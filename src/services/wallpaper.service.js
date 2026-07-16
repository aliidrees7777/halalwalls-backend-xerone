/**
 * Wallpaper service — public catalog business logic.
 *
 * Mirrors the frontend's filter model:
 *   • Browse modes (no category filter): latest | popular | random | live
 *       - latest → newest first
 *       - popular → most downloaded (then most viewed)
 *       - random → random sample
 *       - live   → only live/animated wallpapers (isLive)
 *   • Category slugs (filter by categorySlug): islamic, anime, superheroes,
 *     minimalist, gaming, movies, cars, sport, space, …
 *   • q / search → matches title, category, or tags (case-insensitive).
 *
 * Returns the standard { message, data, statusCode } envelope payload.
 */
const prisma = require('../lib/prisma');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { fetchSource, renderJpeg, CACHE_DIR } = require('../helpers/download-image');
const {
  downloadCatalogForSource,
  wouldUpscale,
} = require('../helpers/resolution-filter');
const { hasPremiumAccess } = require('../helpers/premium-access');

// Short-lived signed token for a resolution download. Issued only after the
// premium gate passes (trackDownload) and validated by the file endpoint — so
// window.open() downloads (which can't send an auth header) stay gated.
const DOWNLOAD_SECRET = () => process.env.JWT_SECRET || 'halalwalls-dev-secret';
const DL_MIN = 100;
const DL_MAX = 4096;

// Normalise a resolution string → { w, h } or { original: true }.
function parseResolution(input) {
  const s = String(input || '').toLowerCase().replace(/[×\s]/g, 'x').trim();
  if (!s || s === 'original') return { original: true };
  const m = s.match(/^(\d{2,5})x(\d{2,5})$/);
  if (!m) return { original: true };
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  if (w < DL_MIN || h < DL_MIN || w > DL_MAX || h > DL_MAX) return { original: true };
  return { w, h };
}

const BROWSE_MODES = ['latest', 'popular', 'random', 'live'];
const DEFAULT_LIMIT = 18;
const MAX_LIMIT = 60;

// ── helpers ──────────────────────────────────────────────────────────────
const fail = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const slugifyTag = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const formatDate = (d) => {
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
};

const clampLimit = (raw) => Math.min(MAX_LIMIT, Math.max(1, parseInt(raw, 10) || DEFAULT_LIMIT));
const clampPage = (raw) => Math.max(1, parseInt(raw, 10) || 1);

// Fisher-Yates shuffle (used for the `random` browse mode — Postgres has no
// native Prisma random ordering, so we sample ids in app code).
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Card shape — matches the frontend `Wallpaper` type.
function serializeCard(doc, favSet) {
  return {
    id: String(doc.id),
    slug: doc.slug,
    title: doc.title,
    image: doc.image,
    category: doc.categorySlug || doc.category || '',
    resolution:
      doc.resolution ||
      doc.preferredResolution ||
      (doc.width && doc.height ? `${doc.width}x${doc.height}` : ''),
    isPremium: !!doc.isPremium,
    isLive: !!doc.isLive,
    downloadCount: doc.downloadCount || 0,
    views: doc.views || 0,
    favoritesCount: doc.favoritesCount || 0,
    ...(favSet ? { isFavorite: favSet.has(String(doc.id)) } : {}),
  };
}

// Detail shape — matches the frontend `WallpaperDetail` type.
function serializeDetail(doc, favSet) {
  const tags = doc.tags || [];
  const catalog = downloadCatalogForSource(doc.width, doc.height);
  return {
    ...serializeCard(doc, favSet),
    description: doc.description || '',
    categoryLabel: doc.category || '',
    tags,
    tagSlugs: tags.map((t) => `${slugifyTag(t)}-wallpapers`),
    author: doc.author || 'HalalWalls',
    publishedAt: formatDate(doc.createdAt),
    originalResolution:
      doc.width && doc.height ? `${doc.width}×${doc.height}` : doc.resolution || '',
    originalSizeMB: doc.sizeMB || 0,
    preferredResolution: doc.preferredResolution || doc.resolution || '',
    // Recompute from source dims so legacy rows don't advertise upscales.
    resolutions: [
      ...catalog.desktop.map((r) => `${r.width}x${r.height}`),
      ...catalog.mobile.map((r) => `${r.width}x${r.height}`),
    ],
    downloadResolutions: catalog,
    width: doc.width || null,
    height: doc.height || null,
    image: doc.image,
    originalUrl: doc.originalUrl || doc.image,
  };
}

// Resolve category (taxonomy) and browse mode (sort) — they COMBINE, e.g.
// category=cars + sort=latest → "latest cars". A browse mode passed as
// `category` (legacy links) or as `filter` still works as the mode.
function resolveSelector(query) {
  const cat = String(query.category || '').trim().toLowerCase();
  const sortParam = String(query.sort || query.filter || '').trim().toLowerCase();

  // `category` is a real category unless it's actually a browse-mode word.
  const categorySlug = cat && !BROWSE_MODES.includes(cat) ? cat : null;

  // Prefer explicit `sort`/`filter`; fall back to a browse mode in `category`;
  // default to latest.
  const mode = BROWSE_MODES.includes(sortParam)
    ? sortParam
    : BROWSE_MODES.includes(cat)
      ? cat
      : 'latest';

  return { categorySlug, mode };
}

// Build the Prisma `where` clause shared by list/count.
function buildWhere(query, categorySlug, mode) {
  const where = { status: 'active' };
  if (categorySlug) where.categorySlug = categorySlug;
  if (mode === 'live') where.isLive = true;
  if (query.tag) where.tags = { has: String(query.tag) };

  // Filter by the wallpaper's native resolution (e.g. "3840x2160"). Accepts the
  // "×" display char too. Combines with category/sort/tag.
  if (query.resolution) {
    const r = String(query.resolution).replace(/×/g, 'x').trim();
    if (r) where.resolution = { equals: r, mode: 'insensitive' };
  }

  const q = String(query.q || query.search || '').trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { categorySlug: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
      { tags: { has: q } }, // arrays match exact elements (no substring)
    ];
  }
  return { where, q };
}

// ── GET /wallpapers — list / search / filter / sort / paginate ───────────
exports.listPublic = async (query = {}, favSet = null) => {
  const { categorySlug, mode } = resolveSelector(query);
  const { where, q } = buildWhere(query, categorySlug, mode);

  const page = clampPage(query.page);
  const limit = clampLimit(query.limit);
  const skip = (page - 1) * limit;

  let docs;
  let total;

  if (mode === 'random') {
    // Sample `limit` random rows: pull matching ids, shuffle, fetch the slice.
    const ids = await prisma.wallpaper.findMany({ where, select: { id: true } });
    total = ids.length;
    const pick = shuffle(ids.map((r) => r.id)).slice(0, limit);
    docs = pick.length
      ? await prisma.wallpaper.findMany({ where: { id: { in: pick } } })
      : [];
  } else {
    const orderBy =
      mode === 'popular'
        ? [{ downloadCount: 'desc' }, { views: 'desc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }]; // latest / category default
    [docs, total] = await Promise.all([
      prisma.wallpaper.findMany({ where, orderBy, skip, take: limit }),
      prisma.wallpaper.count({ where }),
    ]);
  }

  const totalPages = Math.ceil(total / limit) || 0;

  return {
    message: 'Wallpapers fetched',
    data: {
      wallpapers: docs.map((d) => serializeCard(d, favSet)),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      filter: { mode, category: categorySlug, q: q || null, tag: query.tag || null },
    },
    statusCode: 200,
  };
};

// ── GET /wallpapers/:slug — detail (increments view count) ───────────────
exports.getBySlug = async (slug, favSet = null) => {
  // Increment views only on an active match; absent/inactive → 404.
  const bumped = await prisma.wallpaper.updateMany({
    where: { slug, status: 'active' },
    data: { views: { increment: 1 } },
  });
  if (bumped.count === 0) throw fail('Wallpaper not found', 404);

  const doc = await prisma.wallpaper.findUnique({ where: { slug } });

  const related = await prisma.wallpaper.findMany({
    where: { status: 'active', categorySlug: doc.categorySlug, id: { not: doc.id } },
    take: 8,
  });

  const wallpaper = serializeDetail(doc, favSet);
  wallpaper.relatedIds = related.map((r) => String(r.id));

  return {
    message: 'Wallpaper fetched',
    data: {
      wallpaper,
      downloadResolutions: wallpaper.downloadResolutions,
    },
    statusCode: 200,
  };
};

// ── GET /wallpapers/:slug/related ────────────────────────────────────────
exports.related = async (slug, query = {}, favSet = null) => {
  const base = await prisma.wallpaper.findFirst({ where: { slug, status: 'active' } });
  if (!base) throw fail('Wallpaper not found', 404);

  const limit = Math.min(24, Math.max(1, parseInt(query.limit, 10) || 8));

  let docs = await prisma.wallpaper.findMany({
    where: { status: 'active', categorySlug: base.categorySlug, id: { not: base.id } },
    orderBy: [{ downloadCount: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });

  // Backfill with the latest from other categories if this category is thin.
  if (docs.length < limit) {
    const excludeIds = [base.id, ...docs.map((d) => d.id)];
    const extra = await prisma.wallpaper.findMany({
      where: { status: 'active', id: { notIn: excludeIds } },
      orderBy: { createdAt: 'desc' },
      take: limit - docs.length,
    });
    docs = docs.concat(extra);
  }

  return {
    message: 'Related wallpapers fetched',
    data: { wallpapers: docs.map((d) => serializeCard(d, favSet)) },
    statusCode: 200,
  };
};

// ── POST /wallpapers/:slug/download — track a download ───────────────────
exports.trackDownload = async (slug, body = {}, userId = null, origin = '') => {
  const doc = await prisma.wallpaper.findFirst({ where: { slug, status: 'active' } });
  if (!doc) throw fail('Wallpaper not found', 404);

  // Premium gating: premium wallpapers are downloadable by premium members
  // and by admins (full site access). Non-premium wallpapers stay open to any
  // signed-in user. isPremium/role are read from the DB (authoritative).
  if (doc.isPremium) {
    const user = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { isPremium: true, role: true },
        })
      : null;
    if (!hasPremiumAccess(user)) {
      throw fail('This is a premium wallpaper — upgrade to Premium to download it.', 403);
    }
  }

  await prisma.wallpaper.update({
    where: { id: doc.id },
    data: { downloadCount: { increment: 1 } },
  });

  // Sign a short-lived token for the requested resolution and return a link to
  // the file endpoint, which renders + serves the actual image.
  const parsed = parseResolution(body.resolution);
  if (!parsed.original && wouldUpscale(parsed.w, parsed.h, doc.width, doc.height)) {
    throw fail(
      'That resolution is larger than the original image — pick the original or a smaller size.',
      400,
    );
  }
  const payload = parsed.original
    ? { slug, original: true, p: 'dl' }
    : { slug, w: parsed.w, h: parsed.h, p: 'dl' };
  const token = jwt.sign(payload, DOWNLOAD_SECRET(), { expiresIn: '15m' });

  const resolutionLabel = parsed.original
    ? doc.width && doc.height
      ? `${doc.width}x${doc.height}`
      : 'original'
    : `${parsed.w}x${parsed.h}`;

  // Log a timestamped download event — powers the dashboard's downloads-per-day
  // trend + date filters. Best-effort: a logging failure must never break the
  // download itself (the counter is already incremented above).
  try {
    await prisma.downloadEvent.create({
      data: {
        wallpaperId: doc.id,
        userId: userId || null,
        resolution: resolutionLabel,
        isPremium: doc.isPremium,
      },
    });
  } catch {
    /* ignore — download already succeeded */
  }

  return {
    message: 'Download ready',
    data: {
      url: `${origin}/api/v1/wallpapers/${encodeURIComponent(slug)}/file?dl=${token}`,
      downloadCount: doc.downloadCount + 1,
      resolution: resolutionLabel,
    },
    statusCode: 200,
  };
};

// ── GET /wallpapers/:slug/file?dl=<token> — render + serve the download ────
// Validates the signed token (premium gate already enforced when issued).
//   • original → serve the stored source bytes as-is (matches sizeMB on the UI)
//   • WxH      → render a JPEG at that size (cached on disk)
function sourceMimeAndExt(imageUrl) {
  const pathOnly = String(imageUrl || '').split('?')[0].toLowerCase();
  if (pathOnly.endsWith('.png')) return { contentType: 'image/png', ext: 'png' };
  if (pathOnly.endsWith('.jpg') || pathOnly.endsWith('.jpeg')) {
    return { contentType: 'image/jpeg', ext: 'jpg' };
  }
  if (pathOnly.endsWith('.gif')) return { contentType: 'image/gif', ext: 'gif' };
  // Uploads pipeline stores optimized WebP by default.
  return { contentType: 'image/webp', ext: 'webp' };
}

exports.getDownloadFile = async (slug, token) => {
  if (!token) throw fail('Missing download token', 403);

  let payload;
  try {
    payload = jwt.verify(token, DOWNLOAD_SECRET());
  } catch {
    throw fail('This download link has expired — please try again.', 403);
  }
  if (payload.p !== 'dl' || payload.slug !== slug) throw fail('Invalid download link', 403);

  const doc = await prisma.wallpaper.findFirst({ where: { slug, status: 'active' } });
  if (!doc) throw fail('Wallpaper not found', 404);

  const sourceUrl = doc.originalUrl || doc.image;

  // Original download: return the exact stored file (no re-encode) so the
  // "Download Original (X MB)" label matches the bytes the user receives.
  if (payload.original) {
    const buffer = await fetchSource(sourceUrl);
    const { contentType, ext } = sourceMimeAndExt(sourceUrl);
    return {
      buffer,
      filename: `halalwalls-${slug}-original.${ext}`,
      contentType,
    };
  }

  const width = payload.w;
  const height = payload.h;
  const label = `${width}x${height}`;

  // Cache key includes updatedAt so an admin image change invalidates old files.
  const stamp = doc.updatedAt ? doc.updatedAt.getTime() : 0;
  const cacheFile = path.join(CACHE_DIR, `${doc.id}_${label}_${stamp}.jpg`);

  let buffer;
  try {
    buffer = await fs.promises.readFile(cacheFile); // cache hit → instant
  } catch {
    const source = await fetchSource(sourceUrl);
    buffer = await renderJpeg(source, width, height);
    fs.promises.writeFile(cacheFile, buffer).catch(() => {}); // best-effort cache
  }

  return { buffer, filename: `halalwalls-${slug}-${label}.jpg`, contentType: 'image/jpeg' };
};

// ── GET /wallpapers/tags — popular tags across active wallpapers ─────────
// Powers the homepage tag pills (tags users assign to wallpapers at upload).
// Postgres `unnest` expands the tags[] array so we can group + count per tag.
exports.listTags = async (query = {}) => {
  const limit = Math.min(60, Math.max(1, parseInt(query.limit, 10) || 24));
  // Union tags actually used on wallpapers with admin-created active tags, so
  // tags added in the admin panel also surface on the user side.
  const [used, managed] = await Promise.all([
    prisma.$queryRaw`
      SELECT t AS tag, count(*)::int AS count
      FROM hw_wallpapers w, unnest(w.tags) AS t
      WHERE w.status = 'active'
      GROUP BY t`,
    prisma.tag.findMany({ where: { isActive: true }, select: { name: true } }),
  ]);
  const map = new Map();
  used.forEach((r) => map.set(String(r.tag).toLowerCase(), { tag: r.tag, count: Number(r.count) }));
  managed.forEach((t) => {
    const k = t.name.toLowerCase();
    if (!map.has(k)) map.set(k, { tag: t.name, count: 0 });
  });
  const tags = [...map.values()]
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
  return { message: 'Tags fetched', data: { tags }, statusCode: 200 };
};

exports.serializeCard = serializeCard;
exports.serializeDetail = serializeDetail;
exports.downloadCatalogForSource = downloadCatalogForSource;
