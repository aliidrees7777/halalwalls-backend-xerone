/**
 * Credential helpers.
 *
 * The repo ships with DUMMY credentials so the structure is in place. We must
 * not actually try to use a dummy value (it would hang on a fake SMTP host or
 * fail Google verification). So any value that still looks like a placeholder
 * is treated as "not configured" — the app then falls back safely:
 *   • Google  → 503 "not configured"
 *   • Email   → console-log stub
 * The moment a real value (no placeholder markers) is provided, the feature
 * activates automatically. No code change required.
 */
const config = require('config');

const PLACEHOLDER_RE = /dummy|replace ?me|your-|your_|yourprovider|yourcompany|changeme|x{4,}|placeholder/i;

const isPlaceholder = (v) => !v || PLACEHOLDER_RE.test(String(v));

// Returns the value only if it is a real (non-placeholder) credential, else ''.
const real = (v) => (isPlaceholder(v) ? '' : String(v));

// Reads from env first, then the `config` files. Returns a REAL value or ''.
const getReal = (envKey, cfgKey) => {
  const fromEnv = process.env[envKey];
  if (fromEnv !== undefined && fromEnv !== '') return real(fromEnv);
  if (cfgKey && config.has(cfgKey)) return real(config.get(cfgKey));
  return '';
};

// Like getReal but keeps placeholder values too (for non-secret settings such
// as EMAIL_PROVIDER / EMAIL_FROM where a default is fine).
const getRaw = (envKey, cfgKey, def = '') => {
  const fromEnv = process.env[envKey];
  if (fromEnv !== undefined && fromEnv !== '') return String(fromEnv);
  if (cfgKey && config.has(cfgKey)) return String(config.get(cfgKey));
  return def;
};

module.exports = { isPlaceholder, real, getReal, getRaw };
