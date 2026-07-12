import { z } from 'zod';
import { apiGet, apiPost, apiPut, apiDelete } from '../apiClient.js';
import { wrap } from '../responseHelpers.js';

export function registerSchedulerTools(server) {
    server.registerTool(
        'list_schedules',
        {
            title: 'List Scheduled Campaigns',
            description: 'List every recurring/scheduled campaign with its device, group, template, frequency, and next-run time.',
            inputSchema: {},
        },
        wrap(async () => apiGet('/schedules'))
    );

    server.registerTool(
        'add_schedule',
        {
            title: 'Create a Scheduled Campaign',
            description:
                'Create a recurring or one-off scheduled send. Resolve sessionId via list_sessions and groupName ' +
                'via list_groups first if not already known. This will actually fire automatically at the ' +
                'scheduled time(s) going forward, so confirm the schedule details with the user before creating it.',
            inputSchema: {
                name: z.string(),
                sessionId: z.string(),
                groupName: z.string(),
                template: z.string(),
                frequency: z.enum(['once', 'daily', 'weekly', 'monthly']),
                dayOfWeek: z.number().int().min(0).max(6).optional().describe('0=Sunday..6=Saturday, required for weekly'),
                dayOfMonth: z.number().int().min(1).max(31).optional().describe('Required for monthly'),
                sendTime: z.string().optional().describe('24h "HH:MM", e.g. "09:00"'),
            },
        },
        wrap(async (args) => apiPost('/schedules', args))
    );

    server.registerTool(
        'update_schedule',
        {
            title: 'Update a Scheduled Campaign',
            description: 'Update fields of an existing schedule by id. Only pass what should change.',
            inputSchema: {
                scheduleId: z.number(),
                name: z.string().optional(),
                sessionId: z.string().optional(),
                groupName: z.string().optional(),
                template: z.string().optional(),
                frequency: z.enum(['once', 'daily', 'weekly', 'monthly']).optional(),
                dayOfWeek: z.number().int().min(0).max(6).optional(),
                dayOfMonth: z.number().int().min(1).max(31).optional(),
                sendTime: z.string().optional(),
            },
        },
        wrap(async ({ scheduleId, ...rest }) => apiPut(`/schedules/${scheduleId}`, rest))
    );

    server.registerTool(
        'toggle_schedule',
        {
            title: 'Enable/Disable a Schedule',
            description: 'Turn a schedule on or off without deleting it.',
            inputSchema: { scheduleId: z.number(), enabled: z.boolean() },
        },
        wrap(async ({ scheduleId, enabled }) => apiPut(`/schedules/${scheduleId}/toggle`, { enabled }))
    );

    server.registerTool(
        'delete_schedule',
        {
            title: 'Delete a Schedule',
            description: 'Permanently delete a scheduled campaign. Confirm with the user first.',
            inputSchema: { scheduleId: z.number() },
        },
        wrap(async ({ scheduleId }) => apiDelete(`/schedules/${scheduleId}`))
    );
}
