const { generateReply } = require('../ai/provider');
const { MessageMedia } = require('whatsapp-web.js');
const memory = require('../ai/memory');
const { sessions: sessionDb, quickReplies: quickRepliesDb } = require('../db/database');
const sessionManager = require('./sessionManager');
const fs = require('fs');

function init() {
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

            // ─── Quick Reply Check (before AI) ───
            const trimmedContent = content.trim().toLowerCase();
            const quickReply = quickRepliesDb.getByTrigger(trimmedContent);

            if (quickReply) {
                // Send canned response
                if (quickReply.media_path && fs.existsSync(quickReply.media_path)) {
                    try {
                        const media = MessageMedia.fromFilePath(quickReply.media_path);
                        await msg.reply(media, undefined, { caption: quickReply.response });
                    } catch (e) {
                        await msg.reply(quickReply.response);
                    }
                } else {
                    await msg.reply(quickReply.response);
                }
                memory.addMessage(contactPhone, 'out', `[Quick Reply: ${quickReply.label}] ${quickReply.response}`, sessionId);
                console.log(`[QuickReply → ${contactPhone}] Trigger: "${trimmedContent}" → "${quickReply.label}"`);
                return; // Don't proceed to AI
            }

            // ─── AI Auto-Reply ───
            const session = sessionDb.getById(sessionId);
            if (!session || !session.auto_reply) return;

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

module.exports = { init };
