/**
 * Email helper — dual-provider with automatic fallback.
 *
 * Two providers are supported: SMTP (nodemailer) and SendGrid (@sendgrid/mail).
 *
 *   • EMAIL_PROVIDER picks the PREFERRED provider ('smtp' | 'sendgrid').
 *   • If the preferred provider is not configured (or a send throws), the
 *     system automatically falls back to the OTHER provider.
 *   • If NEITHER is configured (e.g. only dummy creds are present), it falls
 *     back to a console-log stub so signup / reset never break in dev/testing.
 *
 * Public API — controllers/services just call:
 *   sendPasswordResetEmail(to, token, firstName)
 */
const fs = require('fs');
const path = require('path');
const { getReal, getRaw } = require('./credentials.helper');

// ── settings ──
const appUrl = () => getRaw('APP_URL', 'appUrl', 'http://localhost:9845');
const fromEmail = () => getRaw('EMAIL_FROM', 'emailFrom', 'no-reply@halalwalls.com');
const fromName = () => getRaw('EMAIL_FROM_NAME', 'emailFromName', 'HalalWalls');
const preferredProvider = () => (getRaw('EMAIL_PROVIDER', 'emailProvider', 'smtp') || 'smtp').toLowerCase();

// ── provider configuration detection (uses REAL, non-placeholder values) ──
const smtpCreds = () => ({
  host: getReal('SMTP_HOST', 'smtpHost'),
  port: Number(getRaw('SMTP_PORT', 'smtpPort', '587')),
  secure: String(getRaw('SMTP_SECURE', 'smtpSecure', 'false')) === 'true',
  user: getReal('SMTP_USER', 'smtpUser'),
  pass: getReal('SMTP_PASS', 'smtpPass'),
});
const sendgridKey = () => getReal('SENDGRID_API_KEY', 'sendgridApiKey');

const smtpConfigured = () => {
  const c = smtpCreds();
  return !!(c.host && c.user);
};
const sendgridConfigured = () => !!sendgridKey();

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
  await transporter.sendMail({ from: `"${fromName()}" <${fromEmail()}>`, to, subject, html });
  return { provider: 'smtp' };
}

async function sendViaSendgrid({ to, subject, html, templateId, dynamicData }) {
  const sg = require('@sendgrid/mail');
  sg.setApiKey(sendgridKey());
  const msg = { to, from: { email: fromEmail(), name: fromName() } };
  if (templateId) {
    // SendGrid Dynamic Template path — content lives in SendGrid, we just
    // supply the variables.
    msg.templateId = templateId;
    msg.dynamicTemplateData = dynamicData;
  } else {
    msg.subject = subject;
    msg.html = html;
  }
  await sg.send(msg);
  return { provider: 'sendgrid' };
}

// ── dispatcher with fallback ──
async function dispatch({ to, subject, html, sendgridTemplateId, dynamicData }) {
  const order = preferredProvider() === 'sendgrid' ? ['sendgrid', 'smtp'] : ['smtp', 'sendgrid'];
  const errors = [];

  for (const provider of order) {
    try {
      if (provider === 'smtp' && smtpConfigured()) return await sendViaSmtp({ to, subject, html });
      if (provider === 'sendgrid' && sendgridConfigured()) {
        return await sendViaSendgrid({ to, subject, html, templateId: sendgridTemplateId, dynamicData });
      }
    } catch (err) {
      errors.push(`${provider}: ${err.message}`);
      console.error(`⚠️  [email] ${provider} send failed, trying fallback: ${err.message}`);
    }
  }

  // Nothing configured (or all providers failed) → console stub.
  console.log(`\n📧 [EMAIL · console-stub] ${errors.length ? `(all providers failed: ${errors.join('; ')})` : '(no email provider configured)'}`);
  console.log(`   to:      ${to}`);
  console.log(`   subject: ${subject}`);
  if (dynamicData && dynamicData.link) console.log(`   link:    ${dynamicData.link}`);
  console.log('');
  return { provider: 'console-stub', errors };
}

// ── public API ──
exports.sendPasswordResetEmail = async (to, token, firstName = 'there') => {
  const link = `${appUrl()}/reset-password?token=${token}`;
  const html = renderTemplate('reset-password', { firstName, link, appName: fromName(), year: new Date().getFullYear() });
  return dispatch({
    to,
    subject: `Reset your ${fromName()} password`,
    html,
    sendgridTemplateId: getReal('SENDGRID_RESET_TEMPLATE_ID', 'sendgridResetTemplateId'),
    dynamicData: { firstName, link },
  });
};
