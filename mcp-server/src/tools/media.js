import { z } from 'zod';
import FormData from 'form-data';
import { apiPost, apiPostForm, apiDelete } from '../apiClient.js';
import { wrap } from '../responseHelpers.js';

export function registerMediaTools(server) {
    server.registerTool(
        'generate_campaign_image',
        {
            title: 'Generate a Campaign Image with AI',
            description:
                'Generate a marketing image from campaign message text via Gemini (requires a configured Gemini ' +
                'API key — check get_settings\'s gemini_api_key first). If a company logo is configured, it is ' +
                'composited into the image automatically. Returns { image: base64, mimetype }. This image is NOT ' +
                'yet usable in a campaign — pass the returned image/mimetype into upload_media next (with a ' +
                'filename you choose) to get a path usable in send_campaign\'s or add_template\'s mediaPaths.',
            inputSchema: { message: z.string().describe('The campaign message text the image should be generated from') },
        },
        wrap(async ({ message }) => apiPost('/media/generate-image', { message }))
    );

    server.registerTool(
        'upload_media',
        {
            title: 'Upload Media Files',
            description:
                'Upload one or more files (base64-encoded) to use as campaign/template attachments. Returns an ' +
                'array of { path, filename, mimetype, size } — use the "path" values as mediaPaths in send_campaign ' +
                'or add_template/update_template. This is also the second step after generate_campaign_image.',
            inputSchema: {
                files: z.array(z.object({
                    base64: z.string().describe('Base64-encoded file contents (no data: URI prefix)'),
                    filename: z.string(),
                    mimetype: z.string().optional(),
                })).min(1).max(10),
            },
        },
        wrap(async ({ files }) => {
            const form = new FormData();
            for (const f of files) {
                const buffer = Buffer.from(f.base64, 'base64');
                form.append('media', buffer, { filename: f.filename, contentType: f.mimetype || 'application/octet-stream' });
            }
            return apiPostForm('/media/upload', form);
        })
    );

    server.registerTool(
        'upload_company_logo',
        {
            title: 'Upload Company Logo',
            description:
                'Upload a company logo (PNG/JPG/WEBP, 5 MB max, base64-encoded) that gets composited into every ' +
                'AI-generated campaign image from now on.',
            inputSchema: {
                base64: z.string().describe('Base64-encoded image contents (no data: URI prefix)'),
                filename: z.string(),
                mimetype: z.string().optional(),
            },
        },
        wrap(async ({ base64, filename, mimetype }) => {
            const form = new FormData();
            form.append('logo', Buffer.from(base64, 'base64'), { filename, contentType: mimetype || 'image/png' });
            return apiPostForm('/settings/logo', form);
        })
    );

    server.registerTool(
        'delete_company_logo',
        {
            title: 'Remove Company Logo',
            description: 'Remove the configured company logo so future AI-generated images no longer include it.',
            inputSchema: {},
        },
        wrap(async () => apiDelete('/settings/logo'))
    );
}
