const { EventEmitter } = require('events');

// Fake Baileys module — makeWASocket() returns a fresh EventEmitter-based
// socket each call, so we can assert exactly how many sockets get created
// and whether the old one's listeners/timers were properly torn down.
// `end`/`logout` mirror the real Baileys behavior verified against
// node_modules/@whiskeysockets/baileys/lib/Socket/socket.js: both
// synchronously emit a `connection.update` close event to whatever
// listeners are currently attached.
const createdSockets = [];
const mockMakeWASocket = jest.fn(() => {
    const sock = new EventEmitter();
    sock.end = jest.fn((error) => {
        sock.ev.emit('connection.update', {
            connection: 'close',
            lastDisconnect: { error, date: new Date() },
        });
    });
    sock.logout = jest.fn(async () => {
        sock.end({ output: { statusCode: 401 } });
    });
    sock.user = { id: '910000000000:1@s.whatsapp.net' };
    sock.ev = sock; // alias so `sock.ev.on(...)` / `sock.ev.removeAllListeners()` hit the same emitter
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
    db: { transaction: (fn) => fn },
}));

describe('sessionManager — restart/relink race (Fix 3)', () => {
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

    test('restarting a live session tears down the old socket without triggering a duplicate auto-reconnect', async () => {
        await sessionManager.createClient('sess1', 'Test Session');
        const firstSocket = createdSockets[0];
        expect(createdSockets.length).toBe(1);

        await sessionManager.restartSession('sess1');
        expect(createdSockets.length).toBe(2);

        // teardownSocket must strip listeners BEFORE calling .end() — otherwise
        // .end()'s synchronous close emit (verified against real Baileys) would
        // hit our still-attached handler and schedule a stale reconnect.
        expect(firstSocket.end).toHaveBeenCalledTimes(1);
        expect(firstSocket.listenerCount('connection.update')).toBe(0);
        expect(firstSocket.listenerCount('messages.upsert')).toBe(0);

        // Advance past the max backoff — if the ordering above were wrong,
        // this would produce a 3rd socket.
        await jest.advanceTimersByTimeAsync(31000);
        expect(createdSockets.length).toBe(2);
        expect(mockMakeWASocket).toHaveBeenCalledTimes(2);
    });

    test('a stale auto-reconnect timer from an earlier disconnect is cancelled by a manual restart', async () => {
        await sessionManager.createClient('sess1', 'Test Session');
        const firstSocket = createdSockets[0];

        // Simulate a real network drop: the connection.update close handler
        // deletes the session from `clients` and schedules an auto-reconnect.
        firstSocket.ev.emit('connection.update', {
            connection: 'close',
            lastDisconnect: { error: undefined },
        });

        // User manually restarts before that timer fires.
        await sessionManager.restartSession('sess1');
        expect(createdSockets.length).toBe(2);

        // The stale timer must have been cancelled — it must NOT fire a 3rd
        // createClient() call once its original delay elapses.
        await jest.advanceTimersByTimeAsync(31000);
        expect(createdSockets.length).toBe(2);
        expect(mockMakeWASocket).toHaveBeenCalledTimes(2);
    });

    test('relinkSession also tears down the old socket and cancels pending reconnects', async () => {
        await sessionManager.createClient('sess1', 'Test Session');
        const firstSocket = createdSockets[0];

        await sessionManager.relinkSession('sess1');
        expect(createdSockets.length).toBe(2);
        expect(firstSocket.listenerCount('connection.update')).toBe(0);

        await jest.advanceTimersByTimeAsync(31000);
        expect(createdSockets.length).toBe(2);
    });

    test('removeSession logs out, tears down the socket, and cancels pending reconnects', async () => {
        await sessionManager.createClient('sess1', 'Test Session');
        const firstSocket = createdSockets[0];

        await sessionManager.removeSession('sess1');
        expect(firstSocket.logout).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(31000);
        // No reconnect should fire after the session was removed.
        expect(createdSockets.length).toBe(1);
    });
});
