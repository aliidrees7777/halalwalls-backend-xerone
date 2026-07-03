/**
 * Environment loader — mirrors the frontend's .env.local / .env.production split
 * so the backend runs the same way locally and on the production server.
 *
 * Loads env in two layers (base, then mode-specific overrides):
 *   • Always try `.env` first (shared defaults).
 *   • production → then `.env.production`
 *   • development / test → then `.env.local`
 *
 * dotenv never overrides variables already present in process.env, so a host
 * that injects real env vars — or the test harness that sets them directly —
 * always wins.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..'); // <backend project root>
const mode = process.env.NODE_ENV || 'development';

const layers = ['.env'];
if (mode === 'production') layers.push('.env.production');
else if (mode !== 'test') layers.push('.env.local');

const loaded = [];
for (let i = 0; i < layers.length; i += 1) {
  const file = layers[i];
  const full = path.join(ROOT, file);
  if (fs.existsSync(full)) {
    // Base `.env` loads first; mode-specific files override those values.
    require('dotenv').config({ path: full, override: i > 0 });
    loaded.push(file);
  }
}

if (mode !== 'test' && loaded.length) {
  // eslint-disable-next-line no-console
  console.log(`🔧 Env loaded from ${loaded.join(' + ')} (NODE_ENV=${mode})`);
}

module.exports = {};
