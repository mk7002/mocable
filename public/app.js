// ===================================================================
// MockAPI Platform - Frontend
// Talks to the Express backend at /api/* and /mock/*
// ===================================================================

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

let mocks = [];
let logs = [];
let editingId = null;

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initForm();
  initModals();
  initImportExport();
  loadMocks();
  loadLogs();
});

// ===== Theme =====
function initTheme() {
  const saved = localStorage.getItem('mockapi_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeButton(saved);

  $('#themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('mockapi_theme', next);
    updateThemeButton(next);
  });
}

function updateThemeButton(theme) {
  $('#themeToggle').innerHTML = theme === 'dark'
    ? '<span class="nav-icon">☀️</span><span class="nav-label">Light Mode</span>'
    : '<span class="nav-icon">🌙</span><span class="nav-label">Dark Mode</span>';
}

// ===== Navigation =====
function initNavigation() {
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(item.dataset.section);
    });
  });

  $('#createMockBtn').addEventListener('click', () => { resetForm(); navigateTo('create'); });
  $('#emptyCreateBtn').addEventListener('click', () => { resetForm(); navigateTo('create'); });
  $('#mobileMenuBtn').addEventListener('click', () => { $('#sidebar').classList.toggle('open'); });
  $('#searchInput').addEventListener('input', e => renderMocksTable(e.target.value));
}

function navigateTo(section) {
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.section === section));
  $$('.content-section').forEach(s => s.classList.remove('active'));

  switch (section) {
    case 'dashboard':
      $('#dashboardSection').classList.add('active');
      $('#pageTitle').textContent = 'Dashboard';
      break;
    case 'create':
      $('#createSection').classList.add('active');
      $('#pageTitle').textContent = editingId ? 'Edit Mock API' : 'Create Mock API';
      break;
    case 'logs':
      $('#logsSection').classList.add('active');
      $('#pageTitle').textContent = 'Request Logs';
      loadLogs();
      break;
    case 'import-export':
      $('#importExportSection').classList.add('active');
      $('#pageTitle').textContent = 'Import / Export';
      break;
  }
  $('#sidebar').classList.remove('open');
}

// ===== API =====
async function api(endpoint, options = {}) {
  const defaults = { headers: { 'Content-Type': 'application/json' } };
  const res = await fetch('/api' + endpoint, { ...defaults, ...options });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

// ===== Load Data =====
async function loadMocks() {
  showLoading(true);
  try {
    mocks = await api('/mocks');
    renderMocksTable();
    updateStats();
  } catch (err) {
    console.error(err);
    showToast('Failed to load mocks', 'error');
  } finally {
    showLoading(false);
  }
}

async function loadLogs() {
  try {
    logs = await api('/logs?limit=100');
    renderLogs();
    updateStats();
  } catch (err) {
    console.error(err);
  }
}

// ===== Stats =====
function updateStats() {
  $('#totalMocks').textContent = mocks.length;
  $('#activeMocks').textContent = mocks.filter(m => m.enabled).length;
  $('#disabledMocks').textContent = mocks.filter(m => !m.enabled).length;
  $('#totalRequests').textContent = logs.length;
}

// ===== Render Mocks =====
function renderMocksTable(query = '') {
  let data = mocks;
  if (query) {
    const q = query.toLowerCase();
    data = mocks.filter(m =>
      (m.name || '').toLowerCase().includes(q) ||
      (m.path || '').toLowerCase().includes(q) ||
      (m.method || '').toLowerCase().includes(q)
    );
  }

  const tbody = $('#mocksTableBody');
  const table = $('#mocksTable');
  const empty = $('#emptyState');

  if (data.length === 0) {
    table.style.display = 'none';
    empty.classList.add('visible');
    tbody.innerHTML = '';
    return;
  }

  table.style.display = 'table';
  empty.classList.remove('visible');

  tbody.innerHTML = data.map(mock => `
    <tr>
      <td><strong>${esc(mock.name)}</strong></td>
      <td><span class="method-badge ${mock.method.toLowerCase()}">${mock.method}</span></td>
      <td class="path-cell">${esc(mock.path)}</td>
      <td><span class="status-badge ${statusClass(mock.statusCode)}">${mock.statusCode}</span></td>
      <td>
        <label class="toggle-switch">
          <input type="checkbox" ${mock.enabled ? 'checked' : ''} data-toggle-id="${mock.id}">
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>${formatDate(mock.createdAt)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-action edit" data-edit-id="${mock.id}" title="Edit">✏️</button>
          <button class="btn-action duplicate" data-dup-id="${mock.id}" title="Duplicate">📋</button>
          <button class="btn-action copy" data-copy-id="${mock.id}" title="Copy URL">🔗</button>
          <button class="btn-action test" data-test-id="${mock.id}" title="Test">▶️</button>
          <button class="btn-action delete" data-del-id="${mock.id}" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  // Event listeners
  tbody.querySelectorAll('[data-toggle-id]').forEach(el => {
    el.addEventListener('change', () => toggleMock(el.dataset.toggleId, el.checked));
  });
  tbody.querySelectorAll('[data-edit-id]').forEach(el => {
    el.addEventListener('click', () => editMock(el.dataset.editId));
  });
  tbody.querySelectorAll('[data-dup-id]').forEach(el => {
    el.addEventListener('click', () => duplicateMock(el.dataset.dupId));
  });
  tbody.querySelectorAll('[data-copy-id]').forEach(el => {
    el.addEventListener('click', () => copyMockUrl(el.dataset.copyId));
  });
  tbody.querySelectorAll('[data-test-id]').forEach(el => {
    el.addEventListener('click', () => testMock(el.dataset.testId));
  });
  tbody.querySelectorAll('[data-del-id]').forEach(el => {
    el.addEventListener('click', () => deleteMock(el.dataset.delId));
  });
}

// ===== Render Logs =====
function renderLogs() {
  const tbody = $('#logsTableBody');
  const table = $('#logsTable');
  const empty = $('#emptyLogs');

  if (logs.length === 0) {
    table.style.display = 'none';
    empty.classList.add('visible');
    tbody.innerHTML = '';
    return;
  }

  table.style.display = 'table';
  empty.classList.remove('visible');

  tbody.innerHTML = logs.map((log, i) => `
    <tr>
      <td>${formatTimestamp(log.timestamp)}</td>
      <td><span class="method-badge ${(log.method || '').toLowerCase()}">${log.method || ''}</span></td>
      <td class="path-cell">${esc(log.path || '')}</td>
      <td><span class="status-badge ${statusClass(log.responseStatus)}">${log.responseStatus || ''}</span></td>
      <td><button class="btn-action" data-log-idx="${i}" title="Details">👁️</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-log-idx]').forEach(el => {
    el.addEventListener('click', () => viewLogDetail(logs[parseInt(el.dataset.logIdx)]));
  });
}

// ===== Form =====
function initForm() {
  $('#mockForm').addEventListener('submit', handleSubmit);
  $('#cancelFormBtn').addEventListener('click', () => { resetForm(); navigateTo('dashboard'); });
  $('#addHeaderBtn').addEventListener('click', addHeaderRow);
  $('#formatJsonBtn').addEventListener('click', formatJson);
  $('#mockBody').addEventListener('input', validateJson);
}

function resetForm() {
  editingId = null;
  $('#mockId').value = '';
  $('#mockName').value = '';
  $('#mockDescription').value = '';
  $('#mockMethod').value = 'GET';
  $('#mockPath').value = '';
  $('#mockStatus').value = '200';
  $('#mockDelay').value = '0';
  $('#mockResponseType').value = 'JSON';
  $('#mockBody').value = '';
  $('#mockEnabled').checked = true;
  $('#jsonError').textContent = '';
  $('#formTitle').textContent = 'Create Mock API';
  $('#saveFormBtn').textContent = 'Save Mock';
  $('#headersContainer').innerHTML = `
    <div class="header-row">
      <input type="text" placeholder="Header name" class="header-key" value="Content-Type">
      <input type="text" placeholder="Header value" class="header-value" value="application/json">
      <button type="button" class="btn-icon btn-remove-header">✕</button>
    </div>`;
  attachHeaderListeners();
}

function addHeaderRow() {
  const row = document.createElement('div');
  row.className = 'header-row';
  row.innerHTML = `
    <input type="text" placeholder="Header name" class="header-key">
    <input type="text" placeholder="Header value" class="header-value">
    <button type="button" class="btn-icon btn-remove-header">✕</button>`;
  $('#headersContainer').appendChild(row);
  attachHeaderListeners();
}

function attachHeaderListeners() {
  $$('.btn-remove-header').forEach(btn => {
    btn.onclick = () => {
      if ($('#headersContainer').children.length > 1) btn.closest('.header-row').remove();
    };
  });
}

function getFormHeaders() {
  const headers = {};
  $$('#headersContainer .header-row').forEach(row => {
    const k = row.querySelector('.header-key').value.trim();
    const v = row.querySelector('.header-value').value.trim();
    if (k) headers[k] = v;
  });
  return headers;
}

function setFormHeaders(headers) {
  const container = $('#headersContainer');
  container.innerHTML = '';
  const entries = Object.entries(headers || {});
  if (entries.length === 0) { addHeaderRow(); return; }
  entries.forEach(([k, v]) => {
    const row = document.createElement('div');
    row.className = 'header-row';
    row.innerHTML = `
      <input type="text" placeholder="Header name" class="header-key" value="${esc(k)}">
      <input type="text" placeholder="Header value" class="header-value" value="${esc(v)}">
      <button type="button" class="btn-icon btn-remove-header">✕</button>`;
    container.appendChild(row);
  });
  attachHeaderListeners();
}

function validateJson() {
  const body = $('#mockBody').value.trim();
  if (!body || $('#mockResponseType').value !== 'JSON') { $('#jsonError').textContent = ''; return true; }
  try { JSON.parse(body); $('#jsonError').textContent = ''; return true; }
  catch (e) { $('#jsonError').textContent = `JSON Error: ${e.message}`; return false; }
}

function formatJson() {
  const ta = $('#mockBody');
  if (!ta.value.trim()) return;
  try {
    ta.value = JSON.stringify(JSON.parse(ta.value), null, 2);
    $('#jsonError').textContent = '';
    showToast('JSON formatted', 'success');
  } catch { showToast('Invalid JSON', 'error'); }
}

async function handleSubmit(e) {
  e.preventDefault();
  const data = {
    name: $('#mockName').value.trim(),
    description: $('#mockDescription').value.trim(),
    method: $('#mockMethod').value,
    path: $('#mockPath').value.trim(),
    statusCode: parseInt($('#mockStatus').value),
    delay: parseInt($('#mockDelay').value) || 0,
    responseType: $('#mockResponseType').value,
    responseBody: $('#mockBody').value,
    headers: getFormHeaders(),
    enabled: $('#mockEnabled').checked,
  };
  if (!data.path.startsWith('/')) data.path = '/' + data.path;

  showLoading(true);
  try {
    if (editingId) {
      await api(`/mocks/${editingId}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('Mock updated', 'success');
    } else {
      await api('/mocks', { method: 'POST', body: JSON.stringify(data) });
      showToast('Mock created', 'success');
    }
    resetForm();
    navigateTo('dashboard');
    await loadMocks();
  } catch (err) {
    showToast('Failed to save mock', 'error');
  } finally {
    showLoading(false);
  }
}

// ===== Actions =====
function editMock(id) {
  const mock = mocks.find(m => m.id === id);
  if (!mock) return;
  editingId = id;
  $('#mockName').value = mock.name || '';
  $('#mockDescription').value = mock.description || '';
  $('#mockMethod').value = mock.method || 'GET';
  $('#mockPath').value = mock.path || '';
  $('#mockStatus').value = mock.statusCode || 200;
  $('#mockDelay').value = mock.delay || 0;
  $('#mockResponseType').value = mock.responseType || 'JSON';
  $('#mockBody').value = mock.responseBody || '';
  $('#mockEnabled').checked = mock.enabled !== false;
  $('#formTitle').textContent = 'Edit Mock API';
  $('#saveFormBtn').textContent = 'Update Mock';
  setFormHeaders(mock.headers);
  navigateTo('create');
}

async function deleteMock(id) {
  if (!confirm('Delete this mock?')) return;
  showLoading(true);
  try {
    await api(`/mocks/${id}`, { method: 'DELETE' });
    showToast('Mock deleted', 'success');
    await loadMocks();
  } catch { showToast('Failed to delete', 'error'); }
  finally { showLoading(false); }
}

async function duplicateMock(id) {
  const mock = mocks.find(m => m.id === id);
  if (!mock) return;
  const copy = { ...mock, name: mock.name + ' (Copy)' };
  delete copy.id;
  delete copy.createdAt;
  showLoading(true);
  try {
    await api('/mocks', { method: 'POST', body: JSON.stringify(copy) });
    showToast('Mock duplicated', 'success');
    await loadMocks();
  } catch { showToast('Failed to duplicate', 'error'); }
  finally { showLoading(false); }
}

async function toggleMock(id, enabled) {
  try {
    await api(`/mocks/${id}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
    const mock = mocks.find(m => m.id === id);
    if (mock) mock.enabled = enabled;
    updateStats();
    showToast(`Mock ${enabled ? 'enabled' : 'disabled'}`, 'success');
  } catch { showToast('Failed to toggle', 'error'); }
}

function copyMockUrl(id) {
  const mock = mocks.find(m => m.id === id);
  if (!mock) return;
  const url = `${window.location.origin}/mock${mock.path}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('URL copied', 'success');
  }).catch(() => {
    const inp = document.createElement('input');
    inp.value = url;
    document.body.appendChild(inp);
    inp.select();
    document.execCommand('copy');
    document.body.removeChild(inp);
    showToast('URL copied', 'success');
  });
}

// ===== Test =====
let currentTestMock = null;

function initModals() {
  $('#closeTestModal').addEventListener('click', () => $('#testModal').classList.remove('active'));
  $('#closeLogModal').addEventListener('click', () => $('#logDetailModal').classList.remove('active'));
  $('#testModal').addEventListener('click', e => { if (e.target === $('#testModal')) $('#testModal').classList.remove('active'); });
  $('#logDetailModal').addEventListener('click', e => { if (e.target === $('#logDetailModal')) $('#logDetailModal').classList.remove('active'); });
  $('#sendTestBtn').addEventListener('click', executeTest);
  $('#clearLogsBtn').addEventListener('click', async () => {
    if (!confirm('Clear all logs?')) return;
    showLoading(true);
    try {
      await api('/logs', { method: 'DELETE' });
      logs = [];
      renderLogs();
      updateStats();
      showToast('Logs cleared', 'success');
    } catch { showToast('Failed to clear logs', 'error'); }
    finally { showLoading(false); }
  });
}

function testMock(id) {
  const mock = mocks.find(m => m.id === id);
  if (!mock) return;
  currentTestMock = mock;

  const url = `${window.location.origin}/mock${mock.path}`;
  $('#testMethod').textContent = mock.method;
  $('#testMethod').className = `method-badge ${mock.method.toLowerCase()}`;
  $('#testUrl').textContent = url;
  $('#testLoading').style.display = 'none';
  $('#testResponse').style.display = 'none';

  const showBody = ['POST', 'PUT', 'PATCH'].includes(mock.method);
  $('#testBodyGroup').style.display = showBody ? 'block' : 'none';
  $('#testRequestBody').value = '';
  $('#testModal').classList.add('active');
}

async function executeTest() {
  if (!currentTestMock) return;
  const mock = currentTestMock;
  const body = $('#testRequestBody').value.trim() || undefined;

  $('#testLoading').style.display = 'block';
  $('#testResponse').style.display = 'none';

  const url = `${window.location.origin}/mock${mock.path}`;
  const startTime = Date.now();

  try {
    const opts = { method: mock.method, headers: { 'Content-Type': 'application/json' } };
    if (body && ['POST', 'PUT', 'PATCH'].includes(mock.method)) opts.body = body;

    const res = await fetch(url, opts);
    const elapsed = Date.now() - startTime;
    const text = await res.text();

    let formatted = text;
    try { formatted = JSON.stringify(JSON.parse(text), null, 2); } catch {}

    const headers = {};
    res.headers.forEach((v, k) => { headers[k] = v; });

    $('#testStatusBadge').textContent = `${res.status}`;
    $('#testStatusBadge').className = `status-badge ${statusClass(res.status)}`;
    $('#testTime').textContent = `(${elapsed}ms)`;
    $('#testResponseHeaders').textContent = JSON.stringify(headers, null, 2);
    $('#testResponseBody').textContent = formatted;

    $('#testLoading').style.display = 'none';
    $('#testResponse').style.display = 'block';

    // Refresh logs
    loadLogs();
  } catch (err) {
    $('#testLoading').style.display = 'none';
    $('#testResponse').style.display = 'block';
    $('#testStatusBadge').textContent = 'Error';
    $('#testStatusBadge').className = 'status-badge error';
    $('#testTime').textContent = '';
    $('#testResponseHeaders').textContent = '';
    $('#testResponseBody').textContent = err.message;
  }
}

// ===== Log Detail =====
function viewLogDetail(log) {
  $('#logDetailContent').innerHTML = `
    <h4>Timestamp</h4><pre>${formatTimestamp(log.timestamp)}</pre>
    <h4>Method</h4><pre>${log.method || 'N/A'}</pre>
    <h4>Path</h4><pre>${esc(log.path || 'N/A')}</pre>
    <h4>Response Status</h4><pre>${log.responseStatus || 'N/A'}</pre>
    <h4>Headers</h4><pre>${JSON.stringify(log.headers || {}, null, 2)}</pre>
    <h4>Query Parameters</h4><pre>${JSON.stringify(log.query || {}, null, 2)}</pre>
    <h4>Request Body</h4><pre>${log.requestBody ? JSON.stringify(log.requestBody, null, 2) : 'null'}</pre>
  `;
  $('#logDetailModal').classList.add('active');
}

// ===== Import/Export =====
function initImportExport() {
  $('#exportBtn').addEventListener('click', exportMocks);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', importMocks);
}

function exportMocks() {
  if (mocks.length === 0) { showToast('No mocks to export', 'info'); return; }
  const data = mocks.map(m => {
    const c = { ...m };
    delete c.id;
    delete c.createdAt;
    return c;
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mocks.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Mocks exported', 'success');
}

async function importMocks(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async event => {
    try {
      const data = JSON.parse(event.target.result);
      if (!Array.isArray(data)) throw new Error('Expected array');
      showLoading(true);
      await api('/mocks/import', { method: 'POST', body: JSON.stringify(data) });
      showToast(`Imported ${data.length} mocks`, 'success');
      await loadMocks();
    } catch (err) { showToast(`Import failed: ${err.message}`, 'error'); }
    finally { showLoading(false); e.target.value = ''; }
  };
  reader.readAsText(file);
}

// ===== Utilities =====
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function statusClass(code) {
  if (!code) return '';
  if (code >= 200 && code < 300) return 'success';
  if (code >= 400 && code < 500) return 'warning';
  if (code >= 500) return 'error';
  return '';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimestamp(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function showLoading(show) { $('#loadingOverlay').classList.toggle('active', show); }

function showToast(msg, type = 'info') {
  const container = $('#toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 3000);
}
