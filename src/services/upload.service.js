// Upload service — handles user wallpaper submissions: persists the uploaded
// image to local disk (served at /uploads) and creates a `pending` Wallpaper
// row for admin review (moderation queue → approve/reject). Storage is isolated
// behind upload-storage.js, so the Hostinger VPS / object-storage swap later
// touches only that helper, not this service.
const prisma = require('../lib/prisma');
const { processImage, removeImages } = require('../helpers/image-pipeline');
const { serializeCard } = require('./wallpaper.service');

// Standard download set carried on every wallpaper (matches the seed data).
const STANDARD_RESOLUTIONS = ['1920x1080', '2560x1440', '3840x2160'];

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Derive a slug from `base` that doesn't collide with an existing wallpaper.
async function uniqueSlug(base) {
  let slug = base || 'wallpaper';
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.wallpaper.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

// Accept tags as an array or a comma-separated string (the upload form sends a
// single free-text field). Trims, drops blanks, de-dupes, preserving order.
function parseTags(input) {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : [];
  const seen = new Set();
  const tags = [];
  for (const t of raw) {
    const tag = String(t).trim();
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      tags.push(tag);
    }
  }
  return tags;
}

// Create a pending wallpaper from an uploaded file + metadata.
//   userId — the submitter (becomes uploadedById)
//   file   — multer file (memory storage: { buffer, mimetype, size, originalname })
//   body   — { category | categorySlug, tags, source | description, title?, author? }
//   origin — absolute base URL (e.g. http://localhost:3662) for the public image URL
exports.createUpload = async (userId, file, body = {}, origin = '') => {
  // 1. Run the Sharp pipeline (optimized WebP + thumbnail on disk); build the
  //    public absolute URLs from the request origin.
  const processed = await processImage(file.buffer);
  const imageUrl = `${origin}${processed.image}`;
  const thumbUrl = `${origin}${processed.thumbnail}`;

  try {
    // 2. Resolve category — accept a slug or a display label; fill the missing
    //    half from the categories table when possible (mirrors admin create).
    const rawCategory = body.category ? String(body.category).trim() : '';
    const categorySlug = body.categorySlug
      ? slugify(body.categorySlug)
      : rawCategory
        ? slugify(rawCategory)
        : null;
    let categoryLabel = rawCategory || null;
    if (!categoryLabel && categorySlug) {
      const cat = await prisma.category.findUnique({ where: { slug: categorySlug } });
      if (cat) categoryLabel = cat.name;
    }

    // 3. Title: explicit → uploaded filename (sans extension) → category label.
    const fileBase = file.originalname
      ? String(file.originalname).replace(/\.[^.]+$/, '').trim()
      : '';
    const title =
      (body.title && String(body.title).trim()) || fileBase || categoryLabel || 'Untitled wallpaper';

    // 4. Real dimensions come from the Sharp pipeline (after any 4K downscale).
    const width = processed.width;
    const height = processed.height;
    const resolution = width && height ? `${width}x${height}` : '';

    // 5. Size = the optimized WebP byte length.
    const sizeMB = Math.round((processed.bytes / (1024 * 1024)) * 100) / 100;

    const description = String(body.description || body.source || '').trim();

    const slug = await uniqueSlug(slugify(title));

    // 6. Create the pending row. User submissions are never premium/live and are
    //    held at status 'pending' until an admin approves them.
    const created = await prisma.wallpaper.create({
      data: {
        title,
        slug,
        description,
        category: categoryLabel,
        categorySlug,
        tags: parseTags(body.tags),
        image: imageUrl,
        originalUrl: imageUrl,
        thumbnailUrl: thumbUrl,
        resolution,
        preferredResolution: resolution,
        resolutions: STANDARD_RESOLUTIONS,
        sizeMB,
        width,
        height,
        author: body.author ? String(body.author).trim() : 'HalalWalls',
        isPremium: false,
        isLive: false,
        status: 'pending',
        uploadedById: userId,
      },
    });

    // The submitter should see it's awaiting review, so carry the status on the
    // card (same shape as GET /me/uploads).
    return {
      message: 'Wallpaper submitted for review',
      data: { wallpaper: { ...serializeCard(created), status: created.status } },
      statusCode: 201,
    };
  } catch (err) {
    // Roll back the generated files so a failed DB write doesn't orphan them.
    await removeImages(processed.filenames).catch(() => {});
    throw err;
  }
};
