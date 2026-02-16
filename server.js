require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const sessionManager = require('./src/whatsapp/sessionManager');
const messageHandler = require('./src/whatsapp/messageHandler');
const bulkSender = require('./src/messaging/bulkSender');
const scheduler = require('./src/messaging/scheduler');
const importer = require('./src/contacts/importer');
const { contacts: contactsDb, groups: groupsDb, campaigns: campaignsDb, settings: settingsDb, messages: messagesDb, quickReplies: quickRepliesDb } = require('./src/db/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Upload directory
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });

// Initialize modules
sessionManager.init(io);
bulkSender.init(io);
messageHandler.init();
scheduler.init(io);

// ═══════════════════════════════════════
// API ROUTES — Sessions
// ═══════════════════════════════════════

app.get('/api/sessions', (req, res) => {
    res.json(sessionManager.listSessions());
});

app.post('/api/sessions', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const sessionId = await sessionManager.addSession(name);
        res.json({ sessionId, name, status: 'initializing' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/sessions/:id', async (req, res) => {
    try {
        await sessionManager.removeSession(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sessions/:id/restart', async (req, res) => {
    try {
        await sessionManager.restartSession(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/sessions/:id/auto-reply', (req, res) => {
    const { enabled } = req.body;
    sessionManager.setAutoReply(req.params.id, enabled);
    res.json({ success: true });
});

// ═══════════════════════════════════════
// API ROUTES — Groups
// ═══════════════════════════════════════

app.get('/api/groups', (req, res) => {
    res.json(groupsDb.getAll());
});

app.post('/api/groups', (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Group name is required' });
        const existing = groupsDb.getByName(name.trim());
        if (existing) return res.status(400).json({ error: 'Group already exists' });
        groupsDb.create(name.trim(), description || '');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/groups/:id', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'New name is required' });
        groupsDb.rename(parseInt(req.params.id), name.trim());
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/groups/:id', (req, res) => {
    try {
        groupsDb.delete(parseInt(req.params.id));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════
// API ROUTES — Contacts
// ═══════════════════════════════════════

app.get('/api/contacts', (req, res) => {
    const { group, search } = req.query;
    if (search) return res.json(contactsDb.search(search));
    res.json(contactsDb.getAll(group));
});

app.get('/api/contacts/groups', (req, res) => {
    res.json(contactsDb.getGroups());
});

app.post('/api/contacts', (req, res) => {
    try {
        const { phone, name, company, group } = req.body;
        if (!phone || !phone.trim()) return res.status(400).json({ error: 'Phone number is required' });
        contactsDb.create(phone.trim(), name || '', company || '', {}, group || 'default');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/contacts/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const result = importer.parseFile(req.file.path);
        result.uploadId = req.file.filename;
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/contacts/import', (req, res) => {
    try {
        const { contacts, group } = req.body;
        if (!contacts || !contacts.length) return res.status(400).json({ error: 'No contacts provided' });
        // Ensure group exists
        const g = group || 'default';
        if (!groupsDb.getByName(g)) {
            groupsDb.create(g, '');
        }
        contactsDb.bulkCreate(contacts, g);
        res.json({ success: true, count: contacts.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/contacts/sync/:sessionId', async (req, res) => {
    try {
        const contacts = await sessionManager.getWhatsAppContacts(req.params.sessionId);
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/contacts/:id', (req, res) => {
    contactsDb.delete(parseInt(req.params.id));
    res.json({ success: true });
});

app.delete('/api/contacts/group/:name', (req, res) => {
    contactsDb.deleteGroup(req.params.name);
    res.json({ success: true });
});

app.post('/api/contacts/move-to-group', (req, res) => {
    try {
        const { contactIds, group, copy } = req.body;
        if (!contactIds || !contactIds.length) return res.status(400).json({ error: 'No contacts selected' });
        if (!group) return res.status(400).json({ error: 'Group name is required' });

        // Ensure group exists
        if (!groupsDb.getByName(group)) {
            groupsDb.create(group, '');
        }

        for (const id of contactIds) {
            const contact = contactsDb.getById(id);
            if (!contact) continue;

            if (copy) {
                // Copy: create a new contact in the target group
                const customFields = typeof contact.custom_fields === 'string'
                    ? JSON.parse(contact.custom_fields || '{}')
                    : (contact.custom_fields || {});
                contactsDb.create(contact.phone, contact.name, contact.company, customFields, group);
            } else {
                // Move: update group_name
                contactsDb.updateGroup(id, group);
            }
        }

        res.json({ success: true, count: contactIds.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════
// API ROUTES — Messaging
// ═══════════════════════════════════════

app.post('/api/messages/send-bulk', async (req, res) => {
    try {
        const { sessionId, contactIds, group, template, minDelay, maxDelay, mediaPath } = req.body;
        if (!sessionId || !template) {
            return res.status(400).json({ error: 'sessionId and template are required' });
        }

        let contacts;
        if (contactIds && contactIds.length) {
            contacts = contactIds.map(id => contactsDb.getById(id)).filter(Boolean);
        } else if (group) {
            contacts = contactsDb.getAll(group);
        } else {
            return res.status(400).json({ error: 'Provide contactIds or group' });
        }

        if (!contacts.length) return res.status(400).json({ error: 'No contacts found' });

        // Start bulk send in background
        res.json({ status: 'started', total: contacts.length });
        bulkSender.sendBulk(sessionId, contacts, template, { minDelay, maxDelay, groupName: group || '', mediaPath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/messages/preview', (req, res) => {
    const { template, contact } = req.body;
    const rendered = bulkSender.renderTemplate(template || '', contact || {});
    res.json({ rendered });
});

app.get('/api/messages', (req, res) => {
    const { phone, limit } = req.query;
    if (phone) return res.json(messagesDb.getByContact(phone, parseInt(limit) || 50));
    res.json(messagesDb.getRecent(parseInt(limit) || 100));
});

// ═══════════════════════════════════════
// API ROUTES — Campaigns
// ═══════════════════════════════════════

app.get('/api/campaigns', (req, res) => {
    res.json(campaignsDb.getAll());
});

app.get('/api/campaigns/:id', (req, res) => {
    const campaign = campaignsDb.getById(parseInt(req.params.id));
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    const messages = campaignsDb.getMessages(parseInt(req.params.id));
    res.json({ ...campaign, messages });
});

// ═══════════════════════════════════════
// API ROUTES — Media Upload
// ═══════════════════════════════════════

const MEDIA_DIR = path.join(__dirname, 'uploads', 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

app.post('/api/media/upload', upload.single('media'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        // Move file to media dir with original extension
        const ext = path.extname(req.file.originalname) || '';
        const filename = `${req.file.filename}${ext}`;
        const dest = path.join(MEDIA_DIR, filename);
        fs.renameSync(req.file.path, dest);

        res.json({
            success: true,
            path: dest,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════
// API ROUTES — Quick Replies
// ═══════════════════════════════════════

app.get('/api/quick-replies', (req, res) => {
    res.json(quickRepliesDb.getAll());
});

app.post('/api/quick-replies', (req, res) => {
    try {
        const { triggerKey, label, response, mediaPath } = req.body;
        if (!triggerKey || !label || !response) {
            return res.status(400).json({ error: 'triggerKey, label, and response are required' });
        }
        quickRepliesDb.create(triggerKey.toLowerCase().trim(), label.trim(), response, mediaPath || null);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/quick-replies/:id', (req, res) => {
    try {
        const { triggerKey, label, response, mediaPath } = req.body;
        quickRepliesDb.update(parseInt(req.params.id), triggerKey, label, response, mediaPath || null);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/quick-replies/:id/toggle', (req, res) => {
    const { enabled } = req.body;
    quickRepliesDb.toggleEnabled(parseInt(req.params.id), enabled);
    res.json({ success: true });
});

app.delete('/api/quick-replies/:id', (req, res) => {
    quickRepliesDb.delete(parseInt(req.params.id));
    res.json({ success: true });
});

// ═══════════════════════════════════════
// API ROUTES — Settings
// ═══════════════════════════════════════

app.get('/api/settings', (req, res) => {
    const all = settingsDb.getAll();
    res.json({
        ai_provider: all.ai_provider || process.env.AI_PROVIDER || 'gemini',
        system_prompt: all.system_prompt || process.env.SYSTEM_PROMPT || 'You are a helpful assistant.',
        min_delay: all.min_delay || process.env.MIN_DELAY_MS || '3000',
        max_delay: all.max_delay || process.env.MAX_DELAY_MS || '5000',
        gemini_api_key: all.gemini_api_key ? '••••••••' : '',
        openai_api_key: all.openai_api_key ? '••••••••' : '',
    });
});

app.put('/api/settings', (req, res) => {
    const allowed = ['ai_provider', 'system_prompt', 'min_delay', 'max_delay', 'gemini_api_key', 'openai_api_key'];
    for (const key of allowed) {
        if (req.body[key] !== undefined && req.body[key] !== '••••••••') {
            settingsDb.set(key, req.body[key]);
        }
    }
    res.json({ success: true });
});

// ═══════════════════════════════════════
// API ROUTES — Scheduler
// ═══════════════════════════════════════

app.get('/api/schedules', (req, res) => {
    res.json(scheduler.getAll());
});

app.post('/api/schedules', (req, res) => {
    try {
        const { name, sessionId, groupName, template, frequency, dayOfWeek, dayOfMonth, sendTime } = req.body;
        if (!name || !sessionId || !groupName || !template || !frequency) {
            return res.status(400).json({ error: 'name, sessionId, groupName, template, and frequency are required' });
        }
        const id = scheduler.create({ name, sessionId, groupName, template, frequency, dayOfWeek, dayOfMonth, sendTime });
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/schedules/:id', (req, res) => {
    try {
        scheduler.update(parseInt(req.params.id), req.body);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/schedules/:id/toggle', (req, res) => {
    const { enabled } = req.body;
    scheduler.toggleEnabled(parseInt(req.params.id), enabled);
    res.json({ success: true });
});

app.delete('/api/schedules/:id', (req, res) => {
    scheduler.remove(parseInt(req.params.id));
    res.json({ success: true });
});

// ═══════════════════════════════════════
// Socket.IO connection
// ═══════════════════════════════════════

io.on('connection', (socket) => {
    console.log('Dashboard connected');
    socket.on('disconnect', () => console.log('Dashboard disconnected'));
});

// ═══════════════════════════════════════
// Start server
// ═══════════════════════════════════════

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🤖 Srotas.bot Dashboard running at http://localhost:${PORT}\n`);
});
