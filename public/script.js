const api = {
  token: localStorage.getItem('token') || '',
  user: null,
  socket: null,
  currentTab: 'system',
  activity: [],
};

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

function showToast(message, isError = false) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.toggle('border-rose-400/50', isError);
  toast.classList.toggle('text-rose-200', isError);
  toast.classList.toggle('border-emerald-400/50', !isError);
  toast.classList.toggle('text-emerald-200', !isError);

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2600);
}

function formatUptime(totalSeconds) {
  const seconds = Number(totalSeconds || 0);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function pushActivity(label, detail, tone = 'cyan') {
  api.activity.unshift({
    label,
    detail,
    tone,
    at: new Date().toISOString(),
  });
  api.activity = api.activity.slice(0, 8);
  renderActivity();
}

function renderActivity() {
  const box = $('activityList');
  if (!box) return;

  if (!api.activity.length) {
    box.innerHTML = '<p class="text-sm text-slate-400">No recent events yet.</p>';
    return;
  }

  box.innerHTML = api.activity
    .map((item) => {
      const toneClass =
        item.tone === 'green'
          ? 'bg-emerald-300'
          : item.tone === 'orange'
            ? 'bg-orange-300'
            : item.tone === 'red'
              ? 'bg-rose-300'
              : 'bg-cyan-300';

      return `<div class="rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2">
        <div class="flex items-start gap-3">
          <span class="mt-1 h-2.5 w-2.5 rounded-full ${toneClass}"></span>
          <div class="min-w-0">
            <p class="text-sm text-slate-100">${escapeHtml(item.label)}</p>
            <p class="text-xs text-slate-400 mt-0.5">${escapeHtml(item.detail)} • ${new Date(item.at).toLocaleTimeString()}</p>
          </div>
        </div>
      </div>`;
    })
    .join('');
}

function setAuthMessage(msg, isError = true) {
  const el = $('authMessage');
  el.textContent = msg || '';
  el.className = `mt-3 text-sm ${isError ? 'text-rose-300' : 'text-emerald-300'}`;
}

async function request(path, options = {}) {
  const headers = options.headers || {};
  if (api.token) headers.Authorization = `Bearer ${api.token}`;

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function showApp(show) {
  $('authBox').classList.toggle('hidden', show);
  $('appBox').classList.toggle('hidden', !show);
}

function openSidebar() {
  $('sidebarShell').classList.remove('hidden');
  $('sidebarOverlay').classList.remove('hidden');
  $('sidebarShell').classList.add('block');
}

function closeSidebar() {
  if (window.innerWidth >= 1024) return;
  $('sidebarShell').classList.add('hidden');
  $('sidebarOverlay').classList.add('hidden');
  $('sidebarShell').classList.remove('block');
}

function renderTab(tab) {
  api.currentTab = tab;
  document.querySelectorAll('.tabPanel').forEach((panel) => panel.classList.add('hidden'));
  document.querySelectorAll('.tabBtn').forEach((btn) => {
    btn.classList.remove('active');
  });

  $(`tab-${tab}`).classList.remove('hidden');
  const activeBtn = document.querySelector(`[data-tab="${tab}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }

  closeSidebar();
}

function applyPercentBar(id, value) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  const el = $(id);
  if (el) el.style.width = `${safeValue}%`;
}

async function loadMe() {
  const data = await request('/api/auth/me');
  api.user = data.user;

  $('welcomeText').textContent = `Logged in as ${api.user.username} (${api.user.role}) | Upload:${api.user.can_upload} Download:${api.user.can_download} Delete:${api.user.can_delete}`;
  $('userRoleBadge').textContent = `${api.user.username} • ${api.user.role.toUpperCase()}`;

  const usersTabButton = document.querySelector('[data-tab="users"]');
  if (api.user.role !== 'admin') usersTabButton.classList.add('hidden');
  else usersTabButton.classList.remove('hidden');
}

async function login(usernameOrEmail, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail, password }),
  });

  api.token = data.token;
  localStorage.setItem('token', data.token);

  await loadMe();
  showApp(true);
  renderTab('system');
  await Promise.all([loadSystemStats(), loadStorage(), loadProcesses(), loadChatHistory(), loadUsers(), listFiles()]);
  initSocket();
  pushActivity('Session started', `Logged in as ${api.user.username}`, 'green');
  showToast('Welcome to Quantum workspace');
}

async function loadSystemStats() {
  const data = await request('/api/system/stats');
  $('cpuValue').textContent = `${data.cpu_percent}%`;
  $('ramValue').textContent = `${data.ram_percent}%`;
  $('diskValue').textContent = `${data.disk_percent}%`;
  $('netValue').textContent = `RX: ${data.net_rx_kb} KB/s | TX: ${data.net_tx_kb} KB/s`;

  $('quickCpu').textContent = `CPU ${data.cpu_percent}%`;
  $('quickRam').textContent = `RAM ${data.ram_percent}%`;
  $('ramRaw').textContent = `${data.raw.ram_used_gb} GB / ${data.raw.ram_total_gb} GB`;
  $('diskRaw').textContent = `${data.raw.disk_used_gb} GB / ${data.raw.disk_total_gb} GB`;
  $('hostLabel').textContent = `HOST ${data.host.hostname || '--'}`;
  $('uptimeLabel').textContent = `UPTIME ${formatUptime(data.uptime_sec)}`;
  $('osLabel').textContent = `${data.host.distro || data.host.platform || 'OS'} ${data.host.release || ''}`.trim();
  $('perfCpuText').textContent = `${data.cpu_percent}%`;
  $('perfRamText').textContent = `${data.ram_percent}%`;
  $('perfDiskText').textContent = `${data.disk_percent}%`;
  $('performanceFacts').innerHTML = `
    <div class="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">Host: ${escapeHtml(data.host.hostname || '--')}</div>
    <div class="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">OS: ${escapeHtml($('osLabel').textContent || '--')}</div>
    <div class="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">Uptime: ${escapeHtml(formatUptime(data.uptime_sec))}</div>
    <div class="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">RAM Used: ${escapeHtml($('ramRaw').textContent || '--')}</div>
    <div class="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">Disk Used: ${escapeHtml($('diskRaw').textContent || '--')}</div>
  `;

  applyPercentBar('cpuBar', data.cpu_percent);
  applyPercentBar('ramBar', data.ram_percent);
  applyPercentBar('diskBar', data.disk_percent);
  applyPercentBar('perfCpuBar', data.cpu_percent);
  applyPercentBar('perfRamBar', data.ram_percent);
  applyPercentBar('perfDiskBar', data.disk_percent);
}

async function loadStorage() {
  const data = await request('/api/system/storage');
  if (!data.disks.length) {
    $('storageTable').innerHTML = '<p class="text-slate-400">No storage devices reported.</p>';
    return;
  }

  const rows = data.disks
    .map(
      (disk) => `<div class="grid grid-cols-[160px,140px,100px,120px,120px,100px] gap-2 border-b border-white/10 py-2">
        <span class="truncate">${escapeHtml(disk.fs || '--')}</span>
        <span class="truncate text-slate-300">${escapeHtml(disk.mount || '--')}</span>
        <span>${escapeHtml(disk.type || '--')}</span>
        <span>${disk.used_gb} GB</span>
        <span>${disk.size_gb} GB</span>
        <span>${disk.use_percent}%</span>
      </div>`
    )
    .join('');

  $('storageTable').innerHTML = `
    <div class="grid grid-cols-[160px,140px,100px,120px,120px,100px] gap-2 border-b border-white/15 pb-2 mb-2 text-xs uppercase text-slate-300">
      <span>Filesystem</span><span>Mount</span><span>Type</span><span>Used</span><span>Total</span><span>Usage</span>
    </div>
    ${rows}
  `;
}

async function loadProcesses() {
  const data = await request('/api/system/processes');
  $('processTotal').textContent = String(data.total || 0);
  $('processRunning').textContent = String(data.running || 0);
  $('processBlocked').textContent = String(data.blocked || 0);

  if (!data.list.length) {
    $('processesTable').innerHTML = '<p class="text-slate-400">No process information available.</p>';
    return;
  }

  const rows = data.list
    .map(
      (proc) => `<div class="grid grid-cols-[70px,180px,80px,100px,120px,1fr] gap-2 border-b border-white/10 py-2">
        <span>${proc.pid}</span>
        <span class="truncate">${escapeHtml(proc.name)}</span>
        <span>${proc.cpu}%</span>
        <span>${proc.mem} MB</span>
        <span class="truncate">${escapeHtml(proc.user)}</span>
        <span class="truncate text-slate-400">${escapeHtml(proc.command)}</span>
      </div>`
    )
    .join('');

  $('processesTable').innerHTML = `
    <div class="grid grid-cols-[70px,180px,80px,100px,120px,1fr] gap-2 border-b border-white/15 pb-2 mb-2 text-xs uppercase text-slate-300">
      <span>PID</span><span>Name</span><span>CPU</span><span>Memory</span><span>User</span><span>Command</span>
    </div>
    ${rows}
  `;
}

function addChatMessage(item, options = {}) {
  const box = $('chatMessages');
  const card = document.createElement('div');
  card.className = 'rounded-xl border border-white/10 bg-black/30 p-2.5';
  card.innerHTML = `<p class="text-xs text-slate-400">${escapeHtml(item.username)} • ${new Date(item.created_at).toLocaleString()}</p><p class="text-slate-100 mt-1">${escapeHtml(item.message)}</p>`;
  box.appendChild(card);
  box.scrollTop = box.scrollHeight;
  if (!options.silent) {
    pushActivity('Chat message', `${item.username}: ${item.message.slice(0, 44)}`, 'cyan');
  }
}

async function loadChatHistory() {
  const data = await request('/api/chat/history');
  $('chatMessages').innerHTML = '';
  data.messages.forEach((item) => addChatMessage(item, { silent: true }));
}

function initSocket() {
  if (api.socket) api.socket.disconnect();
  api.socket = io({ auth: { token: api.token } });
  api.socket.on('chat:new', addChatMessage);
  api.socket.on('connect_error', () => showToast('Chat disconnected', true));
}

async function sendChat() {
  const text = $('chatInput').value.trim();
  if (!text || !api.socket) return;
  api.socket.emit('chat:send', text);
  $('chatInput').value = '';
}

async function askAi() {
  const message = $('aiInput').value.trim();
  if (!message) return;

  const askBtn = $('aiAskBtn');
  askBtn.disabled = true;
  askBtn.textContent = 'Thinking...';
  $('aiOutput').textContent = 'Processing your request...';

  try {
    const data = await request('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    $('aiOutput').textContent = data.answer;
    pushActivity('AI request', message.slice(0, 56), 'orange');
  } catch (err) {
    $('aiOutput').textContent = err.message;
    showToast(err.message, true);
  } finally {
    askBtn.disabled = false;
    askBtn.textContent = 'Ask AI';
  }
}

function normalizePath(path) {
  return path.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function joinPath(base, name) {
  const b = normalizePath(base || '');
  return b ? `${b}/${name}` : name;
}

function renderFileBreadcrumbs(path) {
  const box = $('fileBreadcrumbs');
  const normalized = normalizePath(path);

  if (!normalized) {
    box.innerHTML = '<button data-breadcrumb="" class="rounded-lg border border-white/20 bg-black/30 px-2 py-1">root</button>';
    return;
  }

  const parts = normalized.split('/');
  const crumbs = ['<button data-breadcrumb="" class="rounded-lg border border-white/20 bg-black/30 px-2 py-1">root</button>'];
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    crumbs.push(`<span class="text-slate-500">/</span><button data-breadcrumb="${escapeHtml(current)}" class="rounded-lg border border-white/20 bg-black/30 px-2 py-1">${escapeHtml(part)}</button>`);
  }
  box.innerHTML = crumbs.join('');
}

async function listFiles() {
  const p = normalizePath($('filePath').value.trim());
  $('filePath').value = p;
  renderFileBreadcrumbs(p);

  const data = await request(`/api/files/list?path=${encodeURIComponent(p)}`);
  if (!data.entries.length) {
    $('fileList').innerHTML = '<p class="text-slate-400">No files in this path.</p>';
    return;
  }

  const rows = data.entries
    .map((entry) => {
      const fullPath = joinPath(p, entry.name);
      const dirAction =
        entry.type === 'dir'
          ? `<button data-action="open-dir" data-path="${escapeHtml(fullPath)}" class="rounded-lg border border-white/20 px-2 py-1">open</button>`
          : '';

      const dlAction =
        entry.type === 'file'
          ? `<a class="action-link inline-flex rounded-lg px-2 py-1" href="/api/files/download?path=${encodeURIComponent(fullPath)}" target="_blank">download</a>`
          : '';

      return `<div class="grid grid-cols-[1fr,auto] items-center gap-2 border-b border-white/10 py-2">
        <p class="truncate">${entry.type === 'dir' ? '[DIR]' : '[FILE]'} ${escapeHtml(entry.name)}</p>
        <div class="flex flex-wrap gap-1 justify-end">
          ${dirAction}
          ${dlAction}
          <button data-action="delete-path" data-path="${escapeHtml(fullPath)}" class="rounded-lg border border-rose-400/40 px-2 py-1 text-rose-200">delete</button>
        </div>
      </div>`;
    })
    .join('');

  $('fileList').innerHTML = rows;
  pushActivity('File browser', p ? `Opened ${p}` : 'Opened root storage', 'cyan');
}

async function uploadFile() {
  const file = $('uploadInput').files[0];
  if (!file) {
    showToast('Choose a file first', true);
    return;
  }

  const path = normalizePath($('filePath').value.trim());
  const form = new FormData();
  form.append('file', file);
  form.append('path', path);

  await request('/api/files/upload', { method: 'POST', body: form });
  showToast('Upload complete');
  $('uploadInput').value = '';
  pushActivity('File uploaded', file.name, 'green');
  await listFiles();
}

async function deletePath(path) {
  await request(`/api/files/delete?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
  showToast('Deleted successfully');
  pushActivity('File deleted', path, 'red');
  await listFiles();
}

function renderUsersRows(users) {
  if (!users.length) return '<p class="text-slate-400">No users found.</p>';

  const head = `<div class="grid grid-cols-[180px,220px,130px,1fr,120px,90px] gap-2 border-b border-white/15 pb-2 mb-2 text-xs uppercase text-slate-300">
    <span>Username</span><span>Email</span><span>Role</span><span>Permissions</span><span>Action</span><span>Delete</span>
  </div>`;

  const body = users
    .map((u) => {
      const isSelf = Number(u.id) === Number(api.user?.id);
      return `<div class="grid grid-cols-[180px,220px,130px,1fr,120px,90px] gap-2 items-center border-b border-white/10 py-2">
        <span class="truncate">${escapeHtml(u.username)}</span>
        <span class="truncate text-slate-300">${escapeHtml(u.email)}</span>
        <select class="user-role rounded-lg bg-black/30 border border-white/20 px-2 py-1" data-user-id="${u.id}">
          <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
        </select>
        <div class="flex gap-3 text-xs">
          <label class="flex items-center gap-1"><input class="user-perm" data-field="can_upload" data-user-id="${u.id}" type="checkbox" ${u.can_upload ? 'checked' : ''}/>upload</label>
          <label class="flex items-center gap-1"><input class="user-perm" data-field="can_download" data-user-id="${u.id}" type="checkbox" ${u.can_download ? 'checked' : ''}/>download</label>
          <label class="flex items-center gap-1"><input class="user-perm" data-field="can_delete" data-user-id="${u.id}" type="checkbox" ${u.can_delete ? 'checked' : ''}/>delete</label>
        </div>
        <button class="save-user rounded-lg border border-white/20 px-2 py-1" data-user-id="${u.id}">save</button>
        <button class="delete-user rounded-lg border border-rose-400/40 px-2 py-1 text-rose-200 ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}" data-user-id="${u.id}" ${isSelf ? 'disabled' : ''}>delete</button>
      </div>`;
    })
    .join('');

  return head + body;
}

async function loadUsers() {
  if (!api.user || api.user.role !== 'admin') {
    $('usersTable').innerHTML = '<p class="text-slate-400">Only admin can manage users.</p>';
    return;
  }

  const data = await request('/api/users');
  $('usersTable').innerHTML = renderUsersRows(data.users);
}

function getRowPayload(userId) {
  const role = document.querySelector(`.user-role[data-user-id="${userId}"]`)?.value;
  const perms = document.querySelectorAll(`.user-perm[data-user-id="${userId}"]`);

  const payload = { role };
  perms.forEach((perm) => {
    payload[perm.dataset.field] = perm.checked ? 1 : 0;
  });
  return payload;
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await login($('usernameOrEmail').value.trim(), $('password').value);
    setAuthMessage('', false);
  } catch (err) {
    setAuthMessage(err.message, true);
  }
});

$('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  api.token = '';
  api.user = null;
  if (api.socket) api.socket.disconnect();
  showApp(false);
  showToast('Logged out');
});

$('mobileNavToggle').addEventListener('click', openSidebar);
$('sidebarOverlay').addEventListener('click', closeSidebar);

document.querySelectorAll('.tabBtn').forEach((btn) => {
  btn.addEventListener('click', () => renderTab(btn.dataset.tab));
});

document.querySelectorAll('.jumpTab').forEach((btn) => {
  btn.addEventListener('click', () => renderTab(btn.dataset.targetTab));
});

$('refreshStatsBtn').addEventListener('click', () =>
  loadSystemStats()
    .then(() => pushActivity('Manual refresh', 'System metrics updated', 'green'))
    .catch((err) => showToast(err.message, true))
);
$('refreshProcessesBtn').addEventListener('click', () =>
  loadProcesses()
    .then(() => pushActivity('Process refresh', 'Process table updated', 'orange'))
    .catch((err) => showToast(err.message, true))
);
$('chatSendBtn').addEventListener('click', () => sendChat().catch((err) => showToast(err.message, true)));
$('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat().catch((err) => showToast(err.message, true));
});

$('aiAskBtn').addEventListener('click', askAi);
document.querySelectorAll('.aiPrompt').forEach((btn) => {
  btn.addEventListener('click', () => {
    $('aiInput').value = btn.dataset.prompt || '';
    $('aiInput').focus();
  });
});

$('listFilesBtn').addEventListener('click', () => listFiles().catch((err) => showToast(err.message, true)));
$('uploadBtn').addEventListener('click', () => uploadFile().catch((err) => showToast(err.message, true)));

$('fileList').addEventListener('click', (e) => {
  const target = e.target.closest('button');
  if (!target) return;

  const action = target.dataset.action;
  const path = target.dataset.path || '';

  if (action === 'open-dir') {
    $('filePath').value = path;
    listFiles().catch((err) => showToast(err.message, true));
  }

  if (action === 'delete-path') {
    deletePath(path).catch((err) => showToast(err.message, true));
  }
});

$('fileBreadcrumbs').addEventListener('click', (e) => {
  const target = e.target.closest('[data-breadcrumb]');
  if (!target) return;
  $('filePath').value = target.dataset.breadcrumb || '';
  listFiles().catch((err) => showToast(err.message, true));
});

$('createUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const createdUsername = $('newUsername').value.trim();

  await request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: $('newUsername').value.trim(),
      email: $('newEmail').value.trim(),
      password: $('newPassword').value,
      role: $('newRole').value,
      can_upload: $('newCanUpload').checked ? 1 : 0,
      can_download: $('newCanDownload').checked ? 1 : 0,
      can_delete: $('newCanDelete').checked ? 1 : 0,
    }),
  });

  $('createUserForm').reset();
  $('newCanDownload').checked = true;
  showToast('User created');
  pushActivity('User created', createdUsername || 'new account', 'green');
  await loadUsers();
});

$('usersTable').addEventListener('click', async (e) => {
  const saveBtn = e.target.closest('.save-user');
  if (saveBtn) {
    const userId = saveBtn.dataset.userId;
    const payload = getRowPayload(userId);
    await request(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    showToast('User updated');
    pushActivity('User updated', `Permissions changed for #${userId}`, 'orange');
    return;
  }

  const deleteBtn = e.target.closest('.delete-user');
  if (deleteBtn) {
    const userId = deleteBtn.dataset.userId;
    await request(`/api/users/${userId}`, { method: 'DELETE' });
    showToast('User deleted');
    pushActivity('User deleted', `Removed account #${userId}`, 'red');
    await loadUsers();
  }
});

(async function init() {
  renderActivity();

  if (window.innerWidth >= 1024) {
    $('sidebarShell').classList.remove('hidden');
  }

  if (api.token) {
    try {
      await loadMe();
      showApp(true);
      renderTab('system');
      await Promise.all([loadSystemStats(), loadStorage(), loadProcesses(), loadChatHistory(), loadUsers(), listFiles()]);
      initSocket();
    } catch {
      localStorage.removeItem('token');
      api.token = '';
      showApp(false);
    }
  }

  setInterval(() => {
    if (api.token) loadSystemStats().catch(() => {});
  }, 5000);
})();
