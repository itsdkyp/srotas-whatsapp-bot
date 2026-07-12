import { z } from 'zod';
import { apiGet } from '../apiClient.js';
import { wrap } from '../responseHelpers.js';

export function registerAnalyticsTools(server) {
    server.registerTool(
        'get_analytics',
        {
            title: 'Get Analytics Dashboard',
            description:
                'Get aggregate stats for a time range: total messages, people reached, media sent, delivery rate, ' +
                'message trends over time, AI auto-reply stats, quick-reply stats, and top campaigns. Use this for ' +
                '"how are we doing" / "how did this week go" type questions rather than summing list_campaigns yourself.',
            inputSchema: {
                range: z.enum(['today', 'yesterday', '7days', '30days', 'all']).default('30days'),
            },
        },
        wrap(async ({ range }) => apiGet('/analytics', { range }))
    );

    server.registerTool(
        'get_messages',
        {
            title: 'Get Recent Messages',
            description:
                'Get recent inbound/outbound message log, optionally filtered to one contact\'s phone number. ' +
                'Useful for reviewing a specific conversation\'s history.',
            inputSchema: {
                phone: z.string().optional(),
                limit: z.number().int().optional().describe('Defaults to 50 when phone is given, 100 otherwise'),
            },
        },
        wrap(async ({ phone, limit }) => apiGet('/messages', { phone, limit }))
    );
}
