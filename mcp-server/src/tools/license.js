import { apiGet } from '../apiClient.js';
import { wrap } from '../responseHelpers.js';

export function registerLicenseTools(server) {
    server.registerTool(
        'get_license_status',
        {
            title: 'Get License Status',
            description:
                'Check whether the Srotas WhatsApp Bot license is activated, and its expiry/days remaining. ' +
                'Call this first if any other tool call fails with an activation-related error, to confirm ' +
                'whether the app needs to be activated before anything else will work.',
            inputSchema: {},
        },
        wrap(async () => apiGet('/license-status'))
    );
}
