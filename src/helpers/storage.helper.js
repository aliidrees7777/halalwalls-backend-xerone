/**
 * Image storage helper — uploads to Cloudflare R2 when configured, otherwise
 * falls back to the local `uploads/` disk.
 *
 * R2 is S3-compatible, so we use the AWS SDK pointed at the R2 endpoint.
 * Files are served from a CUSTOM DOMAIN connected to the bucket (set via
 * R2_PUBLIC_BASE_URL, e.g. https://media.halalwalls.com) so public links
 * show the client's own domain — not r2.cloudflarestorage.com.
 *
 * Placeholder-aware (same pattern as email/Google): until REAL R2 credentials
 * are provided, it transparently uses the local disk so dev/testing never break.
 * The moment all R2 values are set, remote upload activates — no code change.
 *
 * In test mode it always uses the local fallback (no network).
 */
const fs = require('fs');
const path = require('path');
const { getReal, getRaw } = require('./credentials.helper');

// ── R2 settings (env first, then config) ──
const r2Config = () => ({
  accountId: getReal('R2_ACCOUNT_ID', 'r2AccountId'),
  accessKeyId: getReal('R2_ACCESS_KEY_ID', 'r2AccessKeyId'),
  secretAccessKey: getReal('R2_SECRET_ACCESS_KEY', 'r2SecretAccessKey'),
  bucket: getReal('R2_BUCKET', 'r2Bucket'),
  // The custom domain connected to the bucket — what the public URL shows.
  publicBaseUrl: getReal('R2_PUBLIC_BASE_URL', 'r2PublicBaseUrl'),
  // Optional explicit S3 endpoint; otherwise derived from the account id.
  endpoint: getRaw('R2_ENDPOINT', 'r2Endpoint', ''),
});

// Remote upload is active only when ALL required values are real (non-placeholder)
// and we're not running the test suite.
const isRemoteConfigured = () => {
  if (process.env.NODE_ENV === 'test') return false;
  const c = r2Config();
  return !!(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket && c.publicBaseUrl);
};

let _client = null;
const client = () => {
  if (_client) return _client;
  const { S3Client } = require('@aws-sdk/client-s3');
  const c = r2Config();
  _client = new S3Client({
    region: 'auto',
    endpoint: c.endpoint || `https://${c.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  return _client;
};

const LOCAL_ROOT = path.join(__dirname, '..', '..', 'uploads');

/**
 * Persist an image and return its public URL.
 *   key  — object key WITHOUT a leading slash, e.g. "wallpapers/<id>-<ts>.jpg"
 * Returns:
 *   • R2 active   → `${R2_PUBLIC_BASE_URL}/wallpapers/<id>-<ts>.jpg` (your domain)
 *   • fallback    → `/uploads/wallpapers/<id>-<ts>.jpg` (served by this app)
 */
exports.saveImage = async ({ buffer, key, contentType }) => {
  const cleanKey = String(key).replace(/^\/+/, '');

  if (isRemoteConfigured()) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const c = r2Config();
    await client().send(
      new PutObjectCommand({
        Bucket: c.bucket,
        Key: cleanKey,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
        // R2 ignores ACLs; public access is granted by the bucket's custom domain.
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    const base = c.publicBaseUrl.replace(/\/+$/, '');
    return `${base}/${cleanKey}`;
  }

  // ── Local-disk fallback (dev / test / not-yet-configured) ──
  const dest = path.join(LOCAL_ROOT, cleanKey);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);
  return `/uploads/${cleanKey}`;
};

exports.isRemoteConfigured = isRemoteConfigured;
