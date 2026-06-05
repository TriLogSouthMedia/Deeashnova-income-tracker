// ==================== STATE ====================
let entries = [];
let settings = { rate: 17.85, tax: 0.12, ot: 8, otm: 1.5 };
let currentUser = null;
let filterMode = 'all';
let currency = 'CAD';
let currencySymbols = { CAD: '$', USD: '$', EUR: '€', GBP: '£', AUD: '$', INR: '₹', JPY: '¥', AED: 'د.إ', SGD: '$', NZD: '$' };
let disabledFields = [];
let customLabels = {};
let showDeliveries = true;
let forgotUsername = '';
let currentTheme = 'dark';

// ==================== THEME ====================
function initTheme() {
  let saved = localStorage.getItem('paypulse-theme');
  if (saved) {
    setTheme(saved, false);
  } else {
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('system', false);
    }
  }
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
    if (currentTheme === 'system') {
      applySystemTheme();
    }
  });
}

function setTheme(mode, save = true) {
  currentTheme = mode;
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));

  if (mode === 'dark') {
    document.body.classList.remove('light-mode');
    document.getElementById('btnDark').classList.add('active');
  } else if (mode === 'light') {
    document.body.classList.add('light-mode');
    document.getElementById('btnLight').classList.add('active');
  } else if (mode === 'system') {
    document.getElementById('btnSystem').classList.add('active');
    applySystemTheme();
  }

  if (save) localStorage.setItem('paypulse-theme', mode);

  // Update chart colors for theme
  updateChartTheme();
}

function applySystemTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
}

function updateChartTheme() {
  let isLight = document.body.classList.contains('light-mode');
  let gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
  let labelColor = isLight ? '#5a5a7a' : '#a0a0b0';

  if (cEarn) {
    cEarn.options.scales.y.grid.color = gridColor;
    cEarn.options.scales.x.grid.color = isLight ? 'rgba(0,0,0,0.05)' : 'transparent';
    cEarn.update('none');
  }
  if (cFuel) {
    cFuel.options.scales.y.grid.color = gridColor;
    cFuel.options.scales.x.grid.color = isLight ? 'rgba(0,0,0,0.05)' : 'transparent';
    cFuel.options.plugins.legend.labels.color = labelColor;
    cFuel.update('none');
  }
  if (cHours) {
    cHours.options.scales.y.grid.color = gridColor;
    cHours.options.scales.x.grid.color = isLight ? 'rgba(0,0,0,0.05)' : 'transparent';
    cHours.options.plugins.legend.labels.color = labelColor;
    cHours.update('none');
  }
  if (cExp) {
    cExp.options.plugins.legend.labels.color = labelColor;
    cExp.update('none');
  }
}

// ==================== PASSWORD VISIBILITY ====================
function showPW(id) {
  let input = document.getElementById(id);
  if (input) input.type = 'text';
}
function hidePW(id) {
  let input = document.getElementById(id);
  if (input) input.type = 'password';
}


let cEarn, cFuel, cHours, cExp;

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
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
  document.getElementById('userBadge').textContent = '👤 ' + (currentUser ? (currentUser.name || currentUser.username) : 'Guest');
  document.getElementById('userBadge').style.cursor = 'pointer';
  document.getElementById('userBadge').title = 'Profile Settings';
  document.getElementById('userBadge').onclick = toggleProfile;
  if (currentUser) {
    currency = currentUser.currency || 'CAD';
    disabledFields = JSON.parse(currentUser.disabled_fields || '[]');
  }
  updateRateDisplay();
  applyFieldVisibility();
  applyCustomLabels();
  applyDeliveriesVisibility();
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
      currency = currentUser.currency || 'CAD';
      disabledFields = JSON.parse(currentUser.disabled_fields || '[]');
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
  let security_question = document.getElementById('regSecurityQ').value.trim();
  let security_answer = document.getElementById('regSecurityA').value.trim();
  document.getElementById('registerError').textContent = '';
  document.getElementById('registerSuccess').textContent = '';

  if (password !== confirm) {
    document.getElementById('registerError').textContent = 'Passwords do not match';
    return;
  }
  if (!security_question || !security_answer) {
    document.getElementById('registerError').textContent = 'Security question and answer are required';
    return;
  }

  try {
    let res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, security_question, security_answer })
    });
    let data = await res.json();
    if (data.success) {
      document.getElementById('registerSuccess').textContent = 'Account created! Logging you in...';
      document.getElementById('registerForm').reset();
      if (data.user) {
        currentUser = data.user;
        settings.rate = currentUser.hourly_rate;
        settings.tax = currentUser.tax_rate;
        settings.ot = currentUser.ot_threshold;
        settings.otm = currentUser.ot_multiplier;
        currency = currentUser.currency || 'CAD';
        disabledFields = JSON.parse(currentUser.disabled_fields || '[]');
        setTimeout(() => initApp(), 500);
      } else {
        setTimeout(() => switchTab('login'), 1000);
      }
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

// ==================== FORGOT PASSWORD ====================
function showForgot() {
  document.getElementById('forgotModal').classList.add('active');
  document.getElementById('forgotStep1').classList.add('active');
  document.getElementById('forgotStep2').classList.remove('active');
  document.getElementById('forgotStep3').classList.remove('active');
  document.getElementById('forgotError1').textContent = '';
  document.getElementById('forgotError2').textContent = '';
  document.getElementById('forgotError3').textContent = '';
  document.getElementById('forgotSuccess').textContent = '';
  document.getElementById('forgotUsername').value = '';
  document.getElementById('forgotAnswer').value = '';
  document.getElementById('forgotNewPass').value = '';
  document.getElementById('forgotConfirmPass').value = '';
}

function hideForgot() {
  document.getElementById('forgotModal').classList.remove('active');
}

function backToStep1() {
  document.getElementById('forgotStep1').classList.add('active');
  document.getElementById('forgotStep2').classList.remove('active');
  document.getElementById('forgotError1').textContent = '';
}

function backToStep2() {
  document.getElementById('forgotStep2').classList.add('active');
  document.getElementById('forgotStep3').classList.remove('active');
  document.getElementById('forgotError2').textContent = '';
}

async function checkUsername() {
  let username = document.getElementById('forgotUsername').value.trim();
  document.getElementById('forgotError1').textContent = '';
  if (!username) {
    document.getElementById('forgotError1').textContent = 'Please enter your username';
    return;
  }
  try {
    let res = await fetch('/api/check-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    let data = await res.json();
    if (data.success) {
      forgotUsername = username;
      document.getElementById('securityQDisplay').textContent = data.security_question || 'What is your favorite color?';
      document.getElementById('forgotStep1').classList.remove('active');
      document.getElementById('forgotStep2').classList.add('active');
    } else {
      document.getElementById('forgotError1').textContent = data.error || 'Username not found';
    }
  } catch (err) {
    document.getElementById('forgotError1').textContent = 'Network error';
  }
}

async function verifyAnswer() {
  let answer = document.getElementById('forgotAnswer').value.trim();
  document.getElementById('forgotError2').textContent = '';
  if (!answer) {
    document.getElementById('forgotError2').textContent = 'Please enter your answer';
    return;
  }
  try {
    let res = await fetch('/api/verify-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: forgotUsername, answer })
    });
    let data = await res.json();
    if (data.success) {
      document.getElementById('forgotStep2').classList.remove('active');
      document.getElementById('forgotStep3').classList.add('active');
    } else {
      document.getElementById('forgotError2').textContent = data.error || 'Incorrect answer';
    }
  } catch (err) {
    document.getElementById('forgotError2').textContent = 'Network error';
  }
}

async function resetPassword() {
  let newPass = document.getElementById('forgotNewPass').value;
  let confirmPass = document.getElementById('forgotConfirmPass').value;
  document.getElementById('forgotError3').textContent = '';
  document.getElementById('forgotSuccess').textContent = '';

  if (newPass.length < 4) {
    document.getElementById('forgotError3').textContent = 'Password must be 4+ characters';
    return;
  }
  if (newPass !== confirmPass) {
    document.getElementById('forgotError3').textContent = 'Passwords do not match';
    return;
  }

  try {
    let res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: forgotUsername, new_password: newPass })
    });
    let data = await res.json();
    if (data.success) {
      document.getElementById('forgotSuccess').textContent = 'Password reset! You can now log in.';
      setTimeout(() => {
        hideForgot();
        switchTab('login');
        document.getElementById('loginUsername').value = forgotUsername;
      }, 2000);
    } else {
      document.getElementById('forgotError3').textContent = data.error || 'Reset failed';
    }
  } catch (err) {
    document.getElementById('forgotError3').textContent = 'Network error';
  }
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
    document.getElementById('setCurrency').value = currency;
    // Update field toggle checkboxes
    document.querySelectorAll('#fieldToggles input').forEach(cb => {
      cb.checked = !disabledFields.includes(cb.getAttribute('onchange').match(/toggleField\('([^']+)'/)[1]);
    });
  }
}

function updateCurrency(v) { currency = v; updateRateDisplay(); }

function toggleField(field, enabled) {
  if (enabled) {
    disabledFields = disabledFields.filter(f => f !== field);
  } else {
    if (!disabledFields.includes(field)) disabledFields.push(field);
  }
  applyFieldVisibility();
}

function applyFieldVisibility() {
  const fieldMap = {
    'grocery': ['eGroc', 'grocCol'],
    'phone': ['ePhone', 'phoneCol'],
    'wifi': ['eWifi', 'wifiCol'],
    'food': ['eFood', 'foodCol'],
    'maintenance': ['eMaint', 'maintCol'],
    'insurance': ['eInsur', 'insurCol'],
    'misc': ['eMisc', 'miscCol'],
    'other': ['eOther', 'otherCol']
  };
  applyDeliveriesVisibility();

  Object.keys(fieldMap).forEach(field => {
    const [inputId, colClass] = fieldMap[field];
    const input = document.getElementById(inputId);
    const cols = document.querySelectorAll('.' + colClass);
    if (disabledFields.includes(field)) {
      if (input) input.closest('.expense-item').style.display = 'none';
      cols.forEach(c => c.style.display = 'none');
    } else {
      if (input) input.closest('.expense-item').style.display = '';
      cols.forEach(c => c.style.display = '');
    }
  });
}

function updateRate(v) { settings.rate = parseFloat(v) || 17.85; updateRateDisplay(); }
function updateTax(v) { settings.tax = (parseFloat(v) || 12) / 100; updateRateDisplay(); }
function updateOT(v) { settings.ot = parseFloat(v) || 8; updateRateDisplay(); }
function updateOTM(v) { settings.otm = parseFloat(v) || 1.5; updateRateDisplay(); }

function updateRateDisplay() {
  let sym = currencySymbols[currency] || '$';
  document.getElementById('rateDisplay').textContent = sym + settings.rate.toFixed(2) + '/hr';
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
        ot_multiplier: settings.otm,
        currency: currency,
        disabled_fields: JSON.stringify(disabledFields)
      })
    });
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
    entries.forEach(e => {
      e.has_overtime = e.has_overtime === 1;
      recalcEntry(e);
    });
    // Sort by date ascending (oldest first, newest last)
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    render();
  } catch (err) {
    showT('Failed to load shifts', true);
  } finally {
    showLoading(false);
  }
}

function recalcEntry(e) {
  let hours = parseFloat(e.hours) || 0;
  let tips = parseFloat(e.tips) || 0;
  let gross = 0;
  let regHours = 0;
  let otHours = 0;

  if (hours > settings.ot) {
    regHours = settings.ot;
    otHours = hours - settings.ot;
    gross = (regHours * settings.rate) + (otHours * settings.rate * settings.otm);
    e.has_overtime = true;
  } else {
    regHours = hours;
    otHours = 0;
    gross = hours * settings.rate;
    e.has_overtime = false;
  }

  e.reg_hours = parseFloat(regHours.toFixed(2));
  e.ot_hours = parseFloat(otHours.toFixed(2));
  e.gross = parseFloat(gross.toFixed(2));
  e.tax = parseFloat((e.gross * settings.tax).toFixed(2));
  e.net = parseFloat((e.gross - e.tax + tips).toFixed(2));
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
  let tips = parseFloat(document.getElementById('eTips').value) || 0;
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

  let day = dateRaw.substring(0,2);
  let month = dateRaw.substring(2,4);
  let year = new Date().getFullYear();
  let date = year + '-' + month + '-' + day;

  let [h1, m1] = timeIn.split(':').map(Number);
  let [h2, m2] = timeOut.split(':').map(Number);
  let start = h1 * 60 + m1;
  let end = h2 * 60 + m2;
  if (end < start) end += 24 * 60;
  let hours = (end - start) / 60;

  let entry = {
    date, time_in: timeIn, time_out: timeOut, hours, km, deliveries,
    fuel_type: fuelType, fuel, tips, grocery, phone, wifi, food, maintenance, insurance, misc, other, notes,
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
      entries.push(entry);
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
  document.getElementById('eTips').value = '';
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

  // If time fields changed, recalculate hours
  if (field === 'time_in' || field === 'time_out') {
    let [h1, m1] = entry.time_in.split(':').map(Number);
    let [h2, m2] = entry.time_out.split(':').map(Number);
    let start = h1 * 60 + m1;
    let end = h2 * 60 + m2;
    if (end < start) end += 24 * 60;
    entry.hours = (end - start) / 60;
  }

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

  let sym = currencySymbols[currency] || '$';
  document.getElementById('dProfit').textContent = sym + totalProfit.toFixed(2);
  document.getElementById('dGross').textContent = sym + totalGross.toFixed(2);
  document.getElementById('dHours').textContent = totalHours.toFixed(2);
  document.getElementById('dDeliv').textContent = totalDeliv;
  document.getElementById('dKM').textContent = totalKM.toFixed(1);
  document.getElementById('dExp').textContent = sym + totalExp.toFixed(2);

  let tbody = document.getElementById('tBody');
  tbody.innerHTML = '';
  filtered.forEach(e => {
    let tr = document.createElement('tr');
    let totalExp = (parseFloat(e.fuel)||0) + (parseFloat(e.grocery)||0) + (parseFloat(e.phone)||0) + (parseFloat(e.wifi)||0) + (parseFloat(e.food)||0) + (parseFloat(e.maintenance)||0) + (parseFloat(e.insurance)||0) + (parseFloat(e.misc)||0) + (parseFloat(e.other)||0);
    tr.innerHTML = `
      <td style="text-align:center">${e.date}</td>
      <td style="text-align:center">${e.time_in}</td>
      <td style="text-align:center">${e.time_out}</td>
      <td style="text-align:center;font-weight:700">${e.reg_hours !== undefined ? e.reg_hours.toFixed(2) : (e.hours > settings.ot ? settings.ot.toFixed(2) : e.hours.toFixed(2))}</td>
      <td style="text-align:center;font-weight:700;color:var(--warning)">${e.ot_hours !== undefined ? e.ot_hours.toFixed(2) : (e.hours > settings.ot ? (e.hours - settings.ot).toFixed(2) : '0.00')}${e.has_overtime ? '<span class="ot-badge">OT</span>' : ''}</td>
      <td style="text-align:center">$${settings.rate.toFixed(2)}</td>
      <td class="cell-calc" style="text-align:right">$${e.gross.toFixed(2)}</td>
      <td class="cell-expense" style="text-align:right">$${e.tax.toFixed(2)}</td>
      <td class="cell-calc" style="text-align:right">$${e.net.toFixed(2)}</td>
      <td style="text-align:center">${e.km}</td>
      <td class="delivCol" style="text-align:center">${e.deliveries}</td>
      <td style="text-align:right">$${(e.tips || 0).toFixed(2)}</td>
      <td style="text-align:right;color:var(--danger);font-weight:600">$${totalExp.toFixed(2)}</td>
      <td class="${e.daily_profit >= 0 ? 'cell-profit' : 'cell-loss'}" style="text-align:right;font-weight:800">$${e.daily_profit.toFixed(2)}</td>
      <td style="min-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${e.notes || '-'}</td>
      <td style="text-align:center;white-space:nowrap">
        <button class="view-btn" onclick="viewShift(${e.id})" title="View/Edit">👁</button>
        <button class="delete-btn" onclick="deleteEntry(${e.id})" title="Delete">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

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
  document.getElementById('wGross').textContent = sym + wGross.toFixed(2);
  document.getElementById('wTax').textContent = sym + wTax.toFixed(2);
  document.getElementById('wNet').textContent = sym + wNet.toFixed(2);
  document.getElementById('wKM').textContent = wKM.toFixed(1);
  document.getElementById('wDeliv').textContent = wDeliv;
  document.getElementById('wFuel').textContent = sym + wFuel.toFixed(2);
  document.getElementById('wExp').textContent = sym + wExp.toFixed(2);
  document.getElementById('wProfit').textContent = sym + wProfit.toFixed(2);
  document.getElementById('wProfit').parentElement.className = 'summary-row total' + (wProfit < 0 ? ' negative' : '');

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
  document.getElementById('mGross').textContent = sym + mGross.toFixed(2);
  document.getElementById('mTax').textContent = sym + mTax.toFixed(2);
  document.getElementById('mNet').textContent = sym + mNet.toFixed(2);
  document.getElementById('mKM').textContent = mKM.toFixed(1);
  document.getElementById('mDeliv').textContent = mDeliv;
  document.getElementById('mFuel').textContent = sym + mFuel.toFixed(2);
  document.getElementById('mExp').textContent = sym + mExp.toFixed(2);
  document.getElementById('mProfit').textContent = sym + mProfit.toFixed(2);
  document.getElementById('mProfit').parentElement.className = 'summary-row total' + (mProfit < 0 ? ' negative' : '');

  updateCharts(filtered);
}

// ==================== CHARTS ====================
function initCharts() {
  Chart.defaults.font.family = "'Segoe UI',system-ui,sans-serif";
  let isLight = document.body.classList.contains('light-mode');
  Chart.defaults.color = isLight ? '#5a5a7a' : '#a0a0b0';

  cEarn = new Chart(document.getElementById('cEarn'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Net Earnings', data: [], borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.1)', fill: true, tension: 0.4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } } }
  });

  cFuel = new Chart(document.getElementById('cFuel'), {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Fuel Cost', data: [], backgroundColor: '#ff1744', borderRadius: 6 }, { label: 'Net Earnings', data: [], backgroundColor: '#00e676', borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#a0a0b0' } } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } } }
  });

  cHours = new Chart(document.getElementById('cHours'), {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Hours', data: [], backgroundColor: '#ff9100', borderRadius: 6 }, { label: 'Deliveries', data: [], backgroundColor: '#e040fb', borderRadius: 6, yAxisID: 'y1' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#a0a0b0' } } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, y1: { position: 'right', beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } }
  });

  cExp = new Chart(document.getElementById('cExp'), {
    type: 'doughnut',
    data: { labels: ['Fuel','Grocery','Phone','WiFi','Food','Maint','Insur','Misc','Other'], datasets: [{ data: [], backgroundColor: ['#ff1744','#ff9100','#2962ff','#e040fb','#ec4899','#6366f1','#00bfa5','#f97316','#64748b','#ffd700'], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 11 }, color: '#a0a0b0' } } } }
  });
}

function updateCharts(filtered) {
  if (!cEarn) return;
  let isLight = document.body.classList.contains('light-mode');
  let gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
  let labelColor = isLight ? '#5a5a7a' : '#a0a0b0';
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
    filtered.reduce((s,e) => s + (e.other||0), 0),
    filtered.reduce((s,e) => s + (e.tips||0), 0)
  ];
  cExp.data.datasets[0].data = expTotals;
  cExp.update();
}

// ==================== EXPORT ====================
function toggleExportMenu() {
  document.getElementById('exportMenu').classList.toggle('active');
}

function exportCSV() {
  let sym = currencySymbols[currency] || '$';
  let h = ['Date','Time In','Time Out','Hours','Rate ('+sym+')','Gross ('+sym+')','Tax ('+sym+')','Net ('+sym+')','Tips ('+sym+')','KM','Deliveries','Fuel Type','Fuel ('+sym+')','Grocery ('+sym+')','Phone ('+sym+')','WiFi ('+sym+')','Food ('+sym+')','Maint ('+sym+')','Insur ('+sym+')','Misc ('+sym+')','Other ('+sym+')','Profit ('+sym+')','Notes'];
  let csv = h.join(',') + '\n';
  entries.forEach(e => {
    csv += `${e.date},${e.time_in},${e.time_out},${e.hours},${settings.rate},${e.gross},${e.tax},${e.net},${e.tips || 0},${e.km},${e.deliveries},${e.fuel_type},${e.fuel},${e.grocery},${e.phone},${e.wifi},${e.food},${e.maintenance},${e.insurance},${e.misc},${e.other},${e.daily_profit},"${(e.notes || '').replace(/"/g,'""')}"\n`;
  });
  let blob = new Blob([csv], { type: 'text/csv' });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = 'paypulse_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showT('CSV exported!');
}

function generateAIReport() {
  if (entries.length === 0) return "No data available for analysis.";

  let sym = currencySymbols[currency] || '$';
  let totalGross = entries.reduce((s,e) => s + e.gross, 0);
  let totalNet = entries.reduce((s,e) => s + e.net, 0);
  let totalHours = entries.reduce((s,e) => s + e.hours, 0);
  let totalExp = entries.reduce((s,e) => s + (e.fuel||0)+(e.grocery||0)+(e.phone||0)+(e.wifi||0)+(e.food||0)+(e.maintenance||0)+(e.insurance||0)+(e.misc||0)+(e.other||0), 0);
  let totalProfit = entries.reduce((s,e) => s + e.daily_profit, 0);
  let avgHourly = totalHours > 0 ? totalNet / totalHours : 0;
  let otCount = entries.filter(e => e.has_overtime).length;
  let avgProfit = entries.length > 0 ? totalProfit / entries.length : 0;

  // Trend analysis
  let sorted = entries.slice().sort((a,b) => new Date(a.date) - new Date(b.date));
  let firstHalf = sorted.slice(0, Math.floor(sorted.length/2));
  let secondHalf = sorted.slice(Math.floor(sorted.length/2));
  let firstProfit = firstHalf.reduce((s,e) => s + e.daily_profit, 0);
  let secondProfit = secondHalf.reduce((s,e) => s + e.daily_profit, 0);
  let trend = secondProfit > firstProfit ? "improving" : secondProfit < firstProfit ? "declining" : "stable";
  let trendPct = firstProfit !== 0 ? Math.abs(((secondProfit - firstProfit) / Math.abs(firstProfit)) * 100).toFixed(1) : 0;

  // Best/worst day
  let bestDay = entries.reduce((max,e) => e.daily_profit > max.daily_profit ? e : max, entries[0]);
  let worstDay = entries.reduce((min,e) => e.daily_profit < min.daily_profit ? e : min, entries[0]);

  // Expense breakdown
  let fuelExp = entries.reduce((s,e) => s + (e.fuel||0), 0);
  let foodExp = entries.reduce((s,e) => s + (e.food||0), 0);
  let topExpense = fuelExp > foodExp ? 'Fuel' : 'Food/Rest';

  let report = `INCOME TRACKER AI ANALYSIS REPORT
Generated: ${new Date().toLocaleDateString()}
User: ${currentUser ? currentUser.username : 'Guest'}

═══ EXECUTIVE SUMMARY ═══
Total Shifts Recorded: ${entries.length}
Total Hours Worked: ${totalHours.toFixed(2)} hrs
Gross Earnings: $${totalGross.toFixed(2)}
Net Earnings (after tax): $${totalNet.toFixed(2)}
Total Expenses: $${totalExp.toFixed(2)}
Overall Profit: $${totalProfit.toFixed(2)}
Average Net per Hour: $${avgHourly.toFixed(2)}
Average Profit per Shift: $${avgProfit.toFixed(2)}

═══ TREND ANALYSIS ═══
Your earnings trend is ${trend.toUpperCase()}.
${trend === 'improving' ? 'Great job! Your recent shifts are showing better profitability compared to earlier ones.' : trend === 'declining' ? 'Attention needed: Your recent profitability has decreased. Consider reviewing expenses or increasing deliveries.' : 'Your earnings have remained consistent across your recorded shifts.'}
Performance change: ${trendPct}% ${trend === 'improving' ? 'increase' : trend === 'declining' ? 'decrease' : 'variance'} in recent period.

═══ SHIFT HIGHLIGHTS ═══
Best Performing Day: ${bestDay.date} (${sym}${bestDay.daily_profit.toFixed(2)} profit)
Worst Performing Day: ${worstDay.date} (${sym}${worstDay.daily_profit.toFixed(2)} profit)
Overtime Shifts: ${otCount} (${((otCount/entries.length)*100).toFixed(0)}% of total)

═══ EXPENSE INSIGHTS ═══
Highest expense category: ${topExpense} ($${(fuelExp > foodExp ? fuelExp : foodExp).toFixed(2)})
Expense-to-Earnings Ratio: ${totalGross > 0 ? ((totalExp/totalGross)*100).toFixed(1) : 0}%
${totalExp/totalGross > 0.3 ? 'Your expenses are relatively high. Consider optimizing fuel usage and reducing non-essential spending.' : 'Your expense management is efficient. Keep up the good work!'}

═══ RECOMMENDATIONS ═══
${avgHourly < settings.rate ? '• Your effective hourly rate is below your base rate. Try to work more overtime shifts or increase delivery efficiency.' : '• Your effective hourly rate is strong. Maintain your current work pattern.'}
${otCount < entries.length * 0.2 ? '• Consider working more overtime-eligible shifts to boost earnings.' : '• You are effectively utilizing overtime opportunities.'}
${totalProfit < 0 ? '• CRITICAL: You are operating at a loss overall. Review all expenses immediately.' : '• You are profitable. Continue tracking to optimize further.'}
• Track your ${topExpense.toLowerCase()} costs closely as they represent your largest expense.
• Set weekly profit goals to maintain motivation and track progress.

═══ END OF REPORT ═══`;

  return report;
}

async function exportPDF() {
  if (entries.length === 0) {
    showT('No data to export', true);
    return;
  }

  showLoading(true);
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    // Header
    doc.setFillColor(255, 23, 68);
    doc.rect(0, 0, 300, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYPULSE INCOME TRACKER REPORT', 15, 17);

    // User info
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()} | User: ${currentUser ? currentUser.username : 'Guest'}`, 15, 32);

    // AI Report
    let report = generateAIReport();
    let reportLines = doc.splitTextToSize(report, 270);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);
    let yPos = 42;
    reportLines.forEach(line => {
      if (yPos > 180) {
        doc.addPage();
        yPos = 15;
      }
      doc.text(line, 15, yPos);
      yPos += 4.5;
    });

    // Data table on new page
    doc.addPage('landscape');
    doc.setFillColor(255, 23, 68);
    doc.rect(0, 0, 300, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SHIFT HISTORY DATA', 15, 14);

    let tableData = entries.map(e => [
      e.date, e.time_in, e.time_out, e.hours.toFixed(2),
      sym + e.gross.toFixed(2), sym + e.tax.toFixed(2), sym + e.net.toFixed(2), sym + (e.tips||0).toFixed(2),
      e.km, e.deliveries, sym + (e.fuel||0).toFixed(2), sym + e.daily_profit.toFixed(2)
    ]);

    doc.autoTable({
      startY: 25,
      head: [['Date', 'In', 'Out', 'Hrs', 'Gross', 'Tax', 'Net', 'Tips', 'KM', 'Deliv', 'Fuel', 'Profit']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 98, 255], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      margin: { left: 15, right: 15 }
    });

    doc.save('paypulse_report_' + new Date().toISOString().split('T')[0] + '.pdf');
    showT('PDF report exported!');
  } catch (err) {
    console.error(err);
    showT('PDF export failed', true);
  } finally {
    showLoading(false);
  }
}

// ==================== CLEAR ====================
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

// ==================== LOADING ====================
function showLoading(show) {
  document.getElementById('loading').classList.toggle('active', show);
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




// ==================== DELIVERIES TOGGLE ====================
function toggleDeliveries(enabled) {
  showDeliveries = enabled;
  applyDeliveriesVisibility();
}

function applyDeliveriesVisibility() {
  let delivInputs = document.querySelectorAll('.deliv-field');
  let delivCols = document.querySelectorAll('.delivCol');
  delivInputs.forEach(el => el.style.display = showDeliveries ? '' : 'none');
  delivCols.forEach(el => el.style.display = showDeliveries ? '' : 'none');
}

function getLabel(field, defaultLabel) {
  return customLabels[field] || defaultLabel;
}

function applyCustomLabels() {
  const labelMap = {
    'grocery': 'Grocery',
    'phone': 'Phone Bill',
    'wifi': 'WiFi Bill',
    'food': 'Food/Rest',
    'maintenance': 'Car Maint',
    'insurance': 'Insurance',
    'misc': 'Misc',
    'other': 'Other'
  };
  Object.keys(labelMap).forEach(field => {
    const label = getLabel(field, labelMap[field]);
    const formLabel = document.getElementById('form-label-' + field);
    if (formLabel) formLabel.textContent = label;
  });
}

function updateLabel(field, value) {
  if (value && value.trim()) {
    customLabels[field] = value.trim();
  } else {
    delete customLabels[field];
  }
  applyCustomLabels();
}

// ==================== PROFILE ====================
function toggleProfile() {
  let panel = document.getElementById('profilePanel');
  panel.classList.toggle('active');
  if (panel.classList.contains('active') && currentUser) {
    document.getElementById('profName').value = currentUser.name || '';
    document.getElementById('profEmail').value = currentUser.email || '';
    document.getElementById('profWork').value = currentUser.workplace || '';
    document.getElementById('profDOB').value = currentUser.dob || '';
    if (currentUser.profile_photo) {
      let preview = document.getElementById('profPhotoPreview');
      preview.src = currentUser.profile_photo;
      preview.style.display = 'block';
      document.getElementById('profPhotoPlaceholder').style.display = 'none';
    }
  }
}

function hideProfile() {
  document.getElementById('profilePanel').classList.remove('active');
}

function previewPhoto(input) {
  if (input.files && input.files[0]) {
    let reader = new FileReader();
    reader.onload = function(e) {
      let preview = document.getElementById('profPhotoPreview');
      preview.src = e.target.result;
      preview.style.display = 'block';
      document.getElementById('profPhotoPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function saveProfile() {
  if (!currentUser) return;
  let name = document.getElementById('profName').value.trim();
  let email = document.getElementById('profEmail').value.trim();
  let workplace = document.getElementById('profWork').value.trim();
  let dob = document.getElementById('profDOB').value;
  let photoInput = document.getElementById('profPhoto');
  let photo = currentUser.profile_photo || '';

  showLoading(true);
  try {
    if (photoInput.files && photoInput.files[0]) {
      let reader = new FileReader();
      photo = await new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(photoInput.files[0]);
      });
    }

    let res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, workplace, dob, profile_photo: photo })
    });
    let result = await res.json();
    if (result.success) {
      currentUser = { ...currentUser, name, email, workplace, dob, profile_photo: photo };
      let displayName = name || currentUser.username || 'Guest';
      document.getElementById('userBadge').textContent = '👤 ' + displayName;
      hideProfile();
      showT('Profile saved!');
    } else {
      showT(result.error || 'Failed to save', true);
    }
  } catch (err) {
    showT('Failed to save profile', true);
  } finally {
    showLoading(false);
  }
}


// ==================== VIEW/EDIT SHIFT MODAL ====================
let viewingEntryId = null;
let isEditMode = false;

function viewShift(id) {
  let entry = entries.find(e => e.id === id);
  if (!entry) return;
  viewingEntryId = id;
  isEditMode = false;
  renderViewModal(entry);
  document.getElementById('viewModal').classList.add('active');
}

function hideViewModal() {
  document.getElementById('viewModal').classList.remove('active');
  viewingEntryId = null;
  isEditMode = false;
}

function renderViewModal(entry, editMode = false) {
  let sym = currencySymbols[currency] || '$';
  let totalExp = (parseFloat(entry.fuel)||0) + (parseFloat(entry.grocery)||0) + (parseFloat(entry.phone)||0) + (parseFloat(entry.wifi)||0) + (parseFloat(entry.food)||0) + (parseFloat(entry.maintenance)||0) + (parseFloat(entry.insurance)||0) + (parseFloat(entry.misc)||0) + (parseFloat(entry.other)||0);

  let expenseDetails = '';
  if (entry.fuel > 0) expenseDetails += `<div class="view-item"><span class="view-item-label">Fuel</span><span class="view-item-value negative">${sym}${entry.fuel.toFixed(2)}</span></div>`;
  if (entry.grocery > 0) expenseDetails += `<div class="view-item"><span class="view-item-label">${getLabel('grocery', 'Grocery')}</span><span class="view-item-value negative">${sym}${entry.grocery.toFixed(2)}</span></div>`;
  if (entry.phone > 0) expenseDetails += `<div class="view-item"><span class="view-item-label">${getLabel('phone', 'Phone Bill')}</span><span class="view-item-value negative">${sym}${entry.phone.toFixed(2)}</span></div>`;
  if (entry.wifi > 0) expenseDetails += `<div class="view-item"><span class="view-item-label">${getLabel('wifi', 'WiFi Bill')}</span><span class="view-item-value negative">${sym}${entry.wifi.toFixed(2)}</span></div>`;
  if (entry.food > 0) expenseDetails += `<div class="view-item"><span class="view-item-label">${getLabel('food', 'Food/Rest')}</span><span class="view-item-value negative">${sym}${entry.food.toFixed(2)}</span></div>`;
  if (entry.maintenance > 0) expenseDetails += `<div class="view-item"><span class="view-item-label">${getLabel('maintenance', 'Car Maint')}</span><span class="view-item-value negative">${sym}${entry.maintenance.toFixed(2)}</span></div>`;
  if (entry.insurance > 0) expenseDetails += `<div class="view-item"><span class="view-item-label">${getLabel('insurance', 'Insurance')}</span><span class="view-item-value negative">${sym}${entry.insurance.toFixed(2)}</span></div>`;
  if (entry.misc > 0) expenseDetails += `<div class="view-item"><span class="view-item-label">${getLabel('misc', 'Misc')}</span><span class="view-item-value negative">${sym}${entry.misc.toFixed(2)}</span></div>`;
  if (entry.other > 0) expenseDetails += `<div class="view-item"><span class="view-item-label">${getLabel('other', 'Other')}</span><span class="view-item-value negative">${sym}${entry.other.toFixed(2)}</span></div>`;
  if (!expenseDetails) expenseDetails = '<div class="view-item"><span class="view-item-label">No expenses recorded</span></div>';

  if (!editMode) {
    document.getElementById('viewModalBody').innerHTML = `
      <div class="view-section">
        <div class="view-section-title">&#128198; Work Details</div>
        <div class="view-grid">
          <div class="view-item"><span class="view-item-label">Date</span><span class="view-item-value">${entry.date}</span></div>
          <div class="view-item"><span class="view-item-label">Time In</span><span class="view-item-value">${entry.time_in}</span></div>
          <div class="view-item"><span class="view-item-label">Time Out</span><span class="view-item-value">${entry.time_out}</span></div>
          <div class="view-item"><span class="view-item-label">Regular Hours</span><span class="view-item-value">${entry.reg_hours !== undefined ? entry.reg_hours.toFixed(2) : (entry.hours > settings.ot ? settings.ot.toFixed(2) : entry.hours.toFixed(2))}</span></div>
          <div class="view-item"><span class="view-item-label">OT Hours</span><span class="view-item-value warning">${entry.ot_hours !== undefined ? entry.ot_hours.toFixed(2) : (entry.hours > settings.ot ? (entry.hours - settings.ot).toFixed(2) : '0.00')}</span></div>
          <div class="view-item"><span class="view-item-label">KM Driven</span><span class="view-item-value">${entry.km}</span></div>
          <div class="view-item"><span class="view-item-label">Deliveries</span><span class="view-item-value">${entry.deliveries}</span></div>
          <div class="view-item"><span class="view-item-label">Fuel Type</span><span class="view-item-value">${entry.fuel_type || 'regular'}</span></div>
        </div>
      </div>
      <div class="view-section">
        <div class="view-section-title">&#128176; Earnings</div>
        <div class="view-grid">
          <div class="view-item"><span class="view-item-label">Hourly Rate</span><span class="view-item-value">${sym}${settings.rate.toFixed(2)}</span></div>
          <div class="view-item"><span class="view-item-label">Gross Earnings</span><span class="view-item-value positive">${sym}${entry.gross.toFixed(2)}</span></div>
          <div class="view-item"><span class="view-item-label">Tax (${(settings.tax*100).toFixed(0)}%)</span><span class="view-item-value negative">${sym}${entry.tax.toFixed(2)}</span></div>
          <div class="view-item"><span class="view-item-label">Tips</span><span class="view-item-value positive">${sym}${(entry.tips || 0).toFixed(2)}</span></div>
          <div class="view-item"><span class="view-item-label">Net Earnings</span><span class="view-item-value positive" style="font-size:1.1rem">${sym}${entry.net.toFixed(2)}</span></div>
        </div>
      </div>
      <div class="view-section">
        <div class="view-section-title">&#128179; Expenses</div>
        <div class="view-grid" style="grid-template-columns:1fr">
          ${expenseDetails}
          <div class="view-item" style="border-top:2px solid var(--border);margin-top:0.3rem;padding-top:0.5rem">
            <span class="view-item-label" style="font-size:0.95rem;color:var(--text)">Total Expenses</span>
            <span class="view-item-value negative" style="font-size:1.1rem">${sym}${totalExp.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div class="view-section">
        <div class="view-section-title">&#128176; Profit</div>
        <div class="view-item" style="justify-content:center;gap:1rem">
          <span class="view-item-label" style="font-size:1rem">Daily Profit</span>
          <span class="view-item-value ${entry.daily_profit >= 0 ? 'positive' : 'negative'}" style="font-size:1.5rem">${sym}${entry.daily_profit.toFixed(2)}</span>
        </div>
      </div>
      <div class="view-section">
        <div class="view-section-title">&#128221; Notes</div>
        <div class="view-notes">${entry.notes || 'No notes'}</div>
      </div>
    `;
    document.getElementById('viewEditBtn').innerHTML = '&#9998; Edit';
    document.getElementById('viewEditBtn').onclick = enableEditMode;
  } else {
    // Edit mode
    document.getElementById('viewModalBody').innerHTML = `
      <div class="view-section">
        <div class="view-section-title">&#128198; Work Details</div>
        <div class="view-grid">
          <div class="view-item"><span class="view-item-label">Date</span><input class="edit-input date-input" id="editDate" value="${entry.date}"></div>
          <div class="view-item"><span class="view-item-label">Time In</span><input class="edit-input time-input" id="editTimeIn" type="time" value="${entry.time_in}"></div>
          <div class="view-item"><span class="view-item-label">Time Out</span><input class="edit-input time-input" id="editTimeOut" type="time" value="${entry.time_out}"></div>
          <div class="view-item"><span class="view-item-label">KM Driven</span><input class="edit-input" id="editKM" type="number" value="${entry.km}" step="0.1"></div>
          <div class="view-item"><span class="view-item-label">Deliveries</span><input class="edit-input" id="editDeliv" type="number" value="${entry.deliveries}"></div>
          <div class="view-item"><span class="view-item-label">Fuel Type</span>
            <select class="edit-select" id="editFuelType">
              <option value="regular" ${entry.fuel_type === 'regular' ? 'selected' : ''}>Regular</option>
              <option value="premium" ${entry.fuel_type === 'premium' ? 'selected' : ''}>Premium</option>
              <option value="diesel" ${entry.fuel_type === 'diesel' ? 'selected' : ''}>Diesel</option>
            </select>
          </div>
        </div>
      </div>
      <div class="view-section">
        <div class="view-section-title">&#128176; Earnings</div>
        <div class="view-grid">
          <div class="view-item"><span class="view-item-label">Tips</span><input class="edit-input" id="editTips" type="number" value="${entry.tips || 0}" step="0.01"></div>
        </div>
      </div>
      <div class="view-section">
        <div class="view-section-title">&#128179; Expenses</div>
        <div class="view-grid">
          <div class="view-item"><span class="view-item-label">Fuel</span><input class="edit-input" id="editFuel" type="number" value="${entry.fuel}" step="0.01"></div>
          <div class="view-item"><span class="view-item-label">${getLabel('grocery', 'Grocery')}</span><input class="edit-input" id="editGroc" type="number" value="${entry.grocery}" step="0.01"></div>
          <div class="view-item"><span class="view-item-label">${getLabel('phone', 'Phone')}</span><input class="edit-input" id="editPhone" type="number" value="${entry.phone}" step="0.01"></div>
          <div class="view-item"><span class="view-item-label">${getLabel('wifi', 'WiFi')}</span><input class="edit-input" id="editWifi" type="number" value="${entry.wifi}" step="0.01"></div>
          <div class="view-item"><span class="view-item-label">${getLabel('food', 'Food')}</span><input class="edit-input" id="editFood" type="number" value="${entry.food}" step="0.01"></div>
          <div class="view-item"><span class="view-item-label">${getLabel('maintenance', 'Maint')}</span><input class="edit-input" id="editMaint" type="number" value="${entry.maintenance}" step="0.01"></div>
          <div class="view-item"><span class="view-item-label">${getLabel('insurance', 'Insur')}</span><input class="edit-input" id="editInsur" type="number" value="${entry.insurance}" step="0.01"></div>
          <div class="view-item"><span class="view-item-label">${getLabel('misc', 'Misc')}</span><input class="edit-input" id="editMisc" type="number" value="${entry.misc}" step="0.01"></div>
          <div class="view-item"><span class="view-item-label">${getLabel('other', 'Other')}</span><input class="edit-input" id="editOther" type="number" value="${entry.other}" step="0.01"></div>
        </div>
      </div>
      <div class="view-section">
        <div class="view-section-title">&#128221; Notes</div>
        <textarea class="edit-input notes-input" id="editNotes" placeholder="Add notes...">${entry.notes || ''}</textarea>
      </div>
    `;
    document.getElementById('viewEditBtn').innerHTML = '&#128190; Save';
    document.getElementById('viewEditBtn').onclick = saveEditMode;
  }
}

function enableEditMode() {
  if (!viewingEntryId) return;
  let entry = entries.find(e => e.id === viewingEntryId);
  if (!entry) return;
  isEditMode = true;
  renderViewModal(entry, true);
}

async function saveEditMode() {
  if (!viewingEntryId) return;
  let entry = entries.find(e => e.id === viewingEntryId);
  if (!entry) return;

  entry.date = document.getElementById('editDate').value;
  entry.time_in = document.getElementById('editTimeIn').value;
  entry.time_out = document.getElementById('editTimeOut').value;
  entry.km = parseFloat(document.getElementById('editKM').value) || 0;
  entry.deliveries = parseInt(document.getElementById('editDeliv').value) || 0;
  entry.fuel_type = document.getElementById('editFuelType').value;
  entry.tips = parseFloat(document.getElementById('editTips').value) || 0;
  entry.fuel = parseFloat(document.getElementById('editFuel').value) || 0;
  entry.grocery = parseFloat(document.getElementById('editGroc').value) || 0;
  entry.phone = parseFloat(document.getElementById('editPhone').value) || 0;
  entry.wifi = parseFloat(document.getElementById('editWifi').value) || 0;
  entry.food = parseFloat(document.getElementById('editFood').value) || 0;
  entry.maintenance = parseFloat(document.getElementById('editMaint').value) || 0;
  entry.insurance = parseFloat(document.getElementById('editInsur').value) || 0;
  entry.misc = parseFloat(document.getElementById('editMisc').value) || 0;
  entry.other = parseFloat(document.getElementById('editOther').value) || 0;
  entry.notes = document.getElementById('editNotes').value;

  // Recalculate hours if time changed
  let [h1, m1] = entry.time_in.split(':').map(Number);
  let [h2, m2] = entry.time_out.split(':').map(Number);
  let start = h1 * 60 + m1;
  let end = h2 * 60 + m2;
  if (end < start) end += 24 * 60;
  entry.hours = (end - start) / 60;

  recalcEntry(entry);

  showLoading(true);
  try {
    await fetch('/api/shifts/' + entry.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    isEditMode = false;
    renderViewModal(entry, false);
    render();
    showT('Shift updated!');
  } catch (err) {
    showT('Update failed', true);
  } finally {
    showLoading(false);
  }
}

// Close view modal on overlay click
document.addEventListener('click', function(e) {
  let viewModal = document.getElementById('viewModal');
  if (viewModal && e.target === viewModal) hideViewModal();
});

// ==================== EVENT LISTENERS ====================
document.addEventListener('click', function(e) {
  let panel = document.getElementById('settingsPanel');
  let fab = document.querySelector('.settings-fab');
  if (panel.classList.contains('active') && !panel.contains(e.target) && e.target !== fab) {
    panel.classList.remove('active');
  }
  let exportMenu = document.getElementById('exportMenu');
  if (exportMenu.classList.contains('active') && !e.target.closest('.export-wrap')) {
    exportMenu.classList.remove('active');
  }
});

document.getElementById('clearModal').addEventListener('click', function(e) {
  if (e.target === this) hideClear();
});

document.getElementById('loginPassword').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') handleLogin(e);
});
