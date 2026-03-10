const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const { settings: settingsDb } = require('../db/database');

let geminiModel = null;
let openaiClient = null;
let currentGeminiModelName = null;

function getProvider() {
    return settingsDb.get('ai_provider') || process.env.AI_PROVIDER || 'gemini';
}

function getSystemPrompt() {
    const savedKey = settingsDb.get('license_key');
    const isEasterEgg = savedKey === 'SROTAS-EASTER-EGG-2026';

    const usePrompt = settingsDb.get('ai_use_system_prompt');
    if (usePrompt === '0' || usePrompt === 'false' || usePrompt === false) {
        if (isEasterEgg) return '';
    }
    return settingsDb.get('system_prompt') || process.env.SYSTEM_PROMPT || 'You are a helpful assistant.';
}

function initGemini() {
    const key = settingsDb.get('gemini_api_key') || process.env.GEMINI_API_KEY;
    if (!key) return null;
    const modelName = settingsDb.get('ai_model') || 'gemini-3.1-pro-preview';
    const genAI = new GoogleGenerativeAI(key);
    geminiModel = genAI.getGenerativeModel({ model: modelName });
    currentGeminiModelName = modelName;
    return geminiModel;
}

function initOpenAI() {
    const key = settingsDb.get('openai_api_key') || process.env.OPENAI_API_KEY;
    if (!key) return null;
    openaiClient = new OpenAI({ apiKey: key });
    return openaiClient;
}

async function generateReply(conversationHistory, incomingMessage, mediaData = null) {
    const provider = getProvider();
    const systemPrompt = getSystemPrompt();

    if (provider === 'gemini') {
        return generateGeminiReply(conversationHistory, incomingMessage, systemPrompt, mediaData);
    } else {
        return generateOpenAIReply(conversationHistory, incomingMessage, systemPrompt, mediaData);
    }
}

async function generateGeminiReply(history, incoming, systemPrompt, mediaData) {
    // Re-init if model selection changed
    const selectedModel = settingsDb.get('ai_model') || 'gemini-3.1-pro-preview';
    if (!geminiModel || currentGeminiModelName !== selectedModel) {
        initGemini();
    }
    const model = geminiModel;
    if (!model) throw new Error('Gemini API key not configured');

    // Build conversation context
    const contextMessages = history.map(m =>
        `${m.direction === 'in' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n');

    const promptParts = [];
    if (systemPrompt && systemPrompt.trim()) {
        promptParts.push(systemPrompt);
    }

    if (contextMessages.trim()) {
        promptParts.push(`Previous conversation:\n${contextMessages}`);
    }

    promptParts.push(`User: ${incoming}`);
    promptParts.push('Respond naturally and helpfully. Keep your response concise.');

    const prompt = promptParts.join('\n\n');

    const contentParts = [];
    if (mediaData && mediaData.data && mediaData.mimetype) {
        contentParts.push({
            inlineData: {
                data: mediaData.data,
                mimeType: mediaData.mimetype
            }
        });
    }
    contentParts.push(prompt);

    const result = await model.generateContent(contentParts);
    const response = result.response;
    return response.text();
}

async function generateOpenAIReply(history, incoming, systemPrompt, mediaData) {
    const client = openaiClient || initOpenAI();
    if (!client) throw new Error('OpenAI API key not configured');

    const messages = [];

    if (systemPrompt && systemPrompt.trim()) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    for (const m of history) {
        messages.push({
            role: m.direction === 'in' ? 'user' : 'assistant',
            content: m.content,
        });
    }

    if (mediaData && mediaData.data && mediaData.mimetype && mediaData.mimetype.startsWith('image/')) {
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: incoming },
                { type: 'image_url', image_url: { url: `data:${mediaData.mimetype};base64,${mediaData.data}` } }
            ]
        });
    } else {
        messages.push({ role: 'user', content: incoming });
    }

    const selectedModel = settingsDb.get('ai_model') || 'gpt-5.4';

    const completion = await client.chat.completions.create({
        model: selectedModel,
        messages,
        max_tokens: 500,
    });

    return completion.choices[0].message.content;
}

module.exports = { generateReply, getProvider, getSystemPrompt };
