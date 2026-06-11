const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;

// Resend email
const resend = new Resend(process.env.RESEND_API_KEY);

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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

// Database setup - create tables if they don't exist
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        security_question TEXT DEFAULT '',
        security_answer TEXT DEFAULT '',
        hourly_rate REAL DEFAULT 17.85,
        tax_rate REAL DEFAULT 0.12,
        ot_threshold REAL DEFAULT 8,
        ot_multiplier REAL DEFAULT 1.5,
        currency TEXT DEFAULT 'CAD',
        disabled_fields TEXT DEFAULT '[]',
        name TEXT DEFAULT '',
        email TEXT DEFAULT '',
        workplace TEXT DEFAULT '',
        dob TEXT DEFAULT '',
        profile_photo TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        time_in TEXT NOT NULL,
        time_out TEXT NOT NULL,
        hours REAL NOT NULL,
        has_overtime INTEGER DEFAULT 0,
        gross REAL NOT NULL,
        tax REAL NOT NULL,
        net REAL NOT NULL,
        tips REAL DEFAULT 0,
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('PayPulse database initialized');
  } finally {
    client.release();
  }
}

initDB().catch(err => console.error('DB init error:', err));

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
app.post('/api/register', async (req, res) => {
  const { username, password, security_question, security_answer } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username.length < 3 || password.length < 4) {
    return res.status(400).json({ error: 'Username: 3+ chars, Password: 4+ chars' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const hashedAnswer = security_answer ? bcrypt.hashSync(security_answer.toLowerCase().trim(), 10) : '';

  try {
    const result = await pool.query(
      'INSERT INTO users (username, password, security_question, security_answer) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, hashedPassword, security_question || '', hashedAnswer]
    );
    const userId = result.rows[0].id;
    req.session.userId = userId;

    const userResult = await pool.query(
      'SELECT id, username, hourly_rate, tax_rate, ot_threshold, ot_multiplier FROM users WHERE id = $1',
      [userId]
    );
    res.json({ success: true, message: 'Account created!', user: userResult.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
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
        ot_multiplier: user.ot_multiplier,
        currency: user.currency || 'CAD',
        disabled_fields: user.disabled_fields || '[]'
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get current user
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, hourly_rate, tax_rate, ot_threshold, ot_multiplier FROM users WHERE id = $1',
      [req.session.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update settings
app.put('/api/settings', requireAuth, async (req, res) => {
  const { hourly_rate, tax_rate, ot_threshold, ot_multiplier, currency, disabled_fields } = req.body;
  try {
    await pool.query(
      'UPDATE users SET hourly_rate = $1, tax_rate = $2, ot_threshold = $3, ot_multiplier = $4, currency = $5, disabled_fields = $6 WHERE id = $7',
      [hourly_rate, tax_rate, ot_threshold, ot_multiplier, currency || 'CAD', disabled_fields || '[]', req.session.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ==================== FORGOT PASSWORD ====================

// Check username exists
app.post('/api/check-user', async (req, res) => {
  const { username } = req.body;
  try {
    const result = await pool.query('SELECT security_question FROM users WHERE username = $1', [username]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Username not found' });
    res.json({ success: true, security_question: result.rows[0].security_question });
  } catch (err) {
    console.error('Check user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify security answer
app.post('/api/verify-answer', async (req, res) => {
  const { username, answer } = req.body;
  try {
    const result = await pool.query('SELECT security_answer FROM users WHERE username = $1', [username]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Username not found' });
    if (!result.rows[0].security_answer) return res.status(400).json({ error: 'No security question set' });
    if (bcrypt.compareSync(answer.toLowerCase().trim(), result.rows[0].security_answer)) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Incorrect answer' });
    }
  } catch (err) {
    console.error('Verify answer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
  const { username, new_password } = req.body;
  if (!new_password || new_password.length < 4) {
    return res.status(400).json({ error: 'Password must be 4+ characters' });
  }
  const hashedPassword = bcrypt.hashSync(new_password, 10);
  try {
    await pool.query('UPDATE users SET password = $1 WHERE username = $2', [hashedPassword, username]);
    res.json({ success: true, message: 'Password reset successfully!' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});


// Update profile
app.put('/api/profile', requireAuth, async (req, res) => {
  const { name, email, workplace, dob, profile_photo } = req.body;
  try {
    await pool.query(
      'UPDATE users SET name = $1, email = $2, workplace = $3, dob = $4, profile_photo = $5 WHERE id = $6',
      [name || '', email || '', workplace || '', dob || '', profile_photo || '', req.session.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ==================== SHIFT ROUTES ====================

// Add shift
app.post('/api/shifts', requireAuth, async (req, res) => {
  const s = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO shifts (user_id, date, time_in, time_out, hours, has_overtime, gross, tax, net,
       km, deliveries, fuel_type, fuel, tips, grocery, phone, wifi, food, maintenance, insurance, misc, other, daily_profit, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
       RETURNING id`,
      [req.session.userId, s.date, s.time_in, s.time_out, s.hours, s.has_overtime ? 1 : 0, s.gross, s.tax, s.net,
       s.km, s.deliveries, s.fuel_type, s.fuel, s.tips || 0, s.grocery, s.phone, s.wifi, s.food, s.maintenance, s.insurance, s.misc, s.other, s.daily_profit, s.notes]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Add shift error:', err);
    res.status(500).json({ error: 'Failed to save shift' });
  }
});

// Get all shifts
app.get('/api/shifts', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM shifts WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
      [req.session.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get shifts error:', err);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// Update shift
app.put('/api/shifts/:id', requireAuth, async (req, res) => {
  const s = req.body;
  try {
    await pool.query(
      `UPDATE shifts SET date = $1, time_in = $2, time_out = $3, hours = $4, has_overtime = $5, gross = $6, tax = $7, net = $8,
       km = $9, deliveries = $10, fuel_type = $11, fuel = $12, tips = $13, grocery = $14, phone = $15, wifi = $16, food = $17, maintenance = $18, insurance = $19, misc = $20, other = $21, daily_profit = $22, notes = $23
       WHERE id = $24 AND user_id = $25`,
      [s.date, s.time_in, s.time_out, s.hours, s.has_overtime ? 1 : 0, s.gross, s.tax, s.net,
       s.km, s.deliveries, s.fuel_type, s.fuel, s.tips || 0, s.grocery, s.phone, s.wifi, s.food, s.maintenance, s.insurance, s.misc, s.other, s.daily_profit, s.notes, req.params.id, req.session.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update shift error:', err);
    res.status(500).json({ error: 'Failed to update shift' });
  }
});

// Delete shift
app.delete('/api/shifts/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM shifts WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete shift error:', err);
    res.status(500).json({ error: 'Failed to delete shift' });
  }
});

// ==================== EMAIL EXPORT ====================
// NOTE: To use your own domain, verify it at resend.com and update the 'from' address below.
// For testing, Resend provides onboarding@resend.dev (no domain verification needed).
app.post('/api/email-report', requireAuth, async (req, res) => {
  const { email, pdf_base64, report_text } = req.body;

  if (!email || !pdf_base64) {
    return res.status(400).json({ error: 'Email and PDF data required' });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'PayPulse <onboarding@resend.dev>',
      to: [email],
      subject: 'Your PayPulse Worksheet Report',
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#1a1a2e">📊 PayPulse Worksheet Report</h2>
          <p style="color:#5a5a7a">Hi ${req.session.userId ? 'there' : ''},</p>
          <p style="color:#5a5a7a">Your worksheet report is attached as a PDF. Here's a quick summary:</p>
          <pre style="background:#f0f2f5;padding:15px;border-radius:8px;font-size:13px;overflow-x:auto;color:#1a1a2e">${report_text ? report_text.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'No summary available.'}</pre>
          <p style="color:#5a5a7a;margin-top:20px">Keep tracking your shifts with PayPulse!</p>
          <hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0">
          <p style="color:#aaa;font-size:12px">Sent from PayPulse Income Tracker</p>
        </div>
      `,
      attachments: [
        {
          content: pdf_base64,
          filename: 'paypulse_report_' + new Date().toISOString().split('T')[0] + '.pdf',
        }
      ]
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Failed to send email: ' + error.message });
    }

    res.json({ success: true, message: 'Report sent to ' + email, id: data?.id });
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log(`PayPulse running on port ${PORT}`);
});
