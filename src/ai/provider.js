const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const { settings: settingsDb } = require('../db/database');

let geminiModel = null;
let openaiClient = null;

function getProvider() {
    return settingsDb.get('ai_provider') || process.env.AI_PROVIDER || 'gemini';
}

function getSystemPrompt() {
    return settingsDb.get('system_prompt') || process.env.SYSTEM_PROMPT || 'You are a helpful assistant.';
}

function initGemini() {
    const key = settingsDb.get('gemini_api_key') || process.env.GEMINI_API_KEY;
    if (!key) return null;
    const genAI = new GoogleGenerativeAI(key);
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    return geminiModel;
}

function initOpenAI() {
    const key = settingsDb.get('openai_api_key') || process.env.OPENAI_API_KEY;
    if (!key) return null;
    openaiClient = new OpenAI({ apiKey: key });
    return openaiClient;
}

async function generateReply(conversationHistory, incomingMessage) {
    const provider = getProvider();
    const systemPrompt = getSystemPrompt();

    if (provider === 'gemini') {
        return generateGeminiReply(conversationHistory, incomingMessage, systemPrompt);
    } else {
        return generateOpenAIReply(conversationHistory, incomingMessage, systemPrompt);
    }
}

async function generateGeminiReply(history, incoming, systemPrompt) {
    const model = geminiModel || initGemini();
    if (!model) throw new Error('Gemini API key not configured');

    // Build conversation context
    const contextMessages = history.map(m =>
        `${m.direction === 'in' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n');

    const prompt = `${systemPrompt}

Previous conversation:
${contextMessages}

User: ${incoming}

Respond naturally and helpfully. Keep your response concise.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
}

async function generateOpenAIReply(history, incoming, systemPrompt) {
    const client = openaiClient || initOpenAI();
    if (!client) throw new Error('OpenAI API key not configured');

    const messages = [
        { role: 'system', content: systemPrompt },
    ];

    for (const m of history) {
        messages.push({
            role: m.direction === 'in' ? 'user' : 'assistant',
            content: m.content,
        });
    }

    messages.push({ role: 'user', content: incoming });

    const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
    });

    return completion.choices[0].message.content;
}

module.exports = { generateReply, getProvider, getSystemPrompt };
