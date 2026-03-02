const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const { sessions: sessionDb } = require('../db/database');

// In-memory map of active WhatsApp clients
const clients = new Map();          // sessionId → Client
const sessionStates = new Map();    // sessionId → { status, qr }

let io = null; // Socket.IO instance — set via init()

function init(socketIO) {
    io = socketIO;

    // Restore persisted sessions on startup
    const saved = sessionDb.getAll();
    for (const s of saved) {
        if (s.status !== 'removed') {
            createClient(s.id, s.name);
        }
    }
}

/**
 * Kill any stale Puppeteer SingletonLock for a session so re-init can proceed.
 */
function cleanStaleLocks(sessionId) {
    const authDir = process.env.APP_USER_DATA_PATH
        ? path.join(process.env.APP_USER_DATA_PATH, '.wwebjs_auth', `session-${sessionId}`)
        : path.join(__dirname, '..', '..', '.wwebjs_auth', `session-${sessionId}`);
    if (!fs.existsSync(authDir)) return;

    const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
    for (const lock of lockFiles) {
        const lockPath = path.join(authDir, lock);
        try {
            if (fs.existsSync(lockPath)) {
                fs.unlinkSync(lockPath);
                console.log(`[Session ${sessionId}] Removed stale lock: ${lock}`);
            }
        } catch (e) {
            // Ignore — best effort
        }
    }
}

function createClient(sessionId, name, retryCount = 0) {
    // Clean stale locks before (re)initializing
    cleanStaleLocks(sessionId);

    let executablePath = undefined;

    // When packaged in Electron on Windows, puppeteer might struggle to find Chrome.
    // We try to find a local installation.
    if (process.env.ELECTRON_RUN_AS_NODE) {
        try {
            const chromePaths = require('chrome-paths');
            executablePath = chromePaths.chrome || chromePaths.chromium;
            console.log(`[Session ${sessionId}] Running in Electron, setting Chrome path to: ${executablePath}`);
        } catch (err) {
            console.warn(`[Session ${sessionId}] Could not resolve Chrome path automatically in Electron.`);
        }
    }

    const authStrategy = new LocalAuth({
        clientId: sessionId,
        dataPath: process.env.APP_USER_DATA_PATH
            ? path.join(process.env.APP_USER_DATA_PATH, '.wwebjs_auth')
            : undefined
    });

    const client = new Client({
        authStrategy,
        puppeteer: {
            executablePath,
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--no-zygote',                 // Prevents crashes in Docker post-QR-auth
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
            ],
        },
    });

    sessionStates.set(sessionId, { status: 'initializing', qr: null });

    client.on('qr', async (qr) => {
        const qrDataUrl = await qrcode.toDataURL(qr, { width: 300 });
        sessionStates.set(sessionId, { status: 'qr_pending', qr: qrDataUrl });
        sessionDb.updateStatus(sessionId, 'qr_pending');
        if (io) io.emit('session:qr', { sessionId, qr: qrDataUrl });
    });

    client.on('ready', async () => {
        const info = client.info;
        const phone = info?.wid?.user || '';
        sessionStates.set(sessionId, { status: 'ready', qr: null });
        sessionDb.updateStatus(sessionId, 'ready');
        sessionDb.updatePhone(sessionId, phone);
        if (io) io.emit('session:ready', { sessionId, phone });
        console.log(`[Session ${name}] Connected — phone: ${phone}`);
    });

    client.on('authenticated', () => {
        console.log(`[Session ${name}] Authenticated`);
    });

    client.on('auth_failure', (msg) => {
        sessionStates.set(sessionId, { status: 'auth_failure', qr: null });
        sessionDb.updateStatus(sessionId, 'auth_failure');
        if (io) io.emit('session:auth_failure', { sessionId, error: msg });
        console.error(`[Session ${name}] Auth failure:`, msg);
    });

    client.on('disconnected', (reason) => {
        sessionStates.set(sessionId, { status: 'disconnected', qr: null });
        sessionDb.updateStatus(sessionId, 'disconnected');
        if (io) io.emit('session:disconnected', { sessionId, reason });
        console.log(`[Session ${name}] Disconnected:`, reason);
    });

    clients.set(sessionId, client);
    client.initialize().catch((err) => {
        console.error(`[Session ${name}] Init error:`, err.message);

        // Auto-retry once after cleaning locks
        if (retryCount < 1) {
            console.log(`[Session ${name}] Retrying initialization...`);
            try { client.destroy().catch(() => { }); } catch (e) { }
            clients.delete(sessionId);
            setTimeout(() => createClient(sessionId, name, retryCount + 1), 3000);
            return;
        }

        sessionStates.set(sessionId, { status: 'error', qr: null });
        sessionDb.updateStatus(sessionId, 'error');
    });

    return sessionId;
}

async function addSession(name) {
    const sessionId = randomUUID().slice(0, 8);
    sessionDb.create(sessionId, name);
    createClient(sessionId, name);
    return sessionId;
}

async function removeSession(sessionId) {
    const client = clients.get(sessionId);
    if (client) {
        try {
            // Timeout destroy to avoid hanging on uninitialized sessions
            await Promise.race([
                client.destroy(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('destroy timeout')), 5000))
            ]);
        } catch (e) {
            console.log(`[Session ${sessionId}] destroy: ${e.message}`);
        }
        clients.delete(sessionId);
    }
    sessionStates.delete(sessionId);
    sessionDb.delete(sessionId);
}

async function restartSession(sessionId) {
    const dbSession = sessionDb.getAll().find(s => s.id === sessionId);
    if (!dbSession) throw new Error('Session not found');

    // Destroy existing client if any
    const client = clients.get(sessionId);
    if (client) {
        try {
            await Promise.race([
                client.destroy(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('destroy timeout')), 5000))
            ]);
        } catch (e) {
            console.log(`[Session ${sessionId}] destroy on restart: ${e.message}`);
        }
        clients.delete(sessionId);
    }
    sessionStates.delete(sessionId);

    // Re-create
    createClient(sessionId, dbSession.name);
}

async function relinkSession(sessionId) {
    const dbSession = sessionDb.getAll().find(s => s.id === sessionId);
    if (!dbSession) throw new Error('Session not found');

    // Destroy existing client
    const client = clients.get(sessionId);
    if (client) {
        try {
            await Promise.race([
                client.destroy(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('destroy timeout')), 5000))
            ]);
        } catch (e) {
            console.log(`[Session ${sessionId}] destroy on relink: ${e.message}`);
        }
        clients.delete(sessionId);
    }
    sessionStates.delete(sessionId);

    // Clear stored auth data so a fresh QR is generated
    const authDir = process.env.APP_USER_DATA_PATH
        ? path.join(process.env.APP_USER_DATA_PATH, '.wwebjs_auth', `session-${sessionId}`)
        : path.join(__dirname, '..', '..', '.wwebjs_auth', `session-${sessionId}`);
    if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
        console.log(`[Session ${sessionId}] Cleared auth data for relink`);
    }

    sessionDb.updateStatus(sessionId, 'initializing');

    // Re-create — will trigger a fresh QR since auth is cleared
    createClient(sessionId, dbSession.name);
}

async function getWhatsAppContacts(sessionId) {
    const client = clients.get(sessionId);
    if (!client) throw new Error('Session not found or not connected');

    const waContacts = await client.getContacts();
    return waContacts
        .filter(c => c.isMyContact && c.id && c.id.server === 'c.us')
        .map(c => ({
            phone: c.id.user,
            name: c.name || c.pushname || '',
            company: '',
        }));
}

async function getWhatsAppGroups(sessionId) {
    const client = clients.get(sessionId);
    if (!client) throw new Error('Session not found or not connected');

    const chats = await client.getChats();
    return chats
        .filter(c => c.isGroup)
        .map(c => ({
            id: c.id._serialized,
            name: c.name,
            participantCount: c.participants ? c.participants.length : 0,
        }));
}

async function getGroupParticipants(sessionId, groupId) {
    const client = clients.get(sessionId);
    if (!client) throw new Error('Session not found or not connected');

    const chat = await client.getChatById(groupId);
    if (!chat || !chat.isGroup) throw new Error('Group not found');

    const participants = chat.participants || [];
    const contacts = [];

    for (const p of participants) {
        try {
            const contact = await client.getContactById(p.id._serialized);
            if (contact && p.id.server === 'c.us') {
                // Prioritize: pushname (their WA display name) > saved name > shortName > phone number
                const name = contact.pushname || contact.name || contact.shortName || p.id.user || '';
                contacts.push({
                    phone: p.id.user,
                    name,
                    company: '',
                });
            }
        } catch (e) {
            // If we can't get contact details, use basic info
            if (p.id.server === 'c.us') {
                contacts.push({
                    phone: p.id.user,
                    name: p.id.user,
                    company: '',
                });
            }
        }
    }

    return contacts;
}

function getClient(sessionId) {
    return clients.get(sessionId) || null;
}

function listSessions() {
    const dbSessions = sessionDb.getAll();
    return dbSessions.map((s) => {
        const live = sessionStates.get(s.id);
        return {
            ...s,
            status: live ? live.status : s.status,
            auto_reply: !!s.auto_reply,
        };
    });
}

function getSessionState(sessionId) {
    return sessionStates.get(sessionId) || { status: 'unknown', qr: null };
}

function setAutoReply(sessionId, enabled) {
    sessionDb.setAutoReply(sessionId, enabled);
}

function onMessage(handler) {
    // Attach handler to all current and future clients
    for (const [sid, client] of clients) {
        client.on('message', (msg) => handler(sid, msg));
    }
    // Store handler so new clients also get it
    _messageHandlers.push(handler);
}

function onVote(handler) {
    // Attach vote handler to all current and future clients
    for (const [sid, client] of clients) {
        client.on('vote_update', (vote) => handler(sid, vote));
    }
    _voteHandlers.push(handler);
}

const _messageHandlers = [];
const _voteHandlers = [];

// Monkey-patch: wrap so each new client gets existing handlers
(function patchCreateClient() {
    const origSet = clients.set.bind(clients);
    clients.set = function (id, client) {
        origSet(id, client);
        for (const h of _messageHandlers) {
            client.on('message', (msg) => h(id, msg));
        }
        for (const h of _voteHandlers) {
            client.on('vote_update', (vote) => h(id, vote));
        }
    };
})();

module.exports = {
    init,
    addSession,
    removeSession,
    restartSession,
    relinkSession,
    getClient,
    listSessions,
    getSessionState,
    setAutoReply,
    getWhatsAppContacts,
    getWhatsAppGroups,
    getGroupParticipants,
    onMessage,
    onVote,
};
