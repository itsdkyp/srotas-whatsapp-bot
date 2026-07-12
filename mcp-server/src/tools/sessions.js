import { z } from 'zod';
import { apiGet, apiPost, apiPut, apiDelete } from '../apiClient.js';
import { wrap } from '../responseHelpers.js';

export function registerSessionTools(server) {
    server.registerTool(
        'list_sessions',
        {
            title: 'List WhatsApp Sessions (Devices)',
            description:
                'List every linked WhatsApp device (session) with its id, name, phone number, and status ' +
                '(ready, qr, initializing, disconnected). Only sessions with status "ready" can send messages. ' +
                'Always call this before send_campaign, retry_campaign, restart_campaign, or any other tool that ' +
                'takes a sessionId, unless the user already gave you an exact session id in this conversation. ' +
                'Match the device the user names (by label or phone) to its id yourself — if more than one ' +
                '"ready" session could match, or the user did not say which device to use, ask them instead of guessing.',
            inputSchema: {},
        },
        wrap(async () => apiGet('/sessions'))
    );

    server.registerTool(
        'add_session',
        {
            title: 'Add a New WhatsApp Session',
            description:
                'Create a new WhatsApp device slot with the given label, starting the QR-linking flow. ' +
                'This returns a QR payload that CANNOT be scanned from a chat interface. After calling this, ' +
                'tell the user to open the Srotas WhatsApp Bot dashboard, go to Devices, and scan the QR code ' +
                'shown there using their phone (WhatsApp > Settings > Linked Devices > Link a Device).',
            inputSchema: {
                name: z.string().describe('A label for this device, e.g. "Sales Team" or "Support Line 2"'),
            },
        },
        wrap(async ({ name }) => apiPost('/sessions', { name }))
    );

    server.registerTool(
        'delete_session',
        {
            title: 'Delete a WhatsApp Session',
            description:
                'Permanently log out and remove a WhatsApp device/session, including its local auth. ' +
                'This is destructive and cannot be undone from chat (the phone would need to re-link via QR). ' +
                'Always state which device (name/phone) you are about to remove and get explicit confirmation ' +
                'from the user before calling this.',
            inputSchema: { sessionId: z.string().describe('The session id, from list_sessions') },
        },
        wrap(async ({ sessionId }) => apiDelete(`/sessions/${sessionId}`))
    );

    server.registerTool(
        'restart_session',
        {
            title: 'Restart a WhatsApp Session',
            description: 'Force-restart a device\'s WhatsApp socket connection. Use this when a session is stuck, showing "disconnected", or not responding — it does not require re-scanning a QR code if the auth is still valid.',
            inputSchema: { sessionId: z.string() },
        },
        wrap(async ({ sessionId }) => apiPost(`/sessions/${sessionId}/restart`))
    );

    server.registerTool(
        'relink_session',
        {
            title: 'Relink a WhatsApp Session (New QR Code)',
            description:
                'Generate a fresh QR code for an existing session slot, e.g. after it was logged out from the ' +
                'phone side. Same caveat as add_session: tell the user to scan the QR from the dashboard, not from chat.',
            inputSchema: { sessionId: z.string() },
        },
        wrap(async ({ sessionId }) => apiPost(`/sessions/${sessionId}/relink`))
    );

    server.registerTool(
        'set_auto_reply',
        {
            title: 'Toggle Legacy Auto-Reply',
            description: 'Enable or disable the legacy auto-reply flag for a session.',
            inputSchema: { sessionId: z.string(), enabled: z.boolean() },
        },
        wrap(async ({ sessionId, enabled }) => apiPut(`/sessions/${sessionId}/auto-reply`, { enabled }))
    );

    server.registerTool(
        'set_ai_replies',
        {
            title: 'Toggle AI Auto-Reply',
            description:
                'Enable or disable Gemini/OpenAI-powered conversational auto-reply for a specific WhatsApp session. ' +
                'When enabling, it is worth confirming the AI provider/system prompt is configured the way the ' +
                'user wants first (see get_settings / update_settings).',
            inputSchema: { sessionId: z.string(), enabled: z.boolean() },
        },
        wrap(async ({ sessionId, enabled }) => apiPut(`/sessions/${sessionId}/ai-replies`, { enabled }))
    );

    server.registerTool(
        'set_quick_replies',
        {
            title: 'Toggle Quick Replies',
            description: 'Enable or disable keyword quick-reply triggers for a specific WhatsApp session.',
            inputSchema: { sessionId: z.string(), enabled: z.boolean() },
        },
        wrap(async ({ sessionId, enabled }) => apiPut(`/sessions/${sessionId}/quick-replies`, { enabled }))
    );
}
