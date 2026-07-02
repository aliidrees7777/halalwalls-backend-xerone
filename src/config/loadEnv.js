/**
 * Environment loader — mirrors the frontend's .env.local / .env.production split
 * so the backend runs the same way locally and on the production server.
 *
 * Picks the env file from NODE_ENV and loads the FIRST one that exists:
 *   • production          → .env.production   (fallback: .env)
 *   • development / test   → .env.local        (fallback: .env)
 *
 * dotenv never overrides variables already present in process.env, so a host
 * that injects real env vars — or the test harness that sets them directly —
 * always wins. These env files are gitignored (they hold secrets) and are
 * provided per host: local values on your machine, production values on the
 * server. The `config/*.json` files (development/production/test) carry the
 * non-secret defaults.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..'); // <backend project root>
const mode = process.env.NODE_ENV || 'development';

const candidates =
  mode === 'production' ? ['.env.production', '.env'] : ['.env.local', '.env'];

for (const file of candidates) {
  const full = path.join(ROOT, file);
  if (fs.existsSync(full)) {
    require('dotenv').config({ path: full });
    if (mode !== 'test') {
      // eslint-disable-next-line no-console
      console.log(`🔧 Env loaded from ${file} (NODE_ENV=${mode})`);
    }
    break;
  }
}

module.exports = {};
