/* ═══════════════════════════════════════
   Main Application — Router & Utilities
   ═══════════════════════════════════════ */

const socket = io();

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
    if (pageName === 'sessions') loadSessions();
    if (pageName === 'contacts') loadContacts();
    if (pageName === 'messaging') loadMessagingPage();
    if (pageName === 'scheduler') loadScheduler();
    if (pageName === 'quickreplies') loadQuickReplies();
    if (pageName === 'settings') loadSettings();
}

// ─── Socket.IO Status ───

const socketStatusDot = document.getElementById('socketStatus');

socket.on('connect', () => {
    socketStatusDot.classList.add('connected');
});

socket.on('disconnect', () => {
    socketStatusDot.classList.remove('connected');
});

// ─── Utility Functions ───

async function api(method, url, body) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
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

// ─── Initial Load ───
loadSessions();
