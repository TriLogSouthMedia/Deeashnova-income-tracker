const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'paypulse-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Database setup
const db = new sqlite3.Database('./paypulse.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    security_question TEXT DEFAULT '',
    security_answer TEXT DEFAULT '',
    hourly_rate REAL DEFAULT 17.85,
    tax_rate REAL DEFAULT 0.12,
    ot_threshold REAL DEFAULT 8,
    ot_multiplier REAL DEFAULT 1.5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    time_in TEXT NOT NULL,
    time_out TEXT NOT NULL,
    hours REAL NOT NULL,
    has_overtime INTEGER DEFAULT 0,
    gross REAL NOT NULL,
    tax REAL NOT NULL,
    net REAL NOT NULL,
    km REAL DEFAULT 0,
    deliveries INTEGER DEFAULT 0,
    fuel_type TEXT DEFAULT 'regular',
    fuel REAL DEFAULT 0,
    grocery REAL DEFAULT 0,
    phone REAL DEFAULT 0,
    wifi REAL DEFAULT 0,
    food REAL DEFAULT 0,
    maintenance REAL DEFAULT 0,
    insurance REAL DEFAULT 0,
    misc REAL DEFAULT 0,
    other REAL DEFAULT 0,
    daily_profit REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
});

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/register', (req, res) => {
  const { username, password, security_question, security_answer } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username.length < 3 || password.length < 4) {
    return res.status(400).json({ error: 'Username: 3+ chars, Password: 4+ chars' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const hashedAnswer = security_answer ? bcrypt.hashSync(security_answer.toLowerCase().trim(), 10) : '';

  db.run('INSERT INTO users (username, password, security_question, security_answer) VALUES (?, ?, ?, ?)', 
    [username, hashedPassword, security_question || '', hashedAnswer], 
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Username already exists' });
        }
        return res.status(500).json({ error: 'Registration failed' });
      }
      req.session.userId = this.lastID;
      db.get('SELECT id, username, hourly_rate, tax_rate, ot_threshold, ot_multiplier FROM users WHERE id = ?',
        [this.lastID],
        (err, user) => {
          if (err || !user) {
            return res.json({ success: true, message: 'Account created!', userId: this.lastID });
          }
          res.json({ success: true, message: 'Account created!', user: user });
        }
      );
    }
  );
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    req.session.userId = user.id;
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        username: user.username,
        hourly_rate: user.hourly_rate,
        tax_rate: user.tax_rate,
        ot_threshold: user.ot_threshold,
        ot_multiplier: user.ot_multiplier
      }
    });
  });
});

// Check username exists
app.post('/api/check-user', (req, res) => {
  const { username } = req.body;
  db.get('SELECT security_question FROM users WHERE username = ?', [username], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Username not found' });
    res.json({ success: true, security_question: row.security_question });
  });
});

// Verify security answer
app.post('/api/verify-answer', (req, res) => {
  const { username, answer } = req.body;
  db.get('SELECT security_answer FROM users WHERE username = ?', [username], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Username not found' });
    if (!row.security_answer) return res.status(400).json({ error: 'No security question set' });
    if (bcrypt.compareSync(answer.toLowerCase().trim(), row.security_answer)) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Incorrect answer' });
    }
  });
});

// Reset password
app.post('/api/reset-password', (req, res) => {
  const { username, new_password } = req.body;
  if (!new_password || new_password.length < 4) {
    return res.status(400).json({ error: 'Password must be 4+ characters' });
  }
  const hashedPassword = bcrypt.hashSync(new_password, 10);
  db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to reset password' });
    res.json({ success: true, message: 'Password reset successfully!' });
  });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get current user
app.get('/api/me', requireAuth, (req, res) => {
  db.get('SELECT id, username, hourly_rate, tax_rate, ot_threshold, ot_multiplier FROM users WHERE id = ?', 
    [req.session.userId], 
    (err, user) => {
      if (err || !user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    }
  );
});

// Update settings
app.put('/api/settings', requireAuth, (req, res) => {
  const { hourly_rate, tax_rate, ot_threshold, ot_multiplier } = req.body;
  db.run(
    'UPDATE users SET hourly_rate = ?, tax_rate = ?, ot_threshold = ?, ot_multiplier = ? WHERE id = ?',
    [hourly_rate, tax_rate, ot_threshold, ot_multiplier, req.session.userId],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update settings' });
      res.json({ success: true });
    }
  );
});

// ==================== SHIFT ROUTES ====================

// Add shift
app.post('/api/shifts', requireAuth, (req, res) => {
  const s = req.body;
  db.run(
    `INSERT INTO shifts (user_id, date, time_in, time_out, hours, has_overtime, gross, tax, net, 
     km, deliveries, fuel_type, fuel, grocery, phone, wifi, food, maintenance, insurance, misc, other, daily_profit, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.session.userId, s.date, s.time_in, s.time_out, s.hours, s.has_overtime ? 1 : 0, s.gross, s.tax, s.net,
     s.km, s.deliveries, s.fuel_type, s.fuel, s.grocery, s.phone, s.wifi, s.food, s.maintenance, s.insurance, s.misc, s.other, s.daily_profit, s.notes],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to save shift' });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Get all shifts
app.get('/api/shifts', requireAuth, (req, res) => {
  db.all('SELECT * FROM shifts WHERE user_id = ? ORDER BY date DESC, created_at DESC', 
    [req.session.userId], 
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch shifts' });
      res.json(rows);
    }
  );
});

// Update shift
app.put('/api/shifts/:id', requireAuth, (req, res) => {
  const s = req.body;
  db.run(
    `UPDATE shifts SET date = ?, time_in = ?, time_out = ?, hours = ?, has_overtime = ?, gross = ?, tax = ?, net = ?,
     km = ?, deliveries = ?, fuel_type = ?, fuel = ?, grocery = ?, phone = ?, wifi = ?, food = ?, maintenance = ?, insurance = ?, misc = ?, other = ?, daily_profit = ?, notes = ?
     WHERE id = ? AND user_id = ?`,
    [s.date, s.time_in, s.time_out, s.hours, s.has_overtime ? 1 : 0, s.gross, s.tax, s.net,
     s.km, s.deliveries, s.fuel_type, s.fuel, s.grocery, s.phone, s.wifi, s.food, s.maintenance, s.insurance, s.misc, s.other, s.daily_profit, s.notes, req.params.id, req.session.userId],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update shift' });
      res.json({ success: true });
    }
  );
});

// Delete shift
app.delete('/api/shifts/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM shifts WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to delete shift' });
    res.json({ success: true });
  });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`PayPulse running on port ${PORT}`);
});
