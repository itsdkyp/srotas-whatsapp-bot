/* ═══════════════════════════════════════
   Scheduler Page
   ═══════════════════════════════════════ */

const schedulesList = document.getElementById('schedulesList');
const addScheduleBtn = document.getElementById('addScheduleBtn');

// ─── Load Scheduler ───

async function loadScheduler() {
  const schedules = await api('GET', '/api/schedules');
  renderSchedules(schedules);
}

function renderSchedules(schedules) {
  if (!schedules || !schedules.length) {
    schedulesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <p>No scheduled messages yet</p>
        <p style="color:var(--text-muted); font-size:13px;">Create a schedule to automatically send messages daily, weekly, or monthly</p>
      </div>
    `;
    return;
  }

  schedulesList.innerHTML = schedules.map(s => {
    const freq = formatFrequency(s);
    const nextRun = s.next_run ? new Date(s.next_run).toLocaleString() : '—';
    const lastRun = s.last_run ? new Date(s.last_run).toLocaleString() : 'Never';

    return `
      <div class="card schedule-card" style="margin-bottom:16px;">
        <div class="session-card-header">
          <span class="session-name">${escapeHtml(s.name)}</span>
          <span class="session-status ${s.enabled ? 'ready' : 'disconnected'}">
            ${s.enabled ? '● Active' : '○ Paused'}
          </span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; font-size:13px; color:var(--text-secondary);">
          <div><strong>Frequency:</strong> ${freq}</div>
          <div><strong>Time:</strong> ${s.send_time || '09:00'}</div>
          <div><strong>Group:</strong> ${escapeHtml(s.group_name)}</div>
          <div><strong>Next Run:</strong> ${nextRun}</div>
          <div><strong>Last Run:</strong> ${lastRun}</div>
        </div>
        <div style="background:var(--bg-input); padding:12px; border-radius:8px; font-size:13px; margin-bottom:16px; white-space:pre-wrap; max-height:80px; overflow:hidden; color:var(--text-secondary);">
          ${escapeHtml(s.template)}
        </div>
        <div class="session-actions">
          <label class="toggle-label">
            <span class="toggle">
              <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="toggleSchedule(${s.id}, this.checked)" />
              <span class="toggle-slider"></span>
            </span>
            Enabled
          </label>
          <button class="btn btn-danger btn-sm" onclick="deleteSchedule(${s.id})">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function formatFrequency(s) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (s.frequency === 'daily') return `Daily at ${s.send_time}`;
  if (s.frequency === 'weekly') return `Every ${days[s.day_of_week] || 'Monday'} at ${s.send_time}`;
  if (s.frequency === 'monthly') return `Monthly on day ${s.day_of_month} at ${s.send_time}`;
  return s.frequency;
}

// ─── Add Schedule ───

addScheduleBtn.addEventListener('click', () => {
  showScheduleForm();
});

async function showScheduleForm() {
  const sessions = await api('GET', '/api/sessions');
  const groups = await api('GET', '/api/contacts/groups');

  const sessionOptions = sessions
    .filter(s => s.status === 'ready')
    .map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join('');

  const groupOptions = groups
    .map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`)
    .join('');

  schedulesList.innerHTML = `
    <div class="card" style="max-width:600px;">
      <h3>Create Schedule</h3>
      <div class="form-group">
        <label>Schedule Name</label>
        <input type="text" id="schedName" class="text-input" placeholder="e.g. Weekly Newsletter" />
      </div>
      <div class="form-group">
        <label>Session</label>
        <select id="schedSession" class="select-input">
          ${sessionOptions || '<option value="">No connected sessions</option>'}
        </select>
      </div>
      <div class="form-group">
        <label>Contact Group</label>
        <select id="schedGroup" class="select-input">
          ${groupOptions || '<option value="">No contact groups</option>'}
        </select>
      </div>
      <div class="form-group">
        <label>Message Template</label>
        <textarea id="schedTemplate" class="textarea-input" rows="4" placeholder="Hello {{name}}, your weekly update from {{company}}..."></textarea>
        <div class="template-hint">
          Available: <code>{{name}}</code> <code>{{company}}</code> <code>{{phone}}</code> + any custom column
        </div>
      </div>
      <div class="form-group">
        <label>Frequency</label>
        <select id="schedFrequency" class="select-input" onchange="updateScheduleFields()">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <div id="schedWeeklyField" class="form-group" style="display:none;">
        <label>Day of Week</label>
        <select id="schedDayOfWeek" class="select-input">
          <option value="0">Sunday</option>
          <option value="1" selected>Monday</option>
          <option value="2">Tuesday</option>
          <option value="3">Wednesday</option>
          <option value="4">Thursday</option>
          <option value="5">Friday</option>
          <option value="6">Saturday</option>
        </select>
      </div>
      <div id="schedMonthlyField" class="form-group" style="display:none;">
        <label>Day of Month</label>
        <input type="number" id="schedDayOfMonth" class="text-input" value="1" min="1" max="28" />
      </div>
      <div class="form-group">
        <label>Send Time</label>
        <input type="time" id="schedSendTime" class="text-input" value="09:00" />
      </div>
      <div style="display:flex; gap:12px; margin-top:8px;">
        <button class="btn btn-success" style="flex:1;" onclick="saveSchedule()">✅ Create Schedule</button>
        <button class="btn btn-danger" style="flex:0;" onclick="loadScheduler()">Cancel</button>
      </div>
    </div>
  `;
}

function updateScheduleFields() {
  const freq = document.getElementById('schedFrequency').value;
  document.getElementById('schedWeeklyField').style.display = freq === 'weekly' ? 'block' : 'none';
  document.getElementById('schedMonthlyField').style.display = freq === 'monthly' ? 'block' : 'none';
}

async function saveSchedule() {
  const name = document.getElementById('schedName').value.trim();
  const sessionId = document.getElementById('schedSession').value;
  const groupName = document.getElementById('schedGroup').value;
  const template = document.getElementById('schedTemplate').value.trim();
  const frequency = document.getElementById('schedFrequency').value;
  const dayOfWeek = parseInt(document.getElementById('schedDayOfWeek').value);
  const dayOfMonth = parseInt(document.getElementById('schedDayOfMonth').value);
  const sendTime = document.getElementById('schedSendTime').value;

  if (!name) return toast('Enter a schedule name', 'error');
  if (!sessionId) return toast('Select a session', 'error');
  if (!groupName) return toast('Select a contact group', 'error');
  if (!template) return toast('Enter a message template', 'error');

  try {
    await api('POST', '/api/schedules', {
      name, sessionId, groupName, template, frequency,
      dayOfWeek, dayOfMonth, sendTime
    });
    toast(`Schedule "${name}" created`, 'success');
    loadScheduler();
  } catch (err) {
    toast(err.message || 'Failed to create schedule', 'error');
  }
}

// ─── Toggle / Delete ───

async function toggleSchedule(id, enabled) {
  await api('PUT', `/api/schedules/${id}/toggle`, { enabled });
  toast(`Schedule ${enabled ? 'enabled' : 'paused'}`, 'info');
  loadScheduler();
}

async function deleteSchedule(jobId) {
  if (!await UI.confirm('Delete this scheduled job?')) return;
  await api('DELETE', `/api/schedules/${jobId}`);
  toast('Schedule deleted', 'success');
  loadScheduler();
}

// ─── Socket.IO Events ───

socket.on('schedule:executed', (data) => {
  toast(`Scheduled job "${data.name}" executed. Next: ${new Date(data.nextRun).toLocaleString()}`, 'success');
  loadScheduler();
});
