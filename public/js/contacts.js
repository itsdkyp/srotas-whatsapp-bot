/* ═══════════════════════════════════════
   Contacts Page
   ═══════════════════════════════════════ */

const contactsBody = document.getElementById('contactsBody');
const contactCount = document.getElementById('contactCount');
const contactSearch = document.getElementById('contactSearch');
const groupFilter = document.getElementById('groupFilter');
const uploadContactsBtn = document.getElementById('uploadContactsBtn');
const fileInput = document.getElementById('fileInput');
const importModal = document.getElementById('importModal');
const importModalClose = document.getElementById('importModalClose');
const importStats = document.getElementById('importStats');
const importPreviewHead = document.getElementById('importPreviewHead');
const importPreviewBody = document.getElementById('importPreviewBody');
const importGroupName = document.getElementById('importGroupName');
const confirmImportBtn = document.getElementById('confirmImportBtn');
const selectAllContacts = document.getElementById('selectAllContacts');

// Add Contact
const addContactBtn = document.getElementById('addContactBtn');
const addContactModal = document.getElementById('addContactModal');
const addContactModalClose = document.getElementById('addContactModalClose');
const saveContactBtn = document.getElementById('saveContactBtn');
const newContactPhone = document.getElementById('newContactPhone');
const newContactName = document.getElementById('newContactName');
const newContactCompany = document.getElementById('newContactCompany');
const newContactGroup = document.getElementById('newContactGroup');

// Sync WhatsApp
const syncWAContactsBtn = document.getElementById('syncWAContactsBtn');
const syncWAModal = document.getElementById('syncWAModal');
const syncWAModalClose = document.getElementById('syncWAModalClose');
const syncWASession = document.getElementById('syncWASession');
const syncWAGroup = document.getElementById('syncWAGroup');
const startSyncBtn = document.getElementById('startSyncBtn');
const syncResult = document.getElementById('syncResult');

// Group management
const createGroupBtn = document.getElementById('createGroupBtn');
const deleteGroupBtn = document.getElementById('deleteGroupBtn');
const createGroupModal = document.getElementById('createGroupModal');
const createGroupModalClose = document.getElementById('createGroupModalClose');
const newGroupName = document.getElementById('newGroupName');
const newGroupDesc = document.getElementById('newGroupDesc');
const saveGroupBtn = document.getElementById('saveGroupBtn');

// Group from selected
const groupFromSelectedBtn = document.getElementById('groupFromSelectedBtn');
const groupFromSelectedModal = document.getElementById('groupFromSelectedModal');
const groupFromSelectedModalClose = document.getElementById('groupFromSelectedModalClose');
const groupFromSelectedName = document.getElementById('groupFromSelectedName');
const confirmGroupFromSelectedBtn = document.getElementById('confirmGroupFromSelectedBtn');
const selectedCountLabel = document.getElementById('selectedCountLabel');

let parsedContacts = [];

// ─── Load Contacts ───

async function loadContacts() {
    await loadGroups();
    const group = groupFilter.value;
    const search = contactSearch.value.trim();

    let url = '/api/contacts';
    const params = [];
    if (group) params.push(`group=${encodeURIComponent(group)}`);
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (params.length) url += '?' + params.join('&');

    const contacts = await api('GET', url);
    renderContacts(contacts);
}

async function loadGroups() {
    const groups = await api('GET', '/api/groups');
    const current = groupFilter.value;
    groupFilter.innerHTML = '<option value="">All Groups</option>';
    groups.forEach(g => {
        groupFilter.innerHTML += `<option value="${escapeHtml(g.name)}" ${g.name === current ? 'selected' : ''}>${escapeHtml(g.name)}</option>`;
    });

    deleteGroupBtn.style.display = current ? 'inline-flex' : 'none';

    newContactGroup.innerHTML = groups.map(g =>
        `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)}</option>`
    ).join('');
}

function renderContacts(contacts) {
    contactCount.textContent = `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`;

    if (!contacts.length) {
        contactsBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted);">
          No contacts found. Add manually, import a CSV file, or sync from WhatsApp.
        </td>
      </tr>`;
        return;
    }

    contactsBody.innerHTML = contacts.map(c => `
    <tr>
      <td><input type="checkbox" class="contact-checkbox" value="${c.id}" onchange="onContactSelectionChange()" /></td>
      <td>${escapeHtml(c.name || '—')}</td>
      <td style="font-family:'SF Mono','Fira Code',monospace; font-size:12px;">${escapeHtml(c.phone)}</td>
      <td>${escapeHtml(c.company || '—')}</td>
      <td><span style="opacity:0.7">${escapeHtml(c.group_name)}</span></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteContact(${c.id})">✕</button>
      </td>
    </tr>
  `).join('');
}

// ─── Selection tracking ───

function getSelectedContactIds() {
    return Array.from(document.querySelectorAll('.contact-checkbox:checked')).map(cb => parseInt(cb.value));
}

function onContactSelectionChange() {
    const count = getSelectedContactIds().length;
    groupFromSelectedBtn.style.display = count > 0 ? 'inline-flex' : 'none';
}

// ─── Search & Filter ───

contactSearch.addEventListener('input', debounce(loadContacts, 300));
groupFilter.addEventListener('change', () => {
    deleteGroupBtn.style.display = groupFilter.value ? 'inline-flex' : 'none';
    loadContacts();
});

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ─── Upload File (CSV Import) ───

uploadContactsBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/contacts/upload', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.error) {
            toast(data.error, 'error');
            return;
        }

        parsedContacts = data.contacts;

        importStats.innerHTML = `
      <span class="stat">Total rows: <strong>${data.totalRows}</strong></span>
      <span class="stat">Valid contacts: <strong>${data.contacts.length}</strong></span>
      <span class="stat">Detected: Phone → <strong>${data.detected.phone}</strong></span>
    `;

        const cols = ['phone', 'name', 'company'];
        if (parsedContacts.length > 0 && parsedContacts[0].custom_fields) {
            Object.keys(parsedContacts[0].custom_fields).forEach(k => cols.push(k));
        }

        importPreviewHead.innerHTML = '<tr>' + cols.map(c => `<th>${escapeHtml(c)}</th>`).join('') + '</tr>';

        const previewRows = parsedContacts.slice(0, 50);
        importPreviewBody.innerHTML = previewRows.map(c => {
            return '<tr>' + cols.map(col => {
                let val = c[col];
                if (val === undefined && c.custom_fields) val = c.custom_fields[col] || '';
                return `<td>${escapeHtml(String(val || ''))}</td>`;
            }).join('') + '</tr>';
        }).join('');

        importModal.classList.add('active');
    } catch (err) {
        toast('Failed to upload file', 'error');
    }

    fileInput.value = '';
});

// ─── Confirm Import ───

confirmImportBtn.addEventListener('click', async () => {
    const group = importGroupName.value.trim() || 'default';

    confirmImportBtn.disabled = true;
    confirmImportBtn.textContent = 'Importing...';

    try {
        await api('POST', '/api/contacts/import', { contacts: parsedContacts, group });
        toast(`Imported ${parsedContacts.length} contacts to "${group}"`, 'success');
        importModal.classList.remove('active');
        loadContacts();
    } catch (err) {
        toast('Import failed', 'error');
    }

    confirmImportBtn.disabled = false;
    confirmImportBtn.textContent = '✅ Import Contacts';
});

importModalClose.addEventListener('click', () => importModal.classList.remove('active'));

// ─── Select All ───

selectAllContacts.addEventListener('change', (e) => {
    document.querySelectorAll('.contact-checkbox').forEach(cb => cb.checked = e.target.checked);
    onContactSelectionChange();
});

// ─── Delete Contact ───

async function deleteContact(id) {
    try {
        await api('DELETE', `/api/contacts/${id}`);
        toast('Contact deleted', 'success');
        loadContacts();
    } catch (err) {
        toast(err.message || 'Failed to delete', 'error');
    }
}

// ═══════════════════════════════════════
// Manual Contact Creation
// ═══════════════════════════════════════

addContactBtn.addEventListener('click', () => {
    newContactPhone.value = '';
    newContactName.value = '';
    newContactCompany.value = '';
    addContactModal.classList.add('active');
    newContactPhone.focus();
});

addContactModalClose.addEventListener('click', () => addContactModal.classList.remove('active'));

saveContactBtn.addEventListener('click', async () => {
    const phone = newContactPhone.value.trim();
    const name = newContactName.value.trim();
    const company = newContactCompany.value.trim();
    const group = newContactGroup.value || 'default';

    if (!phone) return toast('Phone number is required', 'error');

    saveContactBtn.disabled = true;
    try {
        await api('POST', '/api/contacts', { phone, name, company, group });
        toast('Contact added', 'success');
        addContactModal.classList.remove('active');
        loadContacts();
    } catch (err) {
        toast(err.message || 'Failed to add contact', 'error');
    }
    saveContactBtn.disabled = false;
});

// ═══════════════════════════════════════
// WhatsApp Contact Sync
// ═══════════════════════════════════════

syncWAContactsBtn.addEventListener('click', async () => {
    syncResult.innerHTML = '';
    const sessions = await api('GET', '/api/sessions');
    const connected = sessions.filter(s => s.status === 'ready');
    syncWASession.innerHTML = connected.length
        ? connected.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (+${s.phone || '?'})</option>`).join('')
        : '<option value="">No connected sessions</option>';

    const groups = await api('GET', '/api/groups');
    syncWAGroup.innerHTML = groups.map(g =>
        `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)}</option>`
    ).join('');

    syncWAModal.classList.add('active');
});

syncWAModalClose.addEventListener('click', () => syncWAModal.classList.remove('active'));

startSyncBtn.addEventListener('click', async () => {
    const sessionId = syncWASession.value;
    const group = syncWAGroup.value;
    if (!sessionId) return toast('Select a connected session', 'error');

    startSyncBtn.disabled = true;
    startSyncBtn.textContent = '⏳ Fetching...';
    syncResult.innerHTML = '<p style="color:var(--text-secondary);">Retrieving contacts from WhatsApp, please wait...</p>';

    try {
        const waContacts = await api('GET', `/api/contacts/sync/${sessionId}`);

        if (!waContacts.length) {
            syncResult.innerHTML = '<p style="color:var(--warning);">No contacts found in this WhatsApp account.</p>';
        } else {
            await api('POST', '/api/contacts/import', { contacts: waContacts, group });
            syncResult.innerHTML = `<p style="color:var(--success);">✅ Imported ${waContacts.length} contacts to "${escapeHtml(group)}"</p>`;
            toast(`Synced ${waContacts.length} contacts`, 'success');
            loadContacts();
        }
    } catch (err) {
        syncResult.innerHTML = `<p style="color:var(--danger);">❌ ${escapeHtml(err.message || 'Sync failed')}</p>`;
    }

    startSyncBtn.disabled = false;
    startSyncBtn.textContent = '📲 Fetch Contacts';
});

// ═══════════════════════════════════════
// Group Management
// ═══════════════════════════════════════

createGroupBtn.addEventListener('click', () => {
    newGroupName.value = '';
    newGroupDesc.value = '';
    createGroupModal.classList.add('active');
    newGroupName.focus();
});

createGroupModalClose.addEventListener('click', () => createGroupModal.classList.remove('active'));

saveGroupBtn.addEventListener('click', async () => {
    const name = newGroupName.value.trim();
    const description = newGroupDesc.value.trim();
    if (!name) return toast('Group name is required', 'error');

    saveGroupBtn.disabled = true;
    try {
        await api('POST', '/api/groups', { name, description });
        toast(`Group "${name}" created`, 'success');
        createGroupModal.classList.remove('active');
        loadContacts();
    } catch (err) {
        toast(err.message || 'Failed to create group', 'error');
    }
    saveGroupBtn.disabled = false;
});

deleteGroupBtn.addEventListener('click', async () => {
    const groupName = groupFilter.value;
    if (!groupName) return;
    if (groupName === 'default') return toast('Cannot delete the default group', 'error');
    if (!confirm(`Delete group "${groupName}" and all its contacts?`)) return;

    try {
        const groups = await api('GET', '/api/groups');
        const g = groups.find(gr => gr.name === groupName);
        if (g) {
            await api('DELETE', `/api/groups/${g.id}`);
            toast(`Group "${groupName}" deleted`, 'success');
            groupFilter.value = '';
            loadContacts();
        }
    } catch (err) {
        toast(err.message || 'Failed to delete group', 'error');
    }
});

// ═══════════════════════════════════════
// Group from Selected Contacts
// ═══════════════════════════════════════

groupFromSelectedBtn.addEventListener('click', () => {
    const selected = getSelectedContactIds();
    if (!selected.length) return toast('No contacts selected', 'error');
    selectedCountLabel.textContent = selected.length;
    groupFromSelectedName.value = '';
    groupFromSelectedModal.classList.add('active');
    groupFromSelectedName.focus();
});

groupFromSelectedModalClose.addEventListener('click', () => groupFromSelectedModal.classList.remove('active'));

confirmGroupFromSelectedBtn.addEventListener('click', async () => {
    const name = groupFromSelectedName.value.trim();
    if (!name) return toast('Group name is required', 'error');

    const selectedIds = getSelectedContactIds();
    const copyMode = document.getElementById('groupFromSelectedCopy').checked;

    confirmGroupFromSelectedBtn.disabled = true;
    try {
        // Create the group first
        await api('POST', '/api/groups', { name, description: '' });

        // Move or copy selected contacts to the new group
        await api('POST', '/api/contacts/move-to-group', {
            contactIds: selectedIds,
            group: name,
            copy: copyMode,
        });

        toast(`Created group "${name}" with ${selectedIds.length} contacts`, 'success');
        groupFromSelectedModal.classList.remove('active');
        loadContacts();
    } catch (err) {
        toast(err.message || 'Failed to create group from selection', 'error');
    }
    confirmGroupFromSelectedBtn.disabled = false;
});
