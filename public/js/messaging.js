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
const dayFields = document.getElementById('dayFields');
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

// Media attachment
const campMediaFile = document.getElementById('campMediaFile');
const campMediaPath = document.getElementById('campMediaPath');
const mediaUploadPrompt = document.getElementById('mediaUploadPrompt');
const mediaUploadPreview = document.getElementById('mediaUploadPreview');
const mediaFileIcon = document.getElementById('mediaFileIcon');
const mediaFileName = document.getElementById('mediaFileName');
const mediaFileSize = document.getElementById('mediaFileSize');

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
    // Reset media attachment
    campMediaPath.value = '';
    mediaUploadPrompt.style.display = '';
    mediaUploadPreview.style.display = 'none';

    // Load sessions
    const sessions = await api('GET', '/api/sessions');
    const ready = sessions.filter(s => s.status === 'ready');
    campSession.innerHTML = ready.length
        ? ready.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${s.phone || '?'})</option>`).join('')
        : '<option value="">No connected sessions</option>';

    // Load groups
    const groups = await api('GET', '/api/groups');
    campGroup.innerHTML = groups.length
        ? groups.map(g => `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)}</option>`).join('')
        : '<option value="">No contact groups</option>';

    newCampaignModal.classList.add('active');

    // Auto-detect custom fields for first group
    detectCustomFields();
});

newCampaignModalClose.addEventListener('click', () => {
    newCampaignModal.classList.remove('active');
});

// ─── Media Upload for Campaign ───

campMediaFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('media', file);

    try {
        const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        campMediaPath.value = data.path;
        mediaUploadPrompt.style.display = 'none';
        mediaUploadPreview.style.display = 'flex';
        mediaFileName.textContent = data.filename;
        mediaFileSize.textContent = formatFileSize(data.size);
        mediaFileIcon.textContent = getFileIcon(data.filename);
        toast('File attached', 'success');
    } catch (err) {
        toast('Failed to upload file', 'error');
    }
    e.target.value = '';
});

function removeMediaAttachment() {
    campMediaPath.value = '';
    mediaUploadPrompt.style.display = '';
    mediaUploadPreview.style.display = 'none';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── Detect custom fields from selected group ───

campGroup.addEventListener('change', detectCustomFields);

async function detectCustomFields() {
    const group = campGroup.value;
    if (!group) { detectedFieldsSection.style.display = 'none'; return; }

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
            detectedFieldsSection.style.display = 'block';
            detectedFieldsTags.innerHTML = Array.from(customKeys).map(k =>
                `<span class="placeholder-tag" onclick="insertPlaceholder('campTemplate','${k}')">{{${k}}}</span>`
            ).join('');
        } else {
            detectedFieldsSection.style.display = 'none';
        }
    } catch (e) {
        detectedFieldsSection.style.display = 'none';
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

    // Close campaign modal, open progress modal
    newCampaignModal.classList.remove('active');
    progressModal.classList.add('active');
    progressBar.style.width = '0%';
    progressLog.innerHTML = '';
    progressStats.textContent = 'Starting...';

    try {
        await api('POST', '/api/messages/send-bulk', {
            sessionId,
            group,
            template,
            minDelay: parseInt(campMinDelay.value) || 3000,
            maxDelay: parseInt(campMaxDelay.value) || 5000,
            mediaPath: campMediaPath.value || null,
        });
    } catch (err) {
        toast('Failed to start campaign', 'error');
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
    dayFields.style.display = (freq === 'weekly' || freq === 'monthly') ? 'flex' : 'none';
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
    progressLog.innerHTML += `<div class="${cls}">${icon} ${data.lastPhone}${name} — ${data.lastStatus}</div>`;
    progressLog.scrollTop = progressLog.scrollHeight;
});

socket.on('bulk:complete', (data) => {
    progressStats.textContent = `Complete! Sent: ${data.sent} | Failed: ${data.failed} | Total: ${data.total}`;
    toast(`Campaign complete: ${data.sent} sent, ${data.failed} failed`, data.failed > 0 ? 'error' : 'success');
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
                            <tr>
                                <td>#${c.id}</td>
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
                                <td><button class="btn btn-primary btn-sm" onclick="viewCampaign(${c.id})">Details</button></td>
                            </tr>`;
        }).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (err) {
        campaignsList.innerHTML = '<p style="color:var(--danger);">Failed to load campaigns</p>';
    }
}

async function viewCampaign(id) {
    try {
        const data = await api('GET', `/api/campaigns/${id}`);
        const rate = data.total > 0 ? Math.round((data.sent / data.total) * 100) : 0;

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
                <div style="margin-top:16px;">
                    <p><strong>Group:</strong> ${escapeHtml(data.group_name || '—')}</p>
                    <p><strong>Started:</strong> ${new Date(data.started_at).toLocaleString()}</p>
                    ${data.completed_at ? `<p><strong>Completed:</strong> ${new Date(data.completed_at).toLocaleString()}</p>` : ''}
                </div>
            </div>
            <h4 style="margin:20px 0 10px;">Message Details</h4>
            <div class="table-container table-scroll">
                <table class="data-table">
                    <thead>
                        <tr><th>Contact</th><th>Phone</th><th>Status</th><th>Error</th><th>Time</th></tr>
                    </thead>
                    <tbody>
                        ${(data.messages || []).map(m => `
                            <tr>
                                <td>${escapeHtml(m.contact_name || '—')}</td>
                                <td style="font-family:monospace;font-size:12px;">${escapeHtml(m.contact_phone)}</td>
                                <td><span style="color:${m.status === 'sent' ? 'var(--success)' : 'var(--danger)'};">${m.status === 'sent' ? '✓ Sent' : '✕ Failed'}</span></td>
                                <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(m.error || '—')}</td>
                                <td style="font-size:12px;">${m.sent_at ? new Date(m.sent_at).toLocaleTimeString() : '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        campaignModal.classList.add('active');
    } catch (err) {
        toast('Failed to load campaign details', 'error');
    }
}

campaignModalClose.addEventListener('click', () => campaignModal.classList.remove('active'));
