const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Setup test environment variables before requiring the app
process.env.NODE_ENV = 'test';
process.env.APP_USER_DATA_PATH = path.join(__dirname, 'test_data');
process.env.PORT = '0'; // random port or none

// Mock complex sub-systems to focus on API and DB layers
jest.mock('../src/whatsapp/sessionManager', () => ({
    init: jest.fn(),
    addSession: jest.fn().mockResolvedValue('mock-session-id'),
    removeSession: jest.fn().mockResolvedValue(true),
    restartSession: jest.fn().mockResolvedValue(true),
    relinkSession: jest.fn().mockResolvedValue(true),
    setAutoReply: jest.fn(),
    listSessions: jest.fn().mockReturnValue([{ id: 'mock-session-id', name: 'Mock Device', status: 'ready', phone: '12345' }]),
    getSessionState: jest.fn().mockReturnValue({ status: 'ready', qr: null }),
    getWhatsAppContacts: jest.fn().mockResolvedValue([{ phone: '111', name: 'Test WA Contact', company: '' }]),
    getWhatsAppGroups: jest.fn().mockResolvedValue([{ id: 'g1', name: 'Test WA Group', participantCount: 5 }]),
    getGroupParticipants: jest.fn().mockResolvedValue([{ phone: '222', name: 'Test Member', company: '' }]),
    onMessage: jest.fn(),
    onVote: jest.fn()
}));

jest.mock('../src/messaging/bulkSender', () => ({
    init: jest.fn(),
    sendBulk: jest.fn().mockResolvedValue(true),
    renderTemplate: jest.fn().mockReturnValue('Mock rendered text')
}));

jest.mock('../src/messaging/scheduler', () => ({
    init: jest.fn(),
    getAll: jest.fn().mockReturnValue([]),
    create: jest.fn().mockReturnValue(1),
    update: jest.fn(),
    toggleEnabled: jest.fn(),
    remove: jest.fn()
}));

const app = require('../server');
const db = require('../src/db/database');

describe('API Routes', () => {

    beforeAll(() => {
        // Clear DB tables for a clean slate
        try {
            const Database = require('better-sqlite3');
            const d = new Database(path.join(process.env.APP_USER_DATA_PATH, 'data', 'bot.db'));
            d.exec(`
                DELETE FROM sessions;
                DELETE FROM groups;
                DELETE FROM contacts;
                DELETE FROM campaigns;
                DELETE FROM templates;
                DELETE FROM quick_replies;
                DELETE FROM settings;
            `);
            d.close();
        } catch (e) {
            console.error('Failed to clean DB', e);
        }
    });

    afterAll(() => {
        // Clean up test data directory
        try {
            fs.rmSync(process.env.APP_USER_DATA_PATH, { recursive: true, force: true });
        } catch (e) { }
    });

    describe('Settings API', () => {
        it('GET /api/settings should return default settings', async () => {
            const res = await request(app).get('/api/settings');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('theme');
            expect(res.body).toHaveProperty('ai_provider');
            expect(res.body).toHaveProperty('system_prompt');
            // Ensure the detailed prompt is returned
            expect(res.body.system_prompt).toContain('Business Name');
        });

        it('PUT /api/settings should update settings', async () => {
            const res = await request(app)
                .put('/api/settings')
                .send({ theme: 'light', ai_provider: 'openai' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);

            // Verify
            const getRes = await request(app).get('/api/settings');
            expect(getRes.body.theme).toBe('light');
            expect(getRes.body.ai_provider).toBe('openai');
        });
    });

    describe('Groups API', () => {
        it('POST /api/groups should create a new group', async () => {
            const res = await request(app)
                .post('/api/groups')
                .send({ name: 'Test Group', description: 'Test Desc' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('GET /api/groups should list groups', async () => {
            const res = await request(app).get('/api/groups');
            expect(res.statusCode).toEqual(200);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
            expect(res.body[0].name).toBe('Test Group');
        });
    });

    describe('Contacts API', () => {
        it('POST /api/contacts should create a contact', async () => {
            const res = await request(app)
                .post('/api/contacts')
                .send({ phone: '9876543210', name: 'John', company: 'Acme', group: 'Test Group' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });

        it('GET /api/contacts should list contacts', async () => {
            const res = await request(app).get('/api/contacts');
            expect(res.statusCode).toEqual(200);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
            expect(res.body[0].phone).toBe('9876543210');
        });
    });

    describe('Templates API', () => {
        let templateId;

        it('POST /api/templates should create a template', async () => {
            const res = await request(app)
                .post('/api/templates')
                .send({ name: 'Welcome', content: 'Hello {{name}}' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body).toHaveProperty('id');
            templateId = res.body.id;
        });

        it('GET /api/templates should list templates', async () => {
            const res = await request(app).get('/api/templates');
            expect(res.statusCode).toEqual(200);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
            expect(res.body[0].name).toBe('Welcome');
        });

        it('DELETE /api/templates/:id should remove template', async () => {
            const res = await request(app).delete(`/api/templates/${templateId}`);
            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Sessions API (Mocked)', () => {
        it('GET /api/sessions should return mocked sessions', async () => {
            const res = await request(app).get('/api/sessions');
            expect(res.statusCode).toEqual(200);
            expect(res.body[0].name).toBe('Mock Device');
        });

        it('POST /api/sessions should call sessionManager', async () => {
            const res = await request(app).post('/api/sessions').send({ name: 'New Device' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.sessionId).toBe('mock-session-id');
        });
    });

    describe('Messaging & Campaigns', () => {
        it('POST /api/messages/preview should render template', async () => {
            const res = await request(app).post('/api/messages/preview').send({ template: 'Hi' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.rendered).toBe('Mock rendered text');
        });

        it('GET /api/analytics should return valid structure', async () => {
            const res = await request(app).get('/api/analytics');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('stats');
            expect(res.body).toHaveProperty('messagesOverTime');
            expect(res.body).toHaveProperty('topCampaigns');
        });
    });
});
