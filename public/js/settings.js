/* ═══════════════════════════════════════
   Settings Page
   ═══════════════════════════════════════ */

const settingsProvider = document.getElementById('settingsProvider');
const settingsGeminiKey = document.getElementById('settingsGeminiKey');
const settingsOpenAIKey = document.getElementById('settingsOpenAIKey');
const settingsPrompt = document.getElementById('settingsPrompt');
const settingsMinDelay = document.getElementById('settingsMinDelay');
const settingsMaxDelay = document.getElementById('settingsMaxDelay');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// ─── Load Settings ───

async function loadSettings() {
    const settings = await api('GET', '/api/settings');

    settingsProvider.value = settings.ai_provider || 'gemini';
    settingsPrompt.value = settings.system_prompt || '';
    settingsMinDelay.value = settings.min_delay || '3000';
    settingsMaxDelay.value = settings.max_delay || '5000';

    // Show masked keys if they exist
    settingsGeminiKey.placeholder = settings.gemini_api_key ? 'Key is set (enter new to change)' : 'Enter Gemini API key';
    settingsOpenAIKey.placeholder = settings.openai_api_key ? 'Key is set (enter new to change)' : 'Enter OpenAI API key';
}

// ─── Save Settings ───

saveSettingsBtn.addEventListener('click', async () => {
    saveSettingsBtn.disabled = true;
    saveSettingsBtn.textContent = 'Saving...';

    const payload = {
        ai_provider: settingsProvider.value,
        system_prompt: settingsPrompt.value,
        min_delay: settingsMinDelay.value,
        max_delay: settingsMaxDelay.value,
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
