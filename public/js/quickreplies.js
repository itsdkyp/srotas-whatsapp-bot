/* ═══════════════════════════════════════
   Quick Replies Management Page
   ═══════════════════════════════════════ */

const quickRepliesList = document.getElementById('quickRepliesList');
const addQuickReplyBtn = document.getElementById('addQuickReplyBtn');
const quickReplyModal = document.getElementById('quickReplyModal');
const quickReplyModalClose = document.getElementById('quickReplyModalClose');
const quickReplyModalTitle = document.getElementById('quickReplyModalTitle');
const saveQuickReplyBtn = document.getElementById('saveQuickReplyBtn');

const qrEditId = document.getElementById('qrEditId');
const qrTrigger = document.getElementById('qrTrigger');
const qrLabel = document.getElementById('qrLabel');
const qrResponse = document.getElementById('qrResponse');
const qrMediaFile = document.getElementById('qrMediaFile');
const qrMediaPrompt = document.getElementById('qrMediaPrompt');
const qrMediaPreview = document.getElementById('qrMediaPreview');
const qrMediaIcon = document.getElementById('qrMediaIcon');
const qrMediaName = document.getElementById('qrMediaName');
const qrMediaPath = document.getElementById('qrMediaPath');

// ─── Load Quick Replies ───

async function loadQuickReplies() {
    try {
        const replies = await api('GET', '/api/quick-replies');

        if (!replies.length) {
            quickRepliesList.innerHTML = `
                <div class="card" style="text-align:center; padding:48px; color:var(--text-muted);">
                    <div style="font-size:48px; margin-bottom:16px; opacity:0.5;">⚡</div>
                    <p>No quick replies yet. Click <strong>+ Add Quick Reply</strong> to create one.</p>
                    <p style="font-size:13px; margin-top:8px;">
                        Quick replies let you define keyword triggers (like "pricing", "menu", or "1") 
                        that automatically send canned responses when a contact replies with that keyword.
                    </p>
                </div>`;
            return;
        }

        quickRepliesList.innerHTML = `
            <div class="card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Trigger</th>
                            <th>Label</th>
                            <th>Response</th>
                            <th>Attachment</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${replies.map(r => `
                            <tr>
                                <td><code style="background:var(--bg-input);padding:3px 8px;border-radius:4px;font-size:13px;">${escapeHtml(r.trigger_key)}</code></td>
                                <td>${escapeHtml(r.label)}</td>
                                <td style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;color:var(--text-secondary);">
                                    ${escapeHtml(r.response)}
                                </td>
                                <td>${r.media_path ? '📎 Yes' : '—'}</td>
                                <td>
                                    <label class="toggle-label" style="margin:0;">
                                        <span class="toggle">
                                            <input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="toggleQuickReply(${r.id}, this.checked)" />
                                            <span class="toggle-slider"></span>
                                        </span>
                                    </label>
                                </td>
                                <td>
                                    <div style="display:flex;gap:6px;">
                                        <button class="btn btn-primary btn-sm" onclick="editQuickReply(${r.id})">Edit</button>
                                        <button class="btn btn-danger btn-sm" onclick="deleteQuickReply(${r.id})">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="card" style="margin-top:16px; padding:16px;">
                <h4 style="margin-bottom:8px;">💡 How to use Quick Replies in campaigns</h4>
                <p style="font-size:13px; color:var(--text-secondary); line-height:1.6;">
                    Include quick reply options in your campaign message template like this:<br/>
                    <code class="example-template" style="margin-top:8px;">Hi {{name}}! How can we help you today?

${replies.filter(r => r.enabled).map((r, i) => `Reply "${r.trigger_key}" → ${r.label}`).join('\n')}</code>
                </p>
            </div>
        `;
    } catch (err) {
        quickRepliesList.innerHTML = '<p style="color:var(--danger);">Failed to load quick replies</p>';
    }
}

// ─── Open Modal (Add) ───

addQuickReplyBtn.addEventListener('click', () => {
    quickReplyModalTitle.textContent = 'Add Quick Reply';
    qrEditId.value = '';
    qrTrigger.value = '';
    qrLabel.value = '';
    qrResponse.value = '';
    qrMediaPath.value = '';
    qrMediaPrompt.style.display = '';
    qrMediaPreview.style.display = 'none';
    quickReplyModal.classList.add('active');
});

quickReplyModalClose.addEventListener('click', () => {
    quickReplyModal.classList.remove('active');
});

// ─── Edit Quick Reply ───

async function editQuickReply(id) {
    try {
        const replies = await api('GET', '/api/quick-replies');
        const r = replies.find(x => x.id === id);
        if (!r) return toast('Quick reply not found', 'error');

        quickReplyModalTitle.textContent = 'Edit Quick Reply';
        qrEditId.value = r.id;
        qrTrigger.value = r.trigger_key;
        qrLabel.value = r.label;
        qrResponse.value = r.response;
        qrMediaPath.value = r.media_path || '';

        if (r.media_path) {
            qrMediaPrompt.style.display = 'none';
            qrMediaPreview.style.display = 'flex';
            const filename = r.media_path.split('/').pop();
            qrMediaName.textContent = filename;
            qrMediaIcon.textContent = getFileIcon(filename);
        } else {
            qrMediaPrompt.style.display = '';
            qrMediaPreview.style.display = 'none';
        }

        quickReplyModal.classList.add('active');
    } catch (err) {
        toast('Failed to load quick reply', 'error');
    }
}

// ─── Save Quick Reply ───

saveQuickReplyBtn.addEventListener('click', async () => {
    const triggerKey = qrTrigger.value.trim();
    const label = qrLabel.value.trim();
    const response = qrResponse.value.trim();
    const mediaPath = qrMediaPath.value || null;

    if (!triggerKey) return toast('Enter a trigger keyword', 'error');
    if (!label) return toast('Enter a button label', 'error');
    if (!response) return toast('Enter a response message', 'error');

    saveQuickReplyBtn.disabled = true;
    try {
        const editId = qrEditId.value;
        if (editId) {
            await api('PUT', `/api/quick-replies/${editId}`, { triggerKey, label, response, mediaPath });
            toast('Quick reply updated', 'success');
        } else {
            await api('POST', '/api/quick-replies', { triggerKey, label, response, mediaPath });
            toast('Quick reply created', 'success');
        }
        quickReplyModal.classList.remove('active');
        loadQuickReplies();
    } catch (err) {
        toast(err.message || 'Failed to save', 'error');
    }
    saveQuickReplyBtn.disabled = false;
});

// ─── Toggle / Delete ───

async function toggleQuickReply(id, enabled) {
    try {
        await api('PUT', `/api/quick-replies/${id}/toggle`, { enabled });
        toast(enabled ? 'Quick reply enabled' : 'Quick reply disabled', 'success');
    } catch (err) {
        toast('Failed to toggle', 'error');
        loadQuickReplies();
    }
}

async function deleteQuickReply(id) {
    if (!confirm('Delete this quick reply?')) return;
    try {
        await api('DELETE', `/api/quick-replies/${id}`);
        toast('Quick reply deleted', 'success');
        loadQuickReplies();
    } catch (err) {
        toast('Failed to delete', 'error');
    }
}

// ─── Media Upload for Quick Reply ───

qrMediaFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('media', file);

    try {
        const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        qrMediaPath.value = data.path;
        qrMediaPrompt.style.display = 'none';
        qrMediaPreview.style.display = 'flex';
        qrMediaName.textContent = data.filename;
        qrMediaIcon.textContent = getFileIcon(data.filename);
    } catch (err) {
        toast('Failed to upload file', 'error');
    }
    e.target.value = '';
});

function removeQrMedia() {
    qrMediaPath.value = '';
    qrMediaPrompt.style.display = '';
    qrMediaPreview.style.display = 'none';
}

// ─── Helpers ───

function getFileIcon(filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
    if (['mp4', 'avi', 'mov', 'webm'].includes(ext)) return '🎬';
    if (['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(ext)) return '🎵';
    if (['pdf'].includes(ext)) return '📕';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    return '📄';
}
