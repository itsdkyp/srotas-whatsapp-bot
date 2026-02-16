const sessionManager = require('../whatsapp/sessionManager');
const { MessageMedia } = require('whatsapp-web.js');
const { messages: messagesDb, campaigns: campaignsDb } = require('../db/database');
const path = require('path');
const fs = require('fs');

let io = null;

function init(socketIO) {
    io = socketIO;
}

/**
 * Replace template placeholders like {{name}}, {{company}}, {{custom_field}}
 */
function renderTemplate(template, contact) {
    let result = template;
    result = result.replace(/\{\{name\}\}/gi, contact.name || '');
    result = result.replace(/\{\{company\}\}/gi, contact.company || '');
    result = result.replace(/\{\{phone\}\}/gi, contact.phone || '');

    // Replace any custom fields
    const customFields = typeof contact.custom_fields === 'string'
        ? JSON.parse(contact.custom_fields)
        : (contact.custom_fields || {});

    for (const [key, value] of Object.entries(customFields)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
        result = result.replace(regex, value);
    }

    return result;
}

/**
 * Send messages to a list of contacts with template substitution.
 * Creates a campaign record for analytics tracking.
 * Supports optional media attachment (image/document/audio).
 */
async function sendBulk(sessionId, contacts, template, options = {}) {
    const client = sessionManager.getClient(sessionId);
    if (!client) throw new Error('Session not found or not connected');

    const minDelay = options.minDelay || parseInt(process.env.MIN_DELAY_MS) || 3000;
    const maxDelay = options.maxDelay || parseInt(process.env.MAX_DELAY_MS) || 5000;
    const groupName = options.groupName || '';
    const mediaPath = options.mediaPath || null;

    // Prepare media if provided
    let media = null;
    if (mediaPath && fs.existsSync(mediaPath)) {
        try {
            media = MessageMedia.fromFilePath(mediaPath);
        } catch (err) {
            console.error('[BulkSender] Failed to load media:', err.message);
        }
    }

    // Create campaign record
    const campaignId = campaignsDb.create(sessionId, groupName, template, contacts.length);

    const results = [];
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        const message = renderTemplate(template, contact);
        const phone = contact.phone.replace(/[^0-9]/g, '');
        const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;

        try {
            if (media) {
                // Send media with caption
                await client.sendMessage(chatId, media, { caption: message });
            } else {
                await client.sendMessage(chatId, message);
            }
            messagesDb.add(sessionId, contact.phone, 'out', message, 'sent');
            campaignsDb.addMessage(campaignId, contact.phone, contact.name, 'sent', null);
            campaignsDb.incrementSent(campaignId);
            sent++;
            results.push({ phone: contact.phone, status: 'sent', message });

            if (io) {
                io.emit('bulk:progress', {
                    campaignId,
                    sessionId,
                    current: i + 1,
                    total: contacts.length,
                    sent,
                    failed,
                    lastPhone: contact.phone,
                    lastName: contact.name,
                    lastStatus: 'sent',
                });
            }
        } catch (err) {
            failed++;
            results.push({ phone: contact.phone, status: 'failed', error: err.message });
            messagesDb.add(sessionId, contact.phone, 'out', message, 'failed');
            campaignsDb.addMessage(campaignId, contact.phone, contact.name, 'failed', err.message);
            campaignsDb.incrementFailed(campaignId);

            if (io) {
                io.emit('bulk:progress', {
                    campaignId,
                    sessionId,
                    current: i + 1,
                    total: contacts.length,
                    sent,
                    failed,
                    lastPhone: contact.phone,
                    lastName: contact.name,
                    lastStatus: 'failed',
                    error: err.message,
                });
            }
        }

        // Random delay between sends (except after the last message)
        if (i < contacts.length - 1) {
            const delay = Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    // Mark campaign complete
    campaignsDb.complete(campaignId);

    if (io) {
        io.emit('bulk:complete', { campaignId, sessionId, sent, failed, total: contacts.length });
    }

    return { campaignId, sent, failed, total: contacts.length, results };
}

module.exports = { init, sendBulk, renderTemplate };
