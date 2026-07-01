/**
 * Download image renderer — produces a wallpaper at a requested resolution on
 * demand (Sharp), from whatever source the wallpaper points at:
 *   • /uploads/…            → read from local disk (user uploads)
 *   • https?://…            → fetch (Unsplash / picsum / any CDN)
 *   • /relative/path.jpg    → fetch from the frontend origin (APP_URL /public)
 *
 * Output is always a high-quality JPEG (universally compatible as a desktop /
 * phone wallpaper). Resized results are cached on disk so repeat downloads are
 * instant.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const CACHE_DIR = path.join(UPLOAD_DIR, 'cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const APP_URL = () => (process.env.APP_URL || 'http://localhost:3661').replace(/\/$/, '');

const fail = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Load the raw source bytes for a stored image URL/path.
async function fetchSource(imageUrl) {
  if (!imageUrl) throw fail('This wallpaper has no source image', 404);

  // Locally-stored upload → read straight from disk (fast, no network).
  if (imageUrl.startsWith('/uploads/')) {
    const name = imageUrl.replace(/^\/uploads\//, '');
    try {
      return await fs.promises.readFile(path.join(UPLOAD_DIR, name));
    } catch {
      throw fail('Source image file is missing', 404);
    }
  }

  // Absolute URL → fetch as-is. Relative path (frontend /public) → fetch from
  // the frontend origin so it works in both local and production.
  const url = /^https?:\/\//i.test(imageUrl)
    ? imageUrl
    : `${APP_URL()}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;

  let res;
  try {
    res = await fetch(url);
  } catch {
    throw fail('Could not reach the source image', 502);
  }
  if (!res.ok) throw fail(`Could not fetch the source image (${res.status})`, 502);
  return Buffer.from(await res.arrayBuffer());
}

// Render the download JPEG. width/height null → original size (convert only);
// otherwise resize to exactly width×height (cover crop, centred).
async function renderJpeg(sourceBuffer, width, height) {
  const pipeline = sharp(sourceBuffer).rotate(); // honour EXIF orientation
  if (width && height) {
    pipeline.resize(width, height, {
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: false, // the user explicitly picked this resolution
    });
  }
  return pipeline.jpeg({ quality: width && height ? 90 : 92 }).toBuffer();
}

module.exports = { fetchSource, renderJpeg, CACHE_DIR };
