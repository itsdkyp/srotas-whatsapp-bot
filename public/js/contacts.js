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
const importGroupName = document.getElementById('importGroupName'); // kept for backward compat (may be null in new UI)
const importGroupSelect = document.getElementById('importGroupSelect');
const importNewGroupRow = document.getElementById('importNewGroupRow');
const importNewGroupName = document.getElementById('importNewGroupName');
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

// ─── Export Contacts CSV ───

document.getElementById('exportContactsBtn').addEventListener('click', async () => {
    try {
        const group = groupFilter.value;
        const url = group ? `/api/contacts?group=${encodeURIComponent(group)}` : '/api/contacts';
        const contacts = await api('GET', url);
        if (!contacts.length) return toast('No contacts to export', 'error');

        const rows = [['phone', 'name', 'company']];
        for (const c of contacts) {
            rows.push([
                c.phone || '',
                (c.name || '').replace(/"/g, '""'),
                (c.company || '').replace(/"/g, '""'),
            ]);
        }
        const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `contacts_${group || 'all'}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast(`Exported ${contacts.length} contacts as CSV`, 'success');
    } catch (err) {
        toast('Export failed: ' + (err.message || err), 'error');
    }
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

        // Populate group dropdown with existing groups
        try {
            const groups = await api('GET', '/api/groups');
            const currentGroup = groupFilter.value || 'default';
            importGroupSelect.innerHTML =
                groups.map(g =>
                    `<option value="${escapeHtml(g.name)}" ${g.name === currentGroup ? 'selected' : ''}>${escapeHtml(g.name)}</option>`
                ).join('') +
                '<option value="__new__">＋ Create new group…</option>';
            importNewGroupRow.style.display = 'none';
            importNewGroupName.value = '';
        } catch (e) {
            // fallback: show text field if groups can't be fetched
            importGroupSelect.innerHTML = '<option value="default">default</option><option value="__new__">＋ Create new group…</option>';
        }

        importModal.classList.add('active');
    } catch (err) {
        toast('Failed to upload file', 'error');
    }

    fileInput.value = '';
});

// Show/hide new group text input when "Create new" is chosen
if (importGroupSelect) {
    importGroupSelect.addEventListener('change', () => {
        const isNew = importGroupSelect.value === '__new__';
        importNewGroupRow.style.display = isNew ? '' : 'none';
        if (isNew) importNewGroupName.focus();
    });
}

// ─── Confirm Import ───

confirmImportBtn.addEventListener('click', async () => {
    let group;
    if (importGroupSelect && importGroupSelect.value === '__new__') {
        group = importNewGroupName.value.trim();
        if (!group) return toast('Please enter a new group name', 'error');
    } else if (importGroupSelect) {
        group = importGroupSelect.value || 'default';
    } else {
        // fallback for old importGroupName text input
        group = (importGroupName && importGroupName.value.trim()) || 'default';
    }

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
    grabResult.innerHTML = '';
    const sessions = await api('GET', '/api/sessions');
    const connected = sessions.filter(s => s.status === 'ready');
    const sessionOptions = connected.length
        ? connected.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (+${s.phone || '?'})</option>`).join('')
        : '<option value="">No connected sessions</option>';

    syncWASession.innerHTML = sessionOptions;
    grabSession.innerHTML = sessionOptions;

    const groups = await api('GET', '/api/groups');
    const groupOptions = groups.map(g =>
        `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)}</option>`
    ).join('');

    syncWAGroup.innerHTML = groupOptions;
    grabImportGroup.innerHTML = groupOptions;

    // Reset WA group dropdown
    grabWAGroup.innerHTML = '<option value="">— Click "Load Groups" first —</option>';

    syncWAModal.classList.add('active');
});

syncWAModalClose.addEventListener('click', () => syncWAModal.classList.remove('active'));

// ─── Tab Switcher ───

function switchSyncTab(tab, btn) {
    document.getElementById('syncTabPersonal').style.display = tab === 'personal' ? '' : 'none';
    document.getElementById('syncTabGroups').style.display = tab === 'groups' ? '' : 'none';
    btn.parentElement.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
}

// ─── Personal Contacts Sync ───

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
// WhatsApp Group Contact Grabber
// ═══════════════════════════════════════

const grabSession = document.getElementById('grabSession');
const grabImportGroup = document.getElementById('grabImportGroup');
const grabWAGroup = document.getElementById('grabWAGroup');
const loadWAGroupsBtn = document.getElementById('loadWAGroupsBtn');
const startGrabBtn = document.getElementById('startGrabBtn');
const grabResult = document.getElementById('grabResult');

loadWAGroupsBtn.addEventListener('click', async () => {
    const sessionId = grabSession.value;
    if (!sessionId) return toast('Select a connected session', 'error');

    loadWAGroupsBtn.disabled = true;
    loadWAGroupsBtn.textContent = '⏳ Loading...';
    grabResult.innerHTML = '<p style="color:var(--text-secondary);">Fetching WhatsApp groups...</p>';

    try {
        const waGroups = await api('GET', `/api/contacts/wa-groups/${sessionId}`);
        if (!waGroups.length) {
            grabWAGroup.innerHTML = '<option value="">No groups found</option>';
            grabResult.innerHTML = '<p style="color:var(--warning);">No WhatsApp groups found in this account.</p>';
        } else {
            grabWAGroup.innerHTML = waGroups.map(g =>
                `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)} (${g.participantCount} members)</option>`
            ).join('');
            grabResult.innerHTML = `<p style="color:var(--success);">Found ${waGroups.length} groups. Select one and click "Grab Members".</p>`;
        }
    } catch (err) {
        grabResult.innerHTML = `<p style="color:var(--danger);">❌ ${escapeHtml(err.message || 'Failed to load groups')}</p>`;
    }

    loadWAGroupsBtn.disabled = false;
    loadWAGroupsBtn.textContent = '🔄 Load Groups';
});

let _grabbedContacts = []; // Store last grabbed contacts for export

startGrabBtn.addEventListener('click', async () => {
    const sessionId = grabSession.value;
    const waGroupId = grabWAGroup.value;
    const importGroup = grabImportGroup.value;

    if (!sessionId) return toast('Select a connected session', 'error');
    if (!waGroupId) return toast('Select a WhatsApp group', 'error');

    startGrabBtn.disabled = true;
    startGrabBtn.textContent = '⏳ Grabbing...';
    grabResult.innerHTML = '<p style="color:var(--text-secondary);">Extracting members from group, please wait...</p>';

    try {
        const contacts = await api('GET', `/api/contacts/grab-group/${sessionId}/${encodeURIComponent(waGroupId)}`);

        if (!contacts.length) {
            grabResult.innerHTML = '<p style="color:var(--warning);">No contacts found in this group.</p>';
        } else {
            _grabbedContacts = contacts;
            // Show preview + action buttons
            const groupName = grabWAGroup.options[grabWAGroup.selectedIndex]?.text || 'Group';
            grabResult.innerHTML = `
                <div style="padding:16px; background:var(--bg-input); border-radius:var(--radius-sm); margin-top:8px;">
                    <p style="color:var(--success); font-weight:600; margin-bottom:12px;">
                        ✅ Found ${contacts.length} members in "${escapeHtml(groupName)}"
                    </p>
                    <div class="table-container table-scroll" style="max-height:200px; margin-bottom:12px;">
                        <table class="data-table">
                            <thead><tr><th>#</th><th>Phone</th><th>Name</th></tr></thead>
                            <tbody>
                                ${contacts.slice(0, 50).map((c, i) => `
                                    <tr>
                                        <td style="color:var(--text-muted);font-size:11px;">${i + 1}</td>
                                        <td style="font-family:monospace;font-size:12px;">${escapeHtml(c.phone)}</td>
                                        <td>${escapeHtml(c.name || '—')}</td>
                                    </tr>
                                `).join('')}
                                ${contacts.length > 50 ? `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">...and ${contacts.length - 50} more</td></tr>` : ''}
                            </tbody>
                        </table>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="btn btn-success" onclick="importGrabbedContacts()">
                            📥 Import ${contacts.length} to "${escapeHtml(importGroup)}"
                        </button>
                        <button class="btn btn-secondary" onclick="exportGrabbedCSV()">
                            📄 Export CSV (edit & re-import)
                        </button>
                    </div>
                </div>
            `;
        }
    } catch (err) {
        grabResult.innerHTML = `<p style="color:var(--danger);">❌ ${escapeHtml(err.message || 'Failed to grab contacts')}</p>`;
    }

    startGrabBtn.disabled = false;
    startGrabBtn.textContent = '👥 Grab Members';
});

async function importGrabbedContacts() {
    if (!_grabbedContacts.length) return;
    const importGroup = grabImportGroup.value;
    try {
        await api('POST', '/api/contacts/import', { contacts: _grabbedContacts, group: importGroup });
        toast(`Imported ${_grabbedContacts.length} contacts to "${importGroup}"`, 'success');
        grabResult.innerHTML = `<p style="color:var(--success);">✅ Imported ${_grabbedContacts.length} members to "${escapeHtml(importGroup)}"</p>`;
        loadContacts();
    } catch (err) {
        toast('Import failed: ' + (err.message || err), 'error');
    }
}

function exportGrabbedCSV() {
    if (!_grabbedContacts.length) return;
    const rows = [['phone', 'name', 'company']];
    for (const c of _grabbedContacts) {
        rows.push([
            c.phone || '',
            (c.name || '').replace(/"/g, '""'),
            (c.company || '').replace(/"/g, '""'),
        ]);
    }
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grabbed_contacts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSV exported — edit and re-import via "Import CSV"', 'success');
}

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
