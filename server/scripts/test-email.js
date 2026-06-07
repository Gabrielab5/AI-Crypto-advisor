/**
 * Smoke test for SMTP / password reset email.
 * Usage:  node scripts/test-email.js <recipient@email.com>
 *
 * Reads credentials from server/.env
 * Sends a real email to the address you provide.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const nodemailer = require('nodemailer');

const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/test-email.js <recipient@email.com>');
  process.exit(1);
}

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, CLIENT_URL } = process.env;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error('❌  SMTP_HOST, SMTP_USER, and SMTP_PASS must be set in server/.env');
  process.exit(1);
}

const port   = parseInt(SMTP_PORT || '587', 10);
const secure = port === 465;

console.log(`\nSMTP config:`);
console.log(`  Host:   ${SMTP_HOST}:${port} (secure=${secure})`);
console.log(`  User:   ${SMTP_USER}`);
console.log(`  From:   ${SMTP_FROM || 'not set'}`);
console.log(`  To:     ${to}\n`);

const transporter = nodemailer.createTransport({ host: SMTP_HOST, port, secure, auth: { user: SMTP_USER, pass: SMTP_PASS } });

(async () => {
  console.log('Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('✓ SMTP connection OK\n');
  } catch (err) {
    console.error('❌  SMTP verify failed:', err.message);
    console.error('\nCommon Gmail fixes:');
    console.error('  1. Use an App Password (not your regular Gmail password)');
    console.error('     https://myaccount.google.com/apppasswords');
    console.error('  2. SMTP_HOST=smtp.gmail.com  SMTP_PORT=587');
    console.error('  3. SMTP_USER=youraddress@gmail.com');
    process.exit(1);
  }

  const resetUrl = `${CLIENT_URL || 'http://localhost:5173'}/reset-password?token=test-token-123`;
  console.log('Sending test reset email to', to, '...');

  try {
    const info = await transporter.sendMail({
      from:    SMTP_FROM || `"AI Crypto Advisor" <${SMTP_USER}>`,
      to,
      subject: '[TEST] Reset your AI Crypto Advisor password',
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#222">
        <h2 style="color:#1a1a2e">Password Reset (Test)</h2>
        <p>This is a test email from your AI Crypto Advisor SMTP configuration.</p>
        <p>If you received this, password reset emails are working correctly.</p>
        <p style="margin:28px 0">
          <a href="${resetUrl}" style="background:#00ff88;color:#0d0d0d;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
            Reset my password (test)
          </a>
        </p>
        <p style="color:#888;font-size:13px">Reset URL:<br><a href="${resetUrl}">${resetUrl}</a></p>
      </body></html>`,
    });
    console.log('✓ Email sent!');
    console.log('  Message ID:', info.messageId);
    if (info.previewUrl) console.log('  Preview:   ', info.previewUrl);
  } catch (err) {
    console.error('❌  sendMail failed:', err.message);
    process.exit(1);
  }
})();
