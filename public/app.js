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


// ==================== AUTO LOGOUT TIMER ====================
let inactivityTimer;
let logoutWarningTimer;
const INACTIVITY_LIMIT = 10 * 60 * 1000; // 10 minutes
const WARNING_TIME = 30 * 1000; // Show warning 30 seconds before logout

function resetInactivityTimer() {
  if (typeof inactivityTimer !== 'undefined') clearTimeout(inactivityTimer);
  if (typeof logoutWarningTimer !== 'undefined') clearTimeout(logoutWarningTimer);

  // Hide warning if showing
  let warning = document.getElementById('logoutWarning');
  if (warning) warning.classList.remove('show');

  // Only run timer if user is logged in
  if (!currentUser) return;

  // Set warning timer (30 seconds before logout)
  logoutWarningTimer = setTimeout(() => {
    showLogoutWarning();
  }, INACTIVITY_LIMIT - WARNING_TIME);

  // Set logout timer
  inactivityTimer = setTimeout(() => {
    handleAutoLogout();
  }, INACTIVITY_LIMIT);
}

function showLogoutWarning() {
  let warning = document.getElementById('logoutWarning');
  if (!warning) {
    warning = document.createElement('div');
    warning.id = 'logoutWarning';
    warning.className = 'logout-warning';
    warning.innerHTML = `
      <div class="logout-warning-content">
        <span style="font-size:1.5rem">&#9203;</span>
        <div>
          <div style="font-weight:700">Session expiring soon</div>
          <div style="font-size:0.85rem;opacity:0.8">You will be logged out in 30 seconds due to inactivity.</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="stayLoggedIn()">Stay Logged In</button>
      </div>
    `;
    document.body.appendChild(warning);

    // Add CSS for warning
    let style = document.createElement('style');
    style.textContent = `
      .logout-warning{position:fixed;top:24px;left:50%;transform:translateX(-50%) translateY(-150%);background:linear-gradient(135deg,var(--warning),var(--danger));color:white;padding:1rem 1.5rem;border-radius:16px;z-index:9999;box-shadow:0 8px32px rgba(255,145,0,0.4);transition:all 0.4s;min-width:380px;max-width:90vw}
      .logout-warning.show{transform:translateX(-50%) translateY(0)}
      .logout-warning-content{display:flex;align-items:center;gap:1rem}
      .logout-warning .btn{background:rgba(255,255,255,0.2);border:none;color:white;padding:0.5rem 1rem;border-radius:10px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all 0.2s}
      .logout-warning .btn:hover{background:rgba(255,255,255,0.3);transform:scale(1.05)}
      @media(max-width:480px){.logout-warning{min-width:auto;width:90vw;padding:0.8rem 1rem}.logout-warning-content{flex-direction:column;text-align:center;gap:0.6rem}}
    `;
    document.head.appendChild(style);
  }
  warning.classList.add('show');
}

function stayLoggedIn() {
  resetInactivityTimer();
}

async function handleAutoLogout() {
  let warning = document.getElementById('logoutWarning');
  if (warning) warning.classList.remove('show');

  await fetch('/api/logout', { method: 'POST' });
  currentUser = null;
  entries = [];
  showAuth();
  showT('Logged out due to inactivity', true);
}

// Track user activity
function setupInactivityTracking() {
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  events.forEach(event => {
    document.addEventListener(event, resetInactivityTimer, true);
  });
}

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
  setupInactivityTracking();
  resetInactivityTimer();
  document.getElementById('userBadge').textContent = '👤 ' + (currentUser ? (currentUser.name || currentUser.username) : 'Guest');
  document.getElementById('userBadge').style.cursor = 'pointer';
  document.getElementById('userBadge').title = 'Profile Settings';
  document.getElementById('userBadge').onclick = toggleProfile;
  if (currentUser) {
    currency = currentUser.currency || 'CAD';
    disabledFields = JSON.parse(currentUser.disabled_fields || '[]');
    hiddenFields = disabledFields;
  }
  loadFieldConfig();
  updateRateDisplay();
  renderDynamicForm();
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
  let formData = getFormData();

  let dateRaw = formData.date || '';
  let timeIn = formData.time_in || '';
  let timeOut = formData.time_out || '';

  if (!dateRaw || !timeIn || !timeOut) {
    showT('Please fill date, time in and time out', true);
    return;
  }

  let [h1, m1] = timeIn.split(':').map(Number);
  let [h2, m2] = timeOut.split(':').map(Number);
  let start = h1 * 60 + m1;
  let end = h2 * 60 + m2;
  if (end < start) end += 24 * 60;
  let hours = (end - start) / 60;

  let entry = {
    date: formData.date,
    time_in: timeIn,
    time_out: timeOut,
    hours: hours,
    km: formData.km || 0,
    deliveries: formData.deliveries || 0,
    fuel_type: formData.fuel_type || 'regular',
    fuel: formData.fuel || 0,
    tips: formData.tips || 0,
    grocery: formData.grocery || 0,
    phone: formData.phone || 0,
    wifi: formData.wifi || 0,
    food: formData.food || 0,
    maintenance: formData.maintenance || 0,
    insurance: formData.insurance || 0,
    misc: formData.misc || 0,
    other: formData.other || 0,
    notes: formData.notes || '',
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
  [...fieldConfig.workDetails, ...fieldConfig.personalExpenses].forEach(field => {
    let el = document.getElementById('e_' + field.id);
    if (el) {
      if (field.type === 'select') {
        el.value = field.options ? field.options[0] : 'regular';
      } else {
        el.value = '';
      }
    }
  });
  let notesEl = document.getElementById('e_notes');
  if (notesEl) notesEl.value = '';
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
      <td style="text-align:center;font-weight:700">${e.hours.toFixed(2)}${e.has_overtime ? '<span class="ot-badge">OT</span>' : ''}</td>
      <td style="text-align:right;font-weight:700;color:var(--warning)">${e.has_overtime ? sym + ((e.ot_hours || (e.hours > settings.ot ? e.hours - settings.ot : 0)) * settings.rate * (settings.otm - 1) * (1 - settings.tax)).toFixed(2) : '-'}</td>
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

// ==================== PREMIUM PDF REPORT ====================
async function generatePremiumPDF() {
  if (entries.length === 0) {
    showT('No data to export', true);
    return null;
  }

  showLoading(true);
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    let sym = currencySymbols[currency] || '$';
    let pageWidth = doc.internal.pageSize.getWidth();
    let pageHeight = doc.internal.pageSize.getHeight();
    let margin = 14;
    let contentWidth = pageWidth - (margin * 2);

    // === COLORS ===
    const colors = {
      primary: [37, 99, 235],      // #2563EB
      success: [16, 185, 129],     // #10B981
      danger: [239, 68, 68],       // #EF4444
      warning: [245, 158, 11],     // #F59E0B
      purple: [139, 92, 246],      // #8B5CF6
      bg: [248, 250, 252],        // #F8FAFC
      card: [255, 255, 255],       // #FFFFFF
      textPrimary: [15, 23, 42],   // #0F172A
      textSecondary: [100, 116, 139], // #64748B
      border: [226, 232, 240],     // #E2E8F0
      headerBlue: [30, 58, 138]    // Dark blue header
    };

    // === CALCULATIONS ===
    let totalGross = entries.reduce((s,e) => s + e.gross, 0);
    let totalNet = entries.reduce((s,e) => s + e.net, 0);
    let totalHours = entries.reduce((s,e) => s + e.hours, 0);
    let totalProfit = entries.reduce((s,e) => s + e.daily_profit, 0);
    let totalExp = entries.reduce((s,e) => s + (e.fuel||0)+(e.grocery||0)+(e.phone||0)+(e.wifi||0)+(e.food||0)+(e.maintenance||0)+(e.insurance||0)+(e.misc||0)+(e.other||0), 0);
    let totalTips = entries.reduce((s,e) => s + (e.tips||0), 0);
    let totalKM = entries.reduce((s,e) => s + e.km, 0);
    let totalDeliv = entries.reduce((s,e) => s + e.deliveries, 0);
    let avgHourly = totalHours > 0 ? totalNet / totalHours : 0;
    let avgProfit = entries.length > 0 ? totalProfit / entries.length : 0;
    let otCount = entries.filter(e => e.has_overtime).length;

    // Expense breakdown
    let expBreakdown = [
      { name: 'Fuel', value: entries.reduce((s,e) => s + (e.fuel||0), 0), color: colors.danger },
      { name: 'Grocery', value: entries.reduce((s,e) => s + (e.grocery||0), 0), color: colors.success },
      { name: 'Phone', value: entries.reduce((s,e) => s + (e.phone||0), 0), color: colors.primary },
      { name: 'WiFi', value: entries.reduce((s,e) => s + (e.wifi||0), 0), color: colors.purple },
      { name: 'Food', value: entries.reduce((s,e) => s + (e.food||0), 0), color: colors.warning },
      { name: 'Maintenance', value: entries.reduce((s,e) => s + (e.maintenance||0), 0), color: [99, 102, 241] },
      { name: 'Insurance', value: entries.reduce((s,e) => s + (e.insurance||0), 0), color: [6, 182, 212] },
      { name: 'Misc', value: entries.reduce((s,e) => s + (e.misc||0), 0), color: [236, 72, 153] },
      { name: 'Other', value: entries.reduce((s,e) => s + (e.other||0), 0), color: [148, 163, 184] }
    ].filter(e => e.value > 0).sort((a,b) => b.value - a.value);

    // Health score
    let healthScore = Math.min(100, Math.max(0, totalProfit > 0 ? 70 + (totalProfit/totalGross)*30 : 30 + (totalProfit/totalGross)*20));
    let healthLabel = healthScore >= 71 ? 'GOOD' : healthScore >= 41 ? 'FAIR' : 'NEEDS ATTENTION';
    let healthColor = healthScore >= 71 ? colors.success : healthScore >= 41 ? colors.warning : colors.danger;

    // Month/Year
    let now = new Date();
    let monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    let reportId = 'PP-' + now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + '-001';

    // ========== PAGE 1 ==========

    // --- HEADER BANNER ---
    doc.setFillColor(...colors.headerBlue);
    doc.rect(0, 0, pageWidth, 32, 'F');

    // Logo area
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYPULSE', margin, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Monthly Financial Performance Report', margin, 21);

    // Right side info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(monthYear, pageWidth - margin, 12, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Report ID: ' + reportId, pageWidth - margin, 18, { align: 'right' });
    doc.text('Generated: ' + now.toLocaleDateString(), pageWidth - margin, 24, { align: 'right' });

    let y = 40;

    // --- USER INFO ---
    doc.setTextColor(...colors.textPrimary);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(monthYear, margin, y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Report ID: ' + reportId, margin, y + 5);

    doc.setFontSize(9);
    doc.text('Prepared for', pageWidth - margin - 60, y - 2);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(currentUser ? (currentUser.name || currentUser.username) : 'Guest', pageWidth - margin - 60, y + 4);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated: ' + now.toLocaleDateString(), pageWidth - margin - 60, y + 9);

    y += 18;

    // --- FINANCIAL HEALTH SCORE (Left side) ---
    let gaugeX = margin + 25;
    let gaugeY = y + 25;
    let gaugeR = 22;

    // Draw gauge background arc
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(4);
    doc.arc(gaugeX, gaugeY, gaugeR, Math.PI, 0, 'S');

    // Draw score arc
    let scoreAngle = Math.PI + (Math.PI * (healthScore / 100));
    doc.setDrawColor(...healthColor);
    doc.arc(gaugeX, gaugeY, gaugeR, Math.PI, scoreAngle, 'S');

    // Score text
    doc.setTextColor(...colors.textPrimary);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(Math.round(healthScore).toString(), gaugeX, gaugeY + 3, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('/100', gaugeX + 12, gaugeY + 3);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...healthColor);
    doc.text(healthLabel, gaugeX, gaugeY + 18, { align: 'center' });

    doc.setTextColor(...colors.textSecondary);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Financial Health Score', gaugeX, y + 2, { align: 'center' });

    // --- KPI CARDS (Right side grid) ---
    let cardX = margin + 60;
    let cardY = y;
    let cardW = 28;
    let cardH = 22;

    let kpis = [
      { label: 'Total Income', value: sym + totalGross.toFixed(2), color: colors.success, icon: '+' },
      { label: 'Total Expenses', value: sym + totalExp.toFixed(2), color: colors.danger, icon: '-' },
      { label: 'Net Profit/Loss', value: sym + totalProfit.toFixed(2), color: totalProfit >= 0 ? colors.success : colors.danger, icon: totalProfit >= 0 ? '+' : '-' },
      { label: 'Hours Worked', value: totalHours.toFixed(2) + ' hrs', color: colors.primary, icon: 'H' },
      { label: 'Savings Rate', value: totalGross > 0 ? Math.max(0, ((totalGross - totalExp) / totalGross) * 100).toFixed(0) + '%' : '0%', color: colors.warning, icon: 'S' },
      { label: 'Avg Per Hour', value: sym + avgHourly.toFixed(2), color: colors.purple, icon: '$' }
    ];

    kpis.forEach((kpi, i) => {
      let cx = cardX + (i % 3) * (cardW + 3);
      let cy = cardY + Math.floor(i / 3) * (cardH + 3);

      // Card background
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'FD');

      // Icon circle
      doc.setFillColor(...kpi.color);
      doc.circle(cx + 5, cy + 6, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.icon, cx + 5, cy + 7.5, { align: 'center' });

      // Label
      doc.setTextColor(...colors.textSecondary);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(kpi.label, cx + 10, cy + 6);

      // Value
      doc.setTextColor(...kpi.color);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.value, cx + 10, cy + 14);

      // vs last month (placeholder)
      doc.setTextColor(...colors.textSecondary);
      doc.setFontSize(5);
      doc.text('vs May 2026', cx + 10, cy + 19);
    });

    doc.setTextColor(...colors.textPrimary);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Performance Overview', cardX, cardY - 3);

    y += 55;

    // --- INCOME VS EXPENSES CHART ---
    let chartW = 85;
    let chartH = 45;
    let chartX = margin;
    let chartY = y;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(chartX, chartY, chartW, chartH, 3, 3, 'FD');

    doc.setTextColor(...colors.textPrimary);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Income vs Expenses', chartX + 5, chartY + 6);

    // Bar chart
    let maxVal = Math.max(totalGross, totalExp);
    let barScale = (chartH - 25) / (maxVal || 1);
    let barW = 18;

    // Income bar
    let incomeH = totalGross * barScale;
    doc.setFillColor(...colors.success);
    doc.roundedRect(chartX + 15, chartY + chartH - 12 - incomeH, barW, incomeH, 2, 2, 'F');
    doc.setTextColor(...colors.success);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(sym + totalGross.toFixed(2), chartX + 15 + barW/2, chartY + chartH - 14 - incomeH, { align: 'center' });
    doc.setTextColor(...colors.textSecondary);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Income', chartX + 15 + barW/2, chartY + chartH - 5, { align: 'center' });

    // Expense bar
    let expH = totalExp * barScale;
    doc.setFillColor(...colors.danger);
    doc.roundedRect(chartX + 45, chartY + chartH - 12 - expH, barW, expH, 2, 2, 'F');
    doc.setTextColor(...colors.danger);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(sym + totalExp.toFixed(2), chartX + 45 + barW/2, chartY + chartH - 14 - expH, { align: 'center' });
    doc.setTextColor(...colors.textSecondary);
    doc.setFontSize(7);
    doc.text('Expenses', chartX + 45 + barW/2, chartY + chartH - 5, { align: 'center' });

    // Insight text
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(chartX + 5, chartY + chartH - 18, chartW - 10, 10, 2, 2, 'F');
    doc.setTextColor(...colors.danger);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    let diffText = totalProfit >= 0 
      ? `You saved ${sym}${Math.abs(totalProfit).toFixed(2)} this month.` 
      : `You spent ${sym}${Math.abs(totalProfit).toFixed(2)} more than you earned.`;
    doc.text(diffText, chartX + chartW/2, chartY + chartH - 12, { align: 'center' });

    // --- CASH FLOW TREND (Weekly) ---
    let trendX = chartX + chartW + 5;
    let trendY = chartY;
    let trendW = contentWidth - chartW - 5;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(trendX, trendY, trendW, chartH, 3, 3, 'FD');

    doc.setTextColor(...colors.textPrimary);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Cash Flow Trend (Weekly)', trendX + 5, trendY + 6);

    // Simple line chart
    let weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    let weekData = [0.2, 0.4, 0.6, 0.8]; // Placeholder normalized
    let lineX = trendX + 10;
    let lineY = trendY + 15;
    let lineW = trendW - 20;
    let lineH = chartH - 25;

    // Grid lines
    doc.setDrawColor(240, 240, 240);
    doc.setLineWidth(0.2);
    for (let i = 0; i <= 4; i++) {
      let gy = lineY + (lineH / 4) * i;
      doc.line(lineX, gy, lineX + lineW, gy);
    }

    // Draw income line (green)
    doc.setDrawColor(...colors.success);
    doc.setLineWidth(1);
    let points = weekData.map((v, i) => ({
      x: lineX + (lineW / 3) * i,
      y: lineY + lineH - (v * lineH)
    }));
    for (let i = 0; i < points.length - 1; i++) {
      doc.line(points[i].x, points[i].y, points[i+1].x, points[i+1].y);
    }

    // Week labels
    doc.setTextColor(...colors.textSecondary);
    doc.setFontSize(6);
    weeks.forEach((w, i) => {
      doc.text(w, lineX + (lineW / 3) * i, trendY + chartH - 5, { align: 'center' });
    });

    y += chartH + 5;

    // --- EXPENSE BREAKDOWN (Donut) ---
    let donutW = 85;
    let donutH = 55;
    let donutX = margin;
    let donutY = y;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(donutX, donutY, donutW, donutH, 3, 3, 'FD');

    doc.setTextColor(...colors.textPrimary);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Expense Breakdown', donutX + 5, donutY + 6);

    // Draw simple donut segments
    let cx = donutX + 25;
    let cy = donutY + 30;
    let r = 15;
    let innerR = 8;
    let startAngle = 0;

    expBreakdown.forEach((exp, i) => {
      let pct = exp.value / totalExp;
      let angle = pct * 2 * Math.PI;

      doc.setFillColor(...exp.color);
      // Draw pie segment (simplified as circle sectors)
      let midAngle = startAngle + angle / 2;
      let sx = cx + Math.cos(startAngle) * r;
      let sy = cy + Math.sin(startAngle) * r;
      let ex = cx + Math.cos(startAngle + angle) * r;
      let ey = cy + Math.sin(startAngle + angle) * r;

      // Simplified: draw colored circle for legend
      doc.circle(donutX + 50, donutY + 14 + i * 8, 2, 'F');
      doc.setTextColor(...colors.textPrimary);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(exp.name, donutX + 55, donutY + 16 + i * 8);
      doc.setTextColor(...colors.textSecondary);
      doc.text(Math.round(pct * 100) + '%', donutX + 75, donutY + 16 + i * 8);
      doc.setTextColor(...colors.textPrimary);
      doc.setFont('helvetica', 'bold');
      doc.text(sym + exp.value.toFixed(2), donutX + 75, donutY + 16 + i * 8);

      startAngle += angle;
    });

    // --- QUICK INSIGHTS ---
    let insightX = donutX + donutW + 5;
    let insightY = donutY;
    let insightW = contentWidth - donutW - 5;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(insightX, insightY, insightW, donutH, 3, 3, 'FD');

    doc.setTextColor(...colors.textPrimary);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Quick Insights', insightX + 5, insightY + 6);

    let insights = [
      { icon: '💡', text: `Your expenses exceeded income by ${sym}${Math.abs(totalProfit).toFixed(2)} this month.`, color: colors.danger },
      { icon: '⛽', text: `Fuel accounted for ${expBreakdown[0] ? Math.round((expBreakdown[0].value/totalExp)*100) : 0}% of your total spending.`, color: colors.warning },
      { icon: '💰', text: `Your average earnings per hour were ${sym}${avgHourly.toFixed(2)}.`, color: colors.success },
      { icon: '📉', text: `Reducing discretionary spending by 15% could help you achieve positive monthly cash flow.`, color: colors.primary }
    ];

    insights.forEach((ins, i) => {
      let iy = insightY + 14 + i * 11;
      doc.setFillColor(...ins.color);
      doc.circle(insightX + 8, iy, 3, 'F');
      doc.setTextColor(...colors.textPrimary);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      let lines = doc.splitTextToSize(ins.text, insightW - 18);
      doc.text(lines, insightX + 14, iy + 1);
    });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('PayPulse Income Tracker | Page 1 of 2', margin, pageHeight - 8);
    doc.text('Generated by PayPulse', pageWidth - margin, pageHeight - 8, { align: 'right' });

    // ========== PAGE 2 ==========
    doc.addPage();

    // Header
    doc.setFillColor(...colors.headerBlue);
    doc.rect(0, 0, pageWidth, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYPULSE', margin, 12);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Monthly Financial Performance Report', margin, 17);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(monthYear, pageWidth - margin, 12, { align: 'right' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Report ID: ' + reportId, pageWidth - margin, 17, { align: 'right' });

    y = 28;

    // --- MONTHLY SUMMARY ---
    doc.setTextColor(...colors.primary);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Monthly Summary', margin, y);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y + 3, contentWidth * 0.55, 45, 3, 3, 'FD');

    doc.setTextColor(...colors.textPrimary);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let summaryText = `During ${monthYear}, you completed ${entries.length} work shift${entries.length > 1 ? 's' : ''} totaling ${totalHours.toFixed(2)} hours.

Your total earnings reached ${sym}${totalGross.toFixed(2)}, while total expenses amounted to ${sym}${totalExp.toFixed(2)}.

This resulted in a net ${totalProfit >= 0 ? 'profit' : 'loss'} of ${sym}${Math.abs(totalProfit).toFixed(2)} for the month.

Although income remained steady, expenses ${totalExp > totalGross ? 'significantly outweighed' : 'were managed within'} earnings. The primary contributors were ${expBreakdown[0] ? expBreakdown[0].name.toLowerCase() : 'fuel'} and personal spending categories.

The report suggests ${totalProfit < 0 ? 'increasing work hours or reducing discretionary spending' : 'maintaining current work patterns'} to improve profitability in future months.`;

    let summaryLines = doc.splitTextToSize(summaryText, contentWidth * 0.5);
    doc.text(summaryLines, margin + 3, y + 10);

    // --- INCOME ANALYSIS ---
    let incomeX = margin + contentWidth * 0.58;
    let incomeY = y;
    let incomeW = contentWidth * 0.42;

    doc.setTextColor(...colors.primary);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Income Analysis', incomeX, incomeY);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(incomeX, incomeY + 3, incomeW, 45, 3, 3, 'FD');

    doc.setTextColor(...colors.textPrimary);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Monthly Income Trend', incomeX + 5, incomeY + 10);

    // Simple trend line
    let sortedEntries = entries.slice().sort((a,b) => new Date(a.date) - new Date(b.date));
    let trendPoints = sortedEntries.map((e, i) => ({
      x: incomeX + 10 + (incomeW - 20) * (i / (sortedEntries.length - 1 || 1)),
      y: incomeY + 35 - (e.net / (totalNet || 1)) * 15
    }));

    doc.setDrawColor(...colors.success);
    doc.setLineWidth(0.5);
    for (let i = 0; i < trendPoints.length - 1; i++) {
      doc.line(trendPoints[i].x, trendPoints[i].y, trendPoints[i+1].x, trendPoints[i+1].y);
    }

    // Best/Avg/Worst cards
    let bestDay = entries.reduce((max,e) => e.net > max.net ? e : max, entries[0]);
    let worstDay = entries.reduce((min,e) => e.net < min.net ? e : min, entries[0]);
    let avgShift = totalNet / entries.length;

    let miniCards = [
      { label: 'Best Earning Day', value: sym + bestDay.net.toFixed(2), sub: new Date(bestDay.date).toLocaleDateString('en-US', {month:'short', day:'numeric'}), color: colors.success },
      { label: 'Average Shift', value: sym + avgShift.toFixed(2), sub: 'per shift', color: colors.primary },
      { label: 'Lowest Earning Day', value: sym + worstDay.net.toFixed(2), sub: new Date(worstDay.date).toLocaleDateString('en-US', {month:'short', day:'numeric'}), color: colors.danger }
    ];

    miniCards.forEach((card, i) => {
      let cx = incomeX + 5 + i * (incomeW/3 - 2);
      let cy = incomeY + 48;
      let cw = incomeW/3 - 4;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...card.color);
      doc.roundedRect(cx, cy, cw, 18, 2, 2, 'FD');

      doc.setTextColor(...card.color);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(card.label, cx + cw/2, cy + 5, { align: 'center' });
      doc.setFontSize(9);
      doc.text(card.value, cx + cw/2, cy + 11, { align: 'center' });
      doc.setFontSize(5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.textSecondary);
      doc.text(card.sub, cx + cw/2, cy + 15, { align: 'center' });
    });

    y += 72;

    // --- EXPENSE ANALYSIS ---
    doc.setTextColor(...colors.primary);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Expense Analysis', margin, y);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y + 3, contentWidth * 0.48, 40, 3, 3, 'FD');

    doc.setTextColor(...colors.textPrimary);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Top Expense Categories', margin + 5, y + 10);

    // Table header
    doc.setFillColor(248, 250, 252);
    doc.rect(margin + 3, y + 13, contentWidth * 0.44, 6, 'F');
    doc.setTextColor(...colors.textSecondary);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('Category', margin + 5, y + 17);
    doc.text('Amount', margin + 50, y + 17, { align: 'right' });
    doc.text('%', margin + 65, y + 17, { align: 'right' });

    expBreakdown.slice(0, 5).forEach((exp, i) => {
      let rowY = y + 22 + i * 5;
      let pct = totalExp > 0 ? Math.round((exp.value / totalExp) * 100) : 0;

      doc.setFillColor(...exp.color);
      doc.rect(margin + 5, rowY - 1, 40 * (pct / 100), 3, 'F');

      doc.setTextColor(...colors.textPrimary);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(exp.name, margin + 5, rowY + 2);
      doc.setFont('helvetica', 'bold');
      doc.text(sym + exp.value.toFixed(2), margin + 50, rowY + 2, { align: 'right' });
      doc.text(pct + '%', margin + 65, rowY + 2, { align: 'right' });
    });

    // --- PRODUCTIVITY ANALYSIS ---
    let prodX = margin + contentWidth * 0.52;
    let prodY = y;
    let prodW = contentWidth * 0.48;

    doc.setTextColor(...colors.primary);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Productivity Analysis', prodX, prodY);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(prodX, prodY + 3, prodW, 40, 3, 3, 'FD');

    let prodMetrics = [
      { label: 'Hours Worked', value: totalHours.toFixed(2) + ' hrs', color: colors.primary },
      { label: 'Income Earned', value: sym + totalNet.toFixed(2), color: colors.success },
      { label: 'Hourly Rate', value: sym + settings.rate.toFixed(2), color: colors.warning },
      { label: 'Cost Per Hour', value: sym + (totalExp/totalHours).toFixed(2), color: colors.danger },
      { label: 'Profit Per Hour', value: sym + avgProfit.toFixed(2), color: totalProfit >= 0 ? colors.success : colors.danger }
    ];

    prodMetrics.forEach((m, i) => {
      let mx = prodX + 5 + (i % 3) * (prodW/3);
      let my = prodY + 12 + Math.floor(i / 3) * 14;

      doc.setFillColor(...m.color);
      doc.circle(mx + 8, my, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(m.value, mx + 8, my + 1.5, { align: 'center' });

      doc.setTextColor(...colors.textSecondary);
      doc.setFontSize(5);
      doc.setFont('helvetica', 'normal');
      doc.text(m.label, mx + 8, my + 10, { align: 'center' });
    });

    y += 48;

    // --- AI RECOMMENDATIONS ---
    doc.setTextColor(...colors.primary);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('5. AI Recommendations', margin, y);

    let recs = [
      { title: 'Increase Income', items: ['Work additional peak hours', 'Target weekends', 'Focus on high-demand shifts', 'Maintain high customer ratings'], color: colors.success, icon: '✓' },
      { title: 'Reduce Expenses', items: ['Limit fuel consumption', 'Combine errands & optimize routes', 'Track recurring subscriptions', 'Reduce non-essential spending'], color: colors.danger, icon: '✓' }
    ];

    recs.forEach((rec, i) => {
      let rx = margin + i * (contentWidth/2 + 3);
      let ry = y + 3;
      let rw = contentWidth/2 - 3;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(rx, ry, rw, 35, 3, 3, 'FD');

      doc.setFillColor(...rec.color);
      doc.circle(rx + 6, ry + 6, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(rec.icon, rx + 6, ry + 7.5, { align: 'center' });

      doc.setTextColor(...rec.color);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(rec.title, rx + 12, ry + 7);

      rec.items.forEach((item, j) => {
        doc.setTextColor(...colors.textPrimary);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text('• ' + item, rx + 5, ry + 14 + j * 5);
      });
    });

    y += 42;

    // --- FUTURE PROJECTION ---
    doc.setTextColor(...colors.primary);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('6. Future Projection', margin, y);
    doc.setTextColor(...colors.textSecondary);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('If current trend continues', margin, y + 5);

    let projections = [
      { label: 'Projected Monthly Income', value: sym + (totalGross * 4.3).toFixed(2), color: colors.success },
      { label: 'Projected Monthly Expenses', value: sym + (totalExp * 4.3).toFixed(2), color: colors.danger },
      { label: 'Projected Monthly Profit', value: sym + (totalProfit * 4.3).toFixed(2), color: totalProfit >= 0 ? colors.success : colors.danger }
    ];

    projections.forEach((proj, i) => {
      let px = margin + i * (contentWidth/3 + 2);
      let py = y + 10;
      let pw = contentWidth/3 - 2;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...proj.color);
      doc.roundedRect(px, py, pw, 18, 2, 2, 'FD');

      doc.setTextColor(...colors.textSecondary);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(proj.label, px + pw/2, py + 5, { align: 'center' });

      doc.setTextColor(...proj.color);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(proj.value, px + pw/2, py + 13, { align: 'center' });
    });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('PayPulse Income Tracker | Page 2 of 2', margin, pageHeight - 8);
    doc.text('Generated by PayPulse', pageWidth - margin, pageHeight - 8, { align: 'right' });

    showLoading(false);
    return doc;
  } catch (err) {
    console.error('Premium PDF error:', err);
    showLoading(false);
    showT('PDF generation failed', true);
    return null;
  }
}

async function exportPDF() {
  let doc = await generatePremiumPDF();
  if (doc) {
    doc.save('paypulse_report_' + new Date().toISOString().split('T')[0] + '.pdf');
    showT('Premium PDF report exported!');
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


// ==================== FIELD MANAGER ====================
// Default field configuration
let fieldConfig = {
  workDetails: [
    { id: 'date', label: 'Date (DDMM)', type: 'date', required: true, editable: false },
    { id: 'time_in', label: 'Time In', type: 'time', required: true, editable: false },
    { id: 'time_out', label: 'Time Out', type: 'time', required: true, editable: false },
    { id: 'km', label: 'KM Driven', type: 'number', step: '0.1', required: false, editable: true },
    { id: 'deliveries', label: 'Deliveries', type: 'number', required: false, editable: true },
    { id: 'fuel_type', label: 'Fuel Type', type: 'select', options: ['regular','premium','diesel'], required: false, editable: true },
    { id: 'fuel', label: 'Fuel Cost ($)', type: 'number', step: '0.01', required: false, editable: true },
    { id: 'tips', label: 'Tips ($)', type: 'number', step: '0.01', required: false, editable: true }
  ],
  personalExpenses: [
    { id: 'grocery', label: 'Grocery', type: 'number', step: '0.01', required: false, editable: true },
    { id: 'phone', label: 'Phone Bill', type: 'number', step: '0.01', required: false, editable: true },
    { id: 'wifi', label: 'WiFi Bill', type: 'number', step: '0.01', required: false, editable: true },
    { id: 'food', label: 'Food/Rest', type: 'number', step: '0.01', required: false, editable: true },
    { id: 'maintenance', label: 'Car Maint', type: 'number', step: '0.01', required: false, editable: true },
    { id: 'insurance', label: 'Insurance', type: 'number', step: '0.01', required: false, editable: true },
    { id: 'misc', label: 'Misc', type: 'number', step: '0.01', required: false, editable: true },
    { id: 'other', label: 'Other', type: 'number', step: '0.01', required: false, editable: true }
  ]
};

let hiddenFields = [];

function loadFieldConfig() {
  let saved = localStorage.getItem('paypulse-field-config');
  if (saved) {
    try {
      let parsed = JSON.parse(saved);
      fieldConfig = parsed.config || fieldConfig;
      hiddenFields = parsed.hidden || [];
      customLabels = parsed.labels || customLabels;
    } catch(e) {}
  }
}

function saveFieldConfig() {
  localStorage.setItem('paypulse-field-config', JSON.stringify({
    config: fieldConfig,
    hidden: hiddenFields,
    labels: customLabels
  }));
}

function showFieldManager() {
  loadFieldConfig();
  renderFieldManager();
  document.getElementById('fieldManagerModal').classList.add('active');
}

function hideFieldManager() {
  document.getElementById('fieldManagerModal').classList.remove('active');
  hideAddFieldForm();
}

function renderFieldManager() {
  let workList = document.getElementById('workDetailsFields');
  let expList = document.getElementById('personalExpensesFields');

  workList.innerHTML = fieldConfig.workDetails.map((f, i) => `
    <div class="field-manager-item ${hiddenFields.includes(f.id) ? 'hidden-field' : ''}" draggable="true" data-section="work" data-index="${i}" data-id="${f.id}">
      <span class="drag-handle">&#8942;&#8942;</span>
      <div class="field-name"><input type="text" value="${f.label}" onchange="renameField('work', ${i}, this.value)" ${!f.editable ? 'disabled' : ''}></div>
      <span class="field-section">Work</span>
      <div class="field-actions">
        <button class="move-btn" onclick="moveField('work', ${i}, 'expense')" title="Move to Expenses">&#11166;</button>
        <button class="hide-btn" onclick="toggleFieldVisibility('${f.id}')" title="${hiddenFields.includes(f.id) ? 'Show' : 'Hide'}">${hiddenFields.includes(f.id) ? '&#128065;' : '&#128065;&#65039;'}</button>
        ${f.editable ? `<button class="delete-btn" onclick="deleteField('work', ${i})" title="Delete">&#128465;</button>` : ''}
      </div>
    </div>
  `).join('');

  expList.innerHTML = fieldConfig.personalExpenses.map((f, i) => `
    <div class="field-manager-item ${hiddenFields.includes(f.id) ? 'hidden-field' : ''}" draggable="true" data-section="expense" data-index="${i}" data-id="${f.id}">
      <span class="drag-handle">&#8942;&#8942;</span>
      <div class="field-name"><input type="text" value="${f.label}" onchange="renameField('expense', ${i}, this.value)"></div>
      <span class="field-section">Expense</span>
      <div class="field-actions">
        <button class="move-btn" onclick="moveField('expense', ${i}, 'work')" title="Move to Work">&#11165;</button>
        <button class="hide-btn" onclick="toggleFieldVisibility('${f.id}')" title="${hiddenFields.includes(f.id) ? 'Show' : 'Hide'}">${hiddenFields.includes(f.id) ? '&#128065;' : '&#128065;&#65039;'}</button>
        <button class="delete-btn" onclick="deleteField('expense', ${i})" title="Delete">&#128465;</button>
      </div>
    </div>
  `).join('');

  // Add drag and drop listeners
  document.querySelectorAll('.field-manager-item').forEach(item => {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);
  });
}

let dragSrc = null;

function handleDragStart(e) {
  dragSrc = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
  if (e.preventDefault) e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) e.stopPropagation();
  if (dragSrc !== this) {
    let srcSection = dragSrc.dataset.section;
    let srcIndex = parseInt(dragSrc.dataset.index);
    let dstSection = this.dataset.section;
    let dstIndex = parseInt(this.dataset.index);

    let item = fieldConfig[srcSection === 'work' ? 'workDetails' : 'personalExpenses'].splice(srcIndex, 1)[0];
    fieldConfig[dstSection === 'work' ? 'workDetails' : 'personalExpenses'].splice(dstIndex, 0, item);
    renderFieldManager();
  }
  return false;
}

function handleDragEnd() {
  this.classList.remove('dragging');
  document.querySelectorAll('.field-manager-item').forEach(item => item.classList.remove('dragging'));
}

function renameField(section, index, newLabel) {
  let arr = section === 'work' ? fieldConfig.workDetails : fieldConfig.personalExpenses;
  arr[index].label = newLabel;
  customLabels[arr[index].id] = newLabel;
}

function moveField(fromSection, index, toSection) {
  let fromArr = fromSection === 'work' ? fieldConfig.workDetails : fieldConfig.personalExpenses;
  let toArr = toSection === 'work' ? fieldConfig.workDetails : fieldConfig.personalExpenses;
  let item = fromArr.splice(index, 1)[0];
  toArr.push(item);
  renderFieldManager();
}

function toggleFieldVisibility(fieldId) {
  if (hiddenFields.includes(fieldId)) {
    hiddenFields = hiddenFields.filter(f => f !== fieldId);
  } else {
    hiddenFields.push(fieldId);
  }
  renderFieldManager();
}

function deleteField(section, index) {
  if (!confirm('Delete this field?')) return;
  let arr = section === 'work' ? fieldConfig.workDetails : fieldConfig.personalExpenses;
  arr.splice(index, 1);
  renderFieldManager();
}

function showAddFieldForm() {
  document.getElementById('addFieldForm').style.display = 'block';
  document.getElementById('newFieldName').value = '';
  document.getElementById('newFieldName').focus();
}

function hideAddFieldForm() {
  document.getElementById('addFieldForm').style.display = 'none';
}

function addNewField() {
  let name = document.getElementById('newFieldName').value.trim();
  let section = document.getElementById('newFieldSection').value;
  let type = document.getElementById('newFieldType').value;
  if (!name) {
    showT('Please enter a field name', true);
    return;
  }
  let id = 'custom_' + Date.now();
  let newField = {
    id: id,
    label: name,
    type: type,
    step: type === 'number' ? '0.01' : null,
    required: false,
    editable: true
  };
  if (section === 'work') {
    fieldConfig.workDetails.push(newField);
  } else {
    fieldConfig.personalExpenses.push(newField);
  }
  hideAddFieldForm();
  renderFieldManager();
  showT('Field added!');
}

async function saveFieldManager() {
  saveFieldConfig();
  renderDynamicForm();
  hideFieldManager();
  showT('Field layout saved!');

  // Also save to server if logged in
  if (currentUser) {
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
          disabled_fields: JSON.stringify(hiddenFields)
        })
      });
    } catch(e) {}
  }
}

// ==================== DYNAMIC FORM RENDERING ====================
function renderDynamicForm() {
  loadFieldConfig();

  // Render Work Details section
  let workGrid = document.querySelector('.form-grid');
  if (workGrid) {
    let workHTML = '';
    fieldConfig.workDetails.forEach(field => {
      if (hiddenFields.includes(field.id)) return;
      let inputHTML = '';
      if (field.type === 'select') {
        inputHTML = `<select class="form-input" id="e_${field.id}">${field.options.map(o => `<option value="${o}">${o.charAt(0).toUpperCase() + o.slice(1)}</option>`).join('')}</select>`;
      } else if (field.type === 'date') {
        inputHTML = `<input type="text" class="form-input" id="e_${field.id}" placeholder="1505" maxlength="4">`;
      } else if (field.type === 'time') {
        inputHTML = `<input type="time" class="form-input" id="e_${field.id}">`;
      } else {
        inputHTML = `<input type="${field.type}" class="form-input" id="e_${field.id}" placeholder="${field.step ? '0.00' : '0'}" step="${field.step || ''}">`;
      }
      workHTML += `
        <div class="form-group ${field.id === 'deliveries' ? 'deliv-field' : ''}" id="group_${field.id}">
          <label class="form-label">${field.label}</label>
          ${inputHTML}
        </div>
      `;
    });
    workGrid.innerHTML = workHTML;
  }

  // Render Personal Expenses section
  let expenseGrid = document.querySelector('.expense-grid');
  if (expenseGrid) {
    let expHTML = '';
    fieldConfig.personalExpenses.forEach(field => {
      if (hiddenFields.includes(field.id)) return;
      expHTML += `
        <div class="expense-item" id="exp_${field.id}">
          <div class="expense-item-label" id="form-label-${field.id}">${field.label}</div>
          <input type="number" class="expense-item-input" id="e_${field.id}" placeholder="0.00" step="0.01">
        </div>
      `;
    });
    expenseGrid.innerHTML = expHTML;
  }

  applyDeliveriesVisibility();
}

// Override addEntry to use dynamic fields
function getFormData() {
  let data = {};
  [...fieldConfig.workDetails, ...fieldConfig.personalExpenses].forEach(field => {
    let el = document.getElementById('e_' + field.id);
    if (el) {
      if (field.type === 'number') {
        data[field.id] = parseFloat(el.value) || 0;
      } else if (field.type === 'date') {
        let raw = el.value.trim();
        let day = raw.substring(0,2);
        let month = raw.substring(2,4);
        let year = new Date().getFullYear();
        data[field.id] = year + '-' + month + '-' + day;
      } else {
        data[field.id] = el.value;
      }
    }
  });
  return data;
}


// ==================== MONTHLY VIEW ====================
let monthlyViewYear = new Date().getFullYear();

function showMonthlyView() {
  monthlyViewYear = new Date().getFullYear();
  renderMonthlyView();
  document.getElementById('monthlyViewModal').classList.add('active');
}

function hideMonthlyView() {
  document.getElementById('monthlyViewModal').classList.remove('active');
}

function renderMonthlyView() {
  let sym = currencySymbols[currency] || '$';
  let body = document.getElementById('monthlyViewBody');

  if (entries.length === 0) {
    body.innerHTML = '<div class="monthly-empty">No shifts recorded yet.</div>';
    return;
  }

  // Group entries by month
  let months = {};
  entries.forEach(e => {
    let d = new Date(e.date);
    let key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (!months[key]) months[key] = [];
    months[key].push(e);
  });

  // Sort months descending (newest first)
  let sortedMonths = Object.keys(months).sort().reverse();

  // Year navigation
  let years = [...new Set(sortedMonths.map(m => m.split('-')[0]))].sort().reverse();
  let navHTML = '<div class="monthly-nav">';
  years.forEach(y => {
    navHTML += `<button class="monthly-nav-btn ${y == monthlyViewYear ? 'active' : ''}" onclick="setMonthlyYear(${y})">${y}</button>`;
  });
  navHTML += '</div>';

  let html = navHTML;

  let hasDataForYear = false;

  sortedMonths.forEach(monthKey => {
    if (!monthKey.startsWith(String(monthlyViewYear))) return;
    hasDataForYear = true;

    let monthEntries = months[monthKey];
    let [year, month] = monthKey.split('-');
    let monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Calculate month totals
    let totalHours = monthEntries.reduce((s, e) => s + e.hours, 0);
    let totalRegHours = monthEntries.reduce((s, e) => s + (e.reg_hours || (e.hours > settings.ot ? settings.ot : e.hours)), 0);
    let totalOTHours = monthEntries.reduce((s, e) => s + (e.ot_hours || (e.hours > settings.ot ? e.hours - settings.ot : 0)), 0);
    let totalGross = monthEntries.reduce((s, e) => s + e.gross, 0);
    let totalTax = monthEntries.reduce((s, e) => s + e.tax, 0);
    let totalNet = monthEntries.reduce((s, e) => s + e.net, 0);
    let totalTips = monthEntries.reduce((s, e) => s + (e.tips || 0), 0);
    let totalKM = monthEntries.reduce((s, e) => s + e.km, 0);
    let totalDeliv = monthEntries.reduce((s, e) => s + e.deliveries, 0);
    let totalFuel = monthEntries.reduce((s, e) => s + (e.fuel || 0), 0);
    let totalExp = monthEntries.reduce((s, e) => s + (e.fuel || 0) + (e.grocery || 0) + (e.phone || 0) + (e.wifi || 0) + (e.food || 0) + (e.maintenance || 0) + (e.insurance || 0) + (e.misc || 0) + (e.other || 0), 0);
    let totalProfit = monthEntries.reduce((s, e) => s + e.daily_profit, 0);
    let otCount = monthEntries.filter(e => e.has_overtime).length;

    html += `
      <div class="monthly-section">
        <div class="monthly-header">
          <div class="monthly-title">${monthName}</div>
          <div class="monthly-stats">
            <span>${monthEntries.length} shifts</span>
            <span>${totalHours.toFixed(2)} hrs</span>
            <span>${sym}${totalNet.toFixed(2)} net</span>
          </div>
        </div>
        <table class="monthly-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>In - Out</th>
              <th style="text-align:center">Reg Hrs</th>
              <th style="text-align:center">OT Hrs</th>
              <th style="text-align:right">Gross</th>
              <th style="text-align:right">Tax</th>
              <th style="text-align:right">Net</th>
              <th style="text-align:right">Tips</th>
              <th style="text-align:center">KM</th>
              <th style="text-align:center">Deliv</th>
              <th style="text-align:right">Fuel</th>
              <th style="text-align:right">Expenses</th>
              <th style="text-align:right">Profit</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${monthEntries.sort((a, b) => new Date(a.date) - new Date(b.date)).map(e => `
              <tr>
                <td class="m-date">${new Date(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                <td class="m-time">${e.time_in} - ${e.time_out}</td>
                <td class="m-hours">${e.hours.toFixed(2)}${e.has_overtime ? '<span class="ot-badge">OT</span>' : ''}</td>
                <td class="m-ot" style="text-align:right">${e.has_overtime ? sym + ((e.ot_hours || (e.hours > settings.ot ? e.hours - settings.ot : 0)) * settings.rate * (settings.otm - 1) * (1 - settings.tax)).toFixed(2) : '-'}</td>
                <td class="m-gross">${sym}${e.gross.toFixed(2)}</td>
                <td class="m-exp">${sym}${e.tax.toFixed(2)}</td>
                <td class="m-net">${sym}${e.net.toFixed(2)}</td>
                <td class="m-net">${sym}${(e.tips || 0).toFixed(2)}</td>
                <td style="text-align:center">${e.km}</td>
                <td style="text-align:center">${e.deliveries}</td>
                <td class="m-exp">${sym}${(e.fuel || 0).toFixed(2)}</td>
                <td class="m-exp">${sym}${((e.fuel || 0) + (e.grocery || 0) + (e.phone || 0) + (e.wifi || 0) + (e.food || 0) + (e.maintenance || 0) + (e.insurance || 0) + (e.misc || 0) + (e.other || 0)).toFixed(2)}</td>
                <td class="m-profit ${e.daily_profit >= 0 ? 'positive' : 'negative'}">${sym}${e.daily_profit.toFixed(2)}</td>
                <td class="m-notes" title="${(e.notes || '').replace(/"/g, '&quot;')}">${e.notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="monthly-summary">
          <div class="monthly-summary-item">
            <div class="label">Total Hours</div>
            <div class="value">${totalHours.toFixed(2)}</div>
          </div>
          <div class="monthly-summary-item">
            <div class="label">Reg / OT</div>
            <div class="value">${totalRegHours.toFixed(2)} / ${totalOTHours.toFixed(2)}</div>
          </div>
          <div class="monthly-summary-item">
            <div class="label">Gross</div>
            <div class="value">${sym}${totalGross.toFixed(2)}</div>
          </div>
          <div class="monthly-summary-item">
            <div class="label">Tax</div>
            <div class="value">${sym}${totalTax.toFixed(2)}</div>
          </div>
          <div class="monthly-summary-item">
            <div class="label">Net + Tips</div>
            <div class="value">${sym}${(totalNet + totalTips).toFixed(2)}</div>
          </div>
          <div class="monthly-summary-item">
            <div class="label">KM / Deliv</div>
            <div class="value">${totalKM.toFixed(0)} / ${totalDeliv}</div>
          </div>
          <div class="monthly-summary-item">
            <div class="label">Fuel</div>
            <div class="value">${sym}${totalFuel.toFixed(2)}</div>
          </div>
          <div class="monthly-summary-item">
            <div class="label">Total Exp</div>
            <div class="value">${sym}${totalExp.toFixed(2)}</div>
          </div>
          <div class="monthly-summary-item">
            <div class="label">Profit</div>
            <div class="value ${totalProfit >= 0 ? 'positive' : 'negative'}">${sym}${totalProfit.toFixed(2)}</div>
          </div>
          <div class="monthly-summary-item">
            <div class="label">OT Shifts</div>
            <div class="value">${otCount}</div>
          </div>
        </div>
      </div>
    `;
  });

  if (!hasDataForYear) {
    html += `<div class="monthly-empty">No shifts recorded for ${monthlyViewYear}.</div>`;
  }

  body.innerHTML = html;
}

function setMonthlyYear(year) {
  monthlyViewYear = year;
  renderMonthlyView();
}

// Close monthly view on overlay click
document.addEventListener('click', function(e) {
  let modal = document.getElementById('monthlyViewModal');
  if (modal && e.target === modal) hideMonthlyView();
});


// ==================== EMAIL EXPORT ====================
function showEmailExport() {
  // Pre-fill with user's email if available
  let emailInput = document.getElementById('emailExportAddress');
  if (currentUser && currentUser.email) {
    emailInput.value = currentUser.email;
  } else {
    emailInput.value = '';
  }
  document.getElementById('emailIncludeReport').checked = true;
  document.getElementById('emailExportStatus').style.display = 'none';
  document.getElementById('emailSendBtn').disabled = false;
  document.getElementById('emailSendBtn').innerHTML = '&#128231; Send Report';
  document.getElementById('emailModal').classList.add('active');
}

function hideEmailExport() {
  document.getElementById('emailModal').classList.remove('active');
}

async function sendEmailReport() {
  let email = document.getElementById('emailExportAddress').value.trim();
  let includeReport = document.getElementById('emailIncludeReport').checked;
  let statusDiv = document.getElementById('emailExportStatus');
  let sendBtn = document.getElementById('emailSendBtn');

  if (!email || !email.includes('@')) {
    statusDiv.textContent = 'Please enter a valid email address';
    statusDiv.className = 'error';
    statusDiv.style.display = 'block';
    return;
  }

  if (entries.length === 0) {
    statusDiv.textContent = 'No data to export';
    statusDiv.className = 'error';
    statusDiv.style.display = 'block';
    return;
  }

  sendBtn.disabled = true;
  sendBtn.innerHTML = 'Generating...';
  statusDiv.style.display = 'none';

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let sym = currencySymbols[currency] || '$';
    let W = doc.internal.pageSize.getWidth();
    let H = doc.internal.pageSize.getHeight();
    let m = 12;
    let cw = W - m * 2;
    let y = 0;

    // === COLORS ===
    let blue = [13, 71, 161];
    let white = [255, 255, 255];
    let dark = [33, 33, 33];
    let gray = [97, 97, 97];
    let lightGray = [158, 158, 158];
    let border = [224, 224, 224];
    let green = [34, 197, 94];
    let red = [239, 68, 68];
    let orange = [249, 115, 22];
    let purple = [139, 92, 246];
    let teal = [20, 184, 166];
    let yellow = [234, 179, 8];
    let pink = [236, 72, 153];
    let cyan = [6, 182, 212];

    // === DATA ===
    let totalGross = entries.reduce((s, e) => s + e.gross, 0);
    let totalNet = entries.reduce((s, e) => s + e.net, 0);
    let totalHours = entries.reduce((s, e) => s + e.hours, 0);
    let totalProfit = entries.reduce((s, e) => s + e.daily_profit, 0);
    let totalTips = entries.reduce((s, e) => s + (e.tips || 0), 0);
    let totalKM = entries.reduce((s, e) => s + e.km, 0);
    let totalDeliv = entries.reduce((s, e) => s + e.deliveries, 0);
    let totalShifts = entries.length;
    let avgHourly = totalHours > 0 ? totalNet / totalHours : 0;
    let avgProfit = entries.length > 0 ? totalProfit / entries.length : 0;
    let otCount = entries.filter(e => e.has_overtime).length;

    let expBreakdown = [
      { name: 'Fuel', value: entries.reduce((s, e) => s + (e.fuel || 0), 0), color: red },
      { name: 'Grocery', value: entries.reduce((s, e) => s + (e.grocery || 0), 0), color: orange },
      { name: 'Phone', value: entries.reduce((s, e) => s + (e.phone || 0), 0), color: [59, 130, 246] },
      { name: 'WiFi', value: entries.reduce((s, e) => s + (e.wifi || 0), 0), color: purple },
      { name: 'Food', value: entries.reduce((s, e) => s + (e.food || 0), 0), color: pink },
      { name: 'Maintenance', value: entries.reduce((s, e) => s + (e.maintenance || 0), 0), color: teal },
      { name: 'Insurance', value: entries.reduce((s, e) => s + (e.insurance || 0), 0), color: cyan },
      { name: 'Misc', value: entries.reduce((s, e) => s + (e.misc || 0), 0), color: yellow },
      { name: 'Other', value: entries.reduce((s, e) => s + (e.other || 0), 0), color: [148, 163, 184] }
    ].filter(e => e.value > 0).sort((a, b) => b.value - a.value);

    let totalExp = expBreakdown.reduce((s, e) => s + e.value, 0);
    let healthScore = Math.min(100, Math.max(0, totalProfit > 0 ? 70 + (totalProfit / totalGross) * 30 : 30 + (totalProfit / totalGross) * 20));
    let healthLabel = healthScore >= 71 ? 'GOOD' : healthScore >= 41 ? 'FAIR' : 'NEEDS ATTENTION';
    let healthColor = healthScore >= 71 ? green : healthScore >= 41 ? orange : red;

    let now = new Date();
    let monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    let reportId = 'PP-' + now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + '-001';
    let genDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    let userName = currentUser ? (currentUser.name || currentUser.username) : 'Guest';

    let sortedEntries = entries.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    let incomeTrend = sortedEntries.map(e => e.gross);
    let expenseTrend = sortedEntries.map(e => (e.fuel || 0) + (e.grocery || 0) + (e.phone || 0) + (e.wifi || 0) + (e.food || 0));

    // === PAGE 1 ===

    // Header bar
    doc.setFillColor(blue[0], blue[1], blue[2]);
    doc.rect(0, 0, W, 22, 'F');
    doc.setTextColor(white[0], white[1], white[2]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYPULSE', m + 18, 11);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Monthly Financial Performance Report', m + 18, 17);
    doc.setFontSize(7);
    doc.text('Prepared for', W - m - 50, 9, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(userName, W - m - 50, 16, { align: 'right' });

    // Sub-header
    y = 22;
    doc.setFillColor(white[0], white[1], white[2]);
    doc.rect(0, y, W, 10, 'F');
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.line(0, y + 10, W, y + 10);
    doc.setFillColor(219, 234, 254);
    doc.roundedRect(m, y + 2, 30, 6, 2, 2, 'F');
    doc.setTextColor(59, 130, 246);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(monthYear, m + 15, y + 6, { align: 'center' });
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated: ' + genDate, m + 38, y + 6);
    doc.text('Report ID: ' + reportId, W - m, y + 6, { align: 'right' });

    y = 38;

    // Health Score (left)
    let lcw = 55;
    doc.setFillColor(white[0], white[1], white[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.roundedRect(m, y, lcw, 52, 3, 3, 'FD');
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('FINANCIAL HEALTH SCORE', m + 5, y + 6);

    // Gauge - draw as horizontal bar instead of arc
    let gx = m + lcw / 2;
    let gy = y + 32;
    let gw = 40;
    let gh = 6;
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(gx - gw/2, gy, gw, gh, 3, 3, 'F');
    doc.setFillColor(healthColor[0], healthColor[1], healthColor[2]);
    doc.roundedRect(gx - gw/2, gy, gw * (healthScore / 100), gh, 3, 3, 'F');

    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(Math.round(healthScore).toString(), gx, gy - 5, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.text('/ 100', gx + 14, gy - 5);
    doc.setTextColor(healthColor[0], healthColor[1], healthColor[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(healthLabel, gx, gy + 14, { align: 'center' });
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    let msg = healthScore >= 71 ? 'You are in a good financial position. Keep optimizing!' : healthScore >= 41 ? 'Your finances need some attention.' : 'Critical: Immediate action needed.';
    let msgLines = doc.splitTextToSize(msg, lcw - 10);
    doc.text(msgLines, gx, gy + 20, { align: 'center' });

    // KPI Cards (right, 2x3 grid)
    let rx = m + lcw + 5;
    let rw = cw - lcw - 5;
    let cw2 = (rw - 10) / 3;
    let ch = 22;
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('KEY PERFORMANCE OVERVIEW', rx, y + 4);

    let kpis = [
      { label: 'Total Income', value: sym + totalGross.toFixed(2), color: green },
      { label: 'Total Expenses', value: sym + totalExp.toFixed(2), color: red },
      { label: 'Net Profit', value: (totalProfit >= 0 ? '+' : '') + sym + totalProfit.toFixed(2), color: totalProfit >= 0 ? green : red },
      { label: 'Hours Worked', value: totalHours.toFixed(2) + ' hrs', color: purple },
      { label: 'Savings Rate', value: totalGross > 0 ? Math.max(0, ((totalGross - totalExp) / totalGross) * 100).toFixed(0) + '%' : '0%', color: orange },
      { label: 'Avg Per Hour', value: sym + avgHourly.toFixed(2), color: [59, 130, 246] }
    ];

    kpis.forEach((kpi, i) => {
      let cx = rx + (i % 3) * (cw2 + 3);
      let cy = y + 7 + Math.floor(i / 3) * (ch + 3);
      doc.setFillColor(white[0], white[1], white[2]);
      doc.setDrawColor(border[0], border[1], border[2]);
      doc.roundedRect(cx, cy, cw2, ch, 3, 3, 'FD');
      doc.setFillColor(250, 250, 250);
      doc.circle(cx + 6, cy + ch/2, 4.5, 'F');
      doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      let icon = kpi.label.includes('Income') ? '+' : kpi.label.includes('Expense') ? '-' : kpi.label.includes('Profit') ? '$' : kpi.label.includes('Hour') ? 'H' : kpi.label.includes('Savings') ? 'S' : '$';
      doc.text(icon, cx + 6, cy + ch/2 + 1.5, { align: 'center' });
      doc.setTextColor(gray[0], gray[1], gray[2]);
      doc.setFontSize(5);
      doc.setFont('helvetica', 'normal');
      doc.text(kpi.label, cx + 14, cy + 6);
      doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.value, cx + 14, cy + 13);
    });

    // Income vs Expenses (bottom left)
    y += 52;
    let chartH = 45;
    let chartW = (cw - 5) / 2;
    doc.setFillColor(white[0], white[1], white[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.roundedRect(m, y, chartW, chartH, 3, 3, 'FD');
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('INCOME VS EXPENSES', m + 5, y + 6);

    let barMax = Math.max(totalGross, totalExp, 1);
    let barScale = (chartH - 22) / barMax;
    let bw = 22;
    let bby = y + chartH - 10;

    let ih = totalGross * barScale;
    doc.setFillColor(green[0], green[1], green[2]);
    doc.roundedRect(m + 15, bby - ih, bw, ih, 2, 2, 'F');
    doc.setTextColor(green[0], green[1], green[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(sym + totalGross.toFixed(2), m + 15 + bw/2, bby - ih - 2, { align: 'center' });
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('Income', m + 15 + bw/2, bby + 3, { align: 'center' });

    let eh = totalExp * barScale;
    doc.setFillColor(red[0], red[1], red[2]);
    doc.roundedRect(m + 50, bby - eh, bw, eh, 2, 2, 'F');
    doc.setTextColor(red[0], red[1], red[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(sym + totalExp.toFixed(2), m + 50 + bw/2, bby - eh - 2, { align: 'center' });
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(6);
    doc.text('Expenses', m + 50 + bw/2, bby + 3, { align: 'center' });

    let diff = Math.abs(totalProfit);
    let diffText = totalProfit >= 0 ? 'You saved ' + sym + diff.toFixed(2) + ' this month.' : 'You spent ' + sym + diff.toFixed(2) + ' more than you earned.';
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(m + 5, y + chartH - 18, chartW - 10, 8, 2, 2, 'F');
    doc.setTextColor(red[0], red[1], red[2]);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.text('! ' + diffText, m + chartW/2, y + chartH - 13, { align: 'center' });

    // Cash Flow Trend (bottom right)
    let c2x = m + chartW + 5;
    doc.setFillColor(white[0], white[1], white[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.roundedRect(c2x, y, chartW, chartH, 3, 3, 'FD');
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('CASH FLOW TREND', c2x + 5, y + 6);

    let lx = c2x + 8;
    let ly = y + 16;
    let lw = chartW - 16;
    let lh = chartH - 28;
    doc.setDrawColor(240, 240, 240);
    doc.setLineWidth(0.15);
    for (let g = 0; g <= 3; g++) {
      let gy2 = ly + (lh / 3) * g;
      doc.line(lx, gy2, lx + lw, gy2);
    }

    if (incomeTrend.length >= 2) {
      let minI = Math.min(...incomeTrend);
      let maxI = Math.max(...incomeTrend);
      let rangeI = maxI - minI || 1;
      let stepI = lw / (incomeTrend.length - 1);
      doc.setDrawColor(green[0], green[1], green[2]);
      doc.setLineWidth(0.5);
      for (let i = 0; i < incomeTrend.length - 1; i++) {
        doc.line(lx + i * stepI, ly + lh - ((incomeTrend[i] - minI) / rangeI) * lh,
                 lx + (i + 1) * stepI, ly + lh - ((incomeTrend[i + 1] - minI) / rangeI) * lh);
      }
    }

    if (expenseTrend.length >= 2) {
      let minE = Math.min(...expenseTrend);
      let maxE = Math.max(...expenseTrend);
      let rangeE = maxE - minE || 1;
      let stepE = lw / (expenseTrend.length - 1);
      doc.setDrawColor(red[0], red[1], red[2]);
      doc.setLineWidth(0.5);
      for (let i = 0; i < expenseTrend.length - 1; i++) {
        doc.line(lx + i * stepE, ly + lh - ((expenseTrend[i] - minE) / rangeE) * lh,
                 lx + (i + 1) * stepE, ly + lh - ((expenseTrend[i + 1] - minE) / rangeE) * lh);
      }
    }

    doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.setFontSize(5);
    let weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    weeks.forEach((w, i) => {
      doc.text(w, lx + (lw / 3) * i, y + chartH - 4, { align: 'center' });
    });

    // Expense Breakdown (bottom left 2nd row)
    y += chartH + 5;
    let bh = 55;
    let dw = (cw - 5) / 2;
    doc.setFillColor(white[0], white[1], white[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.roundedRect(m, y, dw, bh, 3, 3, 'FD');
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('EXPENSE BREAKDOWN', m + 5, y + 6);

    // Simple horizontal bars instead of donut
    let legendX = m + 5;
    let legendY = y + 14;
    expBreakdown.slice(0, 5).forEach((exp, i) => {
      let ly2 = legendY + i * 8;
      let pct = totalExp > 0 ? Math.round((exp.value / totalExp) * 100) : 0;
      doc.setFillColor(240, 240, 240);
      doc.roundedRect(legendX, ly2 - 1, dw - 10, 3, 1, 1, 'F');
      if (pct > 0) {
        doc.setFillColor(exp.color[0], exp.color[1], exp.color[2]);
        doc.roundedRect(legendX, ly2 - 1, (dw - 10) * (pct / 100), 3, 1, 1, 'F');
      }
      doc.setTextColor(dark[0], dark[1], dark[2]);
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(exp.name, legendX + 3, ly2 + 3.5);
      doc.setFont('helvetica', 'bold');
      doc.text(sym + exp.value.toFixed(2), legendX + dw - 35, ly2 + 3.5, { align: 'right' });
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(pct + '%', legendX + dw - 8, ly2 + 3.5, { align: 'right' });
    });

    // Total
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Expenses', m + 5, y + bh - 8);
    doc.text(sym + totalExp.toFixed(2), m + dw - 5, y + bh - 8, { align: 'right' });

    // AI Insights (bottom right 2nd row)
    let ix = m + dw + 5;
    doc.setFillColor(white[0], white[1], white[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.roundedRect(ix, y, cw - dw - 5, bh, 3, 3, 'FD');
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('AI QUICK INSIGHTS', ix + 5, y + 6);

    let insights = [
      { text: 'Expenses exceeded income by ' + sym + diff.toFixed(2) + ' this month.', color: red, bg: [254, 226, 226] },
      { text: 'Fuel accounted for ' + (expBreakdown[0] ? Math.round((expBreakdown[0].value/totalExp)*100) : 0) + '% of your total spending.', color: orange, bg: [255, 237, 213] },
      { text: 'Your average earnings per hour were ' + sym + avgHourly.toFixed(2) + '.', color: green, bg: [220, 252, 231] },
      { text: 'Reducing discretionary spending by 15% could improve your monthly cash flow.', color: [59, 130, 246], bg: [219, 234, 254] }
    ];

    insights.forEach((ins, i) => {
      let iy = y + 14 + i * 10;
      doc.setFillColor(ins.bg[0], ins.bg[1], ins.bg[2]);
      doc.roundedRect(ix + 5, iy - 4, 6, 6, 1.5, 1.5, 'F');
      doc.setTextColor(ins.color[0], ins.color[1], ins.color[2]);
      doc.setFontSize(5);
      doc.setFont('helvetica', 'bold');
      doc.text('i', ix + 8, iy, { align: 'center' });
      doc.setTextColor(dark[0], dark[1], dark[2]);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      let lines = doc.splitTextToSize(ins.text, cw - dw - 20);
      doc.text(lines, ix + 14, iy);
    });

    // Footer
    doc.setFontSize(6);
    doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('PayPulse Income Tracker', m, H - 6);
    doc.text('Page 1 of 2', W - m, H - 6, { align: 'right' });

    // === PAGE 2 ===
    doc.addPage();

    // Header
    doc.setFillColor(blue[0], blue[1], blue[2]);
    doc.rect(0, 0, W, 18, 'F');
    doc.setTextColor(white[0], white[1], white[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYPULSE', m + 18, 9);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('Monthly Financial Performance Report', m + 18, 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(monthYear, W - m, 9, { align: 'right' });
    doc.setFontSize(5.5);
    doc.text('Report ID: ' + reportId, W - m, 14, { align: 'right' });

    y = 24;

    // Monthly Summary (left)
    let sw = cw * 0.52;
    let sh = 55;
    doc.setFillColor(white[0], white[1], white[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.roundedRect(m, y, sw, sh, 3, 3, 'FD');
    doc.setTextColor(blue[0], blue[1], blue[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('1. MONTHLY SUMMARY', m + 5, y + 6);
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    let summaryText = 'During ' + monthYear + ', you completed ' + totalShifts + ' work shift' + (totalShifts > 1 ? 's' : '') + ' totaling ' + totalHours.toFixed(2) + ' hours. Your total earnings reached ' + sym + totalGross.toFixed(2) + ', while total expenses amounted to ' + sym + totalExp.toFixed(2) + '. This resulted in a net ' + (totalProfit >= 0 ? 'profit' : 'loss') + ' of ' + sym + Math.abs(totalProfit).toFixed(2) + ' for the month.';
    let sumLines = doc.splitTextToSize(summaryText, sw - 10);
    doc.text(sumLines, m + 5, y + 14);

    // Income Analysis (right)
    let iw = cw - sw - 5;
    doc.setFillColor(white[0], white[1], white[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.roundedRect(m + sw + 5, y, iw, sh, 3, 3, 'FD');
    doc.setTextColor(blue[0], blue[1], blue[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('2. INCOME ANALYSIS', m + sw + 10, y + 6);
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Income Trend', m + sw + 10, y + 12);

    let tx = m + sw + 10;
    let ty = y + 15;
    let tw = iw - 15;
    let th = 22;
    doc.setDrawColor(240, 240, 240);
    doc.setLineWidth(0.15);
    for (let g = 0; g <= 3; g++) {
      doc.line(tx, ty + (th / 3) * g, tx + tw, ty + (th / 3) * g);
    }

    if (sortedEntries.length >= 2) {
      let netData = sortedEntries.map(e => e.net);
      let minN = Math.min(...netData);
      let maxN = Math.max(...netData);
      let rangeN = maxN - minN || 1;
      let stepN = tw / (netData.length - 1);
      doc.setDrawColor(green[0], green[1], green[2]);
      doc.setLineWidth(0.5);
      for (let i = 0; i < netData.length - 1; i++) {
        doc.line(tx + i * stepN, ty + th - ((netData[i] - minN) / rangeN) * th,
                 tx + (i + 1) * stepN, ty + th - ((netData[i + 1] - minN) / rangeN) * th);
      }
    }

    doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.setFontSize(4.5);
    doc.setFont('helvetica', 'normal');
    let dateLabels = sortedEntries.map(e => new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    dateLabels.forEach((d, i) => {
      if (i % Math.ceil(dateLabels.length / 4) === 0) {
        doc.text(d, tx + (tw / (dateLabels.length - 1 || 1)) * i, ty + th + 3, { align: 'center' });
      }
    });

    // Best/Avg/Worst cards
    let bestDay = entries.reduce((max, e) => e.net > max.net ? e : max, entries[0]);
    let worstDay = entries.reduce((min, e) => e.net < min.net ? e : min, entries[0]);
    let avgShift = totalNet / entries.length;

    let miniCards = [
      { label: 'Best Day', value: sym + bestDay.net.toFixed(2), sub: new Date(bestDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: green },
      { label: 'Average', value: sym + avgShift.toFixed(2), sub: 'per shift', color: [59, 130, 246] },
      { label: 'Lowest', value: sym + worstDay.net.toFixed(2), sub: new Date(worstDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: red }
    ];

    let mcw = (iw - 14) / 3;
    miniCards.forEach((card, i) => {
      let cx = m + sw + 10 + i * (mcw + 2);
      let cy = y + sh - 14;
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(card.color[0], card.color[1], card.color[2]);
      doc.roundedRect(cx, cy, mcw, 12, 2, 2, 'FD');
      doc.setTextColor(card.color[0], card.color[1], card.color[2]);
      doc.setFontSize(5);
      doc.setFont('helvetica', 'bold');
      doc.text(card.label, cx + mcw/2, cy + 4, { align: 'center' });
      doc.setFontSize(8);
      doc.text(card.value, cx + mcw/2, cy + 9, { align: 'center' });
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.setFontSize(4);
      doc.setFont('helvetica', 'normal');
      doc.text(card.sub, cx + mcw/2, cy + 12, { align: 'center' });
    });

    // Expense Analysis (left)
    y += 60;
    let ew = cw * 0.48;
    let eh = 45;
    doc.setFillColor(white[0], white[1], white[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.roundedRect(m, y, ew, eh, 3, 3, 'FD');
    doc.setTextColor(blue[0], blue[1], blue[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('3. EXPENSE ANALYSIS', m + 5, y + 6);

    doc.setFillColor(250, 250, 250);
    doc.rect(m + 3, y + 10, ew - 6, 5, 'F');
    doc.setTextColor(gray[0], gray[1], gray[2]);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Category', m + 6, y + 13);
    doc.text('Amount', m + ew - 35, y + 13, { align: 'right' });
    doc.text('%', m + ew - 8, y + 13, { align: 'right' });

    expBreakdown.slice(0, 5).forEach((exp, i) => {
      let ry = y + 18 + i * 5.5;
      let pct = totalExp > 0 ? Math.round((exp.value / totalExp) * 100) : 0;
      doc.setFillColor(240, 240, 240);
      doc.roundedRect(m + 3, ry - 1, ew - 6, 3, 1, 1, 'F');
      if (pct > 0) {
        doc.setFillColor(exp.color[0], exp.color[1], exp.color[2]);
        doc.roundedRect(m + 3, ry - 1, (ew - 6) * (pct / 100), 3, 1, 1, 'F');
      }
      doc.setTextColor(dark[0], dark[1], dark[2]);
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(exp.name, m + 6, ry + 3.5);
      doc.setFont('helvetica', 'bold');
      doc.text(sym + exp.value.toFixed(2), m + ew - 35, ry + 3.5, { align: 'right' });
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(pct + '%', m + ew - 8, ry + 3.5, { align: 'right' });
    });

    // Productivity Analysis (right)
    let pw = cw - ew - 5;
    doc.setFillColor(white[0], white[1], white[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.roundedRect(m + ew + 5, y, pw, eh, 3, 3, 'FD');
    doc.setTextColor(blue[0], blue[1], blue[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('4. PRODUCTIVITY ANALYSIS', m + ew + 10, y + 6);

    let prodMetrics = [
      { label: 'Hours', value: totalHours.toFixed(2), color: green },
      { label: 'Income', value: sym + totalNet.toFixed(2), color: [59, 130, 246] },
      { label: 'Rate', value: sym + settings.rate.toFixed(2), color: orange },
      { label: 'Cost/Hr', value: sym + (totalExp / totalHours).toFixed(2), color: red },
      { label: 'Profit/Hr', value: sym + avgProfit.toFixed(2), color: totalProfit >= 0 ? green : red }
    ];

    let mw = (pw - 10) / 5;
    prodMetrics.forEach((m2, i) => {
      let mx = m + ew + 10 + i * mw;
      let my = y + 14;
      // Simple bar instead of gauge
      let barW = mw - 4;
      let barH = 4;
      doc.setFillColor(240, 240, 240);
      doc.roundedRect(mx + 2, my, barW, barH, 2, 2, 'F');
      doc.setFillColor(m2.color[0], m2.color[1], m2.color[2]);
      doc.roundedRect(mx + 2, my, barW * 0.7, barH, 2, 2, 'F');
      doc.setTextColor(dark[0], dark[1], dark[2]);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(m2.value, mx + mw/2, my + 10, { align: 'center' });
      doc.setTextColor(gray[0], gray[1], gray[2]);
      doc.setFontSize(4.5);
      doc.setFont('helvetica', 'normal');
      doc.text(m2.label, mx + mw/2, my + 14, { align: 'center' });
    });

    // AI Recommendations
    y += eh + 5;
    let rh = 38;
    let rw = (cw - 5) / 2;

    let recs = [
      { title: 'Increase Income', items: ['Work additional peak hours', 'Target high-demand periods', 'Focus on weekends', 'Increase productive work time', 'Maintain high ratings'], color: green },
      { title: 'Reduce Expenses', items: ['Reduce fuel consumption', 'Optimize delivery routes', 'Track recurring subscriptions', 'Minimize non-essential spending', 'Plan and combine errands'], color: red }
    ];

    recs.forEach((rec, i) => {
      let rx = m + i * (rw + 5);
      let ry = y;
      doc.setFillColor(white[0], white[1], white[2]);
      doc.setDrawColor(border[0], border[1], border[2]);
      doc.roundedRect(rx, ry, rw, rh, 3, 3, 'FD');
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(rx + 5, ry + 5, 5, 5, 1.5, 1.5, 'F');
      doc.setTextColor(rec.color[0], rec.color[1], rec.color[2]);
      doc.setFontSize(5);
      doc.setFont('helvetica', 'bold');
      doc.text('>', rx + 7.5, ry + 8, { align: 'center' });
      doc.setFontSize(7);
      doc.text(rec.title, rx + 13, ry + 8);
      rec.items.forEach((item, j) => {
        let iy = ry + 15 + j * 4.5;
        doc.setTextColor(green[0], green[1], green[2]);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'bold');
        doc.text('+', rx + 6, iy);
        doc.setTextColor(dark[0], dark[1], dark[2]);
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.text(item, rx + 10, iy);
      });
    });

    // Future Projection
    y += rh + 5;
    let ph = 38;
    doc.setFillColor(white[0], white[1], white[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.roundedRect(m, y, cw, ph, 3, 3, 'FD');
    doc.setTextColor(blue[0], blue[1], blue[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('6. FUTURE PROJECTION', m + 5, y + 6);
    doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.text('If current trend continues', m + 5, y + 10);

    let projM = 4.3;
    let projs = [
      { label: 'Projected Monthly Income', value: sym + (totalGross * projM).toFixed(2), color: green },
      { label: 'Projected Monthly Expenses', value: sym + (totalExp * projM).toFixed(2), color: red },
      { label: 'Projected Monthly Profit', value: sym + (totalProfit * projM).toFixed(2), color: totalProfit >= 0 ? green : red }
    ];

    let pcw = (cw - 20) / 3;
    projs.forEach((proj, i) => {
      let px = m + 5 + i * (pcw + 3);
      let py = y + 14;
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(proj.color[0], proj.color[1], proj.color[2]);
      doc.roundedRect(px, py, pcw, 16, 2, 2, 'FD');
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.setFontSize(5);
      doc.setFont('helvetica', 'normal');
      doc.text(proj.label, px + pcw/2, py + 5, { align: 'center' });
      doc.setTextColor(proj.color[0], proj.color[1], proj.color[2]);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(proj.value, px + pcw/2, py + 12, { align: 'center' });
    });

    // Footer
    doc.setFontSize(6);
    doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('PayPulse Income Tracker', m, H - 6);
    doc.text('Page 2 of 2', W - m, H - 6, { align: 'right' });

    // === SEND ===
    let pdfBase64 = doc.output('datauristring').split(',')[1];

    sendBtn.innerHTML = 'Sending...';
    let reportText = includeReport ? generateAIReport() : '';

    let res = await fetch('/api/email-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, pdf_base64: pdfBase64, report_text: reportText })
    });

    let data = await res.json();
    if (data.success) {
      statusDiv.textContent = 'Report sent to ' + email;
      statusDiv.className = 'success';
      statusDiv.style.display = 'block';
      sendBtn.innerHTML = 'Sent!';
      setTimeout(() => { hideEmailExport(); showT('Report emailed successfully!'); }, 2000);
    } else {
      statusDiv.textContent = data.error || 'Failed to send email';
      statusDiv.className = 'error';
      statusDiv.style.display = 'block';
      sendBtn.disabled = false;
      sendBtn.innerHTML = 'Try Again';
    }
  } catch (err) {
    console.error('Email report error:', err);
    statusDiv.textContent = 'Failed: ' + (err.message || 'Unknown error');
    statusDiv.className = 'error';
    statusDiv.style.display = 'block';
    sendBtn.disabled = false;
    sendBtn.innerHTML = 'Try Again';
  }
}

// Close email modal on overlay click
document.addEventListener('click', function(e) {
  let emailModal = document.getElementById('emailModal');
  if (emailModal && e.target === emailModal) hideEmailExport();
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
