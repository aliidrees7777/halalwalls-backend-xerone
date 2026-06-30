/**
 * Wallpaper image storage — interim local-disk implementation.
 *
 * Persists an uploaded image buffer under the backend's /uploads directory
 * (served statically by index.js). Returns the public path so callers can build
 * a full URL. Storage is isolated behind this helper: when the Hostinger VPS /
 * object-storage pipeline is wired, only saveImage() changes — callers keep the
 * same { filename, path } contract.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Resolves to <backend-root>/uploads (this file lives in src/helpers), matching
// the directory index.js serves statically at /uploads.
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

// Allowed image types → file extension. Mirrors the multer fileFilter on the
// upload route (JPEG/PNG only).
const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

// Ensure the directory exists (no-op when it already does).
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const bad = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

// Persist a buffer to disk under a random, collision-free filename. Returns the
// stored filename and the public path (mounted at /uploads by the static
// server). The caller prefixes the request host to form an absolute URL.
async function saveImage(buffer, mimetype) {
  const ext = EXT_BY_MIME[mimetype];
  if (!ext) throw bad('Only JPEG and PNG images are allowed');
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw bad('Uploaded image is empty');

  const filename = `${crypto.randomUUID()}.${ext}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return { filename, path: `/uploads/${filename}` };
}

// Best-effort delete of a stored file (used to roll back a saved image when the
// surrounding DB write fails). A missing file is not an error.
async function removeImage(filename) {
  if (!filename) return;
  try {
    await fs.promises.unlink(path.join(UPLOAD_DIR, filename));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

module.exports = { saveImage, removeImage, UPLOAD_DIR, EXT_BY_MIME };
