/**
 * Email helper — Resend (HTTP API) preferred, SMTP fallback, console-stub last.
 *
 *   • If RESEND_API_KEY is set (real value) → send via the Resend API (port 443,
 *     so it works on VPS hosts that block outbound SMTP ports).
 *   • Else if SMTP is configured → send via SMTP (nodemailer).
 *   • Else (or if a send fails) → console-log stub so signup / reset /
 *     verification never break in dev/testing.
 *
 * Placeholder-aware: until a REAL key/credential is provided it falls back
 * safely — the moment one is set, sending activates with no code change.
 *
 * Public API:
 *   sendPasswordResetEmail(to, token, firstName)
 *   sendVerificationEmail(to, token, firstName)
 */
const fs = require('fs');
const path = require('path');
const { getReal, getRaw } = require('./credentials.helper');

// ── settings ──
const appUrl = () => getRaw('APP_URL', 'appUrl', 'http://localhost:9845');
const fromEmail = () => getRaw('EMAIL_FROM', 'emailFrom', 'no-reply@halalwalls.com');
const fromName = () => getRaw('EMAIL_FROM_NAME', 'emailFromName', 'HalalWalls');
const fromHeader = () => `${fromName()} <${fromEmail()}>`;

// ── provider credentials (REAL, non-placeholder values only) ──
const resendKey = () => getReal('RESEND_API_KEY', 'resendApiKey');
const resendConfigured = () => !!resendKey();

const smtpCreds = () => ({
  host: getReal('SMTP_HOST', 'smtpHost'),
  port: Number(getRaw('SMTP_PORT', 'smtpPort', '587')),
  secure: String(getRaw('SMTP_SECURE', 'smtpSecure', 'false')) === 'true',
  user: getReal('SMTP_USER', 'smtpUser'),
  pass: getReal('SMTP_PASS', 'smtpPass'),
});
const smtpConfigured = () => {
  const c = smtpCreds();
  return !!(c.host && c.user);
};

// ── template rendering ──
const TEMPLATE_DIR = path.join(__dirname, '..', 'templates', 'email');
const renderTemplate = (name, vars) => {
  let html = fs.readFileSync(path.join(TEMPLATE_DIR, `${name}.html`), 'utf8');
  for (const [key, value] of Object.entries(vars)) {
    html = html.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value));
  }
  return html;
};

// ── provider senders ──
async function sendViaResend({ to, subject, html }) {
  const { Resend } = require('resend');
  const resend = new Resend(resendKey());
  const { data, error } = await resend.emails.send({ from: fromHeader(), to, subject, html });
  if (error) throw new Error(error.message || JSON.stringify(error));
  return { provider: 'resend', id: data && data.id };
}

async function sendViaSmtp({ to, subject, html }) {
  const nodemailer = require('nodemailer');
  const c = smtpCreds();
  const transporter = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
    connectionTimeout: 10000,
  });
  await transporter.sendMail({ from: fromHeader(), to, subject, html });
  return { provider: 'smtp' };
}

// ── dispatcher (Resend → SMTP → console stub) ──
async function dispatch({ to, subject, html, link }) {
  const providers = [];
  if (resendConfigured()) providers.push(['resend', sendViaResend]);
  if (smtpConfigured()) providers.push(['smtp', sendViaSmtp]);

  for (const [name, send] of providers) {
    try {
      return await send({ to, subject, html });
    } catch (err) {
      console.error(`⚠️  [email] ${name} send failed, trying next: ${err.message}`);
    }
  }

  // Nothing configured (or all providers failed) → console stub.
  console.log(`\n📧 [EMAIL · console-stub] ${providers.length ? '(all providers failed)' : '(no email provider configured)'}`);
  console.log(`   to:      ${to}`);
  console.log(`   subject: ${subject}`);
  if (link) console.log(`   link:    ${link}`);
  console.log('');
  return { provider: 'console-stub' };
}

// ── public API ──
exports.sendPasswordResetEmail = async (to, token, firstName = 'there') => {
  const link = `${appUrl()}/reset-password?token=${token}`;
  const html = renderTemplate('reset-password', { firstName, link, appName: fromName(), year: new Date().getFullYear() });
  return dispatch({ to, subject: `Reset your ${fromName()} password`, html, link });
};

exports.sendVerificationEmail = async (to, token, firstName = 'there') => {
  const link = `${appUrl()}/verify-email?token=${token}`;
  const html = renderTemplate('verify-email', { firstName, link, appName: fromName(), year: new Date().getFullYear() });
  return dispatch({ to, subject: `Verify your ${fromName()} email`, html, link });
};

// Log provider status once at startup so misconfig is obvious in server logs.
(function logEmailConfigOnStartup() {
  if (process.env.NODE_ENV === 'test') return;

  const from = fromEmail();
  const sandboxFrom = /@resend\.dev$/i.test(from);

  if (resendConfigured()) {
    // eslint-disable-next-line no-console
    console.log(`📧 Email provider: Resend (from ${fromHeader()})`);
    if (sandboxFrom) {
      // eslint-disable-next-line no-console
      console.warn(
        '⚠️  EMAIL_FROM uses @resend.dev (sandbox). Resend only delivers to the email on your Resend account — not arbitrary users. Verify halalwalls.com in Resend and set EMAIL_FROM=no-reply@halalwalls.com for production.',
      );
    }
    return;
  }

  if (smtpConfigured()) {
    // eslint-disable-next-line no-console
    console.log(`📧 Email provider: SMTP (${smtpCreds().host}, from ${fromHeader()})`);
    return;
  }

  // eslint-disable-next-line no-console
  console.warn('📧 Email: no Resend/SMTP configured — auth emails will be console-stubbed only (API still returns success).');
})();
