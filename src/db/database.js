const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.APP_USER_DATA_PATH
    ? path.join(process.env.APP_USER_DATA_PATH, 'data')
    : path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'bot.db'));

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'disconnected',
    auto_reply INTEGER DEFAULT 0,
    ai_replies_enabled INTEGER DEFAULT 0,
    quick_replies_enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    name TEXT,
    company TEXT,
    custom_fields TEXT DEFAULT '{}',
    group_name TEXT DEFAULT 'default',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(phone, group_name)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    contact_phone TEXT NOT NULL,
    direction TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    timestamp TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    group_name TEXT,
    template TEXT NOT NULL,
    total INTEGER DEFAULT 0,
    sent INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS campaign_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    contact_phone TEXT NOT NULL,
    contact_name TEXT,
    message_content TEXT,
    status TEXT DEFAULT 'pending',
    error TEXT,
    sent_at TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS quick_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trigger_key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    response TEXT NOT NULL,
    media_path TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS message_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    media_paths TEXT,
    buttons_config TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS auto_reply_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    contact_phone TEXT NOT NULL,
    type TEXT NOT NULL,
    trigger_key TEXT,
    response_time_ms INTEGER,
    timestamp TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    session_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    template TEXT NOT NULL,
    frequency TEXT NOT NULL,
    day_of_week INTEGER DEFAULT 0,
    day_of_month INTEGER DEFAULT 1,
    send_time TEXT NOT NULL DEFAULT '09:00',
    enabled INTEGER DEFAULT 1,
    last_run TEXT,
    next_run TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migrations for existing databases
try {
    db.prepare("SELECT message_content FROM campaign_messages LIMIT 0").get();
} catch (e) {
    db.exec("ALTER TABLE campaign_messages ADD COLUMN message_content TEXT");
}
try {
    db.prepare("SELECT buttons_config FROM campaigns LIMIT 0").get();
} catch (e) {
    db.exec("ALTER TABLE campaigns ADD COLUMN buttons_config TEXT");
}
try {
    db.prepare("SELECT media_path FROM campaigns LIMIT 0").get();
} catch (e) {
    db.exec("ALTER TABLE campaigns ADD COLUMN media_path TEXT");
}
try {
    db.prepare("SELECT media_paths FROM campaigns LIMIT 0").get();
} catch (e) {
    db.exec("ALTER TABLE campaigns ADD COLUMN media_paths TEXT");
}
try {
    db.prepare("SELECT name FROM campaigns LIMIT 0").get();
} catch (e) {
    db.exec("ALTER TABLE campaigns ADD COLUMN name TEXT");
}
try {
    db.prepare("SELECT min_delay FROM campaigns LIMIT 0").get();
} catch (e) {
    db.exec("ALTER TABLE campaigns ADD COLUMN min_delay INTEGER DEFAULT 8000");
}
try {
    db.prepare("SELECT max_delay FROM campaigns LIMIT 0").get();
} catch (e) {
    db.exec("ALTER TABLE campaigns ADD COLUMN max_delay INTEGER DEFAULT 18000");
}

// Add AI and Quick Replies columns to sessions table
try {
    db.prepare("SELECT ai_replies_enabled FROM sessions LIMIT 0").get();
} catch (e) {
    db.exec("ALTER TABLE sessions ADD COLUMN ai_replies_enabled INTEGER DEFAULT 0");
}
try {
    db.prepare("SELECT quick_replies_enabled FROM sessions LIMIT 0").get();
} catch (e) {
    db.exec("ALTER TABLE sessions ADD COLUMN quick_replies_enabled INTEGER DEFAULT 1");
}

// Update existing sessions to have correct defaults (migration for old sessions)
db.exec("UPDATE sessions SET quick_replies_enabled = 1 WHERE quick_replies_enabled IS NULL OR (quick_replies_enabled = 0 AND ai_replies_enabled = 0 AND auto_reply = 0)");

// Fix any campaigns stuck in 'running' from previous crashes
db.exec("UPDATE campaigns SET status = 'completed' WHERE status = 'running' AND started_at < datetime('now', '-1 hour')");

// Seed default group if it doesn't exist
const defaultGroup = db.prepare('SELECT id FROM groups WHERE name = ?').get('default');
if (!defaultGroup) {
    db.prepare("INSERT INTO groups (name, description) VALUES ('default', 'Default contact group')").run();
}

// ─── Helper functions ───

const sessions = {
    getAll: () => db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all(),
    getById: (id) => db.prepare('SELECT * FROM sessions WHERE id = ?').get(id),
    create: (id, name) => db.prepare('INSERT INTO sessions (id, name) VALUES (?, ?)').run(id, name),
    updateStatus: (id, status) => db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run(status, id),
    updatePhone: (id, phone) => db.prepare('UPDATE sessions SET phone = ? WHERE id = ?').run(phone, id),
    setAutoReply: (id, enabled) => db.prepare('UPDATE sessions SET auto_reply = ? WHERE id = ?').run(enabled ? 1 : 0, id),
    setAiReplies: (id, enabled) => db.prepare('UPDATE sessions SET ai_replies_enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id),
    setQuickReplies: (id, enabled) => db.prepare('UPDATE sessions SET quick_replies_enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id),
    delete: (id) => db.prepare('DELETE FROM sessions WHERE id = ?').run(id),
};

const groups = {
    getAll: () => db.prepare('SELECT * FROM groups ORDER BY name').all(),
    getByName: (name) => db.prepare('SELECT * FROM groups WHERE name = ?').get(name),
    create: (name, description) => {
        return db.prepare('INSERT INTO groups (name, description) VALUES (?, ?)').run(name, description || '');
    },
    rename: (id, newName) => {
        const old = db.prepare('SELECT name FROM groups WHERE id = ?').get(id);
        if (old) {
            db.prepare('UPDATE groups SET name = ? WHERE id = ?').run(newName, id);
            db.prepare('UPDATE contacts SET group_name = ? WHERE group_name = ?').run(newName, old.name);
        }
    },
    delete: (id) => {
        const group = db.prepare('SELECT name FROM groups WHERE id = ?').get(id);
        if (group) {
            db.prepare('DELETE FROM contacts WHERE group_name = ?').run(group.name);
            db.prepare('DELETE FROM groups WHERE id = ?').run(id);
        }
    },
};

const contacts = {
    getAll: (groupName) => {
        if (groupName) return db.prepare('SELECT * FROM contacts WHERE group_name = ? ORDER BY name').all(groupName);
        return db.prepare('SELECT * FROM contacts ORDER BY group_name, name').all();
    },
    getById: (id) => db.prepare('SELECT * FROM contacts WHERE id = ?').get(id),
    getByPhone: (phone) => db.prepare('SELECT * FROM contacts WHERE phone = ?').get(phone),
    getGroups: () => db.prepare('SELECT DISTINCT group_name FROM contacts ORDER BY group_name').all().map(r => r.group_name),
    create: (phone, name, company, customFields, groupName) => {
        return db.prepare(
            'INSERT OR REPLACE INTO contacts (phone, name, company, custom_fields, group_name) VALUES (?, ?, ?, ?, ?)'
        ).run(phone, name || '', company || '', JSON.stringify(customFields || {}), groupName || 'default');
    },
    bulkCreate: (contactList, groupName) => {
        const insert = db.prepare(
            'INSERT OR REPLACE INTO contacts (phone, name, company, custom_fields, group_name) VALUES (?, ?, ?, ?, ?)'
        );
        const tx = db.transaction((list) => {
            for (const c of list) {
                insert.run(c.phone, c.name || '', c.company || '', JSON.stringify(c.custom_fields || {}), groupName || 'default');
            }
        });
        tx(contactList);
    },
    delete: (id) => db.prepare('DELETE FROM contacts WHERE id = ?').run(id),
    deleteGroup: (groupName) => db.prepare('DELETE FROM contacts WHERE group_name = ?').run(groupName),
    updateGroup: (id, groupName) => db.prepare('UPDATE contacts SET group_name = ? WHERE id = ?').run(groupName, id),
    search: (query) => db.prepare("SELECT * FROM contacts WHERE name LIKE ? OR phone LIKE ? OR company LIKE ?").all(`%${query}%`, `%${query}%`, `%${query}%`),
};

const campaigns = {
    create: (sessionId, groupName, template, total, buttonsConfig, mediaPath, mediaPaths, minDelay, maxDelay, name) => {
        const r = db.prepare(
            'INSERT INTO campaigns (session_id, group_name, template, total, buttons_config, media_path, media_paths, min_delay, max_delay, name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(sessionId, groupName, template, total, buttonsConfig ? JSON.stringify(buttonsConfig) : null, mediaPath || null, mediaPaths ? JSON.stringify(mediaPaths) : null, minDelay || 8000, maxDelay || 18000, name || `Campaign #${Date.now().toString().slice(-4)}`);
        return r.lastInsertRowid;
    },
    getAll: () => db.prepare('SELECT * FROM campaigns ORDER BY started_at DESC').all(),
    getById: (id) => db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id),
    update: (id, fields) => {
        const sets = [];
        const vals = [];
        for (const [k, v] of Object.entries(fields)) {
            sets.push(`${k} = ?`);
            vals.push(v);
        }
        vals.push(id);
        db.prepare(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    },
    addMessage: (campaignId, phone, name, status, error, messageContent) => {
        db.prepare(
            `INSERT INTO campaign_messages (campaign_id, contact_phone, contact_name, message_content, status, error, sent_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
        ).run(campaignId, phone, name || '', messageContent || null, status, error || null);
    },
    getMessages: (campaignId) => {
        return db.prepare('SELECT * FROM campaign_messages WHERE campaign_id = ? ORDER BY sent_at').all(campaignId);
    },
    incrementSent: (id) => db.prepare('UPDATE campaigns SET sent = sent + 1 WHERE id = ?').run(id),
    incrementFailed: (id) => db.prepare('UPDATE campaigns SET failed = failed + 1 WHERE id = ?').run(id),
    complete: (id) => db.prepare("UPDATE campaigns SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(id),
    getFailedMessages: (campaignId) => {
        return db.prepare("SELECT * FROM campaign_messages WHERE campaign_id = ? AND status = 'failed'").all(campaignId);
    },
    removeFailedMessages: (campaignId) => {
        db.prepare("DELETE FROM campaign_messages WHERE campaign_id = ? AND status = 'failed'").run(campaignId);
    },
    getActiveCampaignsWithButtons: () => {
        return db.prepare(
            "SELECT id, session_id, buttons_config FROM campaigns WHERE buttons_config IS NOT NULL AND status = 'completed' AND completed_at > datetime('now', '-7 days')"
        ).all();
    },
    getRecentRecipients: (campaignId) => {
        return db.prepare(
            "SELECT contact_phone FROM campaign_messages WHERE campaign_id = ? AND status = 'sent'"
        ).all(campaignId).map(r => r.contact_phone);
    },
    getErrorBreakdown: (campaignId) => {
        return db.prepare(
            "SELECT error, COUNT(*) as count FROM campaign_messages WHERE campaign_id = ? AND status = 'failed' AND error IS NOT NULL GROUP BY error ORDER BY count DESC"
        ).all(campaignId);
    },
    deleteWithMessages: (id) => {
        db.prepare('DELETE FROM campaign_messages WHERE campaign_id = ?').run(id);
        db.prepare('DELETE FROM campaigns WHERE id = ?').run(id);
    },
};

const messages = {
    add: (sessionId, contactPhone, direction, content, status) => {
        return db.prepare(
            'INSERT INTO messages (session_id, contact_phone, direction, content, status) VALUES (?, ?, ?, ?, ?)'
        ).run(sessionId, contactPhone, direction, content, status || 'sent');
    },
    getByContact: (contactPhone, limit = 50) => {
        return db.prepare(
            'SELECT * FROM messages WHERE contact_phone = ? ORDER BY timestamp DESC LIMIT ?'
        ).all(contactPhone, limit).reverse();
    },
    getRecent: (limit = 100) => {
        return db.prepare('SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?').all(limit).reverse();
    },
};

const settings = {
    get: (key) => {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        return row ? row.value : null;
    },
    set: (key, value) => {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
    },
    getAll: () => {
        const rows = db.prepare('SELECT * FROM settings').all();
        const obj = {};
        for (const r of rows) obj[r.key] = r.value;
        return obj;
    },
};

const quickReplies = {
    getAll: () => db.prepare('SELECT * FROM quick_replies ORDER BY created_at DESC').all(),
    getEnabled: () => db.prepare('SELECT * FROM quick_replies WHERE enabled = 1 ORDER BY created_at DESC').all(),
    getById: (id) => db.prepare('SELECT * FROM quick_replies WHERE id = ?').get(id),
    getByTrigger: (triggerKey) => db.prepare('SELECT * FROM quick_replies WHERE trigger_key = ? AND enabled = 1').get(triggerKey),
    create: (triggerKey, label, response, mediaPath) => {
        return db.prepare(
            'INSERT INTO quick_replies (trigger_key, label, response, media_path) VALUES (?, ?, ?, ?)'
        ).run(triggerKey, label, response, mediaPath || null);
    },
    update: (id, triggerKey, label, response, mediaPath) => {
        db.prepare(
            'UPDATE quick_replies SET trigger_key = ?, label = ?, response = ?, media_path = ? WHERE id = ?'
        ).run(triggerKey, label, response, mediaPath || null, id);
    },
    delete: (id) => db.prepare('DELETE FROM quick_replies WHERE id = ?').run(id),
    toggleEnabled: (id, enabled) => db.prepare('UPDATE quick_replies SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id),
};

const templates = {
    getAll: () => db.prepare('SELECT * FROM message_templates ORDER BY created_at DESC').all(),
    getById: (id) => db.prepare('SELECT * FROM message_templates WHERE id = ?').get(id),
    create: (name, content, mediaPaths, buttonsConfig) => {
        const r = db.prepare(
            'INSERT INTO message_templates (name, content, media_paths, buttons_config) VALUES (?, ?, ?, ?)'
        ).run(name, content, mediaPaths ? JSON.stringify(mediaPaths) : null, buttonsConfig ? JSON.stringify(buttonsConfig) : null);
        return r.lastInsertRowid;
    },
    update: (id, name, content, mediaPaths, buttonsConfig) => {
        db.prepare(
            'UPDATE message_templates SET name = ?, content = ?, media_paths = ?, buttons_config = ? WHERE id = ?'
        ).run(name, content, mediaPaths ? JSON.stringify(mediaPaths) : null, buttonsConfig ? JSON.stringify(buttonsConfig) : null, id);
    },
    delete: (id) => db.prepare('DELETE FROM message_templates WHERE id = ?').run(id),
};

const autoReplyLogs = {
    add: (sessionId, contactPhone, type, triggerKey, responseTimeMs) => {
        db.prepare(
            'INSERT INTO auto_reply_logs (session_id, contact_phone, type, trigger_key, response_time_ms) VALUES (?, ?, ?, ?, ?)'
        ).run(sessionId || null, contactPhone, type, triggerKey || null, responseTimeMs || null);
    },
    getStats: (sinceIso) => {
        const where = sinceIso ? `WHERE timestamp >= '${sinceIso}'` : '';

        const aiRows = db.prepare(
            `SELECT COUNT(*) as total, COUNT(DISTINCT contact_phone) as unique_users,
             AVG(response_time_ms) as avg_ms
             FROM auto_reply_logs WHERE type = 'ai' ${sinceIso ? `AND timestamp >= '${sinceIso}'` : ''}`
        ).get();

        const qrRows = db.prepare(
            `SELECT COUNT(*) as total, COUNT(DISTINCT contact_phone) as unique_users,
             AVG(response_time_ms) as avg_ms
             FROM auto_reply_logs WHERE type = 'quick_reply' ${sinceIso ? `AND timestamp >= '${sinceIso}'` : ''}`
        ).get();

        const mostUsedRow = db.prepare(
            `SELECT trigger_key, COUNT(*) as cnt FROM auto_reply_logs
             WHERE type = 'quick_reply' AND trigger_key IS NOT NULL
             ${sinceIso ? `AND timestamp >= '${sinceIso}'` : ''}
             GROUP BY trigger_key ORDER BY cnt DESC LIMIT 1`
        ).get();

        // AI conversation count — distinct contacts that had at least one AI reply
        const aiConversations = db.prepare(
            `SELECT COUNT(DISTINCT contact_phone) as cnt FROM auto_reply_logs
             WHERE type = 'ai' ${sinceIso ? `AND timestamp >= '${sinceIso}'` : ''}`
        ).get();

        return {
            ai: {
                totalConversations: aiConversations ? aiConversations.cnt : 0,
                messagesHandled: aiRows ? aiRows.total : 0,
                avgResponseTime: aiRows && aiRows.avg_ms ? Math.round(aiRows.avg_ms / 100) / 10 : 0,
                successRate: 100
            },
            quickReply: {
                totalTriggers: qrRows ? qrRows.total : 0,
                uniqueUsers: qrRows ? qrRows.unique_users : 0,
                avgResponseTime: qrRows && qrRows.avg_ms ? Math.round(qrRows.avg_ms) : 0,
                mostUsed: mostUsedRow ? mostUsedRow.trigger_key : '—'
            }
        };
    }
};

module.exports = { db, sessions, groups, contacts, campaigns, messages, settings, quickReplies, templates, autoReplyLogs };
