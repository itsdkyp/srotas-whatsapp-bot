const { messages: messagesDb } = require('../db/database');

/**
 * Add a message to the conversation memory
 */
function addMessage(contactPhone, direction, content, sessionId) {
    messagesDb.add(sessionId || null, contactPhone, direction, content, 'sent');
}

/**
 * Get conversation history for a contact (most recent N messages)
 */
function getHistory(contactPhone, limit = 20) {
    return messagesDb.getByContact(contactPhone, limit);
}

module.exports = { addMessage, getHistory };
