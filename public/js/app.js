/* ═══════════════════════════════════════
   Main Application — Router & Utilities
   ═══════════════════════════════════════ */

const socket = io();

// ─── Apply Theme Immediately ───
(function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
})();

// ─── Toast Notifications ───

function createToastContainer() {
    if (document.querySelector('.toast-container')) return;
    const c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
}
createToastContainer();

function toast(message, type = 'info') {
    const container = document.querySelector('.toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    t.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// ─── SPA Router ───

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const pageName = item.dataset.page;
        navigateTo(pageName);
    });
});

function navigateTo(pageName) {
    navItems.forEach(n => n.classList.remove('active'));
    pages.forEach(p => p.classList.remove('active'));

    const navEl = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    const pageEl = document.getElementById(`page-${pageName}`);

    if (navEl) navEl.classList.add('active');
    if (pageEl) pageEl.classList.add('active');

    // Trigger page-specific refresh
    if (pageName === 'dashboard') loadDashboard();
    if (pageName === 'sessions') loadSessions();
    if (pageName === 'contacts') loadContacts();
    if (pageName === 'messaging') loadMessagingPage();
    if (pageName === 'scheduler') loadScheduler();
    if (pageName === 'templates') loadTemplatesPage();
    if (pageName === 'quickreplies') loadQuickReplies();
    if (pageName === 'settings') loadSettings();
    if (pageName === 'help') loadHelpPage();
}

// ─── Smart System Status Indicator ───

const systemStatusDot = document.getElementById('systemStatus');

// Update system status based on sessions and campaigns
async function updateSystemStatus() {
    try {
        const sessions = await api('GET', '/api/sessions');
        const campaigns = await api('GET', '/api/campaigns');

        // Determine status
        const hasAnySessions = sessions && sessions.length > 0;
        const connectedSessions = sessions.filter(s => s.status === 'ready');
        const hasConnected = connectedSessions.length > 0;

        // Check if any session has auto-features enabled
        // Master switch (auto_reply) must be ON for features to be active
        const hasAutoFeatures = connectedSessions.some(s =>
            s.auto_reply && (s.ai_replies_enabled || s.quick_replies_enabled)
        );

        // Check if any campaign is currently running
        const runningCampaigns = campaigns.filter(c => c.status === 'running');
        const hasRunningCampaign = runningCampaigns.length > 0;

        // Remove all status classes
        systemStatusDot.className = 'status-dot';

        // Apply appropriate status
        if (!hasAnySessions) {
            // Red: No sessions at all
            systemStatusDot.classList.add('status-offline');
            systemStatusDot.title = 'No sessions configured';
        } else if (!hasConnected) {
            // Yellow: Sessions exist but none connected
            systemStatusDot.classList.add('status-disconnected');
            systemStatusDot.title = 'Sessions disconnected';
        } else if (hasRunningCampaign) {
            // Green (fast blink): Campaign running
            systemStatusDot.classList.add('status-running');
            systemStatusDot.title = `Campaign running (${runningCampaigns.length})`;
        } else if (hasAutoFeatures) {
            // Green (slow blink): Auto-features enabled
            systemStatusDot.classList.add('status-active');
            systemStatusDot.title = 'Auto-reply features active';
        } else {
            // Green (solid): Connected but idle
            systemStatusDot.classList.add('status-connected');
            systemStatusDot.title = `${connectedSessions.length} session(s) connected`;
        }
    } catch (err) {
        console.error('[SystemStatus] Update failed:', err);
        systemStatusDot.className = 'status-dot status-offline';
        systemStatusDot.title = 'Status check failed';
    }
}

// Update status every 3 seconds
setInterval(updateSystemStatus, 3000);

// Initial update
updateSystemStatus();

// ─── Utility Functions ───

async function api(method, url, body) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);

    // Guard against non-JSON responses (e.g. HTML error pages)
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        throw new Error(`Server error (${res.status}): expected JSON but got ${contentType || 'unknown content type'}`);
    }

    const data = await res.json();
    if (!res.ok || data.error) {
        throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getFileIcon(filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    const icons = {
        jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
        pdf: '📕', doc: '📄', docx: '📄', xls: '📊', xlsx: '📊',
        mp3: '🎵', wav: '🎵', ogg: '🎵', m4a: '🎵',
        mp4: '🎬', avi: '🎬', mov: '🎬', mkv: '🎬',
    };
    return icons[ext] || '📎';
}

// ─── Initial Load ───
// Defer initial load until all scripts are ready
window.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Activation Status First
    try {
        const res = await fetch('/api/license-status');
        const data = await res.json();

        if (!data.activated) {
            document.getElementById('activationOverlay').style.display = 'flex';
            document.getElementById('mainAppContainer').style.display = 'none';
            setupActivationHandler();
            return; // Stop initialization if not activated
        } else {
            // Hide overlay, show app
            document.getElementById('activationOverlay').style.display = 'none';
            document.getElementById('mainAppContainer').style.display = 'flex';
            if (typeof loadDashboard === 'function') loadDashboard();
        }
    } catch (err) {
        console.error('Failed to check license status', err);
    }
});

function setupActivationHandler() {
    const btn = document.getElementById('activateBtn');
    const input = document.getElementById('activationKeyInput');
    const errEl = document.getElementById('activationError');
    const emojiStr = document.getElementById('activateEmoji');

    let clickCount = 0;
    if (emojiStr) {
        emojiStr.addEventListener('click', () => {
            clickCount++;
            if (clickCount >= 20) {
                input.value = 'SROTAS-EASTER-EGG-2026';
                btn.click();
                clickCount = 0; // reset
            }
        });
    }

    btn.addEventListener('click', async () => {
        const key = input.value.trim();
        errEl.style.display = 'none';

        if (!key) {
            errEl.textContent = 'Please enter a key.';
            errEl.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Verifying...';

        try {
            const data = await api('POST', '/api/activate', { key });
            if (data.success) {
                // Success! Reload to start app normally
                window.location.reload();
            }
        } catch (err) {
            errEl.textContent = err.message || 'Invalid key. Please try again.';
            errEl.style.display = 'block';
        }

        btn.disabled = false;
        btn.textContent = 'Activate License';
    });
}
