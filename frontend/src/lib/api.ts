import axios from 'axios';

// Get base URL for API calls. In electron this is localhost + dynamic port.
// In Next.js dev it will proxy or just hit the same domain.
const API_BASE = '/api';

const api = axios.create({
    baseURL: API_BASE,
});

export const getLicenseStatus = () => api.get('/license-status').then((r) => r.data);
export const activateLicense = (key: string) => api.post('/activate', { key }).then((r) => r.data);

// Sessions
export const getSessions = () => api.get('/sessions').then((r) => r.data);
export const addSession = (name: string) => api.post('/sessions', { name }).then((r) => r.data);
export const deleteSession = (id: string) => api.delete(`/sessions/${id}`).then((r) => r.data);
export const restartSession = (id: string) => api.post(`/sessions/${id}/restart`).then((r) => r.data);
export const relinkSession = (id: string) => api.post(`/sessions/${id}/relink`).then((r) => r.data);
export const setAutoReply = (id: string, enabled: boolean) => api.put(`/sessions/${id}/auto-reply`, { enabled }).then((r) => r.data);
export const setAiReplies = (id: string, enabled: boolean) => api.put(`/sessions/${id}/ai-replies`, { enabled }).then((r) => r.data);
export const setQuickReplies = (id: string, enabled: boolean) => api.put(`/sessions/${id}/quick-replies`, { enabled }).then((r) => r.data);

// Groups
export const getGroups = () => api.get('/groups').then((r) => r.data);
export const addGroup = (name: string, description?: string) => api.post('/groups', { name, description }).then((r) => r.data);
export const renameGroup = (id: string, name: string) => api.put(`/groups/${id}`, { name }).then((r) => r.data);
export const deleteGroup = (id: string) => api.delete(`/groups/${id}`).then((r) => r.data);

// Contacts
export const getContacts = (group?: string, search?: string) =>
    api.get('/contacts', { params: { group, search } }).then((r) => r.data);
export const getContactGroups = () => api.get('/contacts/groups').then((r) => r.data);
export const addContact = (data: any) => api.post('/contacts', data).then((r) => r.data);
export const deleteContact = (id: string) => api.delete(`/contacts/${id}`).then((r) => r.data);
export const deleteContactGroup = (name: string) => api.delete(`/contacts/group/${name}`).then((r) => r.data);
export const importContacts = (contacts: any[], group: string) => api.post('/contacts/import', { contacts, group }).then((r) => r.data);
export const moveToGroup = (contactIds: string[], group: string, copy: boolean) =>
    api.post('/contacts/move-to-group', { contactIds, group, copy }).then((r) => r.data);
export const syncWhatsAppContacts = (sessionId: string) => api.get(`/contacts/sync/${sessionId}`).then((r) => r.data);
export const getWhatsAppGroups = (sessionId: string) => api.get(`/contacts/wa-groups/${sessionId}`).then((r) => r.data);
export const grabGroupContacts = (sessionId: string, groupId: string) => api.get(`/contacts/grab-group/${sessionId}/${groupId}`).then((r) => r.data);

// Messages/Campaigns
export const getCampaigns = () => api.get('/campaigns').then((r) => r.data);
export const getCampaign = (id: string) => api.get(`/campaigns/${id}`).then((r) => r.data);
export const sendBulkMessages = (data: any) => api.post('/messages/send-bulk', data).then((r) => r.data);
export const previewMessage = (template: string, contact: any) => api.post('/messages/preview', { template, contact }).then((r) => r.data);
export const deleteCampaign = (id: string) => api.delete(`/campaigns/${id}`).then((r) => r.data);
export const retryCampaign = (id: string, sessionId: string) => api.post(`/campaigns/${id}/retry`, { sessionId }).then((r) => r.data);
export const restartCampaign = (id: string, sessionId: string) => api.post(`/campaigns/${id}/restart`, { sessionId }).then((r) => r.data);

// Templates
export const getTemplates = () => api.get('/templates').then((r) => r.data);
export const addTemplate = (data: any) => api.post('/templates', data).then((r) => r.data);
export const updateTemplate = (id: string, data: any) => api.put(`/templates/${id}`, data).then((r) => r.data);
export const deleteTemplate = (id: string) => api.delete(`/templates/${id}`).then((r) => r.data);

// Quick Replies
export const getQuickReplies = () => api.get('/quick-replies').then((r) => r.data);
export const addQuickReply = (data: any) => api.post('/quick-replies', data).then((r) => r.data);
export const updateQuickReply = (id: string, data: any) => api.put(`/quick-replies/${id}`, data).then((r) => r.data);
export const deleteQuickReply = (id: string) => api.delete(`/quick-replies/${id}`).then((r) => r.data);
export const toggleQuickReply = (id: string, enabled: boolean) => api.put(`/quick-replies/${id}/toggle`, { enabled }).then((r) => r.data);

// Schedules
export const getSchedules = () => api.get('/schedules').then((r) => r.data);
export const addSchedule = (data: any) => api.post('/schedules', data).then((r) => r.data);
export const updateSchedule = (id: string, data: any) => api.put(`/schedules/${id}`, data).then((r) => r.data);
export const deleteSchedule = (id: string) => api.delete(`/schedules/${id}`).then((r) => r.data);
export const toggleSchedule = (id: string, enabled: boolean) => api.put(`/schedules/${id}/toggle`, { enabled }).then((r) => r.data);

// Analytics
export const getAnalytics = (range: string = '30days') => api.get(`/analytics?range=${range}`).then((r) => r.data);

// Settings
export const getSettings = () => api.get('/settings').then((r) => r.data);
export const updateSettings = (data: any) => api.put('/settings', data).then((r) => r.data);

// Admin
export const generateAdminKey = (days: number) => api.post('/admin/generate-key', { days }).then((r) => r.data);
export const getAdminHistory = () => api.get('/admin/history').then((r) => r.data);

// Upload
export const uploadMedia = (formData: FormData) => api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
}).then(r => r.data);

export const uploadContactsCsv = (formData: FormData) => api.post('/contacts/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
}).then(r => r.data);
