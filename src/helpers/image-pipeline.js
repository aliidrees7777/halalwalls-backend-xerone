/**
 * Image pipeline (Sharp) — turns an uploaded image buffer into web-optimized
 * assets: a full-size WebP (downscaled to at most 4K width) and a WebP
 * thumbnail, both written under the backend's /uploads directory (served
 * statically at /uploads). Returns public paths + the real pixel dimensions.
 *
 * Isolated behind this helper so the storage target (local disk today, object
 * storage later) can change without touching the upload service.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_WIDTH = 3840; // cap huge uploads at 4K width
const THUMB_WIDTH = 480; // grid/card thumbnail width
const FULL_QUALITY = 82;
const THUMB_QUALITY = 70;

const bad = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

// Process an image buffer → optimized WebP full + WebP thumbnail on disk.
// Returns { image, thumbnail, filenames, width, height, bytes }.
async function processImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw bad('Uploaded image is empty');
  }

  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw bad('Unsupported or corrupt image file');
  }

  const srcWidth = meta.width || null;
  const srcHeight = meta.height || null;

  const id = crypto.randomUUID();
  const fullName = `${id}.webp`;
  const thumbName = `${id}-thumb.webp`;

  // Full image: auto-orient (honour EXIF), downscale only if wider than 4K,
  // then encode WebP.
  const fullPipeline = sharp(buffer).rotate();
  if (srcWidth && srcWidth > MAX_WIDTH) fullPipeline.resize({ width: MAX_WIDTH });
  const fullBuf = await fullPipeline.webp({ quality: FULL_QUALITY }).toBuffer();
  await fs.promises.writeFile(path.join(UPLOAD_DIR, fullName), fullBuf);

  // Thumbnail: fixed-width WebP.
  const thumbBuf = await sharp(buffer)
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();
  await fs.promises.writeFile(path.join(UPLOAD_DIR, thumbName), thumbBuf);

  // Effective output dimensions (after any downscale) — keeps aspect ratio.
  let outWidth = srcWidth;
  let outHeight = srcHeight;
  if (srcWidth && srcHeight && srcWidth > MAX_WIDTH) {
    outWidth = MAX_WIDTH;
    outHeight = Math.round(srcHeight * (MAX_WIDTH / srcWidth));
  }

  return {
    image: `/uploads/${fullName}`,
    thumbnail: `/uploads/${thumbName}`,
    filenames: [fullName, thumbName],
    width: outWidth,
    height: outHeight,
    bytes: fullBuf.length,
  };
}

// Best-effort cleanup of generated files (roll back a failed DB write).
async function removeImages(filenames = []) {
  await Promise.all(
    filenames.map(async (name) => {
      try {
        await fs.promises.unlink(path.join(UPLOAD_DIR, name));
      } catch (err) {
        if (err.code !== 'ENOENT') {
          /* ignore cleanup errors */
        }
      }
    }),
  );
}

module.exports = { processImage, removeImages, UPLOAD_DIR };
