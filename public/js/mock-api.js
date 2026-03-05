/**
 * SROTAS WHATSAPP BOT — VERCEL SHOWCASE DEMO
 * ──────────────────────────────────────────
 * This file intercepts all backend API calls and Socket.IO connections,
 * returning realistic mock data so the full UI works without a Node.js backend.
 * Loaded as the FIRST script before app.js and all page scripts.
 */

// ── 1. Stub Socket.IO before app.js calls io() ──────────────────────────────
window.io = function () {
    return { on() { }, emit() { }, off() { }, disconnect() { } };
};

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
    totalMessages: 1284,
    peopleReached: 847,
    mediaSent: 92,
    deliveryRate: 96.4,
    messagesChange: 18,
    peopleChange: 12,
    mediaChange: 5,
    deliveryChange: 2,
    topCampaigns: [
        { name: 'Diwali Promo 2024', sent: 523, delivered: 512, failed: 11 },
        { name: 'Product Launch Q1', sent: 389, delivered: 371, failed: 18 },
        { name: 'Customer Feedback Ask', sent: 247, delivered: 240, failed: 7 }
    ],
    dailyMessages: [42, 78, 55, 134, 98, 167, 112, 89, 201, 145, 178, 85, 134, 98]
        .map((v, i) => ({ date: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10), count: v })),
    sessions: MOCK_SESSIONS
};

const MOCK_CAMPAIGNS = [
    {
        id: 'camp-001', name: 'Diwali Promo 2024',
        sessionId: 'sess-a1b2', sessionName: 'Business Account',
        groupName: 'Customers', status: 'completed',
        total: 5, sent: 5, failed: 0, skipped: 0,
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString()
    },
    {
        id: 'camp-002', name: 'Product Launch Q1',
        sessionId: 'sess-a1b2', sessionName: 'Business Account',
        groupName: 'Leads', status: 'running',
        total: 10, sent: 6, failed: 0, skipped: 0,
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
    },
    {
        id: 'camp-003', name: 'Customer Feedback Ask',
        sessionId: 'sess-c3d4', sessionName: 'Customer Support',
        groupName: 'Customers', status: 'completed',
        total: 5, sent: 5, failed: 0, skipped: 0,
        createdAt: new Date(Date.now() - 14 * 86400000).toISOString()
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
        body: 'Hi {{name}},\n\nSeason\'s greetings from {{company}}! Wishing you and your family a wonderful time.\n\nBest regards,\nTeam Srotas',
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
    },
    {
        id: 'tpl-002', name: 'Follow-Up Message',
        body: 'Hello {{name}},\n\nWe wanted to follow up about our recent conversation. Would you be available for a quick call this week?\n\nWith regards,\n{{company}}',
        createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
    },
    {
        id: 'tpl-003', name: 'Product Launch',
        body: 'Hi {{name}},\n\nExciting news! We just launched our newest product and as a valued partner of {{company}}, you\'re among the first to know.\n\nClick here to learn more: https://srotas.tech\n\nCheers,\nThe team',
        createdAt: new Date(Date.now() - 5 * 86400000).toISOString()
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
        ok: true, status: 200,
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
        if (path.startsWith('/api/analytics'))
            return MOCK_ANALYTICS;
        if (/\/api\/campaigns\/[^/]+$/.test(path)) {
            const id = path.split('/').pop();
            return MOCK_CAMPAIGNS.find(c => c.id === id) || MOCK_CAMPAIGNS[0];
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
        if (path === '/api/sessions')
            return { id: 'demo-' + Math.random().toString(36).slice(2, 6), name: body?.name || 'Demo', status: 'initializing', qr: null };
        if (path === '/api/messages/preview')
            return { preview: (body?.template || '').replace(/{{(\w+)}}/g, (_, k) => body?.contact?.[k] || `[${k}]`) };
        if (path === '/api/messages/send-bulk') {
            setTimeout(() => window.toast?.('Demo mode — messages are not actually sent', 'info'), 500);
            return { jobId: 'demo-job-' + Date.now() };
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
