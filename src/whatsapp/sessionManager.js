const makeWASocket = require('@whiskeysockets/baileys').default;
const {
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    getAggregateVotesInPollMessage,
    Browsers,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const pino = require('pino');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const { sessions: sessionDb, messages: messagesDb, db: rawDb } = require('../db/database');

// ═══════════════════════════════════════
// In-memory state
// ═══════════════════════════════════════

const clients = new Map();            // sessionId → Baileys socket
const sessionStates = new Map();      // sessionId → { status, qr }
const contactStores = new Map();      // sessionId → Map<phone, { phone, name }>
const pollMessageStore = new Map();   // msgKey → { message, createdAt } (for vote decoding)

// Prune pollMessageStore every 30 minutes (remove entries older than 7 days)
setInterval(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [key, entry] of pollMessageStore) {
        if (entry.createdAt < cutoff) pollMessageStore.delete(key);
    }
}, 30 * 60 * 1000);

// Cached Baileys version (refreshed every 24 hours)
let cachedBaileysVersion = null;
let baileysVersionFetchedAt = 0;
const BAILEYS_VERSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

let io = null; // Socket.IO instance — set via init()

// Quiet logger for Baileys internals (reduce noise)
const baileysLogger = pino({ level: 'silent' });

// ═══════════════════════════════════════
// Initialization
// ═══════════════════════════════════════

function init(socketIO) {
    io = socketIO;

    // Restore persisted sessions on startup with a stagger
    const saved = sessionDb.getAll();
    let startupDelayMs = 0;
    for (const s of saved) {
        if (s.status !== 'removed') {
            setTimeout(() => {
                createClient(s.id, s.name);
            }, startupDelayMs);
            startupDelayMs += 2000; // Baileys is fast — shorter stagger than Chromium
        }
    }
}

// ═══════════════════════════════════════
// Auth directory helpers
// ═══════════════════════════════════════

function getAuthDir(sessionId) {
    return process.env.APP_USER_DATA_PATH
        ? path.join(process.env.APP_USER_DATA_PATH, '.wwebjs_auth', `session-${sessionId}`)
        : path.join(__dirname, '..', '..', '.wwebjs_auth', `session-${sessionId}`);
}

// ═══════════════════════════════════════
// Extract text from Baileys message
// ═══════════════════════════════════════

function extractMessageText(msg) {
    const m = msg.message;
    if (!m) return null;

    return m.conversation
        || m.extendedTextMessage?.text
        || m.imageMessage?.caption
        || m.videoMessage?.caption
        || m.documentMessage?.caption
        || m.buttonsResponseMessage?.selectedButtonId
        || m.listResponseMessage?.singleSelectReply?.selectedRowId
        || (m.stickerMessage ? '[Sticker]' : null)
        || (m.imageMessage && !m.imageMessage.caption ? '[Image]' : null)
        || (m.videoMessage && !m.videoMessage.caption ? '[Video]' : null)
        || (m.audioMessage ? '[Audio]' : null)
        || (m.documentMessage && !m.documentMessage.caption ? '[Document]' : null)
        || (m.contactMessage ? '[Contact]' : null)
        || (m.locationMessage ? '[Location]' : null)
        || null;
}

/**
 * Determine message type from Baileys message object.
 */
function getMessageType(msg) {
    const m = msg.message;
    if (!m) return 'unknown';
    if (m.stickerMessage) return 'sticker';
    if (m.imageMessage) return 'image';
    if (m.videoMessage) return 'video';
    if (m.audioMessage) return 'audio';
    if (m.documentMessage) return 'document';
    if (m.contactMessage) return 'contact';
    if (m.locationMessage) return 'location';
    if (m.pollCreationMessage || m.pollCreationMessageV3) return 'poll';
    return 'text';
}

/**
 * Check if a Baileys message contains downloadable media.
 */
function hasMedia(msg) {
    const m = msg.message;
    if (!m) return false;
    return !!(m.imageMessage || m.videoMessage || m.audioMessage || m.documentMessage || m.stickerMessage);
}

// ═══════════════════════════════════════
// Create & manage Baileys sessions
// ═══════════════════════════════════════

async function createClient(sessionId, name, retryCount = 0) {
    const authDir = getAuthDir(sessionId);
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    // Use cached version if available and fresh (avoids GitHub API call on every reconnect)
    if (!cachedBaileysVersion || Date.now() - baileysVersionFetchedAt > BAILEYS_VERSION_TTL) {
        try {
            const { version: fetched } = await fetchLatestBaileysVersion();
            cachedBaileysVersion = fetched;
            baileysVersionFetchedAt = Date.now();
        } catch (e) {
            console.warn('[Baileys] Failed to fetch latest version, using cached or default');
        }
    }
    const version = cachedBaileysVersion || [2, 3000, 1015901307];

    // Initialize per-session contact store
    if (!contactStores.has(sessionId)) {
        contactStores.set(sessionId, new Map());
    }

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        logger: baileysLogger,
        printQRInTerminal: false,
        // Use standard desktop client header to prevent WhatsApp anti-bot systems from revoking linked sessions
        browser: Browsers.macOS('Desktop'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: false,
        // Disable full history sync to prevent downloading thousands of old messages and triggering error 440 rate limits
        syncFullHistory: false,
    });

    const existingState = sessionStates.get(sessionId);
    if (!state.creds?.registered || !existingState || existingState.status !== 'ready') {
        sessionStates.set(sessionId, { status: 'initializing', qr: null });
        if (io) io.emit('session:status', { sessionId, status: 'initializing' });
    }

    // ─── Save credentials on update ───
    sock.ev.on('creds.update', saveCreds);

    // ─── Connection updates (QR, connected, disconnected) ───
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Ignore transient QR emissions during reconnection if credentials are already paired/registered
            if (state.creds?.registered) {
                console.log(`[Session ${name}] Ignoring transient QR emission (session already registered)`);
                return;
            }
            const qrDataUrl = await qrcode.toDataURL(qr, { width: 300 });
            sessionStates.set(sessionId, { status: 'qr_pending', qr: qrDataUrl });
            sessionDb.updateStatus(sessionId, 'qr_pending');
            if (io) io.emit('session:qr', { sessionId, qr: qrDataUrl });
        }

        if (connection === 'open') {
            const phone = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0] || '';
            sessionStates.set(sessionId, { status: 'ready', qr: null });
            sessionDb.updateStatus(sessionId, 'ready');
            sessionDb.updatePhone(sessionId, phone);
            if (io) io.emit('session:ready', { sessionId, phone });
            console.log(`[Session ${name}] Connected — phone: ${phone}`);
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;

            clients.delete(sessionId);

            if (statusCode === DisconnectReason.loggedOut) {
                // User explicitly logged out from their phone — don't reconnect
                sessionStates.set(sessionId, { status: 'disconnected', qr: null });
                sessionDb.updateStatus(sessionId, 'disconnected');
                if (io) io.emit('session:disconnected', { sessionId, reason: 'logged_out' });
                console.log(`[Session ${name}] Logged out from device`);
            } else if (statusCode === DisconnectReason.badSession) {
                // Corrupted session — clear auth
                sessionStates.set(sessionId, { status: 'auth_failure', qr: null });
                sessionDb.updateStatus(sessionId, 'auth_failure');
                if (io) io.emit('session:auth_failure', { sessionId, error: 'bad_session' });
                console.error(`[Session ${name}] Auth failure — bad session`);
            } else {
                // Continuous self-healing auto-reconnect for network drops, timeouts (408), stream restarts (515), or rate limits (440)
                const isStreamRestart = statusCode === 515 || statusCode === 428;
                // Cap backoff at 30 seconds during prolonged internet outages or rate limits
                const delay = isStreamRestart ? 500 : Math.min(3000 * (retryCount + 1), 30000);
                console.log(`[Session ${name}] Disconnected (code ${statusCode}), reconnecting in ${delay}ms (retry #${retryCount + 1})...`);
                if (!isStreamRestart) {
                    sessionStates.set(sessionId, { status: 'reconnecting', qr: null });
                    if (io) io.emit('session:status', { sessionId, status: 'reconnecting' });
                }
                setTimeout(() => createClient(sessionId, name, retryCount + 1), delay);
            }
        }
    });

    // ─── Contacts sync (build in-memory store) ───
    sock.ev.on('contacts.upsert', (contacts) => {
        const store = contactStores.get(sessionId) || new Map();
        for (const c of contacts) {
            if (!c.id) continue;
            const phone = c.id.replace('@s.whatsapp.net', '').split(':')[0];
            store.set(phone, {
                phone,
                name: c.name || c.notify || c.verifiedName || '',
            });
        }
        contactStores.set(sessionId, store);
    });

    sock.ev.on('contacts.update', (updates) => {
        const store = contactStores.get(sessionId) || new Map();
        for (const u of updates) {
            if (!u.id) continue;
            const phone = u.id.replace('@s.whatsapp.net', '').split(':')[0];
            const existing = store.get(phone) || { phone, name: '' };
            if (u.name || u.notify || u.verifiedName) {
                existing.name = u.name || u.notify || u.verifiedName || existing.name;
            }
            store.set(phone, existing);
        }
        contactStores.set(sessionId, store);
    });

    // ─── History sync → store messages in SQLite for AI context ───
    sock.ev.on('messaging-history.set', ({ messages: syncedMessages }) => {
        console.log(`[Session ${name}] Syncing ${syncedMessages.length} historical messages`);

        const insertTx = rawDb.transaction(() => {
            for (const msg of syncedMessages) {
                try {
                    const jid = msg.key.remoteJid;
                    if (!jid || jid === 'status@broadcast' || jid.endsWith('@g.us')) continue;

                    const phone = jid.replace('@s.whatsapp.net', '').split(':')[0];
                    const direction = msg.key.fromMe ? 'out' : 'in';
                    const text = extractMessageText(msg);
                    if (!text) continue;

                    messagesDb.add(sessionId, phone, direction, text, 'synced');
                } catch (e) {
                    // Skip malformed messages silently
                }
            }
        });

        try {
            insertTx();
        } catch (e) {
            console.error(`[Session ${name}] History sync DB error:`, e.message);
        }
    });

    // ─── Real-time messages → route to registered handlers ───
    sock.ev.on('messages.upsert', ({ messages: newMessages, type }) => {
        if (type !== 'notify') return; // Only process real-time messages

        for (const msg of newMessages) {
            for (const handler of _messageHandlers) {
                handler(sessionId, msg, sock);
            }
        }
    });

    // ─── Poll vote updates → route to registered vote handlers ───
    sock.ev.on('messages.update', (updates) => {
        for (const { key, update } of updates) {
            if (!update?.pollUpdates) continue;

            // Decode poll votes
            const pollEntry = pollMessageStore.get(`${key.remoteJid}:${key.id}`);
            if (!pollEntry) continue;
            const pollMsg = pollEntry.message;

            try {
                const votes = getAggregateVotesInPollMessage({
                    message: pollMsg,
                    pollUpdates: update.pollUpdates,
                });

                // Build a vote event similar to whatsapp-web.js format
                for (const vote of votes) {
                    if (!vote.voters || vote.voters.length === 0) continue;
                    for (const voterJid of vote.voters) {
                        const voter = voterJid.replace('@s.whatsapp.net', '').split(':')[0];
                        const voteData = {
                            voter: `${voter}@c.us`, // Keep @c.us format for compatibility with messageHandler
                            selectedOptions: [{ name: vote.name }],
                        };
                        for (const handler of _voteHandlers) {
                            handler(sessionId, voteData);
                        }
                    }
                }
            } catch (e) {
                console.error(`[Session ${name}] Poll vote decode error:`, e.message);
            }
        }
    });

    // Store reference
    clients.set(sessionId, sock);

    return sessionId;
}

// ═══════════════════════════════════════
// Session CRUD
// ═══════════════════════════════════════

async function addSession(name) {
    const sessionId = randomUUID().slice(0, 8);
    sessionDb.create(sessionId, name);
    await createClient(sessionId, name);
    return sessionId;
}

async function removeSession(sessionId) {
    const sock = clients.get(sessionId);
    if (sock) {
        try {
            await sock.logout();
        } catch (e) {
            console.log(`[Session ${sessionId}] logout: ${e.message}`);
            try { sock.end(); } catch (_) { }
        }
        clients.delete(sessionId);
    }
    sessionStates.delete(sessionId);
    contactStores.delete(sessionId);
    sessionDb.delete(sessionId);

    // Clean up auth files
    const authDir = getAuthDir(sessionId);
    if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
    }
}

async function restartSession(sessionId) {
    const dbSession = sessionDb.getAll().find(s => s.id === sessionId);
    if (!dbSession) throw new Error('Session not found');

    // Close existing socket
    const sock = clients.get(sessionId);
    if (sock) {
        try { sock.end(); } catch (e) {
            console.log(`[Session ${sessionId}] end on restart: ${e.message}`);
        }
        clients.delete(sessionId);
    }
    sessionStates.delete(sessionId);

    // Re-create — will reconnect using saved auth keys (no new QR needed)
    await createClient(sessionId, dbSession.name);
}

async function relinkSession(sessionId) {
    const dbSession = sessionDb.getAll().find(s => s.id === sessionId);
    if (!dbSession) throw new Error('Session not found');

    // Close existing socket
    const sock = clients.get(sessionId);
    if (sock) {
        try { sock.end(); } catch (e) {
            console.log(`[Session ${sessionId}] end on relink: ${e.message}`);
        }
        clients.delete(sessionId);
    }
    sessionStates.delete(sessionId);

    // Clear stored auth data so a fresh QR is generated
    const authDir = getAuthDir(sessionId);
    if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
        console.log(`[Session ${sessionId}] Cleared auth data for relink`);
    }

    sessionDb.updateStatus(sessionId, 'initializing');

    // Re-create — will trigger a fresh QR since auth is cleared
    await createClient(sessionId, dbSession.name);
}

// ═══════════════════════════════════════
// WhatsApp Data Retrieval
// ═══════════════════════════════════════

async function getWhatsAppContacts(sessionId) {
    const sock = clients.get(sessionId);
    if (!sock) throw new Error('Session not found or not connected');

    // Return contacts from in-memory store (populated by contacts.upsert events)
    const store = contactStores.get(sessionId) || new Map();
    return Array.from(store.values())
        .filter(c => c.phone && c.phone.length > 4)
        .map(c => ({
            phone: c.phone,
            name: c.name || '',
            company: '',
        }));
}

async function getWhatsAppGroups(sessionId) {
    const sock = clients.get(sessionId);
    if (!sock) throw new Error('Session not found or not connected');

    try {
        const groups = await sock.groupFetchAllParticipating();
        return Object.values(groups).map(g => ({
            id: g.id,
            name: g.subject || g.id,
            participantCount: g.participants ? g.participants.length : 0,
        }));
    } catch (error) {
        console.error(`[Session ${sessionId}] Error fetching groups:`, error.message);
        throw error;
    }
}

async function getGroupParticipants(sessionId, groupId) {
    const sock = clients.get(sessionId);
    if (!sock) throw new Error('Session not found or not connected');

    try {
        const metadata = await sock.groupMetadata(groupId);
        if (!metadata || !metadata.participants) throw new Error('Group not found');

        const store = contactStores.get(sessionId) || new Map();
        return metadata.participants
            .filter(p => p.id.endsWith('@s.whatsapp.net'))
            .map(p => {
                const phone = p.id.replace('@s.whatsapp.net', '').split(':')[0];
                const contact = store.get(phone);
                return {
                    phone,
                    name: contact?.name || phone,
                    company: '',
                };
            });
    } catch (error) {
        console.error(`[Session ${sessionId}] Error fetching group participants:`, error.message);
        throw error;
    }
}

// ═══════════════════════════════════════
// Getters & Setters
// ═══════════════════════════════════════

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
            qr: live ? live.qr : null,
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

// ═══════════════════════════════════════
// Message & Vote Handlers (same pattern as before)
// ═══════════════════════════════════════

const _messageHandlers = [];
const _voteHandlers = [];

function onMessage(handler) {
    _messageHandlers.push(handler);
}

function onVote(handler) {
    _voteHandlers.push(handler);
}

/**
 * Store a sent poll message for later vote decoding.
 * Called by bulkSender after sending a poll.
 */
function storePollMessage(jid, msgId, message) {
    pollMessageStore.set(`${jid}:${msgId}`, { message, createdAt: Date.now() });
}

// ═══════════════════════════════════════
// Exports — same public API as before
// ═══════════════════════════════════════

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
    storePollMessage,
    // Utility exports for other modules
    extractMessageText,
    getMessageType,
    hasMedia,
};
