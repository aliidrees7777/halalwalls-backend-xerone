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

const BROWSE_MODES = ['latest', 'popular', 'random', 'live'];
const DEFAULT_LIMIT = 18;
const MAX_LIMIT = 60;

// Fixed download-resolution set surfaced on the detail page (matches the
// frontend resolutions data). Returned alongside each wallpaper detail.
const DOWNLOAD_RESOLUTIONS = {
  desktop: [
    { label: '1920×1080', width: 1920, height: 1080, fileSizeMB: 1.42, device: 'desktop' },
    { label: '2560×1440', width: 2560, height: 1440, fileSizeMB: 2.18, device: 'desktop' },
    { label: '3840×2160', width: 3840, height: 2160, fileSizeMB: 4.86, device: 'desktop' },
    { label: '1280×720', width: 1280, height: 720, fileSizeMB: 0.88, device: 'desktop' },
    { label: '1366×768', width: 1366, height: 768, fileSizeMB: 0.94, device: 'desktop' },
    { label: '1600×900', width: 1600, height: 900, fileSizeMB: 1.12, device: 'desktop' },
  ],
  mobile: [
    { label: '1080×2400', width: 1080, height: 2400, fileSizeMB: 1.64, device: 'mobile' },
    { label: '1290×2796', width: 1290, height: 2796, fileSizeMB: 1.92, device: 'mobile' },
    { label: '1320×2868', width: 1320, height: 2868, fileSizeMB: 2.04, device: 'mobile' },
    { label: '1170×2532', width: 1170, height: 2532, fileSizeMB: 1.78, device: 'mobile' },
    { label: '1440×3200', width: 1440, height: 3200, fileSizeMB: 2.28, device: 'mobile' },
    { label: '1080×2340', width: 1080, height: 2340, fileSizeMB: 1.58, device: 'mobile' },
  ],
};

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
    resolutions: doc.resolutions || [],
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
    data: { wallpaper, downloadResolutions: DOWNLOAD_RESOLUTIONS },
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
exports.trackDownload = async (slug, body = {}) => {
  const bumped = await prisma.wallpaper.updateMany({
    where: { slug, status: 'active' },
    data: { downloadCount: { increment: 1 } },
  });
  if (bumped.count === 0) throw fail('Wallpaper not found', 404);

  const doc = await prisma.wallpaper.findUnique({ where: { slug } });

  return {
    message: 'Download tracked',
    data: {
      url: doc.originalUrl || doc.image,
      downloadCount: doc.downloadCount,
      resolution: (body && body.resolution) || doc.preferredResolution || doc.resolution || null,
    },
    statusCode: 200,
  };
};

// ── GET /wallpapers/tags — popular tags across active wallpapers ─────────
// Powers the homepage tag pills (tags users assign to wallpapers at upload).
// Postgres `unnest` expands the tags[] array so we can group + count per tag.
exports.listTags = async (query = {}) => {
  const limit = Math.min(60, Math.max(1, parseInt(query.limit, 10) || 24));
  const rows = await prisma.$queryRaw`
    SELECT t AS tag, count(*)::int AS count
    FROM hw_wallpapers w, unnest(w.tags) AS t
    WHERE w.status = 'active'
    GROUP BY t
    ORDER BY count DESC, t ASC
    LIMIT ${limit}`;
  return {
    message: 'Tags fetched',
    data: { tags: rows.map((r) => ({ tag: r.tag, count: Number(r.count) })) },
    statusCode: 200,
  };
};

exports.DOWNLOAD_RESOLUTIONS = DOWNLOAD_RESOLUTIONS;
// Shared serializers (re-used by the favorites/profile services).
exports.serializeCard = serializeCard;
exports.serializeDetail = serializeDetail;
