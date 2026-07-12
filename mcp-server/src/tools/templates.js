import { z } from 'zod';
import { apiGet, apiPost, apiPut, apiDelete } from '../apiClient.js';
import { wrap } from '../responseHelpers.js';

export function registerTemplateTools(server) {
    server.registerTool(
        'list_templates',
        {
            title: 'List Message Templates',
            description: 'List every saved message template (name, content, media, buttons). Check here before writing a campaign message from scratch — the user may already have one.',
            inputSchema: {},
        },
        wrap(async () => apiGet('/templates'))
    );

    server.registerTool(
        'add_template',
        {
            title: 'Create Message Template',
            description:
                'Save a reusable message template. Use {{name}}, {{phone}}, {{company}}, or any custom contact ' +
                'field as placeholders — they get substituted per-recipient when sent. mediaPaths should be paths ' +
                'returned by upload_media (e.g. "/api/media/file/xyz.png"), not raw file data.',
            inputSchema: {
                name: z.string(),
                content: z.string(),
                mediaPaths: z.array(z.string()).optional(),
                buttons: z.array(z.object({ label: z.string(), response: z.string() })).optional(),
            },
        },
        wrap(async (args) => apiPost('/templates', args))
    );

    server.registerTool(
        'update_template',
        {
            title: 'Update Message Template',
            description: 'Update an existing template by id. Only the fields you pass are relevant — check list_templates first for the current values.',
            inputSchema: {
                templateId: z.number(),
                name: z.string().optional(),
                content: z.string().optional(),
                mediaPaths: z.array(z.string()).optional(),
                buttons: z.array(z.object({ label: z.string(), response: z.string() })).optional(),
            },
        },
        wrap(async ({ templateId, ...rest }) => apiPut(`/templates/${templateId}`, rest))
    );

    server.registerTool(
        'delete_template',
        {
            title: 'Delete Message Template',
            description: 'Delete a template by id. Confirm with the user first.',
            inputSchema: { templateId: z.number() },
        },
        wrap(async ({ templateId }) => apiDelete(`/templates/${templateId}`))
    );
}
