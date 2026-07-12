import { z } from 'zod';
import { apiGet, apiPost, apiDelete } from '../apiClient.js';
import { wrap } from '../responseHelpers.js';

export function registerCampaignTools(server) {
    server.registerTool(
        'preview_message',
        {
            title: 'Preview a Rendered Message',
            description:
                'Render a template against a sample contact so you can show the user exactly what recipients will ' +
                'see (with {{placeholders}} substituted) before sending. Always do this before send_campaign when ' +
                'the template is new or was just edited.',
            inputSchema: {
                template: z.string(),
                contact: z.object({}).passthrough().optional().describe('A sample contact object, e.g. { name, phone, company }'),
            },
        },
        wrap(async ({ template, contact }) => apiPost('/messages/preview', { template, contact }))
    );

    server.registerTool(
        'send_campaign',
        {
            title: 'Send a Bulk WhatsApp Campaign',
            description:
                'Launch a bulk WhatsApp send. This messages real people immediately once called — it is NOT a ' +
                'draft or a dry run. Before calling this you MUST: ' +
                '(1) resolve sessionId via list_sessions if not already known, confirming the session is "ready"; ' +
                '(2) resolve the target group via list_groups (or pass explicit contactIds) and know the ' +
                'recipient count; (3) show the user a summary — device, group/recipient count, rendered message ' +
                'preview (see preview_message), and delay settings — and get their explicit go-ahead. ' +
                'Provide either "group" or "contactIds", not both. mediaPaths must be paths already returned by ' +
                'upload_media (see generate_campaign_image + upload_media for AI-generated images), not raw file data.',
            inputSchema: {
                sessionId: z.string(),
                group: z.string().optional().describe('Target contact group name; omit if using contactIds'),
                contactIds: z.array(z.number()).optional().describe('Explicit contact ids; omit if using group'),
                template: z.string().describe('Message text, may include {{name}}/{{phone}}/{{company}}/custom-field placeholders'),
                minDelay: z.number().int().optional().describe('Minimum ms between sends; defaults to 8000'),
                maxDelay: z.number().int().optional().describe('Maximum ms between sends; defaults to 18000'),
                mediaPaths: z.array(z.string()).optional(),
                buttons: z.array(z.object({ label: z.string(), response: z.string() })).optional(),
                name: z.string().optional().describe('A name for this campaign, for history/analytics'),
            },
        },
        wrap(async (args) => apiPost('/messages/send-bulk', args))
    );

    server.registerTool(
        'list_campaigns',
        {
            title: 'List Campaign History',
            description:
                'List every past and in-progress campaign with status (running/completed), total/sent/failed ' +
                'counts, and which device/group it used.',
            inputSchema: {},
        },
        wrap(async () => apiGet('/campaigns'))
    );

    server.registerTool(
        'get_campaign',
        {
            title: 'Get Campaign Details',
            description:
                'Get full detail for one campaign: per-recipient message log, error breakdown (e.g. "15 invalid ' +
                'numbers, 5 timeouts"), and duration. Use this to answer "how did campaign X do" or "is it done yet".',
            inputSchema: { campaignId: z.number() },
        },
        wrap(async ({ campaignId }) => apiGet(`/campaigns/${campaignId}`))
    );

    server.registerTool(
        'delete_campaign',
        {
            title: 'Delete Campaign from History',
            description: 'Permanently delete a campaign and its message log from history. Confirm with the user first.',
            inputSchema: { campaignId: z.number() },
        },
        wrap(async ({ campaignId }) => apiDelete(`/campaigns/${campaignId}`))
    );

    server.registerTool(
        'retry_campaign',
        {
            title: 'Retry Failed Messages in a Campaign',
            description:
                'Re-send only the failed messages from a completed campaign, using the given session. This sends ' +
                'real messages — confirm the failure count (via get_campaign) and the device to send from with ' +
                'the user before calling.',
            inputSchema: { campaignId: z.number(), sessionId: z.string() },
        },
        wrap(async ({ campaignId, sessionId }) => apiPost(`/campaigns/${campaignId}/retry`, { sessionId }))
    );

    server.registerTool(
        'restart_campaign',
        {
            title: 'Restart an Entire Campaign',
            description:
                'Re-send a campaign to its ENTIRE original group again (not just the failures), using the given ' +
                'session. This is a full re-send to everyone, including people who already received it — make sure ' +
                'the user actually wants that (vs. retry_campaign for just the failures) and confirm before calling.',
            inputSchema: { campaignId: z.number(), sessionId: z.string() },
        },
        wrap(async ({ campaignId, sessionId }) => apiPost(`/campaigns/${campaignId}/restart`, { sessionId }))
    );
}
