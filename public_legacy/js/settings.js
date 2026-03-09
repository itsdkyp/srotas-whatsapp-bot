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
    loadLicenseInfo();
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

// ─── License Info ───

async function loadLicenseInfo() {
    try {
        const data = await api('GET', '/api/license-status');

        const keyEl = document.getElementById('licenseKeyMasked');
        const badgeEl = document.getElementById('licenseStatusBadge');
        const expiryEl = document.getElementById('licenseExpiry');
        const daysEl = document.getElementById('licenseDaysRemaining');
        if (!keyEl) return;

        if (!data.activated) {
            badgeEl.textContent = 'NOT ACTIVATED';
            badgeEl.style.background = 'rgba(var(--danger-rgb,220,53,69),0.15)';
            badgeEl.style.color = 'var(--danger)';
            return;
        }

        if (data.isLifetime) {
            keyEl.textContent = 'SROTAS-EASTER-EGG';
            expiryEl.textContent = 'Never';
            daysEl.textContent = '∞';
            daysEl.style.color = '#a855f7';
            badgeEl.textContent = '✨ LIFETIME';
            badgeEl.style.background = 'rgba(168,85,247,0.15)';
            badgeEl.style.color = '#a855f7';
            return;
        }

        keyEl.textContent = data.keyMasked || '—';
        expiryEl.textContent = data.expiryDate
            ? new Date(data.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';

        const days = data.daysRemaining ?? 0;
        daysEl.textContent = days;

        if (days > 30) {
            daysEl.style.color = '#22c55e';
            badgeEl.textContent = '✅ ACTIVE';
            badgeEl.style.background = 'rgba(34,197,94,0.15)';
            badgeEl.style.color = '#22c55e';
        } else if (days > 7) {
            daysEl.style.color = '#f59e0b';
            badgeEl.textContent = '⚠️ EXPIRING SOON';
            badgeEl.style.background = 'rgba(245,158,11,0.15)';
            badgeEl.style.color = '#f59e0b';
        } else {
            daysEl.style.color = 'var(--danger)';
            badgeEl.textContent = '🔴 CRITICAL';
            badgeEl.style.background = 'rgba(220,53,69,0.15)';
            badgeEl.style.color = 'var(--danger)';
        }
    } catch (e) {
        console.error('[License] Failed to load license info', e);
    }
}
