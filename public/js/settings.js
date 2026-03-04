/* ═══════════════════════════════════════
   Settings Page
   ═══════════════════════════════════════ */

const settingsProvider = document.getElementById('settingsProvider');
const settingsGeminiKey = document.getElementById('settingsGeminiKey');
const settingsOpenAIKey = document.getElementById('settingsOpenAIKey');
const settingsPrompt = document.getElementById('settingsPrompt');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// Theme selector (may not exist until settings page loads)
let settingsTheme = null;

// ─── Load Settings ───

async function loadSettings() {
    const settings = await api('GET', '/api/settings');

    settingsProvider.value = settings.ai_provider || 'gemini';
    settingsPrompt.value = settings.system_prompt || '';

    // Show masked keys if they exist
    settingsGeminiKey.placeholder = settings.gemini_api_key ? 'Key is set (enter new to change)' : 'Enter Gemini API key';
    settingsOpenAIKey.placeholder = settings.openai_api_key ? 'Key is set (enter new to change)' : 'Enter OpenAI API key';

    // Initialize theme selector
    if (!settingsTheme) {
        settingsTheme = document.getElementById('settingsTheme');
        if (settingsTheme) {
            settingsTheme.addEventListener('change', async () => {
                const theme = settingsTheme.value;
                console.log('[Theme] Switching to:', theme);

                // Cache locally for instantaneous boot
                localStorage.setItem('theme', theme);
                applyTheme(theme);

                // Push to backend SQLite for definitive persistence across ports
                try {
                    await api('PUT', '/api/settings', { theme });
                    console.log('[Theme] Seamlessly synced with database');
                } catch (e) {
                    console.error('[Theme] Failed to sync with database', e);
                }

                toast(`Switched to ${theme === 'light' ? 'Light' : 'Dark'} Mode`, 'success');
            });
        }
    }

    // Load theme preference
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (settingsTheme) {
        settingsTheme.value = savedTheme;
    }
    applyTheme(savedTheme);
}

// ─── Theme Switcher ───

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

// Theme event listener is now attached in loadSettings()


// ─── Save Settings ───

saveSettingsBtn.addEventListener('click', async () => {
    saveSettingsBtn.disabled = true;
    saveSettingsBtn.textContent = 'Saving...';

    const payload = {
        ai_provider: settingsProvider.value,
        system_prompt: settingsPrompt.value,
    };

    // Only send keys if they were changed
    if (settingsGeminiKey.value.trim()) {
        payload.gemini_api_key = settingsGeminiKey.value.trim();
    }
    if (settingsOpenAIKey.value.trim()) {
        payload.openai_api_key = settingsOpenAIKey.value.trim();
    }

    try {
        await api('PUT', '/api/settings', payload);
        toast('Settings saved', 'success');
        settingsGeminiKey.value = '';
        settingsOpenAIKey.value = '';
        loadSettings();
    } catch (err) {
        toast('Failed to save settings', 'error');
    }

    saveSettingsBtn.disabled = false;
    saveSettingsBtn.textContent = '💾 Save Settings';
});
