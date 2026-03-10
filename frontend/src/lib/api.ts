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
export const getLicenseStatus = async () => { await mockDelay(400); return { activated: true, isLifetime: true, expiryDate: null, daysRemaining: null, keyMasked: 'SROT-****-****-2026' }; };
export const activateLicense = async (key: string) => { await mockDelay(1000); if (key === 'SROTAS-EASTER-EGG-2026' || key.length > 5) return { success: true }; throw new Error('Invalid key'); };

export const getSessions = async () => { await mockDelay(300); return [{ id: 'sess_1', name: 'Primary Support', phone: '919876543210', status: 'ready', auto_reply: 1, ai_replies_enabled: 1, quick_replies_enabled: 1 }]; };
export const addSession = async (name: string) => { await mockDelay(1000); return { sessionId: 'sess_' + Date.now(), name, status: 'initializing' }; };
export const deleteSession = async (id: string) => { await mockDelay(500); return { success: true }; };
export const restartSession = async (id: string) => { await mockDelay(1000); return { success: true }; };
export const relinkSession = async (id: string) => { await mockDelay(1000); return { success: true }; };
export const setAutoReply = async (id: string, enabled: boolean) => { await mockDelay(200); return { success: true }; };
export const setAiReplies = async (id: string, enabled: boolean) => { await mockDelay(200); return { success: true }; };
export const setQuickReplies = async (id: string, enabled: boolean) => { await mockDelay(200); return { success: true }; };

export const getAnalytics = async (range: string = '30days') => {
    await mockDelay(600);
    return {
        stats: { totalMessages: 12450, peopleReached: 3420, mediaSent: 1540, deliveryRate: 98 },
        messagesOverTime: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], sent: [1200, 1500, 1800, 2000, 2500, 2100, 1350], failed: [20, 15, 30, 25, 40, 10, 5] },
        hourlyPattern: { labels: ['12am', '4am', '8am', '12pm', '4pm', '8pm'], counts: [100, 50, 800, 2400, 3100, 1200] },
        aiAnalytics: { totalConversations: 850, messagesHandled: 4200, avgResponseTime: 8.5, avgHistoryMessages: 12.4, successRate: 99 },
        quickReplyAnalytics: { totalTriggers: 1540, uniqueUsers: 620, avgResponseTime: 120, mostUsed: 'pricing' },
        topCampaigns: [
            { id: 1, name: 'Diwali Offer', group: 'All Customers', sent: 5000, failed: 20 },
            { id: 2, name: 'New Feature Announcement', group: 'Premium Users', sent: 1200, failed: 5 }
        ],
        sessions: [{ name: 'Primary Support', status: 'ready', phone: '919876543210' }]
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

export const getCampaigns = async () => { await mockDelay(400); return [{ id: 1, name: 'Diwali Offer', session_name: 'Primary Support', group_name: 'All Customers', status: 'completed', sent: 5000, failed: 20 }]; };
export const getCampaign = async (id: string) => { await mockDelay(300); return { id: 1, name: 'Diwali Offer', session_name: 'Primary Support', group_name: 'All Customers', status: 'completed', sent: 5000, failed: 20, template: 'Hello {{name}}', messages: [], errorBreakdown: [] }; };
export const sendBulkMessages = async (data: any) => { await mockDelay(1000); return { status: 'started', total: 100 }; };
export const previewMessage = async (template: string, contact: any) => { await mockDelay(200); return { rendered: template.replace(/{{name}}/g, 'Demo Name') }; };
export const deleteCampaign = async (id: string) => { await mockDelay(300); return { success: true }; };
export const retryCampaign = async (id: string, sessionId: string) => { await mockDelay(800); return { status: 'started', total: 20 }; };
export const restartCampaign = async (id: string, sessionId: string) => { await mockDelay(800); return { status: 'started', total: 5000 }; };

export const getTemplates = async () => { await mockDelay(300); return [{ id: 1, name: 'Welcome Message', content: 'Hello {{name}}, welcome to Srotas!' }]; };
export const addTemplate = async (data: any) => { await mockDelay(500); return { success: true, id: Date.now() }; };
export const updateTemplate = async (id: string, data: any) => { await mockDelay(400); return { success: true }; };
export const deleteTemplate = async (id: string) => { await mockDelay(300); return { success: true }; };

export const getQuickReplies = async () => { await mockDelay(300); return [{ id: 1, trigger_key: 'pricing', label: 'Pricing Info', response: 'Our pricing starts at $99/mo.', enabled: 1 }]; };
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
