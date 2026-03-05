/**
 * SROTAS WHATSAPP BOT — VERCEL SHOWCASE DEMO
 * ──────────────────────────────────────────
 * This file intercepts all backend API calls and Socket.IO connections,
 * returning realistic mock data so the full UI works without a Node.js backend.
 * Loaded as the FIRST script before app.js and all page scripts.
 */

// ── 1. Stub Socket.IO before app.js calls io() ──────────────────────────────
const _mockSocketListeners = {};
window.io = function () {
    return {
        on(event, fn) {
            if (!_mockSocketListeners[event]) _mockSocketListeners[event] = [];
            _mockSocketListeners[event].push(fn);
        },
        emit() { },
        off() { },
        disconnect() { }
    };
};

function triggerMockSocket(event, payload) {
    const fns = _mockSocketListeners[event];
    if (fns) fns.forEach(fn => fn(payload));
}

// ── 2. Mock Data ─────────────────────────────────────────────────────────────

const MOCK_SESSIONS = [
    {
        id: 'sess-a1b2', name: 'Business Account',
        status: 'ready', phone: '919876543210',
        autoReplyEnabled: true, aiRepliesEnabled: true, quickRepliesEnabled: true,
        qr: null
    },
    {
        id: 'sess-c3d4', name: 'Customer Support',
        status: 'ready', phone: '919876543211',
        autoReplyEnabled: false, aiRepliesEnabled: false, quickRepliesEnabled: true,
        qr: null
    }
];

const MOCK_CONTACTS = [
    { id: 1, phone: '+919876543210', name: 'Rahul Sharma', company: 'TechCorp India', group: 'Customers', city: 'Bangalore' },
    { id: 2, phone: '+919876543211', name: 'Priya Patel', company: 'WebIndia Pvt Ltd', group: 'Customers', city: 'Mumbai' },
    { id: 3, phone: '+919876543212', name: 'Arjun Mehta', company: 'StartupHub', group: 'Customers', city: 'Hyderabad' },
    { id: 4, phone: '+919876543213', name: 'Sneha Rathi', company: 'DigitalEdge', group: 'Customers', city: 'Pune' },
    { id: 5, phone: '+919876543214', name: 'Vikram Singh', company: 'CloudNine Labs', group: 'Customers', city: 'Delhi' },
    { id: 6, phone: '+919876543220', name: 'Ananya Joshi', company: 'RetailX', group: 'Leads', city: 'Chennai' },
    { id: 7, phone: '+919876543221', name: 'Rohit Kumar', company: 'E-commerce Plus', group: 'Leads', city: 'Kolkata' },
    { id: 8, phone: '+919876543222', name: 'Meera Nair', company: 'BizGrowth', group: 'Leads', city: 'Kochi' },
    { id: 9, phone: '+919876543223', name: 'Aditya Gupta', company: 'NextGen Solutions', group: 'Leads', city: 'Jaipur' },
    { id: 10, phone: '+919876543224', name: 'Kavitha Reddy', company: 'SaaS Ventures', group: 'Leads', city: 'Guntur' }
];

const MOCK_GROUPS = ['Customers', 'Leads'];

const MOCK_ANALYTICS = {
    stats: {
        totalMessages: 1284,
        peopleReached: 847,
        mediaSent: 92,
        deliveryRate: 96.4
    },
    messagesOverTime: {
        labels: ['Feb 20', 'Feb 21', 'Feb 22', 'Feb 23', 'Feb 24', 'Feb 25', 'Feb 26', 'Feb 27', 'Feb 28', 'Mar 1', 'Mar 2', 'Mar 3', 'Mar 4', 'Mar 5'],
        sent: [42, 78, 55, 134, 98, 167, 112, 89, 201, 145, 178, 85, 134, 98],
        failed: [1, 3, 2, 5, 0, 8, 4, 1, 6, 3, 5, 2, 4, 1]
    },
    hourlyPattern: {
        labels: ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm'],
        counts: [15, 45, 120, 85, 60, 40, 55, 90, 150, 200, 110, 45]
    },
    topCampaigns: [
        { id: 1, name: 'Diwali Promo 2024', sent: 523, date: new Date(Date.now() - 7 * 86400000).toISOString() },
        { id: 2, name: 'Product Launch Q1', sent: 389, date: new Date(Date.now() - 2 * 86400000).toISOString() },
        { id: 3, name: 'Customer Feedback Ask', sent: 247, date: new Date(Date.now() - 14 * 86400000).toISOString() }
    ],
    sessions: MOCK_SESSIONS,
    aiAnalytics: {
        totalConversations: 342,
        messagesHandled: 891,
        avgResponseTime: 1.2,
        successRate: 94
    },
    quickReplyAnalytics: {
        totalTriggers: 512,
        uniqueUsers: 184,
        avgResponseTime: 45,
        mostUsed: '/price'
    }
};

const MOCK_CAMPAIGNS = [
    {
        id: 1, name: 'Diwali Promo 2024',
        sessionId: 'sess-a1b2', sessionName: 'Business Account',
        groupName: 'Customers', status: 'completed',
        total: 5, sent: 5, failed: 0, skipped: 0,
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
        durationMs: 45000,
        messages: [
            { contact_name: 'Rahul Sharma', contact_phone: '+919876543210', status: 'sent', message_content: 'Hi Rahul, Happy Diwali!', sent_at: new Date().toISOString() },
            { contact_name: 'Priya Patel', contact_phone: '+919876543211', status: 'sent', message_content: 'Hi Priya, Happy Diwali!', sent_at: new Date().toISOString() },
            { contact_name: 'Arjun Mehta', contact_phone: '+919876543212', status: 'sent', message_content: 'Hi Arjun, Happy Diwali!', sent_at: new Date().toISOString() },
            { contact_name: 'Sneha Rathi', contact_phone: '+919876543213', status: 'sent', message_content: 'Hi Sneha, Happy Diwali!', sent_at: new Date().toISOString() },
            { contact_name: 'Vikram Singh', contact_phone: '+919876543214', status: 'sent', message_content: 'Hi Vikram, Happy Diwali!', sent_at: new Date().toISOString() }
        ]
    },
    {
        id: 2, name: 'Product Launch Q1',
        sessionId: 'sess-a1b2', sessionName: 'Business Account',
        groupName: 'Leads', status: 'running',
        total: 10, sent: 6, failed: 2, skipped: 0,
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        durationMs: 82000,
        messages: [
            { contact_name: 'Ananya Joshi', contact_phone: '+919876543220', status: 'sent', message_content: 'Hi Ananya, check out our new launch!', sent_at: new Date().toISOString() },
            { contact_name: 'Rohit Kumar', contact_phone: '+919876543221', status: 'failed', error: 'Invalid number', message_content: 'Hi Rohit, check out our new launch!', sent_at: new Date().toISOString() },
            { contact_name: 'Meera Nair', contact_phone: '+919876543222', status: 'sent', message_content: 'Hi Meera, check out our new launch!', sent_at: new Date().toISOString() },
            { contact_name: 'Aditya Gupta', contact_phone: '+919876543223', status: 'queued', message_content: 'Hi Aditya, check out our new launch!' },
            { contact_name: 'Kavitha Reddy', contact_phone: '+919876543224', status: 'queued', message_content: 'Hi Kavitha, check out our new launch!' }
        ]
    },
    {
        id: 3, name: 'Customer Feedback Ask',
        sessionId: 'sess-c3d4', sessionName: 'Customer Support',
        groupName: 'Customers', status: 'completed',
        total: 2, sent: 2, failed: 0, skipped: 0,
        createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
        durationMs: 16000,
        messages: [
            { contact_name: 'Rahul Sharma', contact_phone: '+919876543210', status: 'sent', message_content: 'Hi Rahul, how was your experience?', sent_at: new Date().toISOString() },
            { contact_name: 'Priya Patel', contact_phone: '+919876543211', status: 'sent', message_content: 'Hi Priya, how was your experience?', sent_at: new Date().toISOString() }
        ]
    }
];

const MOCK_SCHEDULES = [
    {
        id: 'sch-001', name: 'Weekly Newsletter',
        sessionId: 'sess-a1b2', sessionName: 'Business Account',
        groupName: 'Customers', frequency: 'weekly', dayOfWeek: 1, hour: 10, minute: 0,
        template: 'Hi {{name}}, here is your weekly update from {{company}}!',
        enabled: true,
        lastRun: new Date(Date.now() - 7 * 86400000).toISOString(),
        nextRun: new Date(Date.now() + 7 * 86400000).toISOString()
    },
    {
        id: 'sch-002', name: 'Monthly Report',
        sessionId: 'sess-c3d4', sessionName: 'Customer Support',
        groupName: 'Leads', frequency: 'monthly', dayOfMonth: 1, hour: 9, minute: 0,
        template: 'Hello {{name}}, your monthly report from {{company}} is ready!',
        enabled: false,
        lastRun: new Date(Date.now() - 30 * 86400000).toISOString(),
        nextRun: new Date(Date.now() + 15 * 86400000).toISOString()
    },
    {
        id: 'sch-003', name: 'Daily Follow-Up',
        sessionId: 'sess-a1b2', sessionName: 'Business Account',
        groupName: 'Leads', frequency: 'daily', hour: 11, minute: 30,
        template: 'Hi {{name}}, just checking in on your interest in our product from {{company}}.',
        enabled: true,
        lastRun: new Date(Date.now() - 86400000).toISOString(),
        nextRun: new Date(Date.now() + 3600000).toISOString()
    }
];

const MOCK_TEMPLATES = [
    {
        id: 'tpl-001', name: 'Festival Greeting',
        content: 'Hi {{name}},\n\nSeason\'s greetings from {{company}}! Wishing you and your family a wonderful time.\n\nBest regards,\nTeam Srotas',
        created_at: new Date(Date.now() - 30 * 86400000).toISOString()
    },
    {
        id: 'tpl-002', name: 'Follow-Up Message',
        content: 'Hello {{name}},\n\nWe wanted to follow up about our recent conversation. Would you be available for a quick call this week?\n\nWith regards,\n{{company}}',
        created_at: new Date(Date.now() - 15 * 86400000).toISOString()
    },
    {
        id: 'tpl-003', name: 'Product Launch',
        content: 'Hi {{name}},\n\nExciting news! We just launched our newest product and as a valued partner of {{company}}, you\'re among the first to know.\n\nClick here to learn more: https://srotas.tech\n\nCheers,\nThe team',
        created_at: new Date(Date.now() - 5 * 86400000).toISOString()
    }
];

const MOCK_QUICK_REPLIES = [
    { id: 'qr-001', triggerKey: 'price', label: 'Pricing Info', response: 'Our pricing starts at ₹999/month. Reply PLANS for full details.', mediaPath: null },
    { id: 'qr-002', triggerKey: 'demo', label: 'Book Demo', response: 'Book your free demo at https://srotas.tech/demo — takes 2 minutes!', mediaPath: null },
    { id: 'qr-003', triggerKey: 'support', label: 'Support Info', response: 'Our support team is available Mon–Sat 9am–6pm IST. Email: hi@srotas.tech', mediaPath: null }
];

const MOCK_SETTINGS = {
    ai_provider: 'gemini',
    gemini_api_key: '',
    openai_api_key: '',
    system_prompt: 'You are a helpful assistant for Srotas.tech. Be concise, friendly, and always offer to connect the user with a human agent when needed.',
    theme: 'dark'
};

// ── 3. Intercept window.fetch ────────────────────────────────────────────────

const _originalFetch = window.fetch.bind(window);

window.fetch = async function (url, opts = {}) {
    const path = url.toString().replace(/^https?:\/\/[^/]+/, '');
    const method = (opts.method || 'GET').toUpperCase();

    if (!path.startsWith('/api/')) {
        return _originalFetch(url, opts);   // pass through non-API calls (Chart.js CDN etc.)
    }

    await new Promise(r => setTimeout(r, 120 + Math.random() * 80)); // simulate realistic latency

    let body = null;
    if (opts.body) {
        try { body = JSON.parse(opts.body); } catch (e) { /* FormData or plain text */ }
    }

    const result = _mockRoute(method, path, body);

    return {
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        json: () => Promise.resolve(result),
        text: () => Promise.resolve(JSON.stringify(result)),
        clone() { return this; }
    };
};

// ── 4. Route Mock Responses ───────────────────────────────────────────────────

function _mockRoute(method, path, body) {
    // ─ GET ─
    if (method === 'GET') {
        if (path.startsWith('/api/license-status'))
            return { activated: true, isLifetime: false, expiryDate: '2027-03-05', daysRemaining: 365, keyMasked: 'SRTS-****-****-2026' };
        if (path.startsWith('/api/sessions'))
            return MOCK_SESSIONS;
        if (path.startsWith('/api/contacts/groups') || path.startsWith('/api/groups'))
            return MOCK_GROUPS;
        if (path.startsWith('/api/contacts')) {
            const g = new URL('http://x' + path).searchParams.get('group');
            return g ? MOCK_CONTACTS.filter(c => c.group === g) : MOCK_CONTACTS;
        }
        if (path.startsWith('/api/analytics')) {
            const range = new URL('http://x' + path).searchParams.get('range') || '30days';
            const clone = JSON.parse(JSON.stringify(MOCK_ANALYTICS));

            // Generate dummy chart data based on range
            const days = range === '7days' ? 7 : range === '14days' ? 14 : range === 'today' ? 1 : 30;
            const mult = days === 1 ? 0.1 : days === 7 ? 0.4 : 1;

            clone.stats.totalMessages = Math.floor(1284 * mult);
            clone.stats.peopleReached = Math.floor(847 * mult);
            clone.stats.mediaSent = Math.floor(92 * mult);

            if (days === 1) { // Hourly chart
                clone.messagesOverTime.labels = ['10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm'];
                clone.messagesOverTime.sent = [12, 45, 23, 89, 44, 18, 5, 33];
                clone.messagesOverTime.failed = [0, 1, 0, 2, 0, 0, 0, 1];
            } else { // Daily chart
                clone.messagesOverTime.labels = Array.from({ length: days }, (_, i) => `Day ${i + 1}`);
                clone.messagesOverTime.sent = Array.from({ length: days }, () => Math.floor(10 + Math.random() * 80));
                clone.messagesOverTime.failed = Array.from({ length: days }, () => Math.floor(Math.random() * 5));
            }
            return clone;
        }
        if (/\/api\/campaigns\/[^/]+$/.test(path)) {
            const id = path.split('/').pop();
            return MOCK_CAMPAIGNS.find(c => c.id == id) || MOCK_CAMPAIGNS[0];
        }
        if (path.startsWith('/api/campaigns'))
            return MOCK_CAMPAIGNS;
        if (path.startsWith('/api/schedules'))
            return MOCK_SCHEDULES;
        if (path.startsWith('/api/templates'))
            return MOCK_TEMPLATES;
        if (path.startsWith('/api/quick-replies'))
            return MOCK_QUICK_REPLIES;
        if (path.startsWith('/api/settings'))
            return MOCK_SETTINGS;
        if (path.startsWith('/api/admin/history'))
            return [];
        return {};
    }

    // ─ POST / PUT / DELETE ─
    if (method === 'POST') {
        if (path === '/api/sessions') {
            const id = 'demo-' + Math.random().toString(36).slice(2, 6);
            const name = body?.name || 'Demo';
            MOCK_SESSIONS.push({ id, name, status: 'qr_pending', phone: null, autoReplyEnabled: true, aiRepliesEnabled: true, quickRepliesEnabled: true, qr: null });

            setTimeout(() => {
                triggerMockSocket('session:qr', { sessionId: id, qr: 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=SROTAS-DEMO-QR' });
            }, 1500);

            return { sessionId: id, name };
        }
        if (path.includes('/relink')) {
            const sid = path.split('/')[3];
            const s = MOCK_SESSIONS.find(x => x.id === sid);
            if (s) s.status = 'qr_pending';
            setTimeout(() => {
                triggerMockSocket('session:qr', { sessionId: sid, qr: 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=SROTAS-REAUTH-QR' });
            }, 1000);
            return { success: true };
        }
        if (path.includes('/restart')) {
            const sid = path.split('/')[3];
            setTimeout(() => triggerMockSocket('session:ready', { sessionId: sid, phone: '919000000000' }), 2000);
            return { success: true };
        }
        if (path === '/api/messages/preview')
            return { preview: (body?.template || '').replace(/{{(\w+)}}/g, (_, k) => body?.contact?.[k] || `[${k}]`) };
        if (path === '/api/messages/send-bulk') {
            setTimeout(() => window.toast?.('Demo mode — messages are not actually sent', 'info'), 500);
            return { jobId: 'demo-job-' + Date.now() };
        }
        if (/\/api\/campaigns\/[^/]+\/retry$/.test(path)) {
            setTimeout(() => {
                window.toast?.('Demo mode — retry initiated', 'info');
                triggerMockSocket('campaign:progress', { jobId: 'demo', sent: 2, failed: 0, total: 2, status: 'completed' });
            }, 1000);
            return { success: true };
        }
        if (/\/api\/campaigns\/[^/]+\/restart$/.test(path)) {
            setTimeout(() => {
                window.toast?.('Demo mode — restart initiated', 'info');
                triggerMockSocket('campaign:progress', { jobId: 'demo', sent: 10, failed: 0, total: 10, status: 'completed' });
            }, 1000);
            return { success: true };
        }
        if (path === '/api/templates') {
            const t = { id: 'tpl-' + Date.now(), ...body, createdAt: new Date().toISOString() };
            MOCK_TEMPLATES.push(t); return t;
        }
        if (path === '/api/quick-replies') {
            const qr = { id: 'qr-' + Date.now(), ...body }; MOCK_QUICK_REPLIES.push(qr); return qr;
        }
        if (path === '/api/schedules') {
            const s = { id: 'sch-' + Date.now(), ...body }; MOCK_SCHEDULES.push(s); return s;
        }
        if (path === '/api/contacts/upload')
            return { contacts: MOCK_CONTACTS.slice(0, 5) };
        if (path === '/api/contacts/import')
            return { success: true, count: body?.contacts?.length || 5 };
        if (path === '/api/activate')
            return { success: false, error: 'Demo mode — activation disabled' };
        if (path === '/api/admin/generate-key') {
            setTimeout(() => window.toast?.('Demo mode — key generation disabled', 'info'), 300);
            return { key: 'DEMO-ONLY-SRTS-0000', expiryDate: body?.days ? new Date(Date.now() + body.days * 86400000).toISOString().slice(0, 10) : '2027-01-01', days: body?.days };
        }
    }

    if (method === 'PUT') {
        if (path === '/api/settings') { Object.assign(MOCK_SETTINGS, body); return { success: true }; }
        if (path.includes('/auto-reply')) { const s = MOCK_SESSIONS.find(x => path.includes(x.id)); if (s) s.autoReplyEnabled = body?.enabled; return { success: true }; }
        if (path.includes('/ai-replies')) { const s = MOCK_SESSIONS.find(x => path.includes(x.id)); if (s) s.aiRepliesEnabled = body?.enabled; return { success: true }; }
        if (path.includes('/quick-replies')) { const s = MOCK_SESSIONS.find(x => path.includes(x.id)); if (s) s.quickRepliesEnabled = body?.enabled; return { success: true }; }
        if (path.includes('/toggle')) { const sc = MOCK_SCHEDULES.find(x => path.includes(x.id)); if (sc) sc.enabled = body?.enabled; return { success: true }; }
    }

    if (method === 'DELETE') {
        if (path.startsWith('/api/campaigns/')) return { success: true };
        if (path.startsWith('/api/templates/')) return { success: true };
        if (path.startsWith('/api/quick-replies/')) return { success: true };
        if (path.startsWith('/api/schedules/')) return { success: true };
        if (path.startsWith('/api/sessions/')) {
            const sid = path.split('/')[3];
            const idx = MOCK_SESSIONS.findIndex(x => x.id === sid);
            if (idx > -1) MOCK_SESSIONS.splice(idx, 1);
            setTimeout(() => triggerMockSocket('session:disconnected', { sessionId: sid }), 100);
            return { success: true };
        }
    }

    return { success: true };
}

// ── 5. Demo banner ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.id = 'demoBanner';
    banner.innerHTML = `🎭 <strong>Demo Mode</strong> — UI showcase only, no real data is sent or stored`;
    Object.assign(banner.style, {
        position: 'fixed', top: '0', left: '0', right: '0', zIndex: '9999',
        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
        color: '#fff', textAlign: 'center', padding: '6px 16px',
        fontSize: '13px', fontFamily: 'Inter, sans-serif', letterSpacing: '0.3px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)'
    });
    document.body.prepend(banner);

    // Push layout down so the banner doesn't overlap the sidebar
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('.main-content');
    if (sidebar) sidebar.style.paddingTop = '34px';
    if (main) main.style.paddingTop = '34px';
});
