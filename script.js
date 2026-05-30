/* ============================================================
   FINANCE TRACKER — script.js
   ============================================================ */

'use strict';

// ── Configuration ───────────────────────────────────────────
// IMPORTANT: Replace with your deployed Google Apps Script Web App URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwK6MTu5CNeMAohJofoADV4qAOjHX2rGBn2gZBxtCewld3H6oxLwi33sul63VjK5Dg6zw/exec';

const USE_DEMO_DATA = APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';

// ── Constants ────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const CATEGORIES = ['ZEPETO','ROBLOX','BLOCK & DECO','ETC'];

const CAT_COLORS = {
  'ZEPETO':      '#6c63ff',
  'ROBLOX':      '#e05555',
  'BLOCK & DECO':'#f5a623',
  'ETC':         '#2ec4b6'
};

const CAT_BG = {
  'ZEPETO':      'rgba(108,99,255,0.18)',
  'ROBLOX':      'rgba(224,85,85,0.18)',
  'BLOCK & DECO':'rgba(245,166,35,0.18)',
  'ETC':         'rgba(46,196,182,0.18)'
};

// ── App State ────────────────────────────────────────────────
let appData = [];          // all records
let editingRecord = null;  // record being edited
let deleteTarget  = null;  // {id, month}
let monthChartInst  = null;
let yearChartInst   = null;
let currentMonthDash = new Date().getMonth(); // 0-based index
let currentChartTypeMonth = 'bar';
let currentChartTypeYear  = 'bar';
let currentMetricMonth    = 'profit';
let currentMetricYear     = 'profit';

// ── DOM Helpers ──────────────────────────────────────────────
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── Initialisation ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupForm();
  setupDarkMode();
  setupMobile();
  setupMonthTabs();
  showLoader('Loading data...');
  await fetchAllData();
  hideLoader();
  renderDashboard();
  renderYearDashboard();
  renderRecordsTable();
  if (USE_DEMO_DATA) showConfigBanner();
});

// ── Demo data generator ──────────────────────────────────────
function generateDemoData() {
  const data = [];
  MONTHS.forEach((month, mi) => {
    CATEGORIES.forEach(cat => {
      const count = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < count; i++) {
        const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
        const mm  = String(mi + 1).padStart(2, '0');
        const income  = +(Math.random() * 5000 + 500).toFixed(2);
        const expense = +(Math.random() * 3000 + 200).toFixed(2);
        const profit  = +(income - expense).toFixed(2);
        data.push({
          id: Math.random().toString(36).slice(2,10).toUpperCase(),
          date: `2025-${mm}-${day}`,
          income, expense, profit,
          category: cat,
          note: `Demo note ${i+1}`,
          month,
          timestamp: new Date().toISOString()
        });
      }
    });
  });
  return data;
}

// ── Fetch / CRUD ─────────────────────────────────────────────
async function fetchAllData() {
  if (USE_DEMO_DATA) {
    appData = generateDemoData();
    return;
  }
  try {
    const res  = await fetch(`${APPS_SCRIPT_URL}?action=getAll`);
    const json = await res.json();
    if (json.success) appData = json.data;
    else throw new Error(json.error);
  } catch (e) {
    showToast('Failed to load data: ' + e.message, 'error');
    appData = [];
  }
}

async function addRecord(payload) {
  if (USE_DEMO_DATA) {
    const date     = new Date(payload.date);
    const month    = MONTHS[date.getMonth()];
    const income   = +payload.income;
    const expense  = +payload.expense;
    const profit   = +(income - expense).toFixed(2);
    const record   = {
      id: Math.random().toString(36).slice(2,10).toUpperCase(),
      date: payload.date, income, expense, profit,
      category: payload.category,
      note: payload.note || '',
      month, timestamp: new Date().toISOString()
    };
    appData.push(record);
    return { success: true };
  }
  try {
    const res  = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', body: JSON.stringify({ action: 'add', data: payload })
    });
    return await res.json();
  } catch (e) { return { success: false, error: e.message }; }
}

async function updateRecord(payload) {
  if (USE_DEMO_DATA) {
    const idx = appData.findIndex(r => r.id === payload.id);
    if (idx >= 0) {
      const date    = new Date(payload.date);
      const month   = MONTHS[date.getMonth()];
      const income  = +payload.income;
      const expense = +payload.expense;
      const profit  = +(income - expense).toFixed(2);
      appData[idx]  = { ...appData[idx], ...payload, income, expense, profit, month };
    }
    return { success: true };
  }
  try {
    const res  = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', body: JSON.stringify({ action: 'update', data: payload })
    });
    return await res.json();
  } catch (e) { return { success: false, error: e.message }; }
}

async function deleteRecord(id, month) {
  if (USE_DEMO_DATA) {
    appData = appData.filter(r => r.id !== id);
    return { success: true };
  }
  try {
    const res  = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', body: JSON.stringify({ action: 'delete', id, month })
    });
    return await res.json();
  } catch (e) { return { success: false, error: e.message }; }
}

// ── Navigation ───────────────────────────────────────────────
function setupNavigation() {
  $$('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
      // Close mobile sidebar
      document.querySelector('.sidebar').classList.remove('open');
      document.querySelector('.sidebar-overlay').classList.remove('show');
    });
  });
}

function navigateTo(page) {
  $$('.page').forEach(p => p.classList.remove('active'));
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = $(`page-${page}`);
  const navEl  = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (pageEl) pageEl.classList.add('active');
  if (navEl)  navEl.classList.add('active');

  // Refresh charts when navigating
  if (page === 'monthly') { renderDashboard(); }
  if (page === 'yearly')  { renderYearDashboard(); }
  if (page === 'records') { renderRecordsTable(); }
}

// ── Dark Mode ────────────────────────────────────────────────
function setupDarkMode() {
  const toggle = $('dark-toggle');
  const saved  = localStorage.getItem('darkMode') === 'true';
  if (saved) document.body.classList.add('dark');
  toggle?.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', document.body.classList.contains('dark'));
  });
}

// ── Mobile sidebar ───────────────────────────────────────────
function setupMobile() {
  const hamburger = $('hamburger');
  const sidebar   = document.querySelector('.sidebar');
  const overlay   = document.querySelector('.sidebar-overlay');
  hamburger?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
}

// ── Add/Edit Form ─────────────────────────────────────────────
function setupForm() {
  // Auto-set today's date
  const dateInput = $('f-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  // Live profit calculation
  ['f-income','f-expense'].forEach(id => {
    $(id)?.addEventListener('input', updateProfitPreview);
  });

  // Form submit
  $('record-form')?.addEventListener('submit', handleFormSubmit);
  $('btn-cancel-edit')?.addEventListener('click', cancelEdit);
}

function updateProfitPreview() {
  const income  = parseFloat($('f-income').value)  || 0;
  const expense = parseFloat($('f-expense').value) || 0;
  const profit  = income - expense;
  const el      = $('profit-preview');
  if (!el) return;
  el.textContent = formatCurrency(profit);
  el.className   = 'profit-value ' + (profit >= 0 ? 'pos' : 'neg');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const payload = {
    date:     $('f-date').value,
    income:   parseFloat($('f-income').value)  || 0,
    expense:  parseFloat($('f-expense').value) || 0,
    category: $('f-category').value,
    note:     $('f-note').value.trim()
  };
  if (!payload.date) return showToast('Please select a date', 'warning');

  showLoader(editingRecord ? 'Updating record...' : 'Saving record...');
  let result;
  if (editingRecord) {
    payload.id = editingRecord.id;
    result = await updateRecord(payload);
  } else {
    result = await addRecord(payload);
  }
  hideLoader();

  if (result.success) {
    showToast(editingRecord ? 'Record updated!' : 'Record added!', 'success');
    resetForm();
    renderDashboard();
    renderYearDashboard();
    renderRecordsTable();
  } else {
    showToast('Error: ' + (result.error || 'Unknown'), 'error');
  }
}

function resetForm() {
  $('record-form').reset();
  $('f-date').value = new Date().toISOString().split('T')[0];
  updateProfitPreview();
  editingRecord = null;
  $('btn-cancel-edit').style.display = 'none';
  $('form-submit-btn').textContent = '💾 Save Record';
  $('form-heading').textContent = 'Add New Record';
}

function cancelEdit() { resetForm(); }

function populateEditForm(record) {
  editingRecord = record;
  $('f-date').value     = record.date;
  $('f-income').value   = record.income;
  $('f-expense').value  = record.expense;
  $('f-category').value = record.category;
  $('f-note').value     = record.note || '';
  updateProfitPreview();
  $('btn-cancel-edit').style.display = 'inline-flex';
  $('form-submit-btn').textContent = '✏️ Update Record';
  $('form-heading').textContent = 'Edit Record';
  navigateTo('add');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Month Tabs ───────────────────────────────────────────────
function setupMonthTabs() {
  const container = $('month-tabs');
  if (!container) return;
  MONTHS.forEach((m, i) => {
    const tab = document.createElement('button');
    tab.className = 'month-tab' + (i === currentMonthDash ? ' active' : '');
    tab.textContent = m.substring(0, 3);
    tab.addEventListener('click', () => {
      $$('.month-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMonthDash = i;
      renderDashboard();
    });
    container.appendChild(tab);
  });
}

// ── Dashboard: Monthly ────────────────────────────────────────
function renderDashboard() {
  const monthName  = MONTHS[currentMonthDash];
  const monthData  = appData.filter(r => r.month === monthName);
  const totals     = calcTotals(monthData);

  // Update stat cards
  setText('dash-income',  formatCurrency(totals.income));
  setText('dash-expense', formatCurrency(totals.expense));
  setText('dash-profit',  formatCurrency(totals.profit));
  setText('dash-month',   monthName);

  // Update chart
  renderMonthChart(monthData);

  // Ranking
  renderRanking('month-ranking', monthData);
}

function renderMonthChart(monthData) {
  const metric = currentMetricMonth;
  const { labels, values, colors } = buildChartData(monthData, metric);

  if (monthChartInst) monthChartInst.destroy();

  const ctx = $('month-chart');
  if (!ctx) return;

  if (currentChartTypeMonth === 'bar') {
    monthChartInst = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: capitalize(metric), data: values, backgroundColor: colors,
          borderRadius: 6, borderSkipped: false }]
      },
      options: barOptions(metric)
    });
  } else {
    monthChartInst = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values.map(Math.abs), backgroundColor: colors,
        borderWidth: 2, borderColor: '#fff' }] },
      options: pieOptions(metric, values)
    });
  }
}

// ── Dashboard: Yearly ────────────────────────────────────────
function renderYearDashboard() {
  const totals = calcTotals(appData);

  setText('year-income',  formatCurrency(totals.income));
  setText('year-expense', formatCurrency(totals.expense));
  setText('year-profit',  formatCurrency(totals.profit));

  renderYearChart(appData);
  renderRanking('year-ranking', appData);
}

function renderYearChart(data) {
  const metric = currentMetricYear;
  const { labels, values, colors } = buildChartData(data, metric);

  if (yearChartInst) yearChartInst.destroy();

  const ctx = $('year-chart');
  if (!ctx) return;

  if (currentChartTypeYear === 'bar') {
    yearChartInst = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: capitalize(metric), data: values, backgroundColor: colors,
          borderRadius: 6, borderSkipped: false }]
      },
      options: barOptions(metric)
    });
  } else {
    yearChartInst = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values.map(Math.abs), backgroundColor: colors,
        borderWidth: 2, borderColor: '#fff' }] },
      options: pieOptions(metric, values)
    });
  }
}

// ── Chart helpers ────────────────────────────────────────────
function buildChartData(data, metric) {
  const labels = [], values = [], colors = [];
  CATEGORIES.forEach(cat => {
    const rows = data.filter(r => r.category === cat);
    if (!rows.length) return;
    const val = rows.reduce((s, r) => s + (r[metric] || 0), 0);
    labels.push(cat);
    values.push(+val.toFixed(2));
    colors.push(CAT_COLORS[cat]);
  });
  return { labels, values, colors };
}

function barOptions(metric) {
  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ` ${capitalize(metric)}: ${formatCurrency(ctx.parsed.x)}`
        }
      }
    },
    scales: {
      x: {
        ticks: { callback: v => formatCurrencyShort(v),
          font: { family: 'Kanit', size: 11 }, color: '#9aa3b8' },
        grid: { color: 'rgba(158,163,184,0.1)' }
      },
      y: {
        ticks: { font: { family: 'Kanit', size: 12 }, color: '#9aa3b8' },
        grid: { display: false }
      }
    }
  };
}

function pieOptions(metric, values) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font: { family: 'Kanit', size: 12 }, padding: 16, boxWidth: 12 }
      },
      tooltip: {
        callbacks: {
          label: ctx => {
            const total = values.reduce((a,b) => a + Math.abs(b), 0);
            const pct   = total > 0 ? ((Math.abs(values[ctx.dataIndex]) / total) * 100).toFixed(1) : 0;
            return ` ${ctx.label}: ${formatCurrency(values[ctx.dataIndex])} (${pct}%)`;
          }
        }
      }
    }
  };
}

// ── Ranking ──────────────────────────────────────────────────
function renderRanking(containerId, data) {
  const container = $(containerId);
  if (!container) return;

  const catTotals = CATEGORIES.map(cat => {
    const rows = data.filter(r => r.category === cat);
    return {
      cat,
      income:  rows.reduce((s,r) => s + r.income,  0),
      expense: rows.reduce((s,r) => s + r.expense, 0),
      profit:  rows.reduce((s,r) => s + r.profit,  0)
    };
  }).filter(c => c.income + c.expense !== 0)
    .sort((a,b) => b.profit - a.profit);

  if (!catTotals.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>No data yet</p></div>';
    return;
  }

  const badgeClass = ['gold','silver','bronze'];
  container.innerHTML = catTotals.map((c, i) => `
    <div class="ranking-item">
      <span class="rank-badge ${badgeClass[i] || ''}">${i+1}</span>
      <span class="rank-dot" style="background:${CAT_COLORS[c.cat]}"></span>
      <span class="rank-cat">${c.cat}</span>
      <span class="rank-val ${c.profit >= 0 ? 'amount-pos' : 'amount-neg'}">${formatCurrency(c.profit)}</span>
      <span class="rank-sub">${formatCurrency(c.income)} in</span>
    </div>`).join('');
}

// ── Records Table ─────────────────────────────────────────────
let recordsSearch = '', recordsCatFilter = '', recordsMonthFilter = '';

function renderRecordsTable() {
  let data = [...appData];

  if (recordsSearch) {
    const q = recordsSearch.toLowerCase();
    data = data.filter(r =>
      r.date.includes(q) || r.category.toLowerCase().includes(q) ||
      (r.note||'').toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }
  if (recordsCatFilter)   data = data.filter(r => r.category === recordsCatFilter);
  if (recordsMonthFilter) data = data.filter(r => r.month === recordsMonthFilter);

  data.sort((a,b) => new Date(b.date) - new Date(a.date));

  const tbody = $('records-tbody');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state"><div class="empty-icon">🗂️</div><p>No records found</p></div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => `
    <tr>
      <td><code style="font-size:.72rem;color:var(--gray)">${r.id}</code></td>
      <td>${r.date}</td>
      <td class="amount-pos">${formatCurrency(r.income)}</td>
      <td class="amount-neg">${formatCurrency(r.expense)}</td>
      <td class="${r.profit >= 0 ? 'amount-pos' : 'amount-neg'}">${formatCurrency(r.profit)}</td>
      <td><span class="badge badge-${catClass(r.category)}">${r.category}</span></td>
      <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.note||'—'}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-secondary btn-icon" onclick="editRecord('${r.id}')" title="Edit">✏️</button>
          <button class="btn btn-sm btn-danger  btn-icon" onclick="confirmDelete('${r.id}','${r.month}')" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>`).join('');

  setText('records-count', `${data.length} record${data.length !== 1 ? 's' : ''}`);
}

// ── Edit/Delete record ────────────────────────────────────────
function editRecord(id) {
  const record = appData.find(r => r.id === id);
  if (record) populateEditForm(record);
}

function confirmDelete(id, month) {
  deleteTarget = { id, month };
  const record = appData.find(r => r.id === id);
  setText('delete-record-info', record ? `${record.date} | ${record.category} | ${formatCurrency(record.profit)}` : id);
  openModal('delete-modal');
}

async function executeDelete() {
  if (!deleteTarget) return;
  showLoader('Deleting record...');
  closeModal('delete-modal');
  const result = await deleteRecord(deleteTarget.id, deleteTarget.month);
  hideLoader();
  if (result.success) {
    showToast('Record deleted', 'success');
    renderDashboard();
    renderYearDashboard();
    renderRecordsTable();
  } else {
    showToast('Delete failed: ' + (result.error || 'Unknown'), 'error');
  }
  deleteTarget = null;
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id) {
  const el = $(id);
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = $(id);
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  toast.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut .3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Loader ────────────────────────────────────────────────────
function showLoader(msg = 'Loading...') {
  const el = $('loader-overlay');
  if (el) { el.classList.add('show'); setText('loader-text', msg); }
}
function hideLoader() {
  const el = $('loader-overlay');
  if (el) el.classList.remove('show');
}

// ── Utility ───────────────────────────────────────────────────
function calcTotals(data) {
  return {
    income:  data.reduce((s,r) => s + r.income,  0),
    expense: data.reduce((s,r) => s + r.expense, 0),
    profit:  data.reduce((s,r) => s + r.profit,  0)
  };
}
function formatCurrency(n) {
  return '฿' + (+n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatCurrencyShort(n) {
  if (Math.abs(n) >= 1000) return '฿' + (n/1000).toFixed(1) + 'k';
  return '฿' + n;
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function setText(id, val) { const el = $(id); if (el) el.textContent = val; }
function catClass(cat) {
  if (cat === 'ZEPETO') return 'zepeto';
  if (cat === 'ROBLOX') return 'roblox';
  if (cat === 'BLOCK & DECO') return 'block';
  return 'etc';
}

// ── Export PNG ────────────────────────────────────────────────
async function exportPNG(chartId, filename) {
  const canvas = $(chartId);
  if (!canvas) return;
  const link  = document.createElement('a');
  link.href   = canvas.toDataURL('image/png');
  link.download = filename + '.png';
  link.click();
  showToast('Chart exported as PNG', 'success');
}

// ── Config Banner ─────────────────────────────────────────────
function showConfigBanner() {
  const banners = $$('.config-banner');
  banners.forEach(b => b.style.display = 'flex');
}

// ── Expose event handlers to HTML ────────────────────────────
window.editRecord       = editRecord;
window.confirmDelete    = confirmDelete;
window.executeDelete    = executeDelete;
window.openModal        = openModal;
window.closeModal       = closeModal;
window.exportPNG        = exportPNG;

// Chart type toggles
window.setMonthChartType = function(type) {
  currentChartTypeMonth = type;
  $$('.month-chart-type-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.month-chart-type-btn[data-type="${type}"]`)?.classList.add('active');
  renderDashboard();
};
window.setYearChartType = function(type) {
  currentChartTypeYear = type;
  $$('.year-chart-type-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.year-chart-type-btn[data-type="${type}"]`)?.classList.add('active');
  renderYearDashboard();
};

// Metric toggles
window.setMonthMetric = function(metric) {
  currentMetricMonth = metric;
  $$('.month-metric-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.month-metric-btn[data-metric="${metric}"]`)?.classList.add('active');
  renderDashboard();
};
window.setYearMetric = function(metric) {
  currentMetricYear = metric;
  $$('.year-metric-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.year-metric-btn[data-metric="${metric}"]`)?.classList.add('active');
  renderYearDashboard();
};

// Records filter
window.onRecordsSearch = function(e) {
  recordsSearch = e.target.value.trim();
  renderRecordsTable();
};
window.onCatFilter = function(e) {
  recordsCatFilter = e.target.value;
  renderRecordsTable();
};
window.onMonthFilter = function(e) {
  recordsMonthFilter = e.target.value;
  renderRecordsTable();
};
