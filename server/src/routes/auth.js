const router     = require('express').Router();
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const pool       = require('../db/pool');

// ─── Email transporter (singleton, verified on first use) ─────────────────
let _transporter = null;
let _transporterVerified = false;

function getTransporter() {
  if (_transporter) return _transporter;
  const port   = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = port === 465; // true for SSL, false for STARTTLS (587)
  _transporter = nodemailer.createTransport({
    host:       process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transporter;
}

async function verifySmtp() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('[SMTP] No credentials configured — password reset emails will log only');
    return;
  }
  try {
    await getTransporter().verify();
    _transporterVerified = true;
    console.log('[SMTP] ✓ Connected to', process.env.SMTP_HOST, 'as', process.env.SMTP_USER);
  } catch (err) {
    console.error('[SMTP] ✗ Connection failed:', err.message);
  }
}

async function sendResetEmail(to, resetUrl) {
  const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (!smtpConfigured) {
    console.log(`\n[SMTP] No credentials — reset link for ${to}:\n  ${resetUrl}\n`);
    return;
  }

  await getTransporter().sendMail({
    from:    process.env.SMTP_FROM || '"AI Crypto Advisor" <noreply@crypto.dev>',
    to,
    subject: 'Reset your AI Crypto Advisor password',
    html: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#222">
      <h2 style="color:#1a1a2e">Password Reset</h2>
      <p>You requested a password reset for your AI Crypto Advisor account.</p>
      <p>Click the button below — the link expires in <strong>1 hour</strong>.</p>
      <p style="margin:28px 0">
        <a href="${resetUrl}" style="background:#00ff88;color:#0d0d0d;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
          Reset my password
        </a>
      </p>
      <p style="color:#888;font-size:13px">Or copy this link:<br><a href="${resetUrl}">${resetUrl}</a></p>
      <p style="color:#bbb;font-size:12px;margin-top:32px">If you didn't request this, ignore this email — your password won't change.</p>
    </body></html>`,
  });
  console.log('[SMTP] ✓ Reset email sent to', to);
}

// ─── POST /api/auth/register ───────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email, and password are required' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, hash]
    );
    const user = rows[0];
    await pool.query('INSERT INTO user_preferences (user_id) VALUES ($1)', [user.id]);
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, reset_token, reset_token_expiry, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/auth/request-password-reset ────────────────────────────────
router.post('/request-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (!rows[0]) return res.status(404).json({ error: 'No account found with that email address.' });

    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
      [token, expiry, rows[0].id]
    );
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    await sendResetEmail(email, resetUrl);
    res.json({ message: 'Reset link sent. Check your inbox.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/auth/reset-password ────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password)
    return res.status(400).json({ error: 'token and password are required' });
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()',
      [token]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset token' });
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
      [hash, rows[0].id]
    );
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.verifySmtp = verifySmtp;
