// ==================== STATE ====================
let entries = [];
let settings = { rate: 17.85, tax: 0.12, ot: 8, otm: 1.5 };
let currentUser = null;
let filterMode = 'all';

let cEarn, cFuel, cHours, cExp;

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
  // Check if logged in
  try {
    let res = await fetch('/api/me');
    if (res.ok) {
      currentUser = await res.json();
      settings.rate = currentUser.hourly_rate;
      settings.tax = currentUser.tax_rate;
      settings.ot = currentUser.ot_threshold;
      settings.otm = currentUser.ot_multiplier;
      await initApp();
    } else {
      showAuth();
    }
  } catch (e) {
    showAuth();
  }
});

function showAuth() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
}

async function initApp() {
  showApp();
  document.getElementById('userBadge').textContent = '👤 ' + (currentUser ? currentUser.username : 'Guest');
  updateRateDisplay();
  await loadShifts();
  initCharts();
}

// ==================== AUTH ====================
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  if (tab === 'login') {
    document.querySelectorAll('.auth-tab')[0].classList.add('active');
    document.getElementById('loginForm').classList.add('active');
  } else {
    document.querySelectorAll('.auth-tab')[1].classList.add('active');
    document.getElementById('registerForm').classList.add('active');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  let username = document.getElementById('loginUsername').value.trim();
  let password = document.getElementById('loginPassword').value;
  document.getElementById('loginError').textContent = '';

  try {
    let res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    let data = await res.json();
    if (data.success) {
      currentUser = data.user;
      settings.rate = currentUser.hourly_rate;
      settings.tax = currentUser.tax_rate;
      settings.ot = currentUser.ot_threshold;
      settings.otm = currentUser.ot_multiplier;
      await initApp();
    } else {
      document.getElementById('loginError').textContent = data.error || 'Login failed';
    }
  } catch (err) {
    document.getElementById('loginError').textContent = 'Network error';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  let username = document.getElementById('regUsername').value.trim();
  let password = document.getElementById('regPassword').value;
  let confirm = document.getElementById('regPasswordConfirm').value;
  document.getElementById('registerError').textContent = '';
  document.getElementById('registerSuccess').textContent = '';

  if (password !== confirm) {
    document.getElementById('registerError').textContent = 'Passwords do not match';
    return;
  }

  try {
    let res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    let data = await res.json();
    if (data.success) {
      document.getElementById('registerSuccess').textContent = 'Account created! Please sign in.';
      document.getElementById('registerForm').reset();
      setTimeout(() => switchTab('login'), 1000);
    } else {
      document.getElementById('registerError').textContent = data.error || 'Registration failed';
    }
  } catch (err) {
    document.getElementById('registerError').textContent = 'Network error';
  }
}

async function handleLogout() {
  await fetch('/api/logout', { method: 'POST' });
  currentUser = null;
  entries = [];
  showAuth();
}

// ==================== SETTINGS ====================
function toggleSettings() {
  let panel = document.getElementById('settingsPanel');
  panel.classList.toggle('active');
  if (panel.classList.contains('active')) {
    document.getElementById('setRate').value = settings.rate;
    document.getElementById('setTax').value = (settings.tax * 100).toFixed(1);
    document.getElementById('setOT').value = settings.ot;
    document.getElementById('setOTM').value = settings.otm;
  }
}

function updateRate(v) { settings.rate = parseFloat(v) || 17.85; updateRateDisplay(); }
function updateTax(v) { settings.tax = (parseFloat(v) || 12) / 100; updateRateDisplay(); }
function updateOT(v) { settings.ot = parseFloat(v) || 8; updateRateDisplay(); }
function updateOTM(v) { settings.otm = parseFloat(v) || 1.5; updateRateDisplay(); }

function updateRateDisplay() {
  document.getElementById('rateDisplay').textContent = '$' + settings.rate.toFixed(2) + '/hr';
  document.getElementById('taxDisplay').textContent = (settings.tax * 100).toFixed(0) + '%';
  document.getElementById('otDisplay').textContent = settings.ot + 'h';
  document.getElementById('otmDisplay').textContent = settings.otm + 'x';
}

async function saveSettings() {
  if (!currentUser) return;
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hourly_rate: settings.rate,
        tax_rate: settings.tax,
        ot_threshold: settings.ot,
        ot_multiplier: settings.otm
      })
    });
    // Recalculate all entries
    entries.forEach(e => recalcEntry(e));
    render();
  } catch (err) {
    showT('Failed to save settings', true);
  }
}

// ==================== SHIFTS ====================
async function loadShifts() {
  showLoading(true);
  try {
    let res = await fetch('/api/shifts');
    entries = await res.json();
    // Convert numeric booleans
    entries.forEach(e => {
      e.has_overtime = e.has_overtime === 1;
      recalcEntry(e);
    });
    render();
  } catch (err) {
    showT('Failed to load shifts', true);
  } finally {
    showLoading(false);
  }
}

function recalcEntry(e) {
  let hours = parseFloat(e.hours) || 0;
  let gross = 0;
  if (hours > settings.ot) {
    let otHours = hours - settings.ot;
    gross = (settings.ot * settings.rate) + (otHours * settings.rate * settings.otm);
    e.has_overtime = true;
  } else {
    gross = hours * settings.rate;
    e.has_overtime = false;
  }
  e.gross = parseFloat(gross.toFixed(2));
  e.tax = parseFloat((e.gross * settings.tax).toFixed(2));
  e.net = parseFloat((e.gross - e.tax).toFixed(2));
  let expenses = (parseFloat(e.fuel)||0) + (parseFloat(e.grocery)||0) + (parseFloat(e.phone)||0) + (parseFloat(e.wifi)||0) + (parseFloat(e.food)||0) + (parseFloat(e.maintenance)||0) + (parseFloat(e.insurance)||0) + (parseFloat(e.misc)||0) + (parseFloat(e.other)||0);
  e.daily_profit = parseFloat((e.net - expenses).toFixed(2));
}

async function addEntry() {
  let dateRaw = document.getElementById('eDate').value.trim();
  let timeIn = document.getElementById('eIn').value;
  let timeOut = document.getElementById('eOut').value;
  let km = parseFloat(document.getElementById('eKM').value) || 0;
  let deliveries = parseInt(document.getElementById('eDeliv').value) || 0;
  let fuelType = document.getElementById('eFuelType').value;
  let fuel = parseFloat(document.getElementById('eFuel').value) || 0;
  let grocery = parseFloat(document.getElementById('eGroc').value) || 0;
  let phone = parseFloat(document.getElementById('ePhone').value) || 0;
  let wifi = parseFloat(document.getElementById('eWifi').value) || 0;
  let food = parseFloat(document.getElementById('eFood').value) || 0;
  let maintenance = parseFloat(document.getElementById('eMaint').value) || 0;
  let insurance = parseFloat(document.getElementById('eInsur').value) || 0;
  let misc = parseFloat(document.getElementById('eMisc').value) || 0;
  let other = parseFloat(document.getElementById('eOther').value) || 0;
  let notes = document.getElementById('eNotes').value.trim();

  if (!dateRaw || !timeIn || !timeOut) {
    showT('Please fill date, time in and time out', true);
    return;
  }

  // Parse DDMM to a date string
  let day = dateRaw.substring(0,2);
  let month = dateRaw.substring(2,4);
  let year = new Date().getFullYear();
  let date = year + '-' + month + '-' + day;

  // Calculate hours
  let [h1, m1] = timeIn.split(':').map(Number);
  let [h2, m2] = timeOut.split(':').map(Number);
  let start = h1 * 60 + m1;
  let end = h2 * 60 + m2;
  if (end < start) end += 24 * 60;
  let hours = (end - start) / 60;

  let entry = {
    date, time_in: timeIn, time_out: timeOut, hours, km, deliveries,
    fuel_type: fuelType, fuel, grocery, phone, wifi, food, maintenance, insurance, misc, other, notes,
    has_overtime: false, gross: 0, tax: 0, net: 0, daily_profit: 0
  };
  recalcEntry(entry);

  showLoading(true);
  try {
    let res = await fetch('/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    let data = await res.json();
    if (data.success) {
      entry.id = data.id;
      entries.unshift(entry);
      render();
      clearForm();
      showT('Shift saved!');
    } else {
      showT(data.error || 'Failed to save', true);
    }
  } catch (err) {
    showT('Network error', true);
  } finally {
    showLoading(false);
  }
}

function clearForm() {
  document.getElementById('eDate').value = '';
  document.getElementById('eIn').value = '';
  document.getElementById('eOut').value = '';
  document.getElementById('eKM').value = '';
  document.getElementById('eDeliv').value = '';
  document.getElementById('eFuelType').value = 'regular';
  document.getElementById('eFuel').value = '';
  document.getElementById('eGroc').value = '';
  document.getElementById('ePhone').value = '';
  document.getElementById('eWifi').value = '';
  document.getElementById('eFood').value = '';
  document.getElementById('eMaint').value = '';
  document.getElementById('eInsur').value = '';
  document.getElementById('eMisc').value = '';
  document.getElementById('eOther').value = '';
  document.getElementById('eNotes').value = '';
}

async function deleteEntry(id) {
  if (!confirm('Delete this shift?')) return;
  showLoading(true);
  try {
    await fetch('/api/shifts/' + id, { method: 'DELETE' });
    entries = entries.filter(e => e.id !== id);
    render();
    showT('Shift deleted');
  } catch (err) {
    showT('Delete failed', true);
  } finally {
    showLoading(false);
  }
}

async function updateEntryField(id, field, value) {
  let entry = entries.find(e => e.id === id);
  if (!entry) return;
  entry[field] = value;
  recalcEntry(entry);

  showLoading(true);
  try {
    await fetch('/api/shifts/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    render();
    showT('Updated');
  } catch (err) {
    showT('Update failed', true);
  } finally {
    showLoading(false);
  }
}

// ==================== FILTER & SEARCH ====================
function setFilter(mode, btn) {
  filterMode = mode;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
}

function doSearch() {
  render();
}

function getFiltered() {
  let search = document.getElementById('sBox').value.trim().toLowerCase();
  let now = new Date();
  let filtered = entries.filter(e => {
    if (search && !e.date.includes(search) && !(e.notes || '').toLowerCase().includes(search)) return false;
    if (filterMode === 'ot') return e.has_overtime;
    if (filterMode === 'week') {
      let d = new Date(e.date);
      let diff = (now - d) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }
    if (filterMode === 'month') {
      let d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  });
  return filtered;
}

// ==================== RENDER ====================
function render() {
  let filtered = getFiltered();

  // Stats
  let totalGross = 0, totalNet = 0, totalHours = 0, totalDeliv = 0, totalKM = 0, totalExp = 0, totalProfit = 0;
  filtered.forEach(e => {
    totalGross += e.gross;
    totalNet += e.net;
    totalHours += e.hours;
    totalDeliv += e.deliveries;
    totalKM += e.km;
    totalExp += (e.fuel||0) + (e.grocery||0) + (e.phone||0) + (e.wifi||0) + (e.food||0) + (e.maintenance||0) + (e.insurance||0) + (e.misc||0) + (e.other||0);
    totalProfit += e.daily_profit;
  });

  document.getElementById('dProfit').textContent = '$' + totalProfit.toFixed(2);
  document.getElementById('dGross').textContent = '$' + totalGross.toFixed(2);
  document.getElementById('dHours').textContent = totalHours.toFixed(2);
  document.getElementById('dDeliv').textContent = totalDeliv;
  document.getElementById('dKM').textContent = totalKM.toFixed(1);
  document.getElementById('dExp').textContent = '$' + totalExp.toFixed(2);

  // Table
  let tbody = document.getElementById('tBody');
  tbody.innerHTML = '';
  filtered.forEach(e => {
    let tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="cell-input" value="${e.date}" onchange="updateEntryField(${e.id}, 'date', this.value)"></td>
      <td><input class="cell-input" value="${e.time_in}" onchange="updateEntryField(${e.id}, 'time_in', this.value)"></td>
      <td><input class="cell-input" value="${e.time_out}" onchange="updateEntryField(${e.id}, 'time_out', this.value)"></td>
      <td>${e.hours.toFixed(2)}${e.has_overtime ? '<span class="ot-badge">OT</span>' : ''}</td>
      <td>$${settings.rate.toFixed(2)}</td>
      <td class="cell-calc">$${e.gross.toFixed(2)}</td>
      <td class="cell-expense">$${e.tax.toFixed(2)}</td>
      <td class="cell-calc">$${e.net.toFixed(2)}</td>
      <td><input class="cell-input" type="number" value="${e.km}" step="0.1" onchange="updateEntryField(${e.id}, 'km', parseFloat(this.value)||0)"></td>
      <td><input class="cell-input" type="number" value="${e.deliveries}" onchange="updateEntryField(${e.id}, 'deliveries', parseInt(this.value)||0)"></td>
      <td><input class="cell-input" type="number" value="${e.fuel}" step="0.01" onchange="updateEntryField(${e.id}, 'fuel', parseFloat(this.value)||0)"></td>
      <td><input class="cell-input" type="number" value="${e.grocery}" step="0.01" onchange="updateEntryField(${e.id}, 'grocery', parseFloat(this.value)||0)"></td>
      <td><input class="cell-input" type="number" value="${e.phone}" step="0.01" onchange="updateEntryField(${e.id}, 'phone', parseFloat(this.value)||0)"></td>
      <td><input class="cell-input" type="number" value="${e.wifi}" step="0.01" onchange="updateEntryField(${e.id}, 'wifi', parseFloat(this.value)||0)"></td>
      <td><input class="cell-input" type="number" value="${e.food}" step="0.01" onchange="updateEntryField(${e.id}, 'food', parseFloat(this.value)||0)"></td>
      <td><input class="cell-input" type="number" value="${e.maintenance}" step="0.01" onchange="updateEntryField(${e.id}, 'maintenance', parseFloat(this.value)||0)"></td>
      <td><input class="cell-input" type="number" value="${e.insurance}" step="0.01" onchange="updateEntryField(${e.id}, 'insurance', parseFloat(this.value)||0)"></td>
      <td><input class="cell-input" type="number" value="${e.misc}" step="0.01" onchange="updateEntryField(${e.id}, 'misc', parseFloat(this.value)||0)"></td>
      <td><input class="cell-input" type="number" value="${e.other}" step="0.01" onchange="updateEntryField(${e.id}, 'other', parseFloat(this.value)||0)"></td>
      <td class="${e.daily_profit >= 0 ? 'cell-profit' : 'cell-loss'}">$${e.daily_profit.toFixed(2)}</td>
      <td><input class="cell-input" value="${e.notes || ''}" onchange="updateEntryField(${e.id}, 'notes', this.value)"></td>
      <td><button class="delete-btn" onclick="deleteEntry(${e.id})">🗑</button></td>
    `;
    tbody.appendChild(tr);
  });

  // Weekly summary
  let now = new Date();
  let weekEntries = entries.filter(e => {
    let d = new Date(e.date);
    let diff = (now - d) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });
  let wGross = weekEntries.reduce((s,e) => s + e.gross, 0);
  let wTax = weekEntries.reduce((s,e) => s + e.tax, 0);
  let wNet = weekEntries.reduce((s,e) => s + e.net, 0);
  let wHours = weekEntries.reduce((s,e) => s + e.hours, 0);
  let wDeliv = weekEntries.reduce((s,e) => s + e.deliveries, 0);
  let wKM = weekEntries.reduce((s,e) => s + e.km, 0);
  let wFuel = weekEntries.reduce((s,e) => s + (e.fuel||0), 0);
  let wExp = weekEntries.reduce((s,e) => s + (e.fuel||0)+(e.grocery||0)+(e.phone||0)+(e.wifi||0)+(e.food||0)+(e.maintenance||0)+(e.insurance||0)+(e.misc||0)+(e.other||0), 0);
  let wProfit = weekEntries.reduce((s,e) => s + e.daily_profit, 0);

  document.getElementById('wHours').textContent = wHours.toFixed(2);
  document.getElementById('wGross').textContent = '$' + wGross.toFixed(2);
  document.getElementById('wTax').textContent = '$' + wTax.toFixed(2);
  document.getElementById('wNet').textContent = '$' + wNet.toFixed(2);
  document.getElementById('wKM').textContent = wKM.toFixed(1);
  document.getElementById('wDeliv').textContent = wDeliv;
  document.getElementById('wFuel').textContent = '$' + wFuel.toFixed(2);
  document.getElementById('wExp').textContent = '$' + wExp.toFixed(2);
  document.getElementById('wProfit').textContent = '$' + wProfit.toFixed(2);
  document.getElementById('wProfit').parentElement.className = 'summary-row total' + (wProfit < 0 ? ' negative' : '');

  // Monthly summary
  let monthEntries = entries.filter(e => {
    let d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  let mGross = monthEntries.reduce((s,e) => s + e.gross, 0);
  let mTax = monthEntries.reduce((s,e) => s + e.tax, 0);
  let mNet = monthEntries.reduce((s,e) => s + e.net, 0);
  let mHours = monthEntries.reduce((s,e) => s + e.hours, 0);
  let mDeliv = monthEntries.reduce((s,e) => s + e.deliveries, 0);
  let mKM = monthEntries.reduce((s,e) => s + e.km, 0);
  let mFuel = monthEntries.reduce((s,e) => s + (e.fuel||0), 0);
  let mExp = monthEntries.reduce((s,e) => s + (e.fuel||0)+(e.grocery||0)+(e.phone||0)+(e.wifi||0)+(e.food||0)+(e.maintenance||0)+(e.insurance||0)+(e.misc||0)+(e.other||0), 0);
  let mProfit = monthEntries.reduce((s,e) => s + e.daily_profit, 0);

  document.getElementById('mHours').textContent = mHours.toFixed(2);
  document.getElementById('mGross').textContent = '$' + mGross.toFixed(2);
  document.getElementById('mTax').textContent = '$' + mTax.toFixed(2);
  document.getElementById('mNet').textContent = '$' + mNet.toFixed(2);
  document.getElementById('mKM').textContent = mKM.toFixed(1);
  document.getElementById('mDeliv').textContent = mDeliv;
  document.getElementById('mFuel').textContent = '$' + mFuel.toFixed(2);
  document.getElementById('mExp').textContent = '$' + mExp.toFixed(2);
  document.getElementById('mProfit').textContent = '$' + mProfit.toFixed(2);
  document.getElementById('mProfit').parentElement.className = 'summary-row total' + (mProfit < 0 ? ' negative' : '');

  updateCharts(filtered);
}

// ==================== CHARTS ====================
function initCharts() {
  Chart.defaults.font.family = "'Segoe UI',system-ui,sans-serif";
  Chart.defaults.color = '#64748b';

  cEarn = new Chart(document.getElementById('cEarn'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Net Earnings', data: [], borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', fill: true, tension: 0.4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#e2e8f0' } }, x: { grid: { display: false } } } }
  });

  cFuel = new Chart(document.getElementById('cFuel'), {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Fuel Cost', data: [], backgroundColor: '#dc2626', borderRadius: 6 }, { label: 'Net Earnings', data: [], backgroundColor: '#059669', borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, grid: { color: '#e2e8f0' } }, x: { grid: { display: false } } } }
  });

  cHours = new Chart(document.getElementById('cHours'), {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Hours', data: [], backgroundColor: '#d97706', borderRadius: 6 }, { label: 'Deliveries', data: [], backgroundColor: '#7c3aed', borderRadius: 6, yAxisID: 'y1' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, grid: { color: '#e2e8f0' } }, y1: { position: 'right', beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } }
  });

  cExp = new Chart(document.getElementById('cExp'), {
    type: 'doughnut',
    data: { labels: ['Fuel','Grocery','Phone','WiFi','Food','Maint','Insur','Misc','Other'], datasets: [{ data: [], backgroundColor: ['#dc2626','#f59e0b','#3b82f6','#8b5cf6','#ec4899','#6366f1','#14b8a6','#f97316','#64748b'], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } } }
  });
}

function updateCharts(filtered) {
  if (!cEarn) return;
  let labels = filtered.slice().reverse().map(e => e.date);
  cEarn.data.labels = labels;
  cEarn.data.datasets[0].data = filtered.slice().reverse().map(e => e.net);
  cEarn.update();

  cFuel.data.labels = labels;
  cFuel.data.datasets[0].data = filtered.slice().reverse().map(e => e.fuel || 0);
  cFuel.data.datasets[1].data = filtered.slice().reverse().map(e => e.net);
  cFuel.update();

  cHours.data.labels = labels;
  cHours.data.datasets[0].data = filtered.slice().reverse().map(e => e.hours);
  cHours.data.datasets[1].data = filtered.slice().reverse().map(e => e.deliveries);
  cHours.update();

  let expTotals = [
    filtered.reduce((s,e) => s + (e.fuel||0), 0),
    filtered.reduce((s,e) => s + (e.grocery||0), 0),
    filtered.reduce((s,e) => s + (e.phone||0), 0),
    filtered.reduce((s,e) => s + (e.wifi||0), 0),
    filtered.reduce((s,e) => s + (e.food||0), 0),
    filtered.reduce((s,e) => s + (e.maintenance||0), 0),
    filtered.reduce((s,e) => s + (e.insurance||0), 0),
    filtered.reduce((s,e) => s + (e.misc||0), 0),
    filtered.reduce((s,e) => s + (e.other||0), 0)
  ];
  cExp.data.datasets[0].data = expTotals;
  cExp.update();
}

// ==================== LOADING ====================
function showLoading(show) {
  document.getElementById('loading').classList.toggle('active', show);
}

// ==================== EXPORT & CLEAR ====================
function exportCSV() {
  let h = ['Date','Time In','Time Out','Hours','Rate','Gross','Tax','Net','KM','Deliveries','Fuel Type','Fuel','Grocery','Phone','WiFi','Food','Maint','Insur','Misc','Other','Profit','Notes'];
  let csv = h.join(',') + '\n';
  entries.forEach(e => {
    csv += `${e.date},${e.time_in},${e.time_out},${e.hours},${settings.rate},${e.gross},${e.tax},${e.net},${e.km},${e.deliveries},${e.fuel_type},${e.fuel},${e.grocery},${e.phone},${e.wifi},${e.food},${e.maintenance},${e.insurance},${e.misc},${e.other},${e.daily_profit},"${(e.notes || '').replace(/"/g,'""')}"\n`;
  });
  let blob = new Blob([csv], { type: 'text/csv' });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = 'dominos_tracker_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showT('CSV exported!');
}

function showClear() { document.getElementById('clearModal').classList.add('active'); }
function hideClear() { document.getElementById('clearModal').classList.remove('active'); }

async function doClear() {
  showLoading(true);
  try {
    for (let e of entries) {
      await fetch('/api/shifts/' + e.id, { method: 'DELETE' });
    }
    await loadShifts();
    hideClear();
    showT('All data cleared');
  } catch (err) {
    showLoading(false);
    showT('Clear failed', true);
  }
}

// ==================== TOAST ====================
function showT(msg, isError) {
  let toast = document.getElementById('toast');
  let toastMsg = document.getElementById('toastMsg');
  toastMsg.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.querySelector('span').textContent = isError ? '⚠️' : '✅';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('click', function(e) {
  let panel = document.getElementById('settingsPanel');
  let fab = document.querySelector('.settings-fab');
  if (panel.classList.contains('active') && !panel.contains(e.target) && e.target !== fab) {
    panel.classList.remove('active');
  }
});

document.getElementById('clearModal').addEventListener('click', function(e) {
  if (e.target === this) hideClear();
});

document.getElementById('loginPassword').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') handleLogin(e);
});
