const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const memory = require('../ai/memory');
const { generateReply } = require('../ai/provider');
const { sessions: sessionDb, quickReplies: quickRepliesDb, campaigns: campaignsDb, autoReplyLogs, settings: settingsDb } = require('../db/database');
const sessionManager = require('./sessionManager');
const fs = require('fs');
const path = require('path');

const lastReplyTimestamps = new Map();

// Fix #13: Prune stale cooldown entries every 15 minutes
setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000; // 10 minutes
    for (const [key, ts] of lastReplyTimestamps) {
        if (ts < cutoff) lastReplyTimestamps.delete(key);
    }
}, 15 * 60 * 1000);

// Fix #24: Mask phone numbers in logs (show first 2 + last 4 digits)
function maskPhone(phone) {
    if (!phone || phone.length < 6) return '***';
    return phone.slice(0, 2) + '****' + phone.slice(-4);
}

// Fix #18: Cached anti-ban settings (refreshed via refreshSettings())
let _cachedSettings = null;
function getAntiBanSettings() {
    if (_cachedSettings) return _cachedSettings;
    return refreshSettings();
}
function refreshSettings() {
    const antiBanEnabled = settingsDb.get('anti_ban_enabled');
    _cachedSettings = {
        enabled: antiBanEnabled === undefined || antiBanEnabled === '1' || antiBanEnabled === 'true' || antiBanEnabled === true,
        ignoreBots: (() => {
            const v = settingsDb.get('anti_ban_ignore_bots');
            return v === undefined || v === '1' || v === 'true' || v === true;
        })(),
        cooldownSec: parseInt(settingsDb.get('anti_ban_cooldown_sec')) || 30,
        typingDelayMin: parseInt(settingsDb.get('anti_ban_typing_delay_min')) || 3,
        typingDelayMax: parseInt(settingsDb.get('anti_ban_typing_delay_max')) || 6,
    };
    return _cachedSettings;
}

async function simulateTypingDelay(sock, jid) {
    const settings = getAntiBanSettings();
    if (!settings.enabled) return;

    const actualMin = Math.min(settings.typingDelayMin, settings.typingDelayMax);
    const actualMax = Math.max(settings.typingDelayMin, settings.typingDelayMax);
    const delayMs = Math.floor(Math.random() * (actualMax - actualMin + 1) + actualMin) * 1000;

    try {
        await sock.presenceSubscribe(jid);
        await sock.sendPresenceUpdate('composing', jid);
        await new Promise(r => setTimeout(r, delayMs));
        await sock.sendPresenceUpdate('paused', jid);
    } catch (e) { /* ignore presence errors */ }
}

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
            // vote has: voter, selectedOptions (compatible format from sessionManager)
            const voterPhone = vote.voter?.replace('@c.us', '');
            if (!voterPhone) return;

            const selectedOptions = vote.selectedOptions || [];
            if (!selectedOptions.length) return;

            const selectedName = selectedOptions[0]?.name;
            if (!selectedName) return;

            console.log(`[PollVote] ${maskPhone(voterPhone)} selected "${selectedName}"`);

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
                    const sock = sessionManager.getClient(sessionId);
                    if (!sock) continue;
                    const chatId = phoneClean.includes('@') ? phoneClean : `${phoneClean}@s.whatsapp.net`;
                    await sock.sendMessage(chatId, { text: matched.reply });
                    console.log(`[PollVote] Sent auto-reply to ${maskPhone(voterPhone)} for "${selectedName}"`);
                    return;
                }
            }
        } catch (err) {
            console.error('[PollVote] Error handling vote:', err.message);
        }
    });

    // ─── Listen for incoming messages on all sessions ───
    sessionManager.onMessage(async (sessionId, msg, sock) => {
        try {
            const jid = msg.key.remoteJid;

            // Skip status broadcasts, own messages, and group messages
            if (!jid) return;
            if (jid === 'status@broadcast') return;
            if (msg.key.fromMe) return;
            if (jid.endsWith('@g.us')) return;

            const contactPhone = jid.replace('@s.whatsapp.net', '').split(':')[0];
            let content = sessionManager.extractMessageText(msg);
            const msgType = sessionManager.getMessageType(msg);

            // Handle stickers and media that might not have text
            let mediaData = null;
            if (sessionManager.hasMedia(msg)) {
                try {
                    // Download media for AI to analyze (stickers, images)
                    if (msgType === 'sticker' || msgType === 'image') {
                        const buffer = await downloadMediaMessage(msg, 'buffer', {});
                        const mimetype = msg.message?.imageMessage?.mimetype
                            || msg.message?.stickerMessage?.mimetype
                            || 'image/jpeg';
                        mediaData = {
                            data: buffer.toString('base64'),
                            mimetype,
                        };
                    }
                } catch (e) {
                    console.error('[MessageHandler] Failed to download media:', e.message);
                }
            }

            if (!content || content.trim() === '') {
                if (msgType === 'sticker') content = '[User sent a Sticker]';
                else if (msgType === 'image') content = '[User sent an Image]';
                else if (msgType === 'video') content = '[User sent a Video]';
                else if (sessionManager.hasMedia(msg)) content = '[User sent Media]';
                else content = '[Unsupported Message]';
            }

            // Store incoming message
            memory.addMessage(contactPhone, 'in', content, sessionId);

            // Record start time for response tracking
            const msgStartTime = Date.now();

            // Get session settings first
            const session = sessionDb.getById(sessionId);
            if (!session) return;

            // ─── Campaign Button Reply Check (highest priority - always works) ───
            const buttonReply = checkCampaignButtonReply(contactPhone, content);
            if (buttonReply) {
                console.log(`[CampaignButton] Match for "${content}" from ${maskPhone(contactPhone)} — sending reply`);
                await sock.sendMessage(jid, { text: buttonReply }, { quoted: msg });
                memory.addMessage(contactPhone, 'out', `[Button Reply] ${buttonReply}`, sessionId);
                return;
            }

            // ─── Master Auto-Reply Switch Check ───
            if (!session.auto_reply) {
                console.log(`[AutoReply] Master switch is OFF for session ${sessionId} - skipping all responses`);
                return;
            }

            // ─── Anti-Ban Checks (Ignore Bots & Cooldowns) ───
            const abSettings = getAntiBanSettings();
            if (abSettings.enabled) {
                if (abSettings.ignoreBots) {
                    if (jid.endsWith('@lid') || jid.includes('broadcast') || contactPhone.length < 10) {
                        console.log(`[AntiBan] Ignored automated system/LID account: ${maskPhone(contactPhone)}`);
                        return;
                    }
                    const lowerContent = content.toLowerCase();
                    const botKeywords = ['to continue, please type', 'welcome to *', 'sbi whatsapp banking', 'domino\'s', 'verification code', 'otp', 'do not reply', 'automated message'];
                    if (botKeywords.some(k => lowerContent.includes(k))) {
                        console.log(`[AntiBan] Ignored message with bot keywords from ${maskPhone(contactPhone)}`);
                        return;
                    }
                }

                const lastTime = lastReplyTimestamps.get(`${sessionId}:${contactPhone}`);
                if (lastTime && Date.now() - lastTime < abSettings.cooldownSec * 1000) {
                    const remaining = Math.ceil((abSettings.cooldownSec * 1000 - (Date.now() - lastTime)) / 1000);
                    console.log(`[AntiBan] Cooldown active for ${maskPhone(contactPhone)} (${remaining}s remaining) — skipping response to prevent loops/spam.`);
                    return;
                }
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

                    // If the trigger contains only word characters, use word boundary \b
                    const isWordCharOnly = /^\w+$/i.test(trigger);

                    let isMatch = false;
                    if (isWordCharOnly) {
                        const regex = new RegExp(`\\b${escapeRegExp(trigger)}\\b`, 'i');
                        isMatch = regex.test(trimmedContent);
                    } else {
                        isMatch = trimmedContent.includes(trigger);
                    }

                    if (isMatch) {
                        matchedReply = qr;
                        break;
                    }
                }

                if (matchedReply) {
                    console.log(`[QuickReply] Match found for "${matchedReply.trigger_key}" in "${trimmedContent}"`);

                    await simulateTypingDelay(sock, jid);

                    // Send canned response
                    if (matchedReply.media_path && fs.existsSync(matchedReply.media_path)) {
                        try {
                            const mediaBuffer = fs.readFileSync(matchedReply.media_path);
                            const ext = path.extname(matchedReply.media_path).toLowerCase();
                            const mimeMap = {
                                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                                '.gif': 'image/gif', '.mp4': 'video/mp4', '.pdf': 'application/pdf',
                                '.doc': 'application/msword', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
                            };
                            const mimetype = mimeMap[ext] || 'application/octet-stream';

                            if (mimetype.startsWith('image/')) {
                                await sock.sendMessage(jid, {
                                    image: mediaBuffer,
                                    caption: matchedReply.response,
                                }, { quoted: msg });
                            } else if (mimetype.startsWith('video/')) {
                                await sock.sendMessage(jid, {
                                    video: mediaBuffer,
                                    caption: matchedReply.response,
                                }, { quoted: msg });
                            } else if (mimetype.startsWith('audio/')) {
                                await sock.sendMessage(jid, { audio: mediaBuffer, mimetype }, { quoted: msg });
                                if (matchedReply.response) {
                                    await sock.sendMessage(jid, { text: matchedReply.response });
                                }
                            } else {
                                await sock.sendMessage(jid, {
                                    document: mediaBuffer,
                                    mimetype,
                                    fileName: path.basename(matchedReply.media_path),
                                    caption: matchedReply.response,
                                }, { quoted: msg });
                            }
                        } catch (e) {
                            console.error('[QuickReply] Media send failed:', e.message);
                            await sock.sendMessage(jid, { text: matchedReply.response }, { quoted: msg });
                        }
                    } else {
                        await sock.sendMessage(jid, { text: matchedReply.response }, { quoted: msg });
                    }

                    lastReplyTimestamps.set(`${sessionId}:${contactPhone}`, Date.now());
                    memory.addMessage(contactPhone, 'out', `[Quick Reply: ${matchedReply.label}] ${matchedReply.response}`, sessionId);
                    console.log(`[QuickReply → ${maskPhone(contactPhone)}] Trigger: "${matchedReply.trigger_key}" → Sent: "${matchedReply.label}"`);

                    // Log quick reply analytics
                    try {
                        autoReplyLogs.add(sessionId, contactPhone, 'quick_reply', matchedReply.trigger_key, Date.now() - msgStartTime);
                    } catch (e) { /* non-critical */ }

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

            // Get conversation history for context (if enabled)
            const chatHistoryEnabled = settingsDb.get('ai_chat_history');
            const useHistory = chatHistoryEnabled === undefined || chatHistoryEnabled === '1' || chatHistoryEnabled === 'true' || chatHistoryEnabled === true;

            // Add typing indicator so user knows AI is thinking
            try {
                await sock.presenceSubscribe(jid);
                await sock.sendPresenceUpdate('composing', jid);
            } catch (e) {
                // ignore
            }

            let history = [];
            if (useHistory) {
                // Use DB-based history (populated by messaging-history.set sync + real-time messages)
                const historyLimit = parseInt(settingsDb.get('ai_chat_history_limit')) || 20;
                history = memory.getHistory(contactPhone, historyLimit);
            }

            // Generate AI reply
            const reply = await generateReply(history, content, mediaData);

            if (reply && reply.trim()) {
                await simulateTypingDelay(sock, jid);

                // Send reply
                await sock.sendMessage(jid, { text: reply.trim() }, { quoted: msg });

                // Clear typing indicator
                try {
                    await sock.sendPresenceUpdate('paused', jid);
                } catch (e) { }

                lastReplyTimestamps.set(`${sessionId}:${contactPhone}`, Date.now());
                // Store outgoing message
                memory.addMessage(contactPhone, 'out', reply.trim(), sessionId);
                console.log(`[AutoReply → ${maskPhone(contactPhone)}] ${reply.trim().substring(0, 80)}...`);

                // Log AI reply analytics
                try {
                    autoReplyLogs.add(sessionId, contactPhone, 'ai', null, Date.now() - msgStartTime, history.length);
                } catch (e) { /* non-critical */ }
            }
        } catch (err) {
            console.error(`[MessageHandler] Error processing message:`, err.message);
        }
    });
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { init, refreshSettings };
