/**
 * Image pipeline (Sharp) — persists three assets per upload:
 *   1. Original file bytes unchanged (for "Download Original")
 *   2. Display WebP (capped at 4K width for browse/grid)
 *   3. Thumbnail WebP
 *
 * Sized downloads (4K / 2K / Full HD) are rendered on demand from the original.
 * Isolated so the storage target (local disk today, object storage later) can
 * change without touching the upload service.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** Cap for the *display* WebP only — originals keep full resolution. */
const DISPLAY_MAX_WIDTH = 3840;
const THUMB_WIDTH = 480;
const FULL_QUALITY = 82;
const THUMB_QUALITY = 70;

const bad = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

function extensionFor(mimetype, originalname) {
  const name = String(originalname || '').toLowerCase();
  const mime = String(mimetype || '').toLowerCase();
  if (mime === 'image/png' || name.endsWith('.png')) return 'png';
  if (mime === 'image/webp' || name.endsWith('.webp')) return 'webp';
  if (mime === 'image/gif' || name.endsWith('.gif')) return 'gif';
  return 'jpg';
}

/**
 * Process an image buffer → original (as uploaded) + display WebP + thumb.
 * @param {Buffer} buffer
 * @param {{ mimetype?: string, originalname?: string }} [opts]
 * @returns {Promise<{
 *   original: string,
 *   image: string,
 *   thumbnail: string,
 *   filenames: string[],
 *   width: number|null,
 *   height: number|null,
 *   bytes: number,
 *   displayBytes: number,
 * }>}
 */
async function processImage(buffer, opts = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw bad('Uploaded image is empty');
  }

  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw bad('Unsupported or corrupt image file');
  }

  // Pixel size of the uploaded file (exact — used for Original + cascade filter).
  // Honour EXIF orientation so width/height match how the image is viewed.
  const orientation = meta.orientation || 1;
  const swapped = orientation >= 5 && orientation <= 8;
  const srcWidth = (swapped ? meta.height : meta.width) || meta.width || null;
  const srcHeight = (swapped ? meta.width : meta.height) || meta.height || null;

  const id = crypto.randomUUID();
  const ext = extensionFor(opts.mimetype, opts.originalname);
  const originalName = `${id}-original.${ext}`;
  const displayName = `${id}.webp`;
  const thumbName = `${id}-thumb.webp`;

  // 1. Keep the exact upload bytes (dimensions + file size preserved).
  await fs.promises.writeFile(path.join(UPLOAD_DIR, originalName), buffer);

  // 2. Display WebP for the site (downscale only if wider than 4K).
  const displayPipeline = sharp(buffer).rotate();
  if (srcWidth && srcWidth > DISPLAY_MAX_WIDTH) {
    displayPipeline.resize({ width: DISPLAY_MAX_WIDTH });
  }
  const displayBuf = await displayPipeline.webp({ quality: FULL_QUALITY }).toBuffer();
  await fs.promises.writeFile(path.join(UPLOAD_DIR, displayName), displayBuf);

  // 3. Thumbnail WebP.
  const thumbBuf = await sharp(buffer)
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();
  await fs.promises.writeFile(path.join(UPLOAD_DIR, thumbName), thumbBuf);

  return {
    original: `/uploads/${originalName}`,
    image: `/uploads/${displayName}`,
    thumbnail: `/uploads/${thumbName}`,
    filenames: [originalName, displayName, thumbName],
    width: srcWidth,
    height: srcHeight,
    bytes: buffer.length,
    displayBytes: displayBuf.length,
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

module.exports = { processImage, removeImages, UPLOAD_DIR, DISPLAY_MAX_WIDTH };
