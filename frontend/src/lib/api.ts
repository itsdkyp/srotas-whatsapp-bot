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
export const checkForUpdate = async () => { await mockDelay(800); return { currentVersion: '1.2.0', latestVersion: '1.2.0', updateAvailable: false, releaseUrl: 'https://github.com', error: null } as any; };
export const getVersion = async () => ({ version: '1.2.0' } as any);
export const getLicenseStatus = async () => { await mockDelay(400); return { activated: true, isLifetime: false, expiryDate: '2026-12-31', daysRemaining: 365, keyMasked: 'DEMO-****-****-2026' }; };
export const activateLicense = async (key: string) => { await mockDelay(1000); if (key === 'SROTAS-EASTER-EGG-2026' || key.length > 5) return { success: true }; throw new Error('Invalid key'); };

export const getSessions = async () => { await mockDelay(300); return [{ id: 'sess_1', name: 'Primary Support', phone: '919876543210', status: 'ready', auto_reply: 1, ai_replies_enabled: 1, quick_replies_enabled: 1 }]; };
export const addSession = async (name: string) => {
    await mockDelay(1000);
    const id = 'sess_' + Date.now();

    setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any).triggerMockSocket) {
            (window as any).triggerMockSocket('session:qr', {
                id,
                qr: '1@mock_qr_data_string_for_showcase_only=='
            });

            setTimeout(() => {
                (window as any).triggerMockSocket('session:ready', {
                    id,
                    name,
                    phone: '919876000000',
                    status: 'ready'
                });
            }, 5000);
        }
    }, 1500);

    return { sessionId: id, name, status: 'initializing' };
};
export const deleteSession = async (id: string) => { await mockDelay(500); return { success: true }; };
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

export const getGroups = async () => { await mockDelay(300); return [{ id: 1, name: 'All Customers', description: 'Everyone', count: 5000 }, { id: 2, name: 'Premium Users', description: 'VIP tier', count: 1200 }]; };
export const addGroup = async (name: string, description?: string) => { await mockDelay(500); return { success: true }; };
export const renameGroup = async (id: string, name: string) => { await mockDelay(300); return { success: true }; };
export const deleteGroup = async (id: string) => { await mockDelay(300); return { success: true }; };

export const getContacts = async (group?: string, search?: string) => { await mockDelay(400); return [{ id: 1, phone: '919876543210', name: 'John Doe', company: 'Acme Corp', group_name: 'Premium Users', custom_fields: '{}' }]; };
export const getContactGroups = async () => { await mockDelay(200); return ['default', 'All Customers', 'Premium Users']; };
export const addContact = async (data: any) => { await mockDelay(400); return { success: true }; };
export const deleteContact = async (id: string) => { await mockDelay(300); return { success: true }; };
export const deleteContactGroup = async (name: string) => { await mockDelay(500); return { success: true }; };
export const importContacts = async (contacts: any[], group: string) => { await mockDelay(800); return { success: true, count: contacts.length }; };
export const moveToGroup = async (contactIds: string[], group: string, copy: boolean) => { await mockDelay(500); return { success: true, count: contactIds.length }; };
export const syncWhatsAppContacts = async (sessionId: string) => { await mockDelay(2000); return [{ phone: '919000000001', name: 'WA Contact 1', isMyContact: true }]; };
export const getWhatsAppGroups = async (sessionId: string) => { await mockDelay(1000); return [{ id: 'group1@g.us', name: 'Family Group' }]; };
export const grabGroupContacts = async (sessionId: string, groupId: string) => { await mockDelay(1500); return [{ phone: '919000000003', name: 'Group Member 1', isMyContact: false }]; };

export const getCampaigns = async () => {
    await mockDelay(400); return [
        { id: 5, name: 'Product Launch', session_name: 'Sales Team', group_name: 'All Customers', status: 'completed', sent: 4500, failed: 85, started_at: new Date(Date.now() - 86400000 * 15).toISOString() },
        { id: 4, name: 'Flash Sale Reminder', session_name: 'Primary Support', group_name: 'VIP tier', status: 'completed', sent: 200, failed: 1, started_at: new Date(Date.now() - 86400000 * 2).toISOString() },
        { id: 3, name: 'Weekend Newsletter', session_name: 'Primary Support', group_name: 'All Customers', status: 'completed', sent: 800, failed: 25, started_at: new Date(Date.now() - 86400000 * 5).toISOString() },
        { id: 2, name: 'New Feature Announcement', session_name: 'Primary Support', group_name: 'Premium Users', status: 'completed', sent: 1200, failed: 5, started_at: new Date(Date.now() - 86400000 * 10).toISOString() },
        { id: 1, name: 'Diwali Offer', session_name: 'Sales Team', group_name: 'All Customers', status: 'completed', sent: 5000, failed: 20, started_at: new Date(Date.now() - 86400000 * 20).toISOString() }
    ];
};
export const getCampaign = async (id: string) => { await mockDelay(300); return { id: parseInt(id), name: 'Demo Campaign', session_name: 'Primary Support', group_name: 'All Customers', status: 'completed', sent: 5000, failed: 20, template: 'Hello {{name}}', messages: [], errorBreakdown: [{ error: "Invalid number", count: 15 }, { error: "Timeout", count: 5 }], started_at: new Date().toISOString() }; };
export const sendBulkMessages = async (data: any) => { await mockDelay(1000); return { status: 'started', total: 100 }; };
export const previewMessage = async (template: string, contact: any) => { await mockDelay(200); return { rendered: template.replace(/{{name}}/g, 'Demo Name') }; };
export const deleteCampaign = async (id: string) => { await mockDelay(300); return { success: true }; };
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

export const getSchedules = async () => { await mockDelay(300); return []; };
export const addSchedule = async (data: any) => { await mockDelay(500); return { success: true, id: Date.now() }; };
export const updateSchedule = async (id: string, data: any) => { await mockDelay(400); return { success: true }; };
export const deleteSchedule = async (id: string) => { await mockDelay(300); return { success: true }; };
export const toggleSchedule = async (id: string, enabled: boolean) => { await mockDelay(200); return { success: true }; };

export const uploadMedia = async (formData: FormData) => { await mockDelay(1500); return { success: true, files: [{ path: '/mock/path.jpg', filename: 'image.jpg' }] } as any; };
export const uploadContactsCsv = async (formData: FormData) => { await mockDelay(1000); return { headers: ['phone', 'name'], rows: [['919999999999', 'Demo User']], uploadId: 'demo' } as any; };

export const generateAdminKey = async (days: number) => { await mockDelay(800); return { key: 'DEMO-KEY-1234', expiryDate: new Date(Date.now() + days * 86400000).toISOString(), days }; };
export const getAdminHistory = async () => { await mockDelay(400); return [{ key: 'DEMO-KEY-1234', days: 30, expiryDate: new Date().toISOString(), generatedAt: new Date().toISOString() }]; };
