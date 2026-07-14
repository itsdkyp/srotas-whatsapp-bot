const { EventEmitter } = require('events');

// Fake Baileys module for exercising the contact/group sync paths specifically
// (separate from sessionManager.race.test.js, which focuses on socket
// teardown/reconnect races). No contacts/chats are pre-populated on the mock
// socket, so every test naturally exercises the resyncAppState-and-wait
// fallback path in enrichContactStore's callers.
const createdSockets = [];
const mockMakeWASocket = jest.fn(() => {
    const sock = new EventEmitter();
    sock.end = jest.fn();
    sock.logout = jest.fn();
    sock.user = { id: '910000000000:1@s.whatsapp.net' };
    sock.ev = sock;
    sock.contacts = {};
    sock.resyncAppState = jest.fn(async () => {});
    sock.groupFetchAllParticipating = jest.fn(async () => ({}));
    sock.groupMetadata = jest.fn(async (groupId) => ({
        id: groupId,
        participants: [
            { id: '911111111111@s.whatsapp.net' },
            { id: '922222222222@s.whatsapp.net' },
        ],
    }));
    createdSockets.push(sock);
    return sock;
});

jest.mock('@whiskeysockets/baileys', () => ({
    __esModule: true,
    default: (...args) => mockMakeWASocket(...args),
    useMultiFileAuthState: jest.fn(async () => ({
        state: { creds: { registered: true }, keys: {} },
        saveCreds: jest.fn(),
    })),
    DisconnectReason: { loggedOut: 401, badSession: 500 },
    makeCacheableSignalKeyStore: (keys) => keys,
    fetchLatestBaileysVersion: jest.fn(async () => ({ version: [2, 3000, 0] })),
    getAggregateVotesInPollMessage: jest.fn(),
    Browsers: { macOS: () => ['Srotas', 'Desktop', '1.0'] },
}));

jest.mock('qrcode', () => ({ toDataURL: jest.fn(async () => 'data:image/png;base64,x') }));

jest.mock('../src/db/database', () => ({
    sessions: {
        getAll: jest.fn(() => [{ id: 'sess1', name: 'Test Session' }]),
        create: jest.fn(),
        delete: jest.fn(),
        updateStatus: jest.fn(),
        updatePhone: jest.fn(),
    },
    messages: { add: jest.fn(), cleanup: jest.fn() },
    waContacts: {
        getBySession: jest.fn(() => []),
        upsertMany: jest.fn(),
        deleteBySession: jest.fn(),
    },
    db: {
        transaction: (fn) => fn,
        prepare: jest.fn(() => ({ all: jest.fn(() => []) })),
    },
}));

describe('sessionManager — contact/group sync deduplication', () => {
    let sessionManager;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        createdSockets.length = 0;
        jest.resetModules();
        sessionManager = require('../src/whatsapp/sessionManager');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('two concurrent getWhatsAppContacts calls for the same session dedupe into one resyncAppState', async () => {
        await sessionManager.createClient('sess1', 'Test Session');
        const sock = createdSockets[0];

        const p1 = sessionManager.getWhatsAppContacts('sess1');
        const p2 = sessionManager.getWhatsAppContacts('sess1');

        await jest.advanceTimersByTimeAsync(6000);
        const [r1, r2] = await Promise.all([p1, p2]);

        expect(sock.resyncAppState).toHaveBeenCalledTimes(1);
        expect(r1).toBe(r2); // identical resolved array reference — truly deduped, not just equal
    });

    test('getGroupParticipants for two different groups on the same session run independently', async () => {
        await sessionManager.createClient('sess1', 'Test Session');
        const sock = createdSockets[0];

        const pA = sessionManager.getGroupParticipants('sess1', 'groupA@g.us');
        const pB = sessionManager.getGroupParticipants('sess1', 'groupB@g.us');
        await jest.advanceTimersByTimeAsync(6000);
        const [resA, resB] = await Promise.all([pA, pB]);

        expect(resA).not.toBe(resB);
        expect(resA.length).toBe(2);
        expect(resB.length).toBe(2);
        expect(sock.groupMetadata).toHaveBeenCalledTimes(2);
        expect(sock.groupMetadata).toHaveBeenCalledWith('groupA@g.us');
        expect(sock.groupMetadata).toHaveBeenCalledWith('groupB@g.us');
    });

    test('getGroupParticipants called twice concurrently for the SAME group only fetches metadata once', async () => {
        await sessionManager.createClient('sess1', 'Test Session');
        const sock = createdSockets[0];

        const p1 = sessionManager.getGroupParticipants('sess1', 'groupA@g.us');
        const p2 = sessionManager.getGroupParticipants('sess1', 'groupA@g.us');
        await jest.advanceTimersByTimeAsync(6000);
        const [r1, r2] = await Promise.all([p1, p2]);

        expect(sock.groupMetadata).toHaveBeenCalledTimes(1);
        expect(r1).toBe(r2);
    });

    test('a second sync after the first completes is NOT deduped — it runs fresh', async () => {
        await sessionManager.createClient('sess1', 'Test Session');
        const sock = createdSockets[0];

        const first = sessionManager.getWhatsAppContacts('sess1');
        await jest.advanceTimersByTimeAsync(6000);
        await first;
        expect(sock.resyncAppState).toHaveBeenCalledTimes(1);

        // Within the cooldown window, a second call shouldn't re-trigger resyncAppState
        // (no name was ever resolved, so hasAnyName() is still false, but the cooldown
        // gate should suppress a repeat attempt this soon).
        const second = sessionManager.getWhatsAppContacts('sess1');
        await jest.advanceTimersByTimeAsync(6000);
        await second;
        expect(sock.resyncAppState).toHaveBeenCalledTimes(1);
    });
});
