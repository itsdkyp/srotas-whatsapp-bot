/* ═══════════════════════════════════════
   Campaigns / Messaging Page
   ═══════════════════════════════════════ */

const campaignsList = document.getElementById('campaignsList');
const newCampaignBtn = document.getElementById('newCampaignBtn');
const newCampaignModal = document.getElementById('newCampaignModal');
const newCampaignModalClose = document.getElementById('newCampaignModalClose');

const campSession = document.getElementById('campSession');
const campGroup = document.getElementById('campGroup');
const campTemplate = document.getElementById('campTemplate');
const campMinDelay = document.getElementById('campMinDelay');
const campMaxDelay = document.getElementById('campMaxDelay');
const campPreviewBubble = document.getElementById('campPreviewBubble');
const sendNowBtn = document.getElementById('sendNowBtn');
const scheduleBtn = document.getElementById('scheduleBtn');

// Schedule fields
const scheduleFields = document.getElementById('scheduleFields');
const campScheduleName = document.getElementById('campScheduleName');
const campFrequency = document.getElementById('campFrequency');
const campSendTime = document.getElementById('campSendTime');
const campDayOfWeek = document.getElementById('campDayOfWeek');
const campDayOfMonth = document.getElementById('campDayOfMonth');
const dayOfWeekField = document.getElementById('dayOfWeekField');
const dayOfMonthField = document.getElementById('dayOfMonthField');
const confirmScheduleBtn = document.getElementById('confirmScheduleBtn');

// Progress
const progressModal = document.getElementById('progressModal');
const progressModalClose = document.getElementById('progressModalClose');
const progressBar = document.getElementById('progressBar');
const progressStats = document.getElementById('progressStats');
const progressLog = document.getElementById('progressLog');

// Campaign detail
const campaignModal = document.getElementById('campaignModal');
const campaignModalClose = document.getElementById('campaignModalClose');
const campaignDetail = document.getElementById('campaignDetail');

// Detected custom fields
const detectedFieldsSection = document.getElementById('detectedFieldsSection');
const detectedFieldsTags = document.getElementById('detectedFieldsTags');

// Media attachment (multi-file)
const campMediaFile = document.getElementById('campMediaFile');
const mediaUploadPrompt = document.getElementById('mediaUploadPrompt');
const mediaFileList = document.getElementById('mediaFileList');
const mediaAddMore = document.getElementById('mediaAddMore');
let _campaignMediaFiles = []; // { path, filename, size }

// Template selector
const campTemplateSelector = document.getElementById('campTemplateSelector');
const deleteTemplateBtn = document.getElementById('deleteTemplateBtn');
let _loadedTemplates = [];

// Interactive Buttons
const campaignButtonsList = document.getElementById('campaignButtonsList');
const addCampaignButton = document.getElementById('addCampaignButton');

// ─── Load Messaging Page ───

async function loadMessagingPage() {
    loadCampaigns();
}

// ─── New Campaign Modal ───

newCampaignBtn.addEventListener('click', async () => {
    // Reset form
    campTemplate.value = '';
    campPreviewBubble.innerHTML = '<p class="preview-placeholder">Type a message template to see preview...</p>';
    scheduleFields.style.display = 'none';
    detectedFieldsSection.style.display = 'none';
    // Reset media attachments
    _campaignMediaFiles = [];
    renderMediaFileList();
    // Reset template selector
    campTemplateSelector.value = '';
    deleteTemplateBtn.style.display = 'none';

    // Reset buttons
    campaignButtonsList.innerHTML = '';
    updateAddButtonState();

    // Load sessions
    try {
        const sessions = await api('GET', '/api/sessions');
        console.log('[NewCampaign] Fetched sessions:', sessions);

        // Relax filter to allow 'authenticated' or 'ready'
        const ready = sessions.filter(s => s.status === 'ready' || s.status === 'authenticated' || s.status === 'connected');

        if (ready.length === 0 && sessions.length > 0) {
            console.warn('[NewCampaign] No ready sessions found. available statuses:', sessions.map(s => s.status));
        }
        campSession.innerHTML = ready.length
            ? ready.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${s.phone || '?'})</option>`).join('')
            : '<option value="">No connected sessions</option>';

        // Load groups
        const groups = await api('GET', '/api/groups');
        campGroup.innerHTML = groups.length
            ? groups.map(g => `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)}</option>`).join('')
            : '<option value="">No contact groups</option>';

        newCampaignModal.classList.add('active');

        // Load saved templates
        loadTemplates();

        // Auto-detect custom fields for first group
        detectCustomFields();
    } catch (err) {
        console.error('[NewCampaign] Error loading sessions:', err);
        toast('Failed to load sessions', 'error');
        // Still open modal so user can see something is wrong? Or maybe not.
        // Let's open it anyway to inspect empty state
        newCampaignModal.classList.add('active');
    }
});

newCampaignModalClose.addEventListener('click', () => {
    newCampaignModal.classList.remove('active');
});

// ─── Media Upload for Campaign ───

campMediaFile.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (_campaignMediaFiles.length + files.length > 10) {
        toast('Maximum 10 files allowed', 'error');
        e.target.value = '';
        return;
    }

    const formData = new FormData();
    for (const file of files) {
        formData.append('media', file);
    }

    try {
        const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        for (const f of data.files) {
            _campaignMediaFiles.push(f);
        }
        renderMediaFileList();
        toast(`${data.files.length} file(s) attached`, 'success');
    } catch (err) {
        toast('Failed to upload files', 'error');
    }
    e.target.value = '';
});

function removeMediaFile(index) {
    _campaignMediaFiles.splice(index, 1);
    renderMediaFileList();
}

function renderMediaFileList() {
    if (_campaignMediaFiles.length === 0) {
        mediaFileList.innerHTML = '';
        mediaUploadPrompt.style.display = '';
        mediaAddMore.style.display = 'none';
        return;
    }
    mediaUploadPrompt.style.display = 'none';
    mediaAddMore.style.display = _campaignMediaFiles.length < 10 ? '' : 'none';
    mediaFileList.innerHTML = _campaignMediaFiles.map((f, i) => `
        <div class="media-file-item">
            <span class="media-file-icon">${getFileIcon(f.filename)}</span>
            <span class="media-file-name">${escapeHtml(f.filename)}</span>
            <span class="media-file-size">${formatFileSize(f.size)}</span>
            <button class="btn btn-danger btn-xs" onclick="removeMediaFile(${i})">✕</button>
        </div>
    `).join('');
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── Interactive Buttons Logic ───

addCampaignButton.addEventListener('click', () => {
    const btnCount = campaignButtonsList.children.length;
    if (btnCount >= 3) return;

    const num = btnCount + 1;
    const div = document.createElement('div');
    div.className = 'campaign-button-item';
    div.innerHTML = `
        <span class="btn-number">${num}.</span>
        <input type="text" class="text-input btn-label-input" placeholder="Button label (e.g. View Pricing)" maxlength="30" />
        <textarea class="textarea-input btn-reply-input" rows="2" placeholder="Auto-reply content when user presses ${num}"></textarea>
        <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove(); renumberButtons(); updateAddButtonState();">✕</button>
    `;
    campaignButtonsList.appendChild(div);
    updateAddButtonState();
});

function renumberButtons() {
    document.querySelectorAll('#campaignButtonsList .campaign-button-item').forEach((item, i) => {
        const numSpan = item.querySelector('.btn-number');
        const replyInput = item.querySelector('.btn-reply-input');
        if (numSpan) numSpan.textContent = `${i + 1}.`;
        if (replyInput) replyInput.placeholder = `Auto-reply content when user presses ${i + 1}`;
    });
}

function updateAddButtonState() {
    const btnCount = campaignButtonsList.children.length;
    addCampaignButton.disabled = btnCount >= 3;
    addCampaignButton.textContent = btnCount >= 3 ? 'Max 3 Buttons Reached' : '+ Add Button (max 3)';
}

// ─── Detect custom fields from selected group ───

campGroup.addEventListener('change', detectCustomFields);

async function detectCustomFields() {
    const group = campGroup.value;
    if (!group) { detectedFieldsTags.innerHTML = ''; return; }

    try {
        const contacts = await api('GET', `/api/contacts?group=${encodeURIComponent(group)}`);
        const customKeys = new Set();

        for (const c of contacts.slice(0, 10)) {
            let fields = c.custom_fields;
            if (typeof fields === 'string') {
                try { fields = JSON.parse(fields); } catch (e) { fields = {}; }
            }
            if (fields && typeof fields === 'object') {
                Object.keys(fields).forEach(k => customKeys.add(k));
            }
        }

        if (customKeys.size > 0) {
            detectedFieldsTags.innerHTML = Array.from(customKeys).map(k =>
                `<span class="placeholder-tag" onclick="insertPlaceholder('campTemplate','${k}')">{{${k}}}</span>`
            ).join('');
        } else {
            detectedFieldsTags.innerHTML = '';
        }
    } catch (e) {
        detectedFieldsTags.innerHTML = '';
    }
}

// ─── Insert Placeholder Helper ───

function insertPlaceholder(textareaId, fieldName) {
    const ta = document.getElementById(textareaId);
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const placeholder = `{{${fieldName}}}`;
    ta.value = text.substring(0, start) + placeholder + text.substring(end);
    ta.selectionStart = ta.selectionEnd = start + placeholder.length;
    ta.focus();
    updateCampaignPreview();
}

// ─── Live Preview ───

campTemplate.addEventListener('input', updateCampaignPreview);

async function updateCampaignPreview() {
    const template = campTemplate.value;
    if (!template.trim()) {
        campPreviewBubble.innerHTML = '<p class="preview-placeholder">Type a message template to see preview...</p>';
        return;
    }

    const group = campGroup.value;
    let sampleContact = { name: 'John Doe', company: 'Acme Corp', phone: '+1234567890' };

    try {
        const contacts = await api('GET', `/api/contacts?group=${encodeURIComponent(group)}`);
        if (contacts.length > 0) {
            sampleContact = contacts[0];
            if (typeof sampleContact.custom_fields === 'string') {
                sampleContact.custom_fields = JSON.parse(sampleContact.custom_fields);
            }
        }
    } catch (e) { /* use default */ }

    try {
        const result = await api('POST', '/api/messages/preview', { template, contact: sampleContact });
        campPreviewBubble.innerHTML = `<div class="wa-message">${escapeHtml(result.rendered)}</div>`;
    } catch (e) {
        campPreviewBubble.innerHTML = `<div class="wa-message">${escapeHtml(template)}</div>`;
    }
}

// ─── Send Now ───

sendNowBtn.addEventListener('click', async () => {
    const sessionId = campSession.value;
    const group = campGroup.value;
    const template = campTemplate.value.trim();

    if (!sessionId) return toast('Select a connected session', 'error');
    if (!group) return toast('Select a contact group', 'error');
    if (!template) return toast('Enter a message template', 'error');

    if (!confirm(`Send this message to all contacts in "${group}" now?`)) return;

    console.log('User confirmed sending. Starting UI update...');

    // Close campaign modal, open progress modal
    newCampaignModal.classList.remove('active');
    progressModal.classList.add('active');
    progressBar.style.width = '0%';
    progressLog.innerHTML = '<div>Initializing campaign...</div>';
    progressStats.textContent = 'Starting...';

    // Collect buttons (label + reply)
    const buttons = [];
    document.querySelectorAll('#campaignButtonsList .campaign-button-item').forEach(item => {
        const label = (item.querySelector('.btn-label-input') || {}).value?.trim();
        const reply = (item.querySelector('.btn-reply-input') || {}).value?.trim();
        if (label) buttons.push({ label, reply: reply || '' });
    });

    console.log('Payload prepared. Sending API request to /api/messages/send-bulk...');

    try {
        const mediaPaths = _campaignMediaFiles.map(f => f.path);
        const response = await api('POST', '/api/messages/send-bulk', {
            sessionId,
            group,
            template,
            minDelay: parseInt(campMinDelay.value) || 3000,
            maxDelay: parseInt(campMaxDelay.value) || 5000,
            mediaPaths: mediaPaths.length ? mediaPaths : null,
            buttons: buttons.length ? buttons : null,
        });
        console.log('API Response:', response);
    } catch (err) {
        console.error('Campaign API Error:', err);
        toast('Failed to start campaign: ' + err.message, 'error');
        progressModal.classList.remove('active');
    }
});

// ─── Schedule for Later ───

scheduleBtn.addEventListener('click', () => {
    const template = campTemplate.value.trim();
    if (!campSession.value) return toast('Select a connected session', 'error');
    if (!campGroup.value) return toast('Select a contact group', 'error');
    if (!template) return toast('Enter a message template', 'error');

    scheduleFields.style.display = scheduleFields.style.display === 'none' ? 'block' : 'none';
});

campFrequency.addEventListener('change', () => {
    const freq = campFrequency.value;
    dayOfWeekField.style.display = freq === 'weekly' ? 'block' : 'none';
    dayOfMonthField.style.display = freq === 'monthly' ? 'block' : 'none';
});

confirmScheduleBtn.addEventListener('click', async () => {
    const name = campScheduleName.value.trim() || `Campaign ${new Date().toLocaleDateString()}`;
    const sessionId = campSession.value;
    const groupName = campGroup.value;
    const template = campTemplate.value.trim();
    const frequency = campFrequency.value;
    const sendTime = campSendTime.value || '09:00';
    const dayOfWeek = parseInt(campDayOfWeek.value) || 0;
    const dayOfMonth = parseInt(campDayOfMonth.value) || 1;

    confirmScheduleBtn.disabled = true;
    try {
        if (frequency === 'once') {
            // For one-time, use the scheduler with a one-time schedule
            await api('POST', '/api/schedules', {
                name,
                sessionId,
                groupName,
                template,
                frequency: 'daily', // will run once at the scheduled time
                sendTime,
                dayOfWeek,
                dayOfMonth,
            });
            toast(`Scheduled "${name}" at ${sendTime}`, 'success');
        } else {
            await api('POST', '/api/schedules', {
                name,
                sessionId,
                groupName,
                template,
                frequency,
                sendTime,
                dayOfWeek,
                dayOfMonth,
            });
            toast(`Scheduled "${name}" — ${frequency} at ${sendTime}`, 'success');
        }
        newCampaignModal.classList.remove('active');
    } catch (err) {
        toast(err.message || 'Failed to schedule', 'error');
    }
    confirmScheduleBtn.disabled = false;
});

// ─── Progress via Socket.IO ───

socket.on('bulk:progress', (data) => {
    const pct = Math.round((data.current / data.total) * 100);
    progressBar.style.width = `${pct}%`;
    progressStats.textContent = `${data.current}/${data.total} — Sent: ${data.sent} | Failed: ${data.failed}`;

    const cls = data.lastStatus === 'sent' ? 'log-sent' : 'log-failed';
    const icon = data.lastStatus === 'sent' ? '✓' : '✕';
    const name = data.lastName ? ` (${data.lastName})` : '';
    const errorInfo = data.lastStatus === 'failed' && data.error ? ` — ${data.error}` : '';
    progressLog.innerHTML += `<div class="${cls}">${icon} ${data.lastPhone}${name} — ${data.lastStatus}${errorInfo}</div>`;
    progressLog.scrollTop = progressLog.scrollHeight;
});

socket.on('bulk:complete', (data) => {
    progressStats.textContent = `Complete! Sent: ${data.sent} | Failed: ${data.failed} | Total: ${data.total}`;
    toast(`Campaign complete: ${data.sent} sent, ${data.failed} failed`, data.failed > 0 ? 'error' : 'success');
    loadCampaigns();
});

socket.on('bulk:error', (data) => {
    progressStats.textContent = `Campaign error: ${data.error}`;
    toast(`Campaign error: ${data.error}`, 'error');
    loadCampaigns();
});

progressModalClose.addEventListener('click', () => {
    progressModal.classList.remove('active');
});

// ═══════════════════════════════════════
// Campaign History
// ═══════════════════════════════════════

async function loadCampaigns() {
    try {
        const campaigns = await api('GET', '/api/campaigns');

        if (!campaigns.length) {
            campaignsList.innerHTML = `
                <div class="card" style="text-align:center; padding:48px; color:var(--text-muted);">
                    <div style="font-size:48px; margin-bottom:16px; opacity:0.5;">📊</div>
                    <p>No campaigns yet. Click <strong>+ New Campaign</strong> to get started.</p>
                </div>`;
            return;
        }

        campaignsList.innerHTML = `
            <div class="card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Session</th>
                            <th>Group</th>
                            <th>Status</th>
                            <th>Total</th>
                            <th>Sent</th>
                            <th>Failed</th>
                            <th>Success Rate</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${campaigns.map(c => {
            const rate = c.total > 0 ? Math.round((c.sent / c.total) * 100) : 0;
            const statusClass = c.status === 'completed' ? 'ready' : 'initializing';
            const rateColor = rate >= 90 ? 'var(--success)' : rate >= 50 ? 'var(--warning)' : 'var(--danger)';
            return `
                            <tr data-campaign-id="${c.id}">
                                <td>#${c.id}</td>
                                <td style="font-size:12px;">
                                    <div>${escapeHtml(c.session_name || '—')}</div>
                                    <div style="color:var(--text-muted);font-size:11px;">${escapeHtml(c.session_phone || '—')}</div>
                                </td>
                                <td>${escapeHtml(c.group_name || '—')}</td>
                                <td><span class="session-status ${statusClass}">${c.status === 'completed' ? '● Done' : '◌ Running'}</span></td>
                                <td>${c.total}</td>
                                <td style="color:var(--success);">${c.sent}</td>
                                <td style="color:var(--danger);">${c.failed}</td>
                                <td>
                                    <div style="display:flex;align-items:center;gap:8px;">
                                        <div class="mini-bar">
                                            <div class="mini-bar-fill" style="width:${rate}%;background:${rateColor};"></div>
                                        </div>
                                        <span style="font-size:12px;">${rate}%</span>
                                    </div>
                                </td>
                                <td style="font-size:12px;">${new Date(c.started_at).toLocaleString()}</td>
                                <td style="display:flex;gap:4px;flex-wrap:wrap;">
                                    <button class="btn btn-primary btn-sm" onclick="viewCampaign(${c.id})">Analytics</button>
                                    ${c.status === 'completed' ? `<button class="btn btn-success btn-sm" onclick="restartCampaign(${c.id})">Restart</button>` : ''}
                                    ${c.failed > 0 && c.status === 'completed' ? `<button class="btn btn-warning btn-sm" onclick="retryCampaign(${c.id})">Retry ${c.failed} Failed</button>` : ''}
                                    <button class="btn btn-danger btn-sm" onclick="deleteCampaign(${c.id})">Delete</button>
                                </td>
                            </tr>`;
        }).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (err) {
        campaignsList.innerHTML = '<p style="color:var(--danger);">Failed to load campaigns</p>';
    }
}

// Store loaded campaign data for filtering
let _campaignDetailData = null;

async function viewCampaign(id) {
    try {
        const data = await api('GET', `/api/campaigns/${id}`);
        _campaignDetailData = data;
        renderCampaignDetail(data, 'all');
        campaignModal.classList.add('active');
    } catch (err) {
        toast('Failed to load campaign details', 'error');
    }
}

function formatDuration(ms) {
    if (!ms || ms < 0) return '—';
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    if (mins < 60) return `${mins}m ${remSecs}s`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
}

function filterCampaignMessages(filter) {
    if (!_campaignDetailData) return;
    renderCampaignDetail(_campaignDetailData, filter);
}

function exportCampaignCSV() {
    if (!_campaignDetailData) return;
    const data = _campaignDetailData;
    const rows = [['Contact Name', 'Phone', 'Status', 'Error', 'Message Sent', 'Time']];
    for (const m of (data.messages || [])) {
        rows.push([
            m.contact_name || '',
            m.contact_phone,
            m.status,
            m.error || '',
            (m.message_content || '').replace(/"/g, '""'),
            m.sent_at || '',
        ]);
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign_${data.id}_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function renderCampaignDetail(data, filter) {
    const rate = data.total > 0 ? Math.round((data.sent / data.total) * 100) : 0;
    const duration = formatDuration(data.durationMs);

    // Filter messages
    const allMessages = data.messages || [];
    const filteredMessages = filter === 'all' ? allMessages
        : filter === 'sent' ? allMessages.filter(m => m.status === 'sent')
        : allMessages.filter(m => m.status === 'failed');

    // Error breakdown section
    const errorBreakdown = data.errorBreakdown || [];
    const errorBreakdownHtml = errorBreakdown.length > 0 ? `
        <div class="analytics-section">
            <h4 class="analytics-title">Error Breakdown</h4>
            <div class="error-breakdown-list">
                ${errorBreakdown.map(e => `
                    <div class="error-breakdown-item">
                        <div class="error-breakdown-bar">
                            <div class="error-breakdown-fill" style="width:${Math.round((e.count / data.failed) * 100)}%"></div>
                        </div>
                        <div class="error-breakdown-info">
                            <span class="error-breakdown-msg">${escapeHtml(e.error)}</span>
                            <span class="error-breakdown-count">${e.count} contact${e.count > 1 ? 's' : ''}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    campaignDetail.innerHTML = `
        <div class="campaign-summary">
            <div class="campaign-stat-grid">
                <div class="campaign-stat">
                    <div class="stat-value">${data.total}</div>
                    <div class="stat-label">Total</div>
                </div>
                <div class="campaign-stat">
                    <div class="stat-value" style="color:var(--success);">${data.sent}</div>
                    <div class="stat-label">Delivered</div>
                </div>
                <div class="campaign-stat">
                    <div class="stat-value" style="color:var(--danger);">${data.failed}</div>
                    <div class="stat-label">Failed</div>
                </div>
                <div class="campaign-stat">
                    <div class="stat-value">${rate}%</div>
                    <div class="stat-label">Success Rate</div>
                </div>
            </div>
            <div class="campaign-meta">
                <div class="campaign-meta-row">
                    <span class="meta-label">Group</span>
                    <span class="meta-value">${escapeHtml(data.group_name || '—')}</span>
                </div>
                <div class="campaign-meta-row">
                    <span class="meta-label">Session (Phone)</span>
                    <span class="meta-value">
                        <strong>${escapeHtml(data.session_name || 'Unknown')}</strong>
                        <span style="color:var(--text-muted);margin-left:8px;">${escapeHtml(data.session_phone || '—')}</span>
                    </span>
                </div>
                <div class="campaign-meta-row">
                    <span class="meta-label">Started</span>
                    <span class="meta-value">${new Date(data.started_at).toLocaleString()}</span>
                </div>
                ${data.completed_at ? `<div class="campaign-meta-row">
                    <span class="meta-label">Completed</span>
                    <span class="meta-value">${new Date(data.completed_at).toLocaleString()}</span>
                </div>` : ''}
                <div class="campaign-meta-row">
                    <span class="meta-label">Duration</span>
                    <span class="meta-value">${duration}</span>
                </div>
                <div class="campaign-meta-row">
                    <span class="meta-label">Status</span>
                    <span class="meta-value">${data.status === 'completed' ? '<span style="color:var(--success);">Completed</span>' : '<span style="color:var(--warning);">Running</span>'}</span>
                </div>
            </div>
            <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
                ${data.status === 'completed' ? `<button class="btn btn-success btn-sm" onclick="restartCampaign(${data.id})">Restart Campaign</button>` : ''}
                ${data.failed > 0 && data.status === 'completed' ? `<button class="btn btn-warning btn-sm" onclick="retryCampaign(${data.id})">Retry ${data.failed} Failed</button>` : ''}
                <button class="btn btn-primary btn-sm" onclick="exportCampaignCSV()">Export CSV</button>
                <button class="btn btn-danger btn-sm" onclick="deleteCampaign(${data.id})">Delete Campaign</button>
            </div>
        </div>

        ${errorBreakdownHtml}

        <div class="analytics-section">
            <div class="analytics-header">
                <h4 class="analytics-title">Message Log (${filteredMessages.length})</h4>
                <div class="filter-tabs">
                    <button class="filter-tab ${filter === 'all' ? 'active' : ''}" onclick="filterCampaignMessages('all')">All (${allMessages.length})</button>
                    <button class="filter-tab ${filter === 'sent' ? 'active' : ''}" onclick="filterCampaignMessages('sent')">Sent (${data.sent})</button>
                    <button class="filter-tab ${filter === 'failed' ? 'active' : ''}" onclick="filterCampaignMessages('failed')">Failed (${data.failed})</button>
                </div>
            </div>
            <div class="table-container table-scroll">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Contact</th>
                            <th>Phone</th>
                            <th>Status</th>
                            <th>Message Sent</th>
                            <th>Error</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredMessages.length === 0 ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">No messages in this filter</td></tr>` : ''}
                        ${filteredMessages.map((m, idx) => `
                            <tr>
                                <td style="color:var(--text-muted);font-size:11px;">${idx + 1}</td>
                                <td>${escapeHtml(m.contact_name || '—')}</td>
                                <td style="font-family:monospace;font-size:12px;">${escapeHtml(m.contact_phone)}</td>
                                <td><span class="msg-status-badge ${m.status}">${m.status === 'sent' ? '✓ Sent' : '✕ Failed'}</span></td>
                                <td class="msg-content-cell">${m.message_content ? `<div class="msg-content-preview" title="${escapeHtml(m.message_content)}">${escapeHtml(m.message_content.substring(0, 80))}${m.message_content.length > 80 ? '...' : ''}</div>` : '<span style="color:var(--text-muted);">—</span>'}</td>
                                <td class="msg-error-cell">${m.error ? `<span class="msg-error-text" title="${escapeHtml(m.error)}">${escapeHtml(m.error)}</span>` : '<span style="color:var(--text-muted);">—</span>'}</td>
                                <td style="font-size:12px;white-space:nowrap;">${m.sent_at ? new Date(m.sent_at).toLocaleTimeString() : '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

campaignModalClose.addEventListener('click', () => campaignModal.classList.remove('active'));

// ─── Retry Failed Messages ───

async function retryCampaign(id) {
    try {
        // Get available sessions to pick one for retry
        const sessions = await api('GET', '/api/sessions');
        const ready = sessions.filter(s => s.status === 'ready' || s.status === 'authenticated' || s.status === 'connected');
        if (!ready.length) return toast('No connected sessions available', 'error');

        let sessionId = ready[0].id;
        if (ready.length > 1) {
            const choice = prompt(`Select session to retry from:\n${ready.map((s, i) => `${i + 1}. ${s.name} (${s.phone || '?'})`).join('\n')}\n\nEnter number:`);
            if (!choice) return;
            const idx = parseInt(choice) - 1;
            if (idx >= 0 && idx < ready.length) sessionId = ready[idx].id;
        }

        if (!confirm(`Retry all failed messages in campaign #${id}?`)) return;

        // Close detail modal if open, open progress modal
        campaignModal.classList.remove('active');
        progressModal.classList.add('active');
        progressBar.style.width = '0%';
        progressLog.innerHTML = '<div>Retrying failed messages...</div>';
        progressStats.textContent = 'Starting retry...';

        const response = await api('POST', `/api/campaigns/${id}/retry`, { sessionId });
        console.log('Retry response:', response);
    } catch (err) {
        const msg = err.message || String(err);
        if (msg.includes('No failed messages')) {
            toast('No failed messages to retry. Use "Restart" to re-send to all contacts.', 'error');
        } else {
            toast('Failed to retry: ' + msg, 'error');
        }
        progressModal.classList.remove('active');
    }
}

// ─── Restart Campaign (re-run entire campaign from scratch) ───

async function restartCampaign(id) {
    try {
        const sessions = await api('GET', '/api/sessions');
        const ready = sessions.filter(s => s.status === 'ready' || s.status === 'authenticated' || s.status === 'connected');
        if (!ready.length) return toast('No connected sessions available', 'error');

        let sessionId = ready[0].id;
        if (ready.length > 1) {
            const choice = prompt(`Select session:\n${ready.map((s, i) => `${i + 1}. ${s.name} (${s.phone || '?'})`).join('\n')}\n\nEnter number:`);
            if (!choice) return;
            const idx = parseInt(choice) - 1;
            if (idx >= 0 && idx < ready.length) sessionId = ready[idx].id;
        }

        if (!confirm(`Restart campaign #${id}? This will re-send to ALL contacts in the group.`)) return;

        campaignModal.classList.remove('active');
        progressModal.classList.add('active');
        progressBar.style.width = '0%';
        progressLog.innerHTML = '<div>Restarting campaign — sending to all contacts...</div>';
        progressStats.textContent = 'Starting...';

        const response = await api('POST', `/api/campaigns/${id}/restart`, { sessionId });
        console.log('Restart response:', response);
    } catch (err) {
        toast('Failed to restart: ' + (err.message || err), 'error');
        progressModal.classList.remove('active');
    }
}

// ─── Delete Campaign ───

async function deleteCampaign(id) {
    if (!confirm(`Delete campaign #${id} and all its message records? This cannot be undone.`)) return;

    try {
        await api('DELETE', `/api/campaigns/${id}`);
        toast('Campaign deleted', 'success');
        campaignModal.classList.remove('active');
        loadCampaigns();
    } catch (err) {
        toast('Failed to delete campaign: ' + (err.message || err), 'error');
    }
}

// ═══════════════════════════════════════
// Message Templates
// ═══════════════════════════════════════

async function loadTemplates() {
    try {
        _loadedTemplates = await api('GET', '/api/templates');
        campTemplateSelector.innerHTML = '<option value="">— Write from scratch —</option>' +
            _loadedTemplates.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    } catch (err) {
        console.error('Failed to load templates:', err);
    }
}

campTemplateSelector.addEventListener('change', () => {
    const id = campTemplateSelector.value;
    deleteTemplateBtn.style.display = id ? '' : 'none';
    if (!id) return;

    const tmpl = _loadedTemplates.find(t => t.id === parseInt(id));
    if (!tmpl) return;

    // Load message content
    campTemplate.value = tmpl.content || '';
    updateCampaignPreview();

    // Load media files
    _campaignMediaFiles = [];
    if (tmpl.media_paths) {
        try {
            const paths = typeof tmpl.media_paths === 'string' ? JSON.parse(tmpl.media_paths) : tmpl.media_paths;
            if (Array.isArray(paths)) {
                for (const p of paths) {
                    // Extract filename from path
                    const parts = p.split('/');
                    _campaignMediaFiles.push({ path: p, filename: parts[parts.length - 1], size: 0 });
                }
            }
        } catch (e) {}
    }
    renderMediaFileList();

    // Load buttons
    campaignButtonsList.innerHTML = '';
    if (tmpl.buttons_config) {
        try {
            const buttons = typeof tmpl.buttons_config === 'string' ? JSON.parse(tmpl.buttons_config) : tmpl.buttons_config;
            if (Array.isArray(buttons)) {
                for (const btn of buttons) {
                    const num = campaignButtonsList.children.length + 1;
                    const div = document.createElement('div');
                    div.className = 'campaign-button-item';
                    div.innerHTML = `
                        <span class="btn-number">${num}.</span>
                        <input type="text" class="text-input btn-label-input" placeholder="Button label" maxlength="30" value="${escapeHtml(btn.label || '')}" />
                        <textarea class="textarea-input btn-reply-input" rows="2" placeholder="Auto-reply content">${escapeHtml(btn.reply || '')}</textarea>
                        <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove(); renumberButtons(); updateAddButtonState();">✕</button>
                    `;
                    campaignButtonsList.appendChild(div);
                }
            }
        } catch (e) {}
    }
    updateAddButtonState();
    toast(`Template "${tmpl.name}" loaded`, 'success');
});

async function saveAsTemplate() {
    const content = campTemplate.value.trim();
    if (!content) return toast('Write a message template first', 'error');

    const name = prompt('Template name:');
    if (!name || !name.trim()) return;

    // Collect current buttons
    const buttons = [];
    document.querySelectorAll('#campaignButtonsList .campaign-button-item').forEach(item => {
        const label = (item.querySelector('.btn-label-input') || {}).value?.trim();
        const reply = (item.querySelector('.btn-reply-input') || {}).value?.trim();
        if (label) buttons.push({ label, reply: reply || '' });
    });

    // Collect current media paths
    const mediaPaths = _campaignMediaFiles.map(f => f.path);

    try {
        await api('POST', '/api/templates', {
            name: name.trim(),
            content,
            mediaPaths: mediaPaths.length ? mediaPaths : null,
            buttons: buttons.length ? buttons : null,
        });
        toast(`Template "${name.trim()}" saved`, 'success');
        loadTemplates();
    } catch (err) {
        toast('Failed to save template: ' + (err.message || err), 'error');
    }
}

async function deleteSelectedTemplate() {
    const id = campTemplateSelector.value;
    if (!id) return;
    const tmpl = _loadedTemplates.find(t => t.id === parseInt(id));
    if (!confirm(`Delete template "${tmpl ? tmpl.name : id}"?`)) return;

    try {
        await api('DELETE', `/api/templates/${id}`);
        toast('Template deleted', 'success');
        campTemplateSelector.value = '';
        deleteTemplateBtn.style.display = 'none';
        loadTemplates();
    } catch (err) {
        toast('Failed to delete template: ' + (err.message || err), 'error');
    }
}
