import { z } from 'zod';
import { apiGet, apiPost, apiPut, apiDelete } from '../apiClient.js';
import { wrap } from '../responseHelpers.js';

export function registerContactTools(server) {
    // ── Groups ──────────────────────────────────────────────
    server.registerTool(
        'list_groups',
        {
            title: 'List Contact Groups',
            description:
                'List every contact group with its name, description, and contact count. Call this before ' +
                'send_campaign or any group-scoped action when the user names a group, to confirm it exists ' +
                'and check its size (a "campaign to 5000 people" deserves a confirmation the user did not always ' +
                'think to ask for).',
            inputSchema: {},
        },
        wrap(async () => apiGet('/groups'))
    );

    server.registerTool(
        'add_group',
        {
            title: 'Create Contact Group',
            description: 'Create a new, empty contact group.',
            inputSchema: { name: z.string(), description: z.string().optional() },
        },
        wrap(async ({ name, description }) => apiPost('/groups', { name, description }))
    );

    server.registerTool(
        'rename_group',
        {
            title: 'Rename Contact Group',
            description: 'Rename an existing contact group by its numeric id (from list_groups).',
            inputSchema: { groupId: z.number(), name: z.string() },
        },
        wrap(async ({ groupId, name }) => apiPut(`/groups/${groupId}`, { name }))
    );

    server.registerTool(
        'delete_group',
        {
            title: 'Delete Contact Group',
            description:
                'Delete a contact group by its numeric id. This does not necessarily delete the contacts inside it ' +
                '(see delete_contact_group for deleting a group by name together with its contacts). Confirm with ' +
                'the user before calling.',
            inputSchema: { groupId: z.number() },
        },
        wrap(async ({ groupId }) => apiDelete(`/groups/${groupId}`))
    );

    // ── Contacts ────────────────────────────────────────────
    server.registerTool(
        'list_contacts',
        {
            title: 'List / Search Contacts',
            description:
                'List contacts, optionally filtered by group name and/or a search term (matches name, phone, or ' +
                'company), paginated. Returns { contacts: [...], total }. Contact names already reflect resolved ' +
                'WhatsApp push names for unsaved numbers, so you can trust the "name" field even for contacts ' +
                'never manually saved.',
            inputSchema: {
                group: z.string().optional().describe('Group name to filter by; omit or "all" for every group'),
                search: z.string().optional(),
                page: z.number().int().min(1).default(1),
                limit: z.number().int().min(1).max(1000).default(50),
            },
        },
        wrap(async ({ group, search, page, limit }) => apiGet('/contacts', { group, search, page, limit }))
    );

    server.registerTool(
        'export_contacts_csv',
        {
            title: 'Export Contacts as CSV',
            description: 'Export all contacts (optionally filtered by group) as CSV text (phone,name,company,group_name).',
            inputSchema: { group: z.string().optional() },
        },
        wrap(async ({ group }) => apiGet('/contacts/export-csv', { group }))
    );

    server.registerTool(
        'add_contact',
        {
            title: 'Add a Contact',
            description: 'Add a single contact. Phone must include country code (e.g. +919876543210).',
            inputSchema: {
                phone: z.string(),
                name: z.string().optional(),
                company: z.string().optional(),
                group: z.string().optional().describe('Defaults to "default" if omitted'),
            },
        },
        wrap(async (args) => apiPost('/contacts', args))
    );

    server.registerTool(
        'import_contacts',
        {
            title: 'Bulk Import Contacts',
            description:
                'Bulk-insert an array of contacts into a group (creating the group if it does not exist yet). ' +
                'Use this for CSV-like data the user has pasted or described — build the array of {phone, name, ' +
                'company} objects yourself from what they gave you.',
            inputSchema: {
                contacts: z.array(z.object({
                    phone: z.string(),
                    name: z.string().optional(),
                    company: z.string().optional(),
                })).min(1),
                group: z.string().optional().describe('Defaults to "default" if omitted'),
            },
        },
        wrap(async ({ contacts, group }) => apiPost('/contacts/import', { contacts, group }))
    );

    server.registerTool(
        'sync_whatsapp_contacts',
        {
            title: 'Sync Contacts from WhatsApp',
            description:
                'Pull the phone\'s personal WhatsApp contact list for a given (ready) session. This reads from ' +
                'the linked phone\'s own contacts, not the app\'s CRM database — the user should then decide ' +
                'whether to import_contacts any of the results.',
            inputSchema: { sessionId: z.string() },
        },
        wrap(async ({ sessionId }) => apiGet(`/contacts/sync/${sessionId}`))
    );

    server.registerTool(
        'get_whatsapp_groups',
        {
            title: 'List WhatsApp Groups (from the phone)',
            description: 'List the WhatsApp groups (not CRM contact groups) that a given ready session is a member of.',
            inputSchema: { sessionId: z.string() },
        },
        wrap(async ({ sessionId }) => apiGet(`/contacts/wa-groups/${sessionId}`))
    );

    server.registerTool(
        'grab_group_contacts',
        {
            title: 'Grab Members of a WhatsApp Group',
            description:
                'Fetch the phone numbers/names of every participant in a specific WhatsApp group (from get_whatsapp_groups). ' +
                'Useful for turning a WhatsApp group\'s membership into a CRM contact group via import_contacts.',
            inputSchema: { sessionId: z.string(), groupId: z.string().describe('WhatsApp group JID, e.g. "1234567890-1234567890@g.us"') },
        },
        wrap(async ({ sessionId, groupId }) => apiGet(`/contacts/grab-group/${sessionId}/${groupId}`))
    );

    server.registerTool(
        'delete_contact',
        {
            title: 'Delete a Contact',
            description: 'Delete a single contact by its numeric id. Confirm with the user first.',
            inputSchema: { contactId: z.number() },
        },
        wrap(async ({ contactId }) => apiDelete(`/contacts/${contactId}`))
    );

    server.registerTool(
        'delete_contact_group',
        {
            title: 'Delete a Contact Group (by name) and its Contacts',
            description:
                'Delete a contact group by name, along with the contacts in it. This is destructive and cannot be ' +
                'undone — always tell the user how many contacts are in the group (via list_groups) and get ' +
                'explicit confirmation before calling this.',
            inputSchema: { groupName: z.string() },
        },
        wrap(async ({ groupName }) => apiDelete(`/contacts/group/${encodeURIComponent(groupName)}`))
    );

    server.registerTool(
        'bulk_delete_contacts',
        {
            title: 'Bulk Delete Contacts',
            description:
                'Delete multiple contacts by id in one call. Destructive and cannot be undone — always state how ' +
                'many contacts and (if known) which group before calling, and get explicit confirmation.',
            inputSchema: { contactIds: z.array(z.number()).min(1) },
        },
        wrap(async ({ contactIds }) => apiPost('/contacts/bulk-delete', { contactIds }))
    );

    server.registerTool(
        'move_contacts_to_group',
        {
            title: 'Move or Copy Contacts to a Group',
            description:
                'Move (or copy, if copy=true) a set of contacts into a target group, creating the group if needed.',
            inputSchema: {
                contactIds: z.array(z.number()).min(1),
                group: z.string(),
                copy: z.boolean().optional().describe('If true, duplicates contacts into the target group instead of moving them'),
            },
        },
        wrap(async ({ contactIds, group, copy }) => apiPost('/contacts/move-to-group', { contactIds, group, copy }))
    );
}
