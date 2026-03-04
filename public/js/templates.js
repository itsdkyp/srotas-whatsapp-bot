/* ═══════════════════════════════════════
   Templates Page
   ═══════════════════════════════════════ */

const templatesList = document.getElementById('templatesList');
const addTemplateBtn = document.getElementById('addTemplateBtn');
const templateModal = document.getElementById('templateModal');
const templateModalClose = document.getElementById('templateModalClose');
const templateModalTitle = document.getElementById('templateModalTitle');
const tmplName = document.getElementById('tmplName');
const tmplContent = document.getElementById('tmplContent');
const tmplMediaFile = document.getElementById('tmplMediaFile');
const tmplMediaPrompt = document.getElementById('tmplMediaPrompt');
const tmplMediaFileList = document.getElementById('tmplMediaFileList');
const tmplMediaAddMore = document.getElementById('tmplMediaAddMore');
const tmplButtonsList = document.getElementById('tmplButtonsList');
const tmplAddButton = document.getElementById('tmplAddButton');
const saveTemplateBtn = document.getElementById('saveTemplateBtn');

let _tmplMediaFiles = []; // { path, filename, size }
let _editingTemplateId = null;

// ─── Load Templates Page ───

async function loadTemplatesPage() {
    try {
        const templates = await api('GET', '/api/templates');

        if (!templates.length) {
            templatesList.innerHTML = `
                <div class="card" style="text-align:center; padding:48px; color:var(--text-muted);">
                    <div style="font-size:48px; margin-bottom:16px; opacity:0.5;">📋</div>
                    <p>No templates yet. Click <strong>+ New Template</strong> to create one.</p>
                </div>`;
            return;
        }

        templatesList.innerHTML = `
            <div class="card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Message</th>
                            <th>Media</th>
                            <th>Buttons</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${templates.map(t => {
            let mediaCount = 0;
            try { mediaCount = t.media_paths ? JSON.parse(t.media_paths).length : 0; } catch (e) { }
            let btnCount = 0;
            try { btnCount = t.buttons_config ? JSON.parse(t.buttons_config).length : 0; } catch (e) { }
            return `
                            <tr>
                                <td style="font-weight:600;">${escapeHtml(t.name)}</td>
                                <td style="max-width:250px;">
                                    <div style="font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(t.content)}">
                                        ${escapeHtml(t.content.substring(0, 80))}${t.content.length > 80 ? '...' : ''}
                                    </div>
                                </td>
                                <td>${mediaCount > 0 ? `📎 ${mediaCount} file${mediaCount > 1 ? 's' : ''}` : '<span style="color:var(--text-muted);">—</span>'}</td>
                                <td>${btnCount > 0 ? `🔘 ${btnCount}` : '<span style="color:var(--text-muted);">—</span>'}</td>
                                <td style="font-size:12px;">${new Date(t.created_at).toLocaleDateString()}</td>
                                <td style="display:flex;gap:4px;">
                                    <button class="btn btn-primary btn-sm" onclick="editTemplate(${t.id})">Edit</button>
                                    <button class="btn btn-danger btn-sm" onclick="deleteTemplate(${t.id}, '${escapeHtml(t.name)}')">Delete</button>
                                </td>
                            </tr>`;
        }).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (err) {
        templatesList.innerHTML = '<p style="color:var(--danger);">Failed to load templates</p>';
    }
}

// ─── Open New Template Modal ───

addTemplateBtn.addEventListener('click', () => {
    _editingTemplateId = null;
    templateModalTitle.textContent = 'New Template';
    saveTemplateBtn.textContent = '💾 Save Template';
    tmplName.value = '';
    tmplContent.value = '';
    _tmplMediaFiles = [];
    renderTmplMediaFileList();
    tmplButtonsList.innerHTML = '';
    updateTmplAddButtonState();
    templateModal.classList.add('active');
});

templateModalClose.addEventListener('click', () => {
    templateModal.classList.remove('active');
});

// ─── Template Media Upload ───

tmplMediaFile.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (_tmplMediaFiles.length + files.length > 10) {
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
            _tmplMediaFiles.push(f);
        }
        renderTmplMediaFileList();
        toast(`${data.files.length} file(s) attached`, 'success');
    } catch (err) {
        toast('Failed to upload files', 'error');
    }
    e.target.value = '';
});

function removeTmplMediaFile(index) {
    _tmplMediaFiles.splice(index, 1);
    renderTmplMediaFileList();
}

function renderTmplMediaFileList() {
    if (_tmplMediaFiles.length === 0) {
        tmplMediaFileList.innerHTML = '';
        tmplMediaPrompt.style.display = '';
        tmplMediaAddMore.style.display = 'none';
        return;
    }
    tmplMediaPrompt.style.display = 'none';
    tmplMediaAddMore.style.display = _tmplMediaFiles.length < 10 ? '' : 'none';
    tmplMediaFileList.innerHTML = _tmplMediaFiles.map((f, i) => `
        <div class="media-file-item">
            <span class="media-file-icon">${getFileIcon(f.filename)}</span>
            <span class="media-file-name">${escapeHtml(f.filename)}</span>
            <span class="media-file-size">${formatFileSize(f.size)}</span>
            <button class="btn btn-danger btn-xs" onclick="removeTmplMediaFile(${i})">✕</button>
        </div>
    `).join('');
}

// ─── Template Buttons ───

tmplAddButton.addEventListener('click', () => {
    const btnCount = tmplButtonsList.children.length;
    if (btnCount >= 3) return;

    const num = btnCount + 1;
    const div = document.createElement('div');
    div.className = 'campaign-button-item';
    div.innerHTML = `
        <span class="btn-number">${num}.</span>
        <input type="text" class="text-input btn-label-input" placeholder="Button label" maxlength="30" />
        <textarea class="textarea-input btn-reply-input" rows="2" placeholder="Auto-reply when pressed"></textarea>
        <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove(); renumberTmplButtons(); updateTmplAddButtonState();">✕</button>
    `;
    tmplButtonsList.appendChild(div);
    updateTmplAddButtonState();
});

function renumberTmplButtons() {
    document.querySelectorAll('#tmplButtonsList .campaign-button-item').forEach((item, i) => {
        const numSpan = item.querySelector('.btn-number');
        if (numSpan) numSpan.textContent = `${i + 1}.`;
    });
}

function updateTmplAddButtonState() {
    const btnCount = tmplButtonsList.children.length;
    tmplAddButton.disabled = btnCount >= 3;
    tmplAddButton.textContent = btnCount >= 3 ? 'Max 3 Buttons Reached' : '+ Add Button (max 3)';
}

// ─── Save Template ───

saveTemplateBtn.addEventListener('click', async () => {
    const name = tmplName.value.trim();
    const content = tmplContent.value.trim();

    if (!name) return toast('Enter a template name', 'error');
    if (!content) return toast('Enter message content', 'error');

    // Collect buttons
    const buttons = [];
    document.querySelectorAll('#tmplButtonsList .campaign-button-item').forEach(item => {
        const label = (item.querySelector('.btn-label-input') || {}).value?.trim();
        const reply = (item.querySelector('.btn-reply-input') || {}).value?.trim();
        if (label) buttons.push({ label, reply: reply || '' });
    });

    const mediaPaths = _tmplMediaFiles.map(f => f.path);

    saveTemplateBtn.disabled = true;
    try {
        if (_editingTemplateId) {
            await api('PUT', `/api/templates/${_editingTemplateId}`, {
                name, content,
                mediaPaths: mediaPaths.length ? mediaPaths : null,
                buttons: buttons.length ? buttons : null,
            });
            toast(`Template "${name}" updated`, 'success');
        } else {
            await api('POST', '/api/templates', {
                name, content,
                mediaPaths: mediaPaths.length ? mediaPaths : null,
                buttons: buttons.length ? buttons : null,
            });
            toast(`Template "${name}" saved`, 'success');
        }
        templateModal.classList.remove('active');
        loadTemplatesPage();
    } catch (err) {
        toast('Failed to save template: ' + (err.message || err), 'error');
    }
    saveTemplateBtn.disabled = false;
});

// ─── Edit Template ───

async function editTemplate(id) {
    try {
        const templates = await api('GET', '/api/templates');
        const tmpl = templates.find(t => t.id === id);
        if (!tmpl) return toast('Template not found', 'error');

        _editingTemplateId = id;
        templateModalTitle.textContent = 'Edit Template';
        saveTemplateBtn.textContent = '💾 Update Template';

        tmplName.value = tmpl.name;
        tmplContent.value = tmpl.content;

        // Load media
        _tmplMediaFiles = [];
        if (tmpl.media_paths) {
            try {
                const paths = typeof tmpl.media_paths === 'string' ? JSON.parse(tmpl.media_paths) : tmpl.media_paths;
                if (Array.isArray(paths)) {
                    for (const p of paths) {
                        const parts = p.split('/');
                        _tmplMediaFiles.push({ path: p, filename: parts[parts.length - 1], size: 0 });
                    }
                }
            } catch (e) { }
        }
        renderTmplMediaFileList();

        // Load buttons
        tmplButtonsList.innerHTML = '';
        if (tmpl.buttons_config) {
            try {
                const buttons = typeof tmpl.buttons_config === 'string' ? JSON.parse(tmpl.buttons_config) : tmpl.buttons_config;
                if (Array.isArray(buttons)) {
                    for (const btn of buttons) {
                        const num = tmplButtonsList.children.length + 1;
                        const div = document.createElement('div');
                        div.className = 'campaign-button-item';
                        div.innerHTML = `
                            <span class="btn-number">${num}.</span>
                            <input type="text" class="text-input btn-label-input" placeholder="Button label" maxlength="30" value="${escapeHtml(btn.label || '')}" />
                            <textarea class="textarea-input btn-reply-input" rows="2" placeholder="Auto-reply when pressed">${escapeHtml(btn.reply || '')}</textarea>
                            <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove(); renumberTmplButtons(); updateTmplAddButtonState();">✕</button>
                        `;
                        tmplButtonsList.appendChild(div);
                    }
                }
            } catch (e) { }
        }
        updateTmplAddButtonState();

        templateModal.classList.add('active');
    } catch (err) {
        toast('Failed to load template: ' + (err.message || err), 'error');
    }
}

// ─── Delete Template ───

async function deleteTemplate(id, name) {
    if (!await UI.confirm(`Delete template "${name}"? This cannot be undone.`)) return;

    try {
        await api('DELETE', `/api/templates/${id}`);
        toast('Template deleted', 'success');
        loadTemplatesPage();
    } catch (err) {
        toast('Failed to delete template: ' + (err.message || err), 'error');
    }
}
