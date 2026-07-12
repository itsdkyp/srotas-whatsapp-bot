import { z } from 'zod';
import { apiGet, apiPost, apiPut, apiDelete } from '../apiClient.js';
import { wrap } from '../responseHelpers.js';

export function registerQuickReplyTools(server) {
    server.registerTool(
        'list_quick_replies',
        {
            title: 'List Quick Replies',
            description: 'List every keyword quick-reply rule (trigger keyword, label, response text, enabled state).',
            inputSchema: {},
        },
        wrap(async () => apiGet('/quick-replies'))
    );

    server.registerTool(
        'add_quick_reply',
        {
            title: 'Create Quick Reply',
            description:
                'Create a keyword-triggered instant response. When an incoming message matches triggerKey ' +
                '(case-insensitive), the response is sent immediately, before AI auto-reply kicks in.',
            inputSchema: {
                triggerKey: z.string().describe('The keyword that triggers this reply, e.g. "pricing"'),
                label: z.string().describe('A human-readable name for this rule'),
                response: z.string(),
                mediaPath: z.string().optional(),
            },
        },
        wrap(async (args) => apiPost('/quick-replies', args))
    );

    server.registerTool(
        'update_quick_reply',
        {
            title: 'Update Quick Reply',
            description: 'Update an existing quick-reply rule by id.',
            inputSchema: {
                quickReplyId: z.number(),
                triggerKey: z.string().optional(),
                label: z.string().optional(),
                response: z.string().optional(),
                mediaPath: z.string().optional(),
            },
        },
        wrap(async ({ quickReplyId, ...rest }) => apiPut(`/quick-replies/${quickReplyId}`, rest))
    );

    server.registerTool(
        'toggle_quick_reply',
        {
            title: 'Enable/Disable Quick Reply',
            description: 'Turn a quick-reply rule on or off without deleting it.',
            inputSchema: { quickReplyId: z.number(), enabled: z.boolean() },
        },
        wrap(async ({ quickReplyId, enabled }) => apiPut(`/quick-replies/${quickReplyId}/toggle`, { enabled }))
    );

    server.registerTool(
        'delete_quick_reply',
        {
            title: 'Delete Quick Reply',
            description: 'Permanently delete a quick-reply rule by id.',
            inputSchema: { quickReplyId: z.number() },
        },
        wrap(async ({ quickReplyId }) => apiDelete(`/quick-replies/${quickReplyId}`))
    );
}
