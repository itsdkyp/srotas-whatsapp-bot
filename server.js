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
const license = require('./src/license');
const { sessions: sessionsDb, contacts: contactsDb, groups: groupsDb, campaigns: campaignsDb, settings: settingsDb, messages: messagesDb, quickReplies: quickRepliesDb, templates: templatesDb, autoReplyLogs } = require('./src/db/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Upload directory
const UPLOAD_DIR = process.env.APP_USER_DATA_PATH
    ? path.join(process.env.APP_USER_DATA_PATH, 'uploads')
    : path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });

// Initialize modules
sessionManager.init(io);
bulkSender.init(io);
messageHandler.init();
scheduler.init(io);

// ═══════════════════════════════════════
// API ROUTES — License & Activation
// ═══════════════════════════════════════

app.get('/api/license-status', (req, res) => {
    const activated = license.isActivated();
    if (!activated) return res.json({ activated: false });

    const { settings: settingsDb } = require('./src/db/database');
    const savedKey = settingsDb.get('license_key');
    let expiryDate = null, daysRemaining = null, isLifetime = false;

    if (savedKey === 'SROTAS-EASTER-EGG-2026') {
        isLifetime = true;
    } else if (savedKey) {
        try {
            const cleanKey = savedKey.replace(/-/g, '').toUpperCase();
            const EPOCH = new Date('2024-01-01T00:00:00Z').getTime();
            const daysSinceEpoch = parseInt(cleanKey.slice(0, 4), 16);
            const expiryMs = EPOCH + (daysSinceEpoch + 1) * 24 * 60 * 60 * 1000;
            expiryDate = new Date(expiryMs).toISOString().split('T')[0];
            daysRemaining = Math.max(0, Math.ceil((expiryMs - Date.now()) / (24 * 60 * 60 * 1000)));
        } catch (e) { /* ignore decode errors */ }
    }

    const keyMasked = savedKey
        ? savedKey.replace(/-/g, '').slice(0, 4) + '-****-****-' + savedKey.replace(/-/g, '').slice(-4)
        : null;

    res.json({ activated, isLifetime, expiryDate, daysRemaining, keyMasked });
});

app.post('/api/activate', (req, res) => {
    try {
        const { key } = req.body;
        if (!key) return res.status(400).json({ error: 'License key is required' });

        const result = license.activate(key);
        if (result.success) {
            res.json({ success: true, message: 'Software activated successfully.' });
        } else {
            res.status(400).json({
                error: result.reason === 'License expired'
                    ? 'This license key has expired.'
                    : 'Invalid license key. Please check and try again.'
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Admin: Key Generator (Easter egg only) ───
app.post('/api/admin/generate-key', (req, res) => {
    const { settings: settingsDb } = require('./src/db/database');
    const savedKey = settingsDb.get('license_key');
    if (savedKey !== 'SROTAS-EASTER-EGG-2026') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    const days = parseInt(req.body.days);
    if (!days || days < 1 || days > 9999) {
        return res.status(400).json({ error: 'Invalid duration. Must be 1–9999 days.' });
    }
    try {
        const key = license.generateKey(days);
        const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        // Persist to history
        let history = [];
        try { history = JSON.parse(settingsDb.get('admin_issued_keys') || '[]'); } catch (e) { }
        history.unshift({ key, days, expiryDate, generatedAt: new Date().toISOString() });
        settingsDb.set('admin_issued_keys', JSON.stringify(history.slice(0, 100)));
        res.json({ key, expiryDate, days });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/history', (req, res) => {
    const { settings: settingsDb } = require('./src/db/database');
    const savedKey = settingsDb.get('license_key');
    if (savedKey !== 'SROTAS-EASTER-EGG-2026') return res.status(403).json({ error: 'Forbidden' });
    try { res.json(JSON.parse(settingsDb.get('admin_issued_keys') || '[]')); }
    catch (e) { res.json([]); }
});

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

app.post('/api/sessions/:id/relink', async (req, res) => {
    try {
        await sessionManager.relinkSession(req.params.id);
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

app.put('/api/sessions/:id/ai-replies', (req, res) => {
    try {
        const { enabled } = req.body;
        console.log(`[API] Setting AI replies for session ${req.params.id} to ${enabled}`);
        sessionsDb.setAiReplies(req.params.id, enabled);
        res.json({ success: true });
    } catch (err) {
        console.error('[API] Error setting AI replies:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/sessions/:id/quick-replies', (req, res) => {
    try {
        const { enabled } = req.body;
        console.log(`[API] Setting quick replies for session ${req.params.id} to ${enabled}`);
        sessionsDb.setQuickReplies(req.params.id, enabled);
        res.json({ success: true });
    } catch (err) {
        console.error('[API] Error setting quick replies:', err);
        res.status(500).json({ error: err.message });
    }
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
        const sessionId = req.params.sessionId;
        const state = sessionManager.getSessionState(sessionId);
        console.log('[Sync Contacts] Looked up session:', sessionId, 'Found state:', state);
        if (state.status !== 'ready') {
            return res.status(400).json({ error: `Session is not ready (status: ${state.status}). Please ensure WhatsApp is connected.` });
        }
        const contacts = await sessionManager.getWhatsAppContacts(sessionId);
        res.json(contacts);
    } catch (err) {
        console.error('[Sync Contacts] Error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to sync WhatsApp contacts' });
    }
});

app.get('/api/contacts/wa-groups/:sessionId', async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const state = sessionManager.getSessionState(sessionId);
        if (state.status !== 'ready') {
            return res.status(400).json({ error: `Session is not ready (status: ${state.status}). Please ensure WhatsApp is connected.` });
        }
        const groups = await sessionManager.getWhatsAppGroups(sessionId);
        res.json(groups);
    } catch (err) {
        console.error('[WA Groups] Error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to fetch WhatsApp groups' });
    }
});

app.get('/api/contacts/grab-group/:sessionId/:groupId', async (req, res) => {
    try {
        const { sessionId, groupId } = req.params;
        const state = sessionManager.getSessionState(sessionId);
        if (state.status !== 'ready') {
            return res.status(400).json({ error: `Session is not ready (status: ${state.status}). Please ensure WhatsApp is connected.` });
        }
        const contacts = await sessionManager.getGroupParticipants(sessionId, groupId);
        res.json(contacts);
    } catch (err) {
        console.error('[Grab Group] Error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to grab group contacts' });
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
        const { sessionId, contactIds, group, template, minDelay, maxDelay, mediaPath, mediaPaths, buttons } = req.body;
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
        bulkSender.sendBulk(sessionId, contacts, template, {
            minDelay, maxDelay, groupName: group || '', mediaPath, mediaPaths: mediaPaths || null, buttons: buttons || null, name: req.body.name || null,
        }).catch(err => {
            console.error('[Server] Campaign failed:', err.message);
        });
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
    const campaigns = campaignsDb.getAll();
    const sessions = sessionsDb.getAll();

    // Enrich campaigns with session information
    const enrichedCampaigns = campaigns.map(c => {
        const session = sessions.find(s => s.id === c.session_id);
        return {
            ...c,
            session_name: session ? session.name : 'Unknown',
            session_phone: session ? session.phone : '—'
        };
    });

    res.json(enrichedCampaigns);
});

app.get('/api/campaigns/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const campaign = campaignsDb.getById(id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    const messages = campaignsDb.getMessages(id);
    const errorBreakdown = campaignsDb.getErrorBreakdown(id);

    // Get session information
    const sessions = sessionsDb.getAll();
    const session = sessions.find(s => s.id === campaign.session_id);

    // Calculate duration
    let durationMs = null;
    if (campaign.started_at && campaign.completed_at) {
        durationMs = new Date(campaign.completed_at) - new Date(campaign.started_at);
    }

    res.json({
        ...campaign,
        messages,
        errorBreakdown,
        durationMs,
        session_name: session ? session.name : 'Unknown',
        session_phone: session ? session.phone : '—'
    });
});

app.delete('/api/campaigns/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const campaign = campaignsDb.getById(id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        campaignsDb.deleteWithMessages(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/campaigns/:id/retry', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const campaign = campaignsDb.getById(id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        if (campaign.status === 'running') return res.status(400).json({ error: 'Campaign is already running' });

        const { sessionId } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

        // Get failed messages from this campaign
        const failedMessages = campaignsDb.getFailedMessages(id);
        if (!failedMessages.length) return res.status(400).json({ error: 'No failed messages to retry' });

        // Build contact objects from failed messages
        const contacts = failedMessages.map(m => {
            // Try to find the contact in DB for full data, or use basic info
            const dbContact = contactsDb.getByPhone(m.contact_phone);
            return dbContact || { phone: m.contact_phone, name: m.contact_name || '', company: '', custom_fields: '{}' };
        });

        // Remove old failed records so retry doesn't create duplicates
        campaignsDb.removeFailedMessages(id);
        // Adjust campaign counters: reset failed count and total to reflect retry
        campaignsDb.update(id, {
            failed: 0,
            total: campaign.sent + contacts.length,
        });

        // Parse buttons config from original campaign
        let retryButtons = null;
        if (campaign.buttons_config) {
            try { retryButtons = JSON.parse(campaign.buttons_config); } catch (e) { }
        }

        res.json({ status: 'started', total: contacts.length });
        // Parse media paths from original campaign
        let retryMediaPaths = null;
        if (campaign.media_paths) {
            try { retryMediaPaths = JSON.parse(campaign.media_paths); } catch (e) { }
        }

        bulkSender.sendBulk(sessionId, contacts, campaign.template, {
            groupName: campaign.group_name || '',
            campaignId: id,
            buttons: retryButtons,
            mediaPath: campaign.media_path || null,
            mediaPaths: retryMediaPaths,
            minDelay: campaign.min_delay || 8000,
            maxDelay: campaign.max_delay || 18000,
        }).catch(err => {
            console.error('[Server] Retry campaign failed:', err.message);
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/campaigns/:id/restart', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const campaign = campaignsDb.getById(id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        if (campaign.status === 'running') return res.status(400).json({ error: 'Campaign is already running' });

        const { sessionId } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

        // Get all contacts from the original group
        const contacts = campaign.group_name ? contactsDb.getAll(campaign.group_name) : [];
        if (!contacts.length) return res.status(400).json({ error: 'No contacts found in group' });

        // Parse buttons config from original campaign
        let buttons = null;
        if (campaign.buttons_config) {
            try { buttons = JSON.parse(campaign.buttons_config); } catch (e) { }
        }

        res.json({ status: 'started', total: contacts.length });
        // Parse media paths from original campaign
        let restartMediaPaths = null;
        if (campaign.media_paths) {
            try { restartMediaPaths = JSON.parse(campaign.media_paths); } catch (e) { }
        }

        bulkSender.sendBulk(sessionId, contacts, campaign.template, {
            groupName: campaign.group_name || '',
            buttons,
            mediaPath: campaign.media_path || null,
            mediaPaths: restartMediaPaths,
            minDelay: campaign.min_delay || 8000,
            maxDelay: campaign.max_delay || 18000,
        }).catch(err => {
            console.error('[Server] Restart campaign failed:', err.message);
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════
// API ROUTES — Media Upload
// ═══════════════════════════════════════

const MEDIA_DIR = process.env.APP_USER_DATA_PATH
    ? path.join(process.env.APP_USER_DATA_PATH, 'uploads', 'media')
    : path.join(__dirname, 'uploads', 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

app.post('/api/media/upload', upload.array('media', 10), (req, res) => {
    try {
        if (!req.files || !req.files.length) return res.status(400).json({ error: 'No files uploaded' });

        const files = req.files.map(file => {
            const ext = path.extname(file.originalname) || '';
            const filename = `${file.filename}${ext}`;
            const dest = path.join(MEDIA_DIR, filename);
            fs.renameSync(file.path, dest);
            return {
                path: dest,
                filename: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
            };
        });

        res.json({ success: true, files });
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
// API ROUTES — Message Templates
// ═══════════════════════════════════════

app.get('/api/templates', (req, res) => {
    res.json(templatesDb.getAll());
});

app.post('/api/templates', (req, res) => {
    try {
        const { name, content, mediaPaths, buttons } = req.body;
        if (!name || !content) return res.status(400).json({ error: 'name and content are required' });
        const id = templatesDb.create(name.trim(), content, mediaPaths || null, buttons || null);
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/templates/:id', (req, res) => {
    try {
        const { name, content, mediaPaths, buttons } = req.body;
        templatesDb.update(parseInt(req.params.id), name, content, mediaPaths || null, buttons || null);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/templates/:id', (req, res) => {
    templatesDb.delete(parseInt(req.params.id));
    res.json({ success: true });
});

// ═══════════════════════════════════════
// API ROUTES — Analytics/Dashboard
// ═══════════════════════════════════════

app.get('/api/analytics', (req, res) => {
    try {
        const range = req.query.range || '30days';
        const now = new Date();

        // Get all data
        const allCampaigns = campaignsDb.getAll() || [];
        const allSessions = sessionsDb.getAll() || [];

        console.log('[Analytics] Total campaigns:', allCampaigns.length);
        console.log('[Analytics] Total sessions:', allSessions.length);

        // Filter campaigns by date range
        const filteredCampaigns = allCampaigns.filter(c => {
            if (!c.started_at) return false;
            if (range === 'all') return true;

            const campaignDate = new Date(c.started_at);
            if (range === 'today') {
                return campaignDate.toDateString() === now.toDateString();
            }
            if (range === 'yesterday') {
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                return campaignDate.toDateString() === yesterday.toDateString();
            }
            if (range === '7days') {
                const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
                return campaignDate >= weekAgo;
            }
            if (range === '30days') {
                const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
                return campaignDate >= monthAgo;
            }
            return true;
        });

        console.log('[Analytics] Filtered campaigns:', filteredCampaigns.length);

        // Calculate stats
        const totalSent = filteredCampaigns.reduce((sum, c) => sum + (c.sent || 0), 0);
        const totalFailed = filteredCampaigns.reduce((sum, c) => sum + (c.failed || 0), 0);
        const totalMessages = totalSent + totalFailed;
        const deliveryRate = totalMessages > 0 ? Math.round((totalSent / totalMessages) * 100) : 0;

        // Count unique contacts reached (from sent messages)
        const uniqueContacts = new Set();
        filteredCampaigns.forEach(c => {
            if (c.group_name && c.sent > 0) {
                try {
                    const groupContacts = contactsDb.getAll(c.group_name) || [];
                    // Assume first N contacts were reached (where N = sent count)
                    groupContacts.slice(0, c.sent).forEach(contact => {
                        if (contact.phone) uniqueContacts.add(contact.phone);
                    });
                } catch (err) {
                    console.error('[Analytics] Error counting contacts for group:', c.group_name, err);
                }
            }
        });

        // Count media files sent
        const mediaSent = filteredCampaigns.reduce((sum, c) => {
            const sentCount = c.sent || 0;
            if (!sentCount) return sum;

            if (c.media_paths) {
                try {
                    const paths = JSON.parse(c.media_paths);
                    return sum + (paths.length * sentCount);
                } catch (e) {
                    console.error('[Analytics] Error parsing media_paths:', e);
                }
            } else if (c.media_path) {
                return sum + sentCount;
            }
            return sum;
        }, 0);

        // Messages over time
        const messagesOverTime = generateMessagesOverTime(filteredCampaigns, range);

        // Hourly pattern
        const hourlyPattern = generateHourlyPattern(filteredCampaigns);

        // Top campaigns
        const topCampaigns = filteredCampaigns
            .filter(c => c.sent > 0)
            .sort((a, b) => (b.sent || 0) - (a.sent || 0))
            .slice(0, 5)
            .map(c => ({
                id: c.id,
                name: c.name || `Campaign #${c.id}`,
                date: c.started_at,
                group: c.group_name || 'No group',
                sent: c.sent || 0,
                failed: c.failed || 0
            }));

        // Sessions summary
        const sessions = allSessions.map(s => ({
            name: s.name,
            status: s.status || 'unknown',
            phone: s.phone
        }));

        // Build sinceIso for auto_reply_logs filtering
        let sinceIso = null;
        if (range === 'today') {
            const d = new Date(now);
            d.setHours(0, 0, 0, 0);
            sinceIso = d.toISOString();
        } else if (range === 'yesterday') {
            const d = new Date(now);
            d.setDate(d.getDate() - 1);
            d.setHours(0, 0, 0, 0);
            sinceIso = d.toISOString();
        } else if (range === '7days') {
            sinceIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (range === '30days') {
            sinceIso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
        }
        // 'all' => sinceIso stays null (no date filter)

        // AI & Quick Reply Analytics from real tracking data
        const autoStats = autoReplyLogs.getStats(sinceIso);
        const aiAnalytics = autoStats.ai;
        const quickReplyAnalytics = autoStats.quickReply;

        const response = {
            stats: {
                totalMessages,
                peopleReached: uniqueContacts.size,
                mediaSent,
                deliveryRate,
                messagesChange: 0,
                peopleChange: 0,
                mediaChange: 0,
                deliveryChange: 0
            },
            messagesOverTime,
            hourlyPattern,
            topCampaigns,
            sessions,
            aiAnalytics,
            quickReplyAnalytics
        };

        console.log('[Analytics] Response stats:', response.stats);
        console.log('[Analytics] Top campaigns count:', topCampaigns.length);
        console.log('[Analytics] Sessions count:', sessions.length);

        res.json(response);

    } catch (err) {
        console.error('[Analytics] Error:', err);
        res.status(500).json({
            error: err.message,
            stats: {
                totalMessages: 0,
                peopleReached: 0,
                mediaSent: 0,
                deliveryRate: 0,
                messagesChange: 0,
                peopleChange: 0,
                mediaChange: 0,
                deliveryChange: 0
            },
            messagesOverTime: { labels: [], sent: [], failed: [] },
            hourlyPattern: { labels: [], counts: [] },
            topCampaigns: [],
            sessions: []
        });
    }
});

function generateMessagesOverTime(campaigns, range) {
    const labels = [];
    const sent = [];
    const failed = [];
    const now = new Date();

    if (range === 'today') {
        // Hourly for today (24 hours)
        for (let i = 0; i < 24; i++) {
            const hour = i.toString().padStart(2, '0');
            labels.push(`${hour}:00`);
            sent.push(0);
            failed.push(0);
        }

        campaigns.forEach(c => {
            if (c.started_at) {
                const campaignDate = new Date(c.started_at);
                const isToday = campaignDate.toDateString() === now.toDateString();
                if (isToday) {
                    const hour = campaignDate.getHours();
                    sent[hour] += c.sent || 0;
                    failed[hour] += c.failed || 0;
                }
            }
        });
    } else if (range === 'yesterday') {
        // Hourly for yesterday (24 hours)
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        for (let i = 0; i < 24; i++) {
            const hour = i.toString().padStart(2, '0');
            labels.push(`${hour}:00`);
            sent.push(0);
            failed.push(0);
        }

        campaigns.forEach(c => {
            if (c.started_at) {
                const campaignDate = new Date(c.started_at);
                const isYesterday = campaignDate.toDateString() === yesterday.toDateString();
                if (isYesterday) {
                    const hour = campaignDate.getHours();
                    sent[hour] += c.sent || 0;
                    failed[hour] += c.failed || 0;
                }
            }
        });
    } else if (range === '7days') {
        // Daily for last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
            const label = `${dayName} ${date.getMonth() + 1}/${date.getDate()}`;
            labels.push(label);
            sent.push(0);
            failed.push(0);
        }

        campaigns.forEach(c => {
            if (c.started_at) {
                const campaignDate = new Date(c.started_at);
                const daysDiff = Math.floor((now.getTime() - campaignDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysDiff >= 0 && daysDiff < 7) {
                    const index = 6 - daysDiff;
                    sent[index] += c.sent || 0;
                    failed[index] += c.failed || 0;
                }
            }
        });
    } else if (range === '30days') {
        // Daily for last 30 days (show every 3rd day to avoid clutter)
        for (let i = 29; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const label = `${date.getMonth() + 1}/${date.getDate()}`;
            labels.push(label);
            sent.push(0);
            failed.push(0);
        }

        campaigns.forEach(c => {
            if (c.started_at) {
                const campaignDate = new Date(c.started_at);
                const daysDiff = Math.floor((now.getTime() - campaignDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysDiff >= 0 && daysDiff < 30) {
                    const index = 29 - daysDiff;
                    sent[index] += c.sent || 0;
                    failed[index] += c.failed || 0;
                }
            }
        });
    } else {
        // All time: Group by week for last 12 weeks
        const weeks = 12;
        for (let i = weeks - 1; i >= 0; i--) {
            const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
            const label = `Week ${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
            labels.push(label);
            sent.push(0);
            failed.push(0);
        }

        campaigns.forEach(c => {
            if (c.started_at) {
                const campaignDate = new Date(c.started_at);
                const weeksDiff = Math.floor((now.getTime() - campaignDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
                if (weeksDiff >= 0 && weeksDiff < weeks) {
                    const index = weeks - 1 - weeksDiff;
                    sent[index] += c.sent || 0;
                    failed[index] += c.failed || 0;
                }
            }
        });
    }

    return { labels, sent, failed };
}

function generateHourlyPattern(campaigns) {
    const labels = [];
    const counts = Array(24).fill(0);

    for (let i = 0; i < 24; i++) {
        labels.push(i + 'h');
    }

    campaigns.forEach(c => {
        if (c.started_at) {
            const hour = new Date(c.started_at).getHours();
            counts[hour] += (c.sent || 0) + (c.failed || 0);
        }
    });

    return { labels, counts };
}

// ═══════════════════════════════════════
// API ROUTES — Settings
// ═══════════════════════════════════════

app.get('/api/settings', (req, res) => {
    const all = settingsDb.getAll();
    res.json({
        theme: all.theme || 'dark',
        ai_provider: all.ai_provider || process.env.AI_PROVIDER || 'gemini',
        system_prompt: all.system_prompt || process.env.SYSTEM_PROMPT || 'You are a helpful assistant.',
        min_delay: all.min_delay || process.env.MIN_DELAY_MS || '8000',
        max_delay: all.max_delay || process.env.MAX_DELAY_MS || '18000',
        gemini_api_key: all.gemini_api_key ? '••••••••' : '',
        openai_api_key: all.openai_api_key ? '••••••••' : '',
    });
});

app.put('/api/settings', (req, res) => {
    const allowed = ['theme', 'ai_provider', 'system_prompt', 'min_delay', 'max_delay', 'gemini_api_key', 'openai_api_key'];
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
    const schedules = scheduler.getAll();
    const sessions = sessionsDb.getAll();
    const enriched = schedules.map(s => {
        const session = sessions.find(sess => sess.id === s.session_id);
        return {
            ...s,
            session_name: session ? session.name : 'Unknown Device',
        };
    });
    res.json(enriched);
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
    const actualPort = server.address().port;
    console.log(`SERVER_PORT=${actualPort}`);
    console.log(`\n🤖 Srotas.bot Dashboard running at http://localhost:${actualPort}\n`);
});
