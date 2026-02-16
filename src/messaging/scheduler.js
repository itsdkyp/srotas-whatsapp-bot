const { contacts: contactsDb, settings: settingsDb } = require('../db/database');
const bulkSender = require('./bulkSender');
const Database = require('better-sqlite3');
const path = require('path');

// We reuse the same DB file
const db = new Database(path.join(__dirname, '..', '..', 'data', 'bot.db'));

// Create schedules table
db.exec(`
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

let io = null;
let timerHandle = null;

function init(socketIO) {
    io = socketIO;
    // Check every 60 seconds for due schedules
    timerHandle = setInterval(checkSchedules, 60 * 1000);
    // Also run once at startup
    setTimeout(checkSchedules, 5000);
    updateAllNextRuns();
}

// ─── CRUD ───

function getAll() {
    return db.prepare('SELECT * FROM schedules ORDER BY created_at DESC').all();
}

function getById(id) {
    return db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
}

function create({ name, sessionId, groupName, template, frequency, dayOfWeek, dayOfMonth, sendTime }) {
    const nextRun = calculateNextRun(frequency, dayOfWeek || 0, dayOfMonth || 1, sendTime || '09:00');
    const result = db.prepare(
        `INSERT INTO schedules (name, session_id, group_name, template, frequency, day_of_week, day_of_month, send_time, next_run)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(name, sessionId, groupName, template, frequency, dayOfWeek || 0, dayOfMonth || 1, sendTime || '09:00', nextRun);
    return result.lastInsertRowid;
}

function update(id, fields) {
    const schedule = getById(id);
    if (!schedule) return;

    const name = fields.name ?? schedule.name;
    const sessionId = fields.sessionId ?? schedule.session_id;
    const groupName = fields.groupName ?? schedule.group_name;
    const template = fields.template ?? schedule.template;
    const frequency = fields.frequency ?? schedule.frequency;
    const dayOfWeek = fields.dayOfWeek ?? schedule.day_of_week;
    const dayOfMonth = fields.dayOfMonth ?? schedule.day_of_month;
    const sendTime = fields.sendTime ?? schedule.send_time;
    const enabled = fields.enabled !== undefined ? (fields.enabled ? 1 : 0) : schedule.enabled;

    const nextRun = calculateNextRun(frequency, dayOfWeek, dayOfMonth, sendTime);

    db.prepare(
        `UPDATE schedules SET name=?, session_id=?, group_name=?, template=?, frequency=?, day_of_week=?, day_of_month=?, send_time=?, enabled=?, next_run=?
     WHERE id=?`
    ).run(name, sessionId, groupName, template, frequency, dayOfWeek, dayOfMonth, sendTime, enabled, nextRun, id);
}

function remove(id) {
    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
}

function toggleEnabled(id, enabled) {
    db.prepare('UPDATE schedules SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
}

// ─── Scheduling Logic ───

function calculateNextRun(frequency, dayOfWeek, dayOfMonth, sendTime) {
    const now = new Date();
    const [hours, minutes] = (sendTime || '09:00').split(':').map(Number);
    let next = new Date();
    next.setHours(hours, minutes, 0, 0);

    if (frequency === 'daily') {
        if (next <= now) next.setDate(next.getDate() + 1);
    } else if (frequency === 'weekly') {
        // dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
        const currentDay = next.getDay();
        let daysUntil = (dayOfWeek - currentDay + 7) % 7;
        if (daysUntil === 0 && next <= now) daysUntil = 7;
        next.setDate(next.getDate() + daysUntil);
    } else if (frequency === 'monthly') {
        next.setDate(dayOfMonth);
        if (next <= now) {
            next.setMonth(next.getMonth() + 1);
            next.setDate(dayOfMonth);
        }
    }

    return next.toISOString();
}

function calculateNextRunAfterExecution(frequency, dayOfWeek, dayOfMonth, sendTime) {
    const [hours, minutes] = (sendTime || '09:00').split(':').map(Number);
    let next = new Date();
    next.setHours(hours, minutes, 0, 0);

    if (frequency === 'daily') {
        next.setDate(next.getDate() + 1);
    } else if (frequency === 'weekly') {
        next.setDate(next.getDate() + 7);
    } else if (frequency === 'monthly') {
        next.setMonth(next.getMonth() + 1);
        next.setDate(dayOfMonth);
    }

    return next.toISOString();
}

function updateAllNextRuns() {
    const schedules = getAll();
    for (const s of schedules) {
        if (s.enabled && (!s.next_run || new Date(s.next_run) < new Date())) {
            const nextRun = calculateNextRun(s.frequency, s.day_of_week, s.day_of_month, s.send_time);
            db.prepare('UPDATE schedules SET next_run = ? WHERE id = ?').run(nextRun, s.id);
        }
    }
}

async function checkSchedules() {
    const now = new Date();
    const schedules = db.prepare('SELECT * FROM schedules WHERE enabled = 1').all();

    for (const s of schedules) {
        if (!s.next_run) continue;
        const nextRun = new Date(s.next_run);

        if (nextRun <= now) {
            console.log(`[Scheduler] Running scheduled job: "${s.name}"`);

            try {
                const contacts = contactsDb.getAll(s.group_name);
                if (contacts.length > 0) {
                    await bulkSender.sendBulk(s.session_id, contacts, s.template);
                    console.log(`[Scheduler] Sent ${contacts.length} messages for "${s.name}"`);
                } else {
                    console.log(`[Scheduler] No contacts in group "${s.group_name}" for "${s.name}"`);
                }
            } catch (err) {
                console.error(`[Scheduler] Error in "${s.name}":`, err.message);
            }

            // Update last_run and next_run
            const newNextRun = calculateNextRunAfterExecution(s.frequency, s.day_of_week, s.day_of_month, s.send_time);
            db.prepare('UPDATE schedules SET last_run = ?, next_run = ? WHERE id = ?')
                .run(now.toISOString(), newNextRun, s.id);

            if (io) {
                io.emit('schedule:executed', { id: s.id, name: s.name, nextRun: newNextRun });
            }
        }
    }
}

function stop() {
    if (timerHandle) clearInterval(timerHandle);
}

module.exports = { init, stop, getAll, getById, create, update, remove, toggleEnabled };
