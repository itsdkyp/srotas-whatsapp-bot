import { z } from 'zod';
import { apiGet, apiPut } from '../apiClient.js';
import { wrap } from '../responseHelpers.js';

export function registerSettingsTools(server) {
    server.registerTool(
        'get_settings',
        {
            title: 'Get Application Settings',
            description:
                'Get current AI provider/model, system prompts, send-delay defaults, anti-ban configuration, and ' +
                'whether a Gemini/OpenAI key or company logo is configured. API keys are returned as-is if set — ' +
                'treat them as sensitive, do not print them back to the user unless they specifically ask to see them.',
            inputSchema: {},
        },
        wrap(async () => apiGet('/settings'))
    );

    server.registerTool(
        'update_settings',
        {
            title: 'Update Application Settings',
            description:
                'Update one or more settings fields; only pass what should change, everything else is left as-is. ' +
                'Changing gemini_api_key/openai_api_key replaces live API credentials — confirm with the user ' +
                'before changing those two specifically. Changing system_prompt/image_generation_prompt affects ' +
                'live AI behavior immediately for all future messages/images.',
            inputSchema: {
                theme: z.enum(['dark', 'light']).optional(),
                ai_provider: z.enum(['gemini', 'openai']).optional(),
                ai_model: z.string().optional(),
                ai_image_model: z.string().optional(),
                ai_chat_history: z.boolean().optional(),
                ai_chat_history_limit: z.number().optional(),
                ai_use_system_prompt: z.boolean().optional(),
                system_prompt: z.string().optional(),
                image_generation_prompt: z.string().optional(),
                min_delay: z.union([z.string(), z.number()]).optional(),
                max_delay: z.union([z.string(), z.number()]).optional(),
                gemini_api_key: z.string().optional(),
                openai_api_key: z.string().optional(),
                anti_ban_enabled: z.boolean().optional(),
                anti_ban_ignore_bots: z.boolean().optional(),
                anti_ban_cooldown_sec: z.union([z.string(), z.number()]).optional(),
                anti_ban_typing_delay_min: z.union([z.string(), z.number()]).optional(),
                anti_ban_typing_delay_max: z.union([z.string(), z.number()]).optional(),
            },
        },
        wrap(async (args) => apiPut('/settings', args))
    );
}
