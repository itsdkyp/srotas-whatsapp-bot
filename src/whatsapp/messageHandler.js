const { generateReply } = require('../ai/provider');
const { MessageMedia } = require('whatsapp-web.js');
const memory = require('../ai/memory');
const { sessions: sessionDb, quickReplies: quickRepliesDb, campaigns: campaignsDb } = require('../db/database');
const sessionManager = require('./sessionManager');
const fs = require('fs');

/**
 * Check if an incoming message matches a campaign button reply.
 * Returns the button's reply content if matched, null otherwise.
 */
function checkCampaignButtonReply(contactPhone, content) {
    const trimmed = content.trim();

    // Get recent campaigns that have buttons configured
    const campaigns = campaignsDb.getActiveCampaignsWithButtons();

    for (const campaign of campaigns) {
        let buttons;
        try {
            buttons = JSON.parse(campaign.buttons_config);
        } catch (e) { continue; }

        if (!buttons || !buttons.length) continue;

        // Check if this contact was a recipient of this campaign
        const recipients = campaignsDb.getRecentRecipients(campaign.id);
        const phoneClean = contactPhone.replace(/[^0-9]/g, '');
        const isRecipient = recipients.some(r => r.replace(/[^0-9]/g, '') === phoneClean);
        if (!isRecipient) continue;

        // Check if the reply matches a button number or label
        for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            const num = String(i + 1);
            const label = (btn.label || btn.body || '').toLowerCase().trim();

            if (trimmed === num || trimmed.toLowerCase() === label) {
                return btn.reply || btn.body || null;
            }
        }
    }
    return null;
}

function init() {
    // ─── Poll Vote Handler (for clickable campaign buttons) ───
    sessionManager.onVote(async (sessionId, vote) => {
        try {
            // vote has: voter, selectedOptions, parentMessage, etc.
            const voterPhone = vote.voter?.replace('@c.us', '');
            if (!voterPhone) return;

            const selectedOptions = vote.selectedOptions || [];
            if (!selectedOptions.length) return;

            const selectedName = selectedOptions[0]?.name;
            if (!selectedName) return;

            console.log(`[PollVote] ${voterPhone} selected "${selectedName}"`);

            // Find the campaign button that matches this vote
            const campaigns = campaignsDb.getActiveCampaignsWithButtons();
            for (const campaign of campaigns) {
                let buttons;
                try { buttons = JSON.parse(campaign.buttons_config); } catch (e) { continue; }
                if (!buttons || !buttons.length) continue;

                // Check if voter was a recipient
                const recipients = campaignsDb.getRecentRecipients(campaign.id);
                const phoneClean = voterPhone.replace(/[^0-9]/g, '');
                const isRecipient = recipients.some(r => r.replace(/[^0-9]/g, '') === phoneClean);
                if (!isRecipient) continue;

                // Find matching button by label
                const matched = buttons.find(b => {
                    const label = (b.label || b.body || '').trim();
                    return label === selectedName;
                });

                if (matched && matched.reply) {
                    const client = sessionManager.getClient(sessionId);
                    if (!client) continue;
                    const chatId = phoneClean.includes('@c.us') ? phoneClean : `${phoneClean}@c.us`;
                    await client.sendMessage(chatId, matched.reply);
                    console.log(`[PollVote] Sent auto-reply to ${voterPhone} for "${selectedName}"`);
                    return;
                }
            }
        } catch (err) {
            console.error('[PollVote] Error handling vote:', err.message);
        }
    });

    // Listen for incoming messages on all sessions
    sessionManager.onMessage(async (sessionId, msg) => {
        try {
            // Skip group messages, status updates, and own messages
            if (msg.from === 'status@broadcast') return;
            if (msg.fromMe) return;
            if (msg.from.includes('@g.us')) return; // group chat

            const contactPhone = msg.from.replace('@c.us', '');
            const content = msg.body;

            // Store incoming message
            memory.addMessage(contactPhone, 'in', content, sessionId);

            // Get session settings first
            const session = sessionDb.getById(sessionId);
            if (!session) return;

            // ─── Campaign Button Reply Check (highest priority - always works) ───
            const buttonReply = checkCampaignButtonReply(contactPhone, content);
            if (buttonReply) {
                console.log(`[CampaignButton] Match for "${content}" from ${contactPhone} — sending reply`);
                await msg.reply(buttonReply);
                memory.addMessage(contactPhone, 'out', `[Button Reply] ${buttonReply}`, sessionId);
                return;
            }

            // ─── Master Auto-Reply Switch Check ───
            if (!session.auto_reply) {
                console.log(`[AutoReply] Master switch is OFF for session ${sessionId} - skipping all responses`);
                return;
            }

            // ─── Quick Reply Check (only if enabled for this session) ───
            if (session.quick_replies_enabled) {
                const trimmedContent = content.trim().toLowerCase();

                // Fetch all enabled quick replies to check for matches
                const enabledReplies = quickRepliesDb.getEnabled();
                let matchedReply = null;

                // Sort by trigger length (descending) to match longest specific triggers first
                enabledReplies.sort((a, b) => b.trigger_key.length - a.trigger_key.length);

                for (const qr of enabledReplies) {
                    const trigger = qr.trigger_key.toLowerCase().trim();
                    // Check if message contains the trigger as a whole word
                    const regex = new RegExp(`\\b${escapeRegExp(trigger)}\\b`, 'i');
                    if (regex.test(trimmedContent)) {
                        matchedReply = qr;
                        break;
                    }
                }

                if (matchedReply) {
                    console.log(`[QuickReply] Match found for "${matchedReply.trigger_key}" in "${trimmedContent}"`);

                    // Send canned response
                    if (matchedReply.media_path && fs.existsSync(matchedReply.media_path)) {
                        try {
                            const media = MessageMedia.fromFilePath(matchedReply.media_path);
                            await msg.reply(media, undefined, { caption: matchedReply.response });
                        } catch (e) {
                            console.error('[QuickReply] Media send failed:', e.message);
                            await msg.reply(matchedReply.response);
                        }
                    } else {
                        await msg.reply(matchedReply.response);
                    }

                    memory.addMessage(contactPhone, 'out', `[Quick Reply: ${matchedReply.label}] ${matchedReply.response}`, sessionId);
                    console.log(`[QuickReply → ${contactPhone}] Trigger: "${matchedReply.trigger_key}" → Sent: "${matchedReply.label}"`);
                    return; // Don't proceed to AI
                } else {
                    console.log(`[QuickReply] No match found for: "${trimmedContent}"`);
                }
            } else {
                console.log(`[QuickReply] Disabled for session ${sessionId}`);
            }

            // ─── AI Auto-Reply (only if enabled for this session) ───
            if (!session.ai_replies_enabled) {
                console.log(`[AI] Disabled for session ${sessionId}`);
                return;
            }

            // Get conversation history for context
            const history = memory.getHistory(contactPhone, 20);

            // Generate AI reply
            const reply = await generateReply(history, content);

            if (reply && reply.trim()) {
                // Send reply
                await msg.reply(reply.trim());
                // Store outgoing message
                memory.addMessage(contactPhone, 'out', reply.trim(), sessionId);
                console.log(`[AutoReply → ${contactPhone}] ${reply.trim().substring(0, 80)}...`);
            }
        } catch (err) {
            console.error(`[MessageHandler] Error processing message:`, err.message);
        }
    });
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { init };
