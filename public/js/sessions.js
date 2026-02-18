/* ═══════════════════════════════════════
   Sessions Page
   ═══════════════════════════════════════ */

const sessionsList = document.getElementById('sessionsList');
const addSessionBtn = document.getElementById('addSessionBtn');
const addSessionModal = document.getElementById('addSessionModal');
const addSessionModalClose = document.getElementById('addSessionModalClose');
const sessionNameInput = document.getElementById('sessionNameInput');
const createSessionBtn = document.getElementById('createSessionBtn');
const qrModal = document.getElementById('qrModal');
const qrModalClose = document.getElementById('qrModalClose');
const qrContainer = document.getElementById('qrContainer');

let pendingQrSessionId = null;

// ─── Load Sessions ───

let _sessionsLoaded = false;

async function loadSessions() {
  // Show skeleton only on first load
  if (!_sessionsLoaded) {
    sessionsList.innerHTML = renderSessionSkeletons(3);
  }
  try {
    const sessions = await api('GET', '/api/sessions');
    _sessionsLoaded = true;
    renderSessions(sessions);
  } catch (err) {
    sessionsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>Failed to load sessions</p>
        <button class="btn btn-primary" onclick="loadSessions()">Retry</button>
      </div>`;
  }
}

function renderSessionSkeletons(count) {
  return Array.from({ length: count }, () => `
    <div class="session-card skeleton-card">
      <div class="session-card-header">
        <span class="skeleton-text" style="width:120px;height:18px;"></span>
        <span class="skeleton-text" style="width:80px;height:22px;border-radius:20px;"></span>
      </div>
      <div class="skeleton-text" style="width:140px;height:14px;margin-bottom:16px;"></div>
      <div style="display:flex;gap:8px;">
        <span class="skeleton-text" style="width:80px;height:32px;border-radius:8px;"></span>
        <span class="skeleton-text" style="width:70px;height:32px;border-radius:8px;"></span>
      </div>
    </div>
  `).join('');
}

function renderSessions(sessions) {
  if (!sessions.length) {
    sessionsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📱</div>
        <p>No WhatsApp sessions yet</p>
        <button class="btn btn-primary" onclick="openAddSessionModal()">Add Your First Account</button>
      </div>
    `;
    return;
  }

  sessionsList.innerHTML = sessions.map(s => {
    const isBroken = ['error', 'disconnected', 'auth_failure'].includes(s.status);
    const isQrPending = s.status === 'qr_pending';
    const isInitializing = s.status === 'initializing';
    const isReady = s.status === 'ready';
    return `
    <div class="session-card" data-id="${s.id}">
      <div class="session-card-header">
        <span class="session-name">${escapeHtml(s.name)}</span>
        <span class="session-status ${s.status}">${formatStatus(s.status)}</span>
      </div>
      <div class="session-phone">${s.phone ? '+' + s.phone : 'Not connected'}</div>
      ${isBroken ? `<div class="session-broken-hint">Device link is broken or session lost connection.</div>` : ''}

      ${isReady ? `
        <div class="session-toggles">
          <div class="master-toggle">
            <label class="toggle-label master">
              <span class="toggle">
                <input type="checkbox" id="autoReply_${s.id}" ${s.auto_reply ? 'checked' : ''} onchange="toggleAutoReply('${s.id}', this.checked)" />
                <span class="toggle-slider"></span>
              </span>
              <span>
                <strong>Auto-Reply</strong>
                <span class="toggle-hint">Master switch - enables all responses</span>
              </span>
            </label>
          </div>
          <div class="sub-toggles" style="${s.auto_reply ? '' : 'opacity:0.5;pointer-events:none;'}">
            <label class="toggle-label">
              <span class="toggle">
                <input type="checkbox" ${s.auto_reply && s.ai_replies_enabled ? 'checked' : ''} onchange="toggleAiReplies('${s.id}', this.checked)" ${s.auto_reply ? '' : 'disabled'} />
                <span class="toggle-slider"></span>
              </span>
              🧠 AI Replies
            </label>
            <label class="toggle-label">
              <span class="toggle">
                <input type="checkbox" ${s.auto_reply && s.quick_replies_enabled ? 'checked' : ''} onchange="toggleQuickReplies('${s.id}', this.checked)" ${s.auto_reply ? '' : 'disabled'} />
                <span class="toggle-slider"></span>
              </span>
              ⚡ Quick Replies
            </label>
          </div>
        </div>
      ` : ''}

      <div class="session-actions">
        ${isQrPending ? `<button class="btn btn-primary btn-sm" onclick="showQrForSession('${s.id}', '${escapeHtml(s.name)}')">⬜ Show QR Code</button>` : ''}
        ${isBroken ? `
          <button class="btn btn-success btn-sm" onclick="relinkSession('${s.id}', '${escapeHtml(s.name)}')">🔗 Relink</button>
          <button class="btn btn-primary btn-sm" onclick="restartSession('${s.id}')">🔄 Restart</button>
        ` : ''}
        ${isInitializing ? `<span style="font-size:12px;color:var(--text-muted);">Starting up...</span>` : ''}
        <button class="btn btn-danger btn-sm" onclick="deleteSession('${s.id}')">Remove</button>
      </div>
    </div>`;
  }).join('');
}

function formatStatus(status) {
  const labels = {
    ready: '● Connected',
    qr_pending: '◌ QR Ready',
    initializing: '◌ Starting...',
    disconnected: '○ Offline',
    error: '✕ Error',
    auth_failure: '✕ Auth Failed',
  };
  return labels[status] || status;
}

// ─── Add Session Flow ───

function openAddSessionModal() {
  sessionNameInput.value = '';
  addSessionModal.classList.add('active');
  sessionNameInput.focus();
}

addSessionBtn.addEventListener('click', openAddSessionModal);

addSessionModalClose.addEventListener('click', () => {
  addSessionModal.classList.remove('active');
});

createSessionBtn.addEventListener('click', async () => {
  const name = sessionNameInput.value.trim();
  if (!name) return toast('Enter a session name', 'error');

  createSessionBtn.disabled = true;
  createSessionBtn.textContent = 'Creating...';

  try {
    const result = await api('POST', '/api/sessions', { name });
    pendingQrSessionId = result.sessionId;
    addSessionModal.classList.remove('active');

    // Show QR modal
    qrContainer.innerHTML = `
      <div class="qr-loading">
        <div class="spinner"></div>
        <p>Initializing session "${escapeHtml(name)}"...</p>
        <p class="qr-hint">A QR code will appear here momentarily</p>
      </div>
    `;
    qrModal.classList.add('active');
    toast(`Session "${name}" created`, 'success');
    loadSessions();
  } catch (err) {
    toast(err.message || 'Failed to create session', 'error');
  }

  createSessionBtn.disabled = false;
  createSessionBtn.textContent = 'Create & Get QR';
});

// ─── QR Code via Socket.IO ───

socket.on('session:qr', ({ sessionId, qr }) => {
  // Show QR if this is the session we're waiting for
  if (pendingQrSessionId && sessionId === pendingQrSessionId) {
    qrContainer.innerHTML = `
      <img src="${qr}" alt="QR Code" width="280" height="280" />
      <p style="margin-top:16px; color:var(--text-secondary); font-size:13px;">
        Open WhatsApp &rarr; Linked Devices &rarr; Scan this QR
      </p>
    `;
    // Open QR modal if not already open
    if (!qrModal.classList.contains('active')) {
      qrModal.classList.add('active');
    }
  }
  // Store latest QR per session so "Scan QR" button can show it
  _sessionQrCache[sessionId] = qr;
  loadSessions();
});

// Cache QR data URLs per session
const _sessionQrCache = {};

socket.on('session:ready', ({ sessionId, phone }) => {
  delete _sessionQrCache[sessionId];
  if (pendingQrSessionId === sessionId) {
    qrModal.classList.remove('active');
    pendingQrSessionId = null;
    toast(`Connected! Phone: +${phone}`, 'success');
  }
  loadSessions();
});

socket.on('session:disconnected', ({ sessionId }) => {
  delete _sessionQrCache[sessionId];
  loadSessions();
});

socket.on('session:auth_failure', ({ sessionId }) => {
  delete _sessionQrCache[sessionId];
  if (pendingQrSessionId === sessionId) {
    qrContainer.innerHTML = `
      <div class="qr-loading">
        <p style="color:var(--danger)">Authentication failed</p>
        <p class="qr-hint">Use <strong>Relink</strong> to clear stored auth and generate a fresh QR code</p>
      </div>
    `;
  }
  loadSessions();
});

qrModalClose.addEventListener('click', () => {
  qrModal.classList.remove('active');
  pendingQrSessionId = null;
});

// ─── Feature Toggles ───

async function toggleAutoReply(sessionId, enabled) {
  try {
    await api('PUT', `/api/sessions/${sessionId}/auto-reply`, { enabled });

    // If turning OFF auto-reply, also turn off AI and Quick Replies
    if (!enabled) {
      await api('PUT', `/api/sessions/${sessionId}/ai-replies`, { enabled: false });
      await api('PUT', `/api/sessions/${sessionId}/quick-replies`, { enabled: false });
      toast(`Auto-reply disabled (AI & Quick Replies also disabled)`, 'info');
    } else {
      toast(`Auto-reply enabled`, 'info');
    }

    // Reload sessions to update UI
    loadSessions();
  } catch (err) {
    console.error('[ToggleAutoReply] Error:', err);
    toast('Failed to update auto-reply setting', 'error');
  }
}

async function toggleAiReplies(sessionId, enabled) {
  try {
    await api('PUT', `/api/sessions/${sessionId}/ai-replies`, { enabled });
    toast(`🧠 AI Replies ${enabled ? 'enabled' : 'disabled'}`, 'success');
  } catch (err) {
    toast('Failed to update AI replies setting', 'error');
    loadSessions(); // Reload to reset toggle state
  }
}

async function toggleQuickReplies(sessionId, enabled) {
  try {
    await api('PUT', `/api/sessions/${sessionId}/quick-replies`, { enabled });
    toast(`⚡ Quick Replies ${enabled ? 'enabled' : 'disabled'}`, 'success');
  } catch (err) {
    toast('Failed to update quick replies setting', 'error');
    loadSessions(); // Reload to reset toggle state
  }
}

// ─── Delete Session ───

async function deleteSession(sessionId) {
  if (!confirm('Remove this session? You will need to scan QR again.')) return;
  try {
    await api('DELETE', `/api/sessions/${sessionId}`);
    toast('Session removed', 'success');
    loadSessions();
  } catch (err) {
    toast(err.message || 'Failed to remove session', 'error');
  }
}

// ─── Restart Session ───

async function restartSession(sessionId) {
  try {
    toast('Restarting session...', 'info');
    pendingQrSessionId = sessionId;
    await api('POST', `/api/sessions/${sessionId}/restart`);

    // Show QR modal — restart may need a fresh QR
    qrContainer.innerHTML = `
      <div class="qr-loading">
        <div class="spinner"></div>
        <p>Restarting session...</p>
        <p class="qr-hint">If a QR code appears, scan it to reconnect</p>
      </div>
    `;
    qrModal.classList.add('active');
    loadSessions();
  } catch (err) {
    toast(err.message || 'Failed to restart session', 'error');
  }
}

// ─── Relink Session (clear auth + fresh QR) ───

async function relinkSession(sessionId, sessionName) {
  if (!confirm(`Relink "${sessionName}"? This will clear stored auth and require a fresh QR scan.`)) return;

  try {
    toast('Relinking session — clearing old auth data...', 'info');
    pendingQrSessionId = sessionId;

    qrContainer.innerHTML = `
      <div class="qr-loading">
        <div class="spinner"></div>
        <p>Relinking "${escapeHtml(sessionName)}"...</p>
        <p class="qr-hint">Clearing old auth data and generating a fresh QR code</p>
      </div>
    `;
    qrModal.classList.add('active');

    await api('POST', `/api/sessions/${sessionId}/relink`);
    toast('Auth cleared — waiting for QR code', 'success');
    loadSessions();
  } catch (err) {
    toast(err.message || 'Failed to relink session', 'error');
    qrContainer.innerHTML = `
      <div class="qr-loading">
        <p style="color:var(--danger)">Relink failed: ${escapeHtml(err.message || 'Unknown error')}</p>
      </div>
    `;
  }
}

// ─── Show QR for a session (when user clicks "Scan QR" on a qr_pending session) ───

function showQrForSession(sessionId, sessionName) {
  pendingQrSessionId = sessionId;

  const cachedQr = _sessionQrCache[sessionId];
  if (cachedQr) {
    qrContainer.innerHTML = `
      <img src="${cachedQr}" alt="QR Code" width="280" height="280" />
      <p style="margin-top:16px; color:var(--text-secondary); font-size:13px;">
        Open WhatsApp &rarr; Linked Devices &rarr; Scan this QR
      </p>
    `;
  } else {
    qrContainer.innerHTML = `
      <div class="qr-loading">
        <div class="spinner"></div>
        <p>Waiting for QR code for "${escapeHtml(sessionName)}"...</p>
        <p class="qr-hint">The QR code will appear here shortly</p>
      </div>
    `;
  }
  qrModal.classList.add('active');
}
