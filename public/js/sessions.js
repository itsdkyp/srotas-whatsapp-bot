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

async function loadSessions() {
  const sessions = await api('GET', '/api/sessions');
  renderSessions(sessions);
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
    const showRestart = ['error', 'disconnected', 'auth_failure'].includes(s.status);
    return `
    <div class="session-card" data-id="${s.id}">
      <div class="session-card-header">
        <span class="session-name">${escapeHtml(s.name)}</span>
        <span class="session-status ${s.status}">${formatStatus(s.status)}</span>
      </div>
      <div class="session-phone">${s.phone ? '+' + s.phone : 'Not connected'}</div>
      <div class="session-actions">
        <label class="toggle-label">
          <span class="toggle">
            <input type="checkbox" ${s.auto_reply ? 'checked' : ''} onchange="toggleAutoReply('${s.id}', this.checked)" />
            <span class="toggle-slider"></span>
          </span>
          Auto-Reply
        </label>
        ${showRestart ? `<button class="btn btn-primary btn-sm" onclick="restartSession('${s.id}')">🔄 Restart</button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="deleteSession('${s.id}')">Remove</button>
      </div>
    </div>`;
  }).join('');
}

function formatStatus(status) {
  const labels = {
    ready: '● Connected',
    qr_pending: '◌ Scan QR',
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
  if (pendingQrSessionId && sessionId === pendingQrSessionId) {
    qrContainer.innerHTML = `
      <img src="${qr}" alt="QR Code" width="280" height="280" />
      <p style="margin-top:16px; color:var(--text-secondary); font-size:13px;">
        Open WhatsApp → Linked Devices → Scan this QR
      </p>
    `;
  }
  loadSessions();
});

socket.on('session:ready', ({ sessionId, phone }) => {
  if (pendingQrSessionId === sessionId) {
    qrModal.classList.remove('active');
    pendingQrSessionId = null;
    toast(`Connected! Phone: +${phone}`, 'success');
  }
  loadSessions();
});

socket.on('session:disconnected', ({ sessionId }) => {
  loadSessions();
});

socket.on('session:auth_failure', ({ sessionId }) => {
  if (pendingQrSessionId === sessionId) {
    qrContainer.innerHTML = `
      <div class="qr-loading">
        <p style="color:var(--danger)">❌ Authentication failed</p>
        <p class="qr-hint">Try removing and re-adding the session</p>
      </div>
    `;
  }
  loadSessions();
});

qrModalClose.addEventListener('click', () => {
  qrModal.classList.remove('active');
  pendingQrSessionId = null;
});

// ─── Auto-Reply Toggle ───

async function toggleAutoReply(sessionId, enabled) {
  await api('PUT', `/api/sessions/${sessionId}/auto-reply`, { enabled });
  toast(`Auto-reply ${enabled ? 'enabled' : 'disabled'}`, 'info');
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
    await api('POST', `/api/sessions/${sessionId}/restart`);
    toast('Session restarting — please wait', 'success');
    setTimeout(loadSessions, 3000);
  } catch (err) {
    toast(err.message || 'Failed to restart session', 'error');
  }
}
