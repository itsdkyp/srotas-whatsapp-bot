const sessionManager = require('../whatsapp/sessionManager');
const { MessageMedia, Poll } = require('whatsapp-web.js');
const { messages: messagesDb, campaigns: campaignsDb } = require('../db/database');
const path = require('path');
const fs = require('fs');

let io = null;
const SEND_TIMEOUT_MS = 30000; // 30 second timeout per message

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
 * Send a single message with a timeout to prevent hanging forever.
 */
function sendWithTimeout(client, chatId, content, sendOptions) {
    return Promise.race([
        client.sendMessage(chatId, content, sendOptions),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Message send timed out after 30s')), SEND_TIMEOUT_MS)
        ),
    ]);
}

/**
 * Send messages to a list of contacts with template substitution.
 * Creates a campaign record for analytics tracking.
 * Supports optional media attachment (image/document/audio).
 * If campaignId is provided, resumes/retries into that campaign record.
 */
async function sendBulk(sessionId, contacts, template, options = {}) {
    const campaignId = options.campaignId || null;
    console.log('[BulkSender] Starting campaign:', { sessionId, contactsCount: contacts.length, hasButtons: !!options.buttons, retryOfCampaign: campaignId });

    const client = sessionManager.getClient(sessionId);
    if (!client) {
        console.error('[BulkSender] Client not found for session:', sessionId);
        throw new Error('Session not found or not connected');
    }

    const minDelay = options.minDelay || parseInt(process.env.MIN_DELAY_MS) || 8000;
    const maxDelay = options.maxDelay || parseInt(process.env.MAX_DELAY_MS) || 18000;
    const groupName = options.groupName || '';
    const mediaPath = options.mediaPath || null;
    const mediaPaths = options.mediaPaths || null;
    const buttonsData = options.buttons || null;
    const campaignName = options.name || null;

    // Prepare media files (multiple or single for backward compat)
    const mediaList = [];
    if (mediaPaths && mediaPaths.length > 0) {
        for (const mp of mediaPaths) {
            if (mp && fs.existsSync(mp)) {
                try {
                    mediaList.push(MessageMedia.fromFilePath(mp));
                } catch (err) {
                    console.error('[BulkSender] Failed to load media:', mp, err.message);
                }
            }
        }
    } else if (mediaPath && fs.existsSync(mediaPath)) {
        try {
            mediaList.push(MessageMedia.fromFilePath(mediaPath));
        } catch (err) {
            console.error('[BulkSender] Failed to load media:', err.message);
        }
    }

    // Create campaign record or reuse existing one for retries
    let activeCampaignId;
    if (campaignId) {
        // Retry: update the existing campaign to running and adjust total
        campaignsDb.update(campaignId, { status: 'running', completed_at: null });
        activeCampaignId = campaignId;
    } else {
        activeCampaignId = campaignsDb.create(sessionId, groupName, template, contacts.length, buttonsData, mediaPath, mediaPaths, minDelay, maxDelay, campaignName);
    }

    const results = [];
    let sent = 0;
    let failed = 0;

    try {
        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            console.log(`[BulkSender] Processing contact ${i + 1}/${contacts.length}: ${contact.phone}`);

            // Re-check session is still connected before each send
            const currentClient = sessionManager.getClient(sessionId);
            if (!currentClient) {
                const errMsg = 'Session disconnected during campaign';
                console.error(`[BulkSender] ${errMsg}`);
                // Mark all remaining contacts as failed
                for (let j = i; j < contacts.length; j++) {
                    const c = contacts[j];
                    const renderedMsg = renderTemplate(template, c);
                    failed++;
                    campaignsDb.addMessage(activeCampaignId, c.phone, c.name, 'failed', errMsg, renderedMsg);
                    campaignsDb.incrementFailed(activeCampaignId);
                    if (io) {
                        io.emit('bulk:progress', {
                            campaignId: activeCampaignId, sessionId,
                            current: j + 1, total: contacts.length, sent, failed,
                            lastPhone: c.phone, lastName: c.name, lastStatus: 'failed', error: errMsg,
                        });
                    }
                }
                break;
            }

            let message = renderTemplate(template, contact);
            const phoneStr = String(contact.phone).trim();
            // Remove spaces, parens, and standard visual separators but preserve @g.us / @c.us formats.
            // If they provided a raw group ID (without @g.us), it might break if they format personal numbers with hyphens,
            // so we rely on the backend/UI preserving @g.us or the user including it in CSV for groups.
            const phone = phoneStr.replace(/[^\d@\.\-a-zA-Z\+]/gi, '');
            const chatId = phone.includes('@') ? phone : `${phone.replace(/[\-\+]/g, '')}@c.us`;

            try {
                // ─── Construct Message Payload ───
                if (mediaList.length > 0) {
                    // First media gets the message as caption
                    await sendWithTimeout(currentClient, chatId, mediaList[0], { caption: message });
                    // Additional media sent standalone
                    for (let mi = 1; mi < mediaList.length; mi++) {
                        await sendWithTimeout(currentClient, chatId, mediaList[mi], {});
                    }
                } else {
                    // Text-only message
                    await sendWithTimeout(currentClient, chatId, message, {});
                }

                // Send interactive Poll as clickable buttons (if configured)
                if (buttonsData && buttonsData.length > 0) {
                    const pollOptions = buttonsData.map(b => b.label || b.body || 'Option');
                    const poll = new Poll('Choose an option:', pollOptions);
                    await sendWithTimeout(currentClient, chatId, poll, {});
                }

                messagesDb.add(sessionId, contact.phone, 'out', message, 'sent');
                campaignsDb.addMessage(activeCampaignId, contact.phone, contact.name, 'sent', null, message);
                campaignsDb.incrementSent(activeCampaignId);
                sent++;
                results.push({ phone: contact.phone, status: 'sent', message });

                if (io) {
                    io.emit('bulk:progress', {
                        campaignId: activeCampaignId, sessionId,
                        current: i + 1, total: contacts.length, sent, failed,
                        lastPhone: contact.phone, lastName: contact.name, lastStatus: 'sent',
                    });
                }
            } catch (err) {
                // Build a more descriptive error message
                let errorDetail = err.message || 'Unknown error';
                if (errorDetail.includes('timed out')) {
                    errorDetail = 'Message send timed out — WhatsApp server did not respond within 30s';
                } else if (errorDetail.includes('not registered') || errorDetail.includes('invalid')) {
                    errorDetail = `Invalid WhatsApp number: ${phone} — number is not registered on WhatsApp`;
                } else if (errorDetail.includes('disconnected') || errorDetail.includes('ECONNRESET')) {
                    errorDetail = 'Connection lost — WhatsApp session was disconnected during send';
                }
                console.error(`[BulkSender] Error sending to ${contact.phone}:`, errorDetail);
                failed++;
                results.push({ phone: contact.phone, status: 'failed', error: errorDetail });
                messagesDb.add(sessionId, contact.phone, 'out', message, 'failed');
                campaignsDb.addMessage(activeCampaignId, contact.phone, contact.name, 'failed', errorDetail, message);
                campaignsDb.incrementFailed(activeCampaignId);

                if (io) {
                    io.emit('bulk:progress', {
                        campaignId: activeCampaignId, sessionId,
                        current: i + 1, total: contacts.length, sent, failed,
                        lastPhone: contact.phone, lastName: contact.name,
                        lastStatus: 'failed', error: errorDetail,
                    });
                }
            }

            // Random delay between sends (except after the last message)
            if (i < contacts.length - 1) {
                const delay = Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    } catch (err) {
        // Catch any unexpected errors so campaign doesn't stay "running" forever
        console.error('[BulkSender] Campaign crashed:', err);
        if (io) {
            io.emit('bulk:error', { campaignId: activeCampaignId, sessionId, error: err.message });
        }
    }

    // Mark campaign complete (always runs, even after crash)
    campaignsDb.complete(activeCampaignId);

    if (io) {
        io.emit('bulk:complete', { campaignId: activeCampaignId, sessionId, sent, failed, total: contacts.length });
    }

    return { campaignId: activeCampaignId, sent, failed, total: contacts.length, results };
}

module.exports = { init, sendBulk, renderTemplate };
