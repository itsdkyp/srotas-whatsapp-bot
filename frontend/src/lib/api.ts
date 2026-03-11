import axios from 'axios';

// MOCK API FOR VERCEL SHOWCASE
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const DEMO_SETTINGS = {
    theme: 'dark',
    ai_provider: 'gemini',
    ai_model: 'gemini-3.1-pro-preview',
    ai_chat_history: false,
    ai_chat_history_limit: 20,
    ai_use_system_prompt: true,
    system_prompt: 'You are an intelligent, professional, and friendly customer support AI assistant for Srotas...',
    min_delay: '8000',
    max_delay: '18000',
    gemini_api_key: '',
    openai_api_key: ''
};

export const getSettings = async () => { await mockDelay(300); return DEMO_SETTINGS; };
export const updateSettings = async (data: any) => { await mockDelay(500); Object.assign(DEMO_SETTINGS, data); return { success: true }; };
export const checkForUpdate = async () => { await mockDelay(800); return { currentVersion: '1.2.3', latestVersion: '1.2.3', updateAvailable: false, releaseUrl: 'https://github.com', error: null } as any; };
export const getVersion = async () => ({ version: '1.2.3' } as any);
export const getLicenseStatus = async () => { await mockDelay(400); return { activated: true, isLifetime: false, expiryDate: '2026-12-31', daysRemaining: 365, keyMasked: 'DEMO-****-****-2026' }; };
export const activateLicense = async (key: string) => { await mockDelay(1000); if (key === 'SROTAS-EASTER-EGG-2026' || key.length > 5) return { success: true }; throw new Error('Invalid key'); };

let MOCK_SESSIONS = [
    { id: 'sess_1', name: 'Primary Support', phone: '919876543210', status: 'ready', auto_reply: 1, ai_replies_enabled: 1, quick_replies_enabled: 1 }
];

export const getSessions = async () => { await mockDelay(300); return [...MOCK_SESSIONS]; };

export const addSession = async (name: string) => {
    await mockDelay(1000);
    const id = 'sess_' + Date.now();

    // Add it to local array so getSessions returns it
    const newSess = { id, name, status: 'initializing', phone: '' };
    MOCK_SESSIONS.push(newSess as any);

    setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any).triggerMockSocket) {
            newSess.status = 'qr';
            (window as any).triggerMockSocket('session:qr', {
                sessionId: id,
                qr: 'https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=MockSrotasBotSessionQR123'
            });

            setTimeout(() => {
                newSess.status = 'ready';
                newSess.phone = '919876000000';
                (window as any).triggerMockSocket('session:ready', {
                    sessionId: id,
                    name,
                    phone: '919876000000',
                    status: 'ready'
                });
            }, 5000);
        }
    }, 1500);

    return { sessionId: id, name, status: 'initializing' };
};

export const deleteSession = async (id: string) => {
    await mockDelay(500);
    MOCK_SESSIONS = MOCK_SESSIONS.filter(s => s.id !== id);
    return { success: true };
};
export const restartSession = async (id: string) => { await mockDelay(1000); return { success: true }; };
export const relinkSession = async (id: string) => { await mockDelay(1000); return { success: true }; };
export const setAutoReply = async (id: string, enabled: boolean) => { await mockDelay(200); return { success: true }; };
export const setAiReplies = async (id: string, enabled: boolean) => { await mockDelay(200); return { success: true }; };
export const setQuickReplies = async (id: string, enabled: boolean) => { await mockDelay(200); return { success: true }; };

export const getAnalytics = async (range: string = '30days') => {
    await mockDelay(600);

    let stats, messagesOverTime, hourlyPattern, aiAnalytics, quickReplyAnalytics, topCampaigns;

    if (range === 'today') {
        stats = { totalMessages: 420, peopleReached: 150, mediaSent: 45, deliveryRate: 99 };
        messagesOverTime = { labels: ['8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm'], sent: [20, 45, 120, 80, 60, 45, 50], failed: [0, 1, 2, 0, 1, 0, 0] };
        hourlyPattern = { labels: ['12am', '4am', '8am', '12pm', '4pm', '8pm'], counts: [5, 2, 80, 150, 90, 60] };
        aiAnalytics = { totalConversations: 45, messagesHandled: 120, avgResponseTime: 6.2, avgHistoryMessages: 5.1, successRate: 100 };
        quickReplyAnalytics = { totalTriggers: 85, uniqueUsers: 40, avgResponseTime: 105, mostUsed: 'hello' };
        topCampaigns = [
            { id: 4, name: 'Flash Sale Reminder', group: 'VIP tier', sent: 200, failed: 1 }
        ];
    } else if (range === 'yesterday') {
        stats = { totalMessages: 850, peopleReached: 320, mediaSent: 110, deliveryRate: 97 };
        messagesOverTime = { labels: ['8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm'], sent: [40, 90, 200, 150, 120, 100, 150], failed: [2, 5, 10, 4, 3, 1, 0] };
        hourlyPattern = { labels: ['12am', '4am', '8am', '12pm', '4pm', '8pm'], counts: [10, 5, 120, 300, 210, 180] };
        aiAnalytics = { totalConversations: 92, messagesHandled: 310, avgResponseTime: 7.1, avgHistoryMessages: 8.2, successRate: 98 };
        quickReplyAnalytics = { totalTriggers: 140, uniqueUsers: 85, avgResponseTime: 115, mostUsed: 'pricing' };
        topCampaigns = [
            { id: 3, name: 'Weekend Newsletter', group: 'All Customers', sent: 800, failed: 25 }
        ];
    } else if (range === '7days') {
        stats = { totalMessages: 5420, peopleReached: 1850, mediaSent: 640, deliveryRate: 98 };
        messagesOverTime = { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], sent: [600, 850, 700, 950, 1200, 700, 420], failed: [10, 15, 8, 12, 20, 5, 2] };
        hourlyPattern = { labels: ['12am', '4am', '8am', '12pm', '4pm', '8pm'], counts: [50, 20, 400, 1200, 1500, 600] };
        aiAnalytics = { totalConversations: 420, messagesHandled: 1850, avgResponseTime: 7.8, avgHistoryMessages: 10.5, successRate: 99 };
        quickReplyAnalytics = { totalTriggers: 650, uniqueUsers: 310, avgResponseTime: 118, mostUsed: 'demo' };
        topCampaigns = [
            { id: 2, name: 'New Feature Announcement', group: 'Premium Users', sent: 1200, failed: 5 },
            { id: 3, name: 'Weekend Newsletter', group: 'All Customers', sent: 800, failed: 25 }
        ];
    } else {
        // 30 days or all
        stats = { totalMessages: 18450, peopleReached: 5420, mediaSent: 2540, deliveryRate: 98 };
        messagesOverTime = { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], sent: [4200, 3800, 5100, 5350], failed: [80, 65, 90, 75] };
        hourlyPattern = { labels: ['12am', '4am', '8am', '12pm', '4pm', '8pm'], counts: [250, 120, 1800, 5400, 6100, 2400] };
        aiAnalytics = { totalConversations: 1850, messagesHandled: 8200, avgResponseTime: 8.5, avgHistoryMessages: 12.4, successRate: 99 };
        quickReplyAnalytics = { totalTriggers: 2540, uniqueUsers: 1120, avgResponseTime: 120, mostUsed: 'pricing' };
        topCampaigns = [
            { id: 1, name: 'Diwali Offer', group: 'All Customers', sent: 5000, failed: 20 },
            { id: 5, name: 'Product Launch', group: 'All Customers', sent: 4500, failed: 85 },
            { id: 2, name: 'New Feature Announcement', group: 'Premium Users', sent: 1200, failed: 5 },
            { id: 3, name: 'Weekend Newsletter', group: 'All Customers', sent: 800, failed: 25 },
            { id: 4, name: 'Flash Sale Reminder', group: 'VIP tier', sent: 200, failed: 1 }
        ];
    }

    return {
        stats,
        messagesOverTime,
        hourlyPattern,
        aiAnalytics,
        quickReplyAnalytics,
        topCampaigns,
        sessions: [{ name: 'Primary Support', status: 'ready', phone: '919876543210' }, { name: 'Sales Team', status: 'ready', phone: '919876543211' }]
    };
};

export const getGroups = async () => {
    await mockDelay(300);
    return [
        { id: 1, name: 'All Customers', description: 'Everyone in the database', count: 5000 },
        { id: 2, name: 'Premium Users', description: 'VIP tier subscriptions', count: 1200 },
        { id: 3, name: 'India Region', description: 'Customers from India', count: 2450 },
        { id: 4, name: 'B2B Clients', description: 'Enterprise partners', count: 340 }
    ];
};
export const addGroup = async (name: string, description?: string) => { await mockDelay(500); return { success: true }; };
export const renameGroup = async (id: string, name: string) => { await mockDelay(300); return { success: true }; };
export const deleteGroup = async (id: string) => { await mockDelay(300); return { success: true }; };

const firstNames = ['Rajesh', 'Priya', 'Amit', 'Neha', 'Sanjay', 'Kavita', 'Vikram', 'Anjali', 'Rahul', 'Sneha', 'Michael', 'Sarah', 'David', 'Emma', 'John', 'Lisa', 'James', 'Emily', 'Robert', 'Jessica', 'William', 'Sophia', 'Thomas', 'Mia', 'Klaus', 'Hans', 'Yuki', 'Wei', 'Chen', 'Mohammed', 'Fatima', 'Omar', 'Aisha', 'Carlos', 'Maria', 'Jose', 'Ana'];
const lastNames = ['Kumar', 'Sharma', 'Singh', 'Patel', 'Gupta', 'Verma', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis'];
const companies = ['Infosys', 'TCS', 'Wipro', 'TechNova', 'Globex', 'Acme Corp', 'StartUp Inc', 'Berlin Tech', 'Aussie Imports', 'Reliance', 'Tata', 'Mahindra', 'HDFC', 'ICICI', 'Amazon', 'Google', 'Microsoft', 'Apple', 'Meta', 'Tesla', 'Netflix', 'Oracle', 'IBM', 'Intel', 'Cisco', 'HP', 'Dell', 'Sony', 'Samsung', 'Panasonic', 'LG', 'Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes'];

const MOCK_CONTACTS: any[] = [];
for (let i = 1; i <= 150; i++) {
    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    const company = companies[Math.floor(Math.random() * companies.length)];
    const group_name = ['All Customers', 'Premium Users', 'India Region', 'B2B Clients', 'default'][Math.floor(Math.random() * 5)];
    const phonePrefix = ['91', '1', '44', '61', '49'][Math.floor(Math.random() * 5)];
    const phone = phonePrefix + Math.floor(Math.random() * 1000000000).toString().padStart(10, '0');
    MOCK_CONTACTS.push({
        id: i,
        phone,
        name: `${fn} ${ln}`,
        company,
        group_name,
        custom_fields: '{}',
        created_at: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString()
    });
}

export const getContacts = async (group?: string, search?: string) => {
    await mockDelay(400);
    let res = MOCK_CONTACTS;
    if (group && group !== 'All' && group !== 'default') res = res.filter(c => c.group_name === group);
    if (search) res = res.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || c.company.toLowerCase().includes(search.toLowerCase()));
    return res;
};
export const getContactGroups = async () => { await mockDelay(200); return ['default', 'All Customers', 'Premium Users', 'India Region', 'B2B Clients']; };
export const addContact = async (data: any) => { await mockDelay(400); return { success: true }; };
export const deleteContact = async (id: string) => { await mockDelay(300); return { success: true }; };
export const deleteContactGroup = async (name: string) => { await mockDelay(500); return { success: true }; };
export const importContacts = async (contacts: any[], group: string) => { await mockDelay(800); return { success: true, count: contacts.length }; };
export const moveToGroup = async (contactIds: string[], group: string, copy: boolean) => { await mockDelay(500); return { success: true, count: contactIds.length }; };
export const syncWhatsAppContacts = async (sessionId: string) => { await mockDelay(2000); return [{ phone: '919000000001', name: 'WA Contact 1', isMyContact: true }]; };
export const getWhatsAppGroups = async (sessionId: string) => { await mockDelay(1000); return [{ id: 'group1@g.us', name: 'Family Group' }]; };
export const grabGroupContacts = async (sessionId: string, groupId: string) => { await mockDelay(1500); return [{ phone: '919000000003', name: 'Group Member 1', isMyContact: false }]; };

let MOCK_CAMPAIGNS: any[] = [
    { id: 5, name: 'Product Launch', session_name: 'Sales Team', group_name: 'All Customers', status: 'completed', total: 4585, sent: 4500, failed: 85, started_at: new Date(Date.now() - 86400000 * 15).toISOString(), messages: [] },
    { id: 4, name: 'Flash Sale Reminder', session_name: 'Primary Support', group_name: 'VIP tier', status: 'completed', total: 201, sent: 200, failed: 1, started_at: new Date(Date.now() - 86400000 * 2).toISOString(), messages: [] },
    { id: 3, name: 'Weekend Newsletter', session_name: 'Primary Support', group_name: 'All Customers', status: 'completed', total: 825, sent: 800, failed: 25, started_at: new Date(Date.now() - 86400000 * 5).toISOString(), messages: [] },
    { id: 2, name: 'New Feature Announcement', session_name: 'Primary Support', group_name: 'Premium Users', status: 'completed', total: 1205, sent: 1200, failed: 5, started_at: new Date(Date.now() - 86400000 * 10).toISOString(), messages: [] },
    { id: 1, name: 'Diwali Offer', session_name: 'Sales Team', group_name: 'All Customers', status: 'completed', total: 5020, sent: 5000, failed: 20, started_at: new Date(Date.now() - 86400000 * 20).toISOString(), messages: [] }
];

export const getCampaigns = async () => {
    await mockDelay(400);
    return MOCK_CAMPAIGNS;
};

export const getCampaign = async (id: string) => {
    await mockDelay(300);
    const c = MOCK_CAMPAIGNS.find(x => x.id === parseInt(id));
    if (!c) return { id: parseInt(id), name: 'Demo Campaign', session_name: 'Primary Support', group_name: 'All Customers', status: 'completed', total: 5020, sent: 5000, failed: 20, template: 'Hello {{name}}', messages: [], errorBreakdown: [{ error: "Invalid number", count: 15 }, { error: "Timeout", count: 5 }], started_at: new Date().toISOString() };

    const errorBreakdown = c.failed > 0 ? [{ error: "Simulated Timeout/Invalid Number", count: c.failed }] : [];
    return { ...c, template: 'Hello {{name}}, this is a mock campaign preview.', errorBreakdown };
};

export const sendBulkMessages = async (data: any) => {
    await mockDelay(1000);

    // Determine total based on group if possible, else default to 50
    let total = 50;
    if (data.group === 'All Customers') total = 5000;
    else if (data.group === 'Premium Users') total = 1200;
    else if (data.group === 'India Region') total = 2450;
    else if (data.group === 'B2B Clients') total = 340;

    // For demo purposes, we will only actually "simulate" up to 100 messages slowly 
    // so the user isn't waiting 20 minutes. But we will make the final count jump to the total.
    const simulateCount = Math.min(total, 60);

    const newCampaign = {
        id: Date.now(),
        name: data.name || 'Quick Campaign',
        session_name: MOCK_SESSIONS.find(s => s.id === data.sessionId)?.name || 'Primary Support',
        group_name: data.group || 'Custom Group',
        status: 'running',
        total: total,
        sent: 0,
        failed: 0,
        started_at: new Date().toISOString(),
        messages: [] as any[]
    };
    MOCK_CAMPAIGNS.unshift(newCampaign);

    // Simulate background sending progress
    setTimeout(() => {
        let sent = 0;
        let failed = 0;
        const interval = setInterval(() => {
            const isFailure = Math.random() < 0.1; // 10% failure rate
            if (isFailure) failed++; else sent++;

            const phone = '91987654' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');

            newCampaign.sent = sent;
            newCampaign.failed = failed;
            newCampaign.messages.unshift({
                id: Date.now() + Math.random(),
                contact_phone: phone,
                contact_name: 'Demo Contact',
                status: isFailure ? 'failed' : 'sent',
                error_message: isFailure ? 'Invalid Number Simulation' : null,
                created_at: new Date().toISOString()
            });

            if (typeof window !== 'undefined' && (window as any).triggerMockSocket) {
                (window as any).triggerMockSocket('bulk:progress', {
                    total,
                    sent,
                    failed,
                    lastPhone: phone,
                    lastStatus: isFailure ? 'failed' : 'sent'
                });
            }

            if (sent + failed >= simulateCount) {
                clearInterval(interval);

                // If it was a huge group, instantly simulate the rest
                if (total > simulateCount) {
                    const remaining = total - simulateCount;
                    const extraFailed = Math.floor(remaining * 0.05); // 5% failure
                    sent += (remaining - extraFailed);
                    failed += extraFailed;
                    newCampaign.sent = sent;
                    newCampaign.failed = failed;
                }

                newCampaign.status = 'completed';
                if (typeof window !== 'undefined' && (window as any).triggerMockSocket) {
                    (window as any).triggerMockSocket('bulk:complete', {
                        total, sent, failed
                    });
                }
            }
        }, 100); // 1 message every 100ms for faster demo
    }, 500);

    return { status: 'started', total };
};
export const previewMessage = async (template: string, contact: any) => { await mockDelay(200); return { rendered: template.replace(/{{name}}/g, 'Demo Name') }; };
export const deleteCampaign = async (id: string) => {
    await mockDelay(300);
    MOCK_CAMPAIGNS = MOCK_CAMPAIGNS.filter(c => c.id !== parseInt(id));
    return { success: true };
};
export const retryCampaign = async (id: string, sessionId: string) => { await mockDelay(800); return { status: 'started', total: 20 }; };
export const restartCampaign = async (id: string, sessionId: string) => { await mockDelay(800); return { status: 'started', total: 5000 }; };

export const getTemplates = async () => {
    await mockDelay(300); return [
        { id: 1, name: 'Welcome Message', content: 'Hello {{name}}, welcome to Srotas! How can we help you today?' },
        { id: 2, name: 'Meeting Reminder', content: 'Hi {{name}}, just a reminder about our meeting tomorrow at 10 AM. Reply YES to confirm.' },
        { id: 3, name: 'Payment Link', content: 'Dear {{name}}, your invoice is due. Please use this link to pay: https://srotas.tech/pay/{{phone}}' },
        { id: 4, name: 'Support Ticket Closed', content: 'Your ticket #T-{{phone}} has been resolved. Thank you for choosing Srotas!' }
    ];
};
export const addTemplate = async (data: any) => { await mockDelay(500); return { success: true, id: Date.now() }; };
export const updateTemplate = async (id: string, data: any) => { await mockDelay(400); return { success: true }; };
export const deleteTemplate = async (id: string) => { await mockDelay(300); return { success: true }; };

export const getQuickReplies = async () => {
    await mockDelay(300); return [
        { id: 1, trigger_key: 'pricing', label: 'Pricing Info', response: 'Our pricing starts at ₹999/month. Reply PLANS for full details.', enabled: 1 },
        { id: 2, trigger_key: 'demo', label: 'Book Demo', response: 'Book your free demo at https://srotas.tech/demo — takes 2 minutes!', enabled: 1 },
        { id: 3, trigger_key: 'support', label: 'Support Info', response: 'Our support team is available Mon–Sat 9am–6pm IST. Email: hi@srotas.tech', enabled: 1 },
        { id: 4, trigger_key: 'hello', label: 'Greeting', response: 'Hi there! Welcome to Srotas Bot. How can we orchestrate your digital flow today?', enabled: 1 },
        { id: 5, trigger_key: 'address', label: 'Office Location', response: 'We are located at 123 Tech Park, Bangalore, India.', enabled: 0 }
    ];
};
export const addQuickReply = async (data: any) => { await mockDelay(500); return { success: true }; };
export const updateQuickReply = async (id: string, data: any) => { await mockDelay(400); return { success: true }; };
export const deleteQuickReply = async (id: string) => { await mockDelay(300); return { success: true }; };
export const toggleQuickReply = async (id: string, enabled: boolean) => { await mockDelay(200); return { success: true }; };

export const getSchedules = async () => {
    await mockDelay(300);
    return [
        { id: 1, name: 'Daily Greeting', session_name: 'Primary Support', group_name: 'Premium Users', template: 'Hello {{name}}! Have a great day!', frequency: 'daily', time: '09:00', enabled: 1, next_run: new Date(Date.now() + 86400000).toISOString() },
        { id: 2, name: 'Weekly Newsletter', session_name: 'Sales Team', group_name: 'All Customers', template: 'Check out our latest weekly updates: https://srotas.tech/news', frequency: 'weekly', day_of_week: 1, time: '10:00', enabled: 1, next_run: new Date(Date.now() + 86400000 * 3).toISOString() },
        { id: 3, name: 'Monthly Invoice Reminder', session_name: 'Primary Support', group_name: 'All Customers', template: 'Reminder: Your invoice will be generated on the 1st.', frequency: 'monthly', day_of_month: 28, time: '14:30', enabled: 0, next_run: new Date(Date.now() + 86400000 * 15).toISOString() }
    ];
};
export const addSchedule = async (data: any) => { await mockDelay(500); return { success: true, id: Date.now() }; };
export const updateSchedule = async (id: string, data: any) => { await mockDelay(400); return { success: true }; };
export const deleteSchedule = async (id: string) => { await mockDelay(300); return { success: true }; };
export const toggleSchedule = async (id: string, enabled: boolean) => { await mockDelay(200); return { success: true }; };

export const uploadMedia = async (formData: FormData) => { await mockDelay(1500); return { success: true, files: [{ path: '/mock/path.jpg', filename: 'image.jpg' }] } as any; };
export const uploadContactsCsv = async (formData: FormData) => { await mockDelay(1000); return { headers: ['phone', 'name'], rows: [['919999999999', 'Demo User']], uploadId: 'demo' } as any; };

export const generateAdminKey = async (days: number) => { await mockDelay(800); return { key: 'DEMO-KEY-1234', expiryDate: new Date(Date.now() + days * 86400000).toISOString(), days }; };
export const getAdminHistory = async () => { await mockDelay(400); return [{ key: 'DEMO-KEY-1234', days: 30, expiryDate: new Date().toISOString(), generatedAt: new Date().toISOString() }]; };
