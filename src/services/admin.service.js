// Admin service — CMS/dashboard business logic for staff (admin role only).
// Implemented per the Admin CRUD plan:
//   • Q1.2 — getOverview (analytics counts)
//   • Q1.3 — contacts management
//   • Q2.1/2.2 — wallpaper management (read + write)
//   • Q2.3 — moderation queue (pending / approve / reject)
const prisma = require('../lib/prisma');
const { parsePagination, buildMeta, ADMIN_MAX_LIMIT } = require('../helpers/pagination');
const adminPage = (query) => parsePagination(query, { maxLimit: ADMIN_MAX_LIMIT });
const {
  resolutionKeysForSource,
  preferredResolutionForSource,
} = require('../helpers/resolution-filter');
const { resolveCategories, categoryWhere } = require('../helpers/category-resolve');

const fail = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const assertUuid = (id, label = 'id') => {
  if (!UUID_RE.test(String(id))) throw fail(`Invalid ${label}`, 400);
};

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const toBool = (v) => (v === 'true' || v === true ? true : v === 'false' || v === false ? false : undefined);

/** Cumulative downloads across all wallpapers (Wallpaper.downloadCount sum). */
async function getTotalDownloads() {
  const agg = await prisma.wallpaper.aggregate({ _sum: { downloadCount: true } });
  return agg._sum.downloadCount || 0;
}

/** Per-download event log — used for "this month" when the table/client is available. */
async function countDownloadEvents(where = {}) {
  try {
    if (typeof prisma.downloadEvent?.count === 'function') {
      return await prisma.downloadEvent.count({ where });
    }
  } catch {
    /* stale Prisma client or missing hw_download_events table */
  }
  return 0;
}

const CONTACT_STATUSES = ['new', 'read', 'resolved'];
const WALLPAPER_STATUSES = ['active', 'pending', 'hidden'];

const UPLOADER_SELECT = { select: { id: true, firstName: true, lastName: true, email: true } };

const serializeContact = (c) => ({
  id: c.id,
  name: c.name,
  email: c.email,
  reason: c.reason,
  message: c.message,
  status: c.status,
  createdAt: c.createdAt,
});

const serializeAdminWallpaper = (w) => ({
  id: w.id,
  title: w.title,
  slug: w.slug,
  description: w.description,
  category: w.category,
  categorySlug: w.categorySlug,
  categories: Array.isArray(w.categories) && w.categories.length
    ? w.categories
    : w.category
      ? [w.category]
      : [],
  categorySlugs: Array.isArray(w.categorySlugs) && w.categorySlugs.length
    ? w.categorySlugs
    : w.categorySlug
      ? [w.categorySlug]
      : [],
  tags: w.tags,
  image: w.image,
  originalUrl: w.originalUrl,
  thumbnailUrl: w.thumbnailUrl,
  resolution: w.resolution,
  preferredResolution: w.preferredResolution,
  resolutions: w.resolutions,
  sizeMB: w.sizeMB,
  width: w.width,
  height: w.height,
  author: w.author,
  isPremium: w.isPremium,
  isLive: w.isLive,
  status: w.status,
  downloadCount: w.downloadCount,
  views: w.views,
  favoritesCount: w.favoritesCount,
  uploadedById: w.uploadedById,
  uploadedBy: w.uploadedBy
    ? {
        id: w.uploadedBy.id,
        name: `${w.uploadedBy.firstName || ''} ${w.uploadedBy.lastName || ''}`.trim(),
        email: w.uploadedBy.email,
      }
    : null,
  createdAt: w.createdAt,
  updatedAt: w.updatedAt,
});

const serializeAdminUser = (u) => ({
  id: u.id,
  firstName: u.firstName,
  lastName: u.lastName,
  name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
  email: u.email,
  role: u.role,
  authProvider: u.authProvider,
  emailVerified: u.emailVerified,
  isPremium: u.role === 'admin' ? true : !!u.isPremium,
  subscriptionPlan: u.role === 'admin' ? (u.subscriptionPlan || 'lifetime') : u.subscriptionPlan || null,
  isDeleted: !!u.isDeleted,
  status: u.isDeleted ? 'deactivated' : 'active',
  avatar: u.avatar,
  banner: u.banner,
  bio: u.bio,
  favoritesCount: u._count ? u._count.favorites : 0,
  uploadsCount: u._count ? u._count.uploadedWallpapers : 0,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

const USER_COUNTS = { _count: { select: { favorites: true, uploadedWallpapers: true } } };

const WALLPAPER_SORTS = {
  latest: [{ createdAt: 'desc' }],
  oldest: [{ createdAt: 'asc' }],
  popular: [{ downloadCount: 'desc' }, { createdAt: 'desc' }],
  views: [{ views: 'desc' }, { createdAt: 'desc' }],
  title: [{ title: 'asc' }],
};

// Derive a slug from base that doesn't collide with an existing wallpaper.
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

// ── GET /admin/overview — dashboard analytics ────────────────────────────
exports.getOverview = async () => {
  const [
    userTotal,
    adminCount,
    premiumUsers,
    verifiedUsers,
    wpStatusGroups,
    liveCount,
    premiumWps,
    categoryTotal,
    contactStatusGroups,
    wpAgg,
    favoritesTotal,
    downloadTotal,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.user.count({ where: { isPremium: true } }),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.wallpaper.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.wallpaper.count({ where: { isLive: true } }),
    prisma.wallpaper.count({ where: { isPremium: true } }),
    prisma.category.count(),
    prisma.contact.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.wallpaper.aggregate({ _sum: { views: true } }),
    prisma.favorite.count(),
    getTotalDownloads(),
  ]);

  const wpByStatus = { active: 0, pending: 0, hidden: 0 };
  wpStatusGroups.forEach((g) => { wpByStatus[g.status] = g._count._all; });
  const wpTotal = wpByStatus.active + wpByStatus.pending + wpByStatus.hidden;

  const cByStatus = { new: 0, read: 0, resolved: 0 };
  contactStatusGroups.forEach((g) => { cByStatus[g.status] = g._count._all; });
  const contactTotal = cByStatus.new + cByStatus.read + cByStatus.resolved;

  return {
    message: 'Admin overview',
    data: {
      users: {
        total: userTotal,
        admins: adminCount,
        regular: userTotal - adminCount,
        premium: premiumUsers,
        verified: verifiedUsers,
        unverified: userTotal - verifiedUsers,
      },
      wallpapers: {
        total: wpTotal,
        active: wpByStatus.active,
        pending: wpByStatus.pending,
        hidden: wpByStatus.hidden,
        live: liveCount,
        premium: premiumWps,
      },
      categories: { total: categoryTotal },
      contacts: {
        total: contactTotal,
        new: cByStatus.new,
        read: cByStatus.read,
        resolved: cByStatus.resolved,
      },
      engagement: {
        totalDownloads: downloadTotal,
        totalViews: wpAgg._sum.views || 0,
        totalFavorites: favoritesTotal,
      },
    },
    statusCode: 200,
  };
};

// ───────────────────────── Wallpaper management ─────────────────────────

// GET /admin/wallpapers — list ALL statuses (search / filter / sort / paginate)
exports.listWallpapers = async (query = {}) => {
  const { page, limit, skip } = adminPage(query);

  const where = {};
  if (query.status) {
    if (!WALLPAPER_STATUSES.includes(query.status)) {
      throw fail(`status must be one of: ${WALLPAPER_STATUSES.join(', ')}`, 400);
    }
    where.status = query.status;
  }
  if (query.category) Object.assign(where, categoryWhere(query.category));
  if (query.resolution) where.resolution = String(query.resolution).trim();
  const prem = toBool(query.isPremium);
  if (prem !== undefined) where.isPremium = prem;
  const live = toBool(query.isLive);
  if (live !== undefined) where.isLive = live;

  const q = String(query.q || '').trim();
  if (q) {
    const searchOr = [
      { uploadedBy: { is: { email: { contains: q, mode: 'insensitive' } } } },
      { uploadedBy: { is: { firstName: { contains: q, mode: 'insensitive' } } } },
      { title: { contains: q, mode: 'insensitive' } },
      { categorySlug: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
      { categories: { has: q } },
      { categorySlugs: { has: slugify(q) } },
      { tags: { has: q } },
    ];
    where.AND = [...(where.AND || []), { OR: searchOr }];
  }

  const orderBy = WALLPAPER_SORTS[query.sort] || WALLPAPER_SORTS.latest;

  const [rows, total] = await Promise.all([
    prisma.wallpaper.findMany({ where, orderBy, skip, take: limit, include: { uploadedBy: UPLOADER_SELECT } }),
    prisma.wallpaper.count({ where }),
  ]);

  return {
    message: 'Wallpapers fetched',
    data: { wallpapers: rows.map(serializeAdminWallpaper), pagination: buildMeta(total, page, limit) },
    statusCode: 200,
  };
};

// GET /admin/wallpapers/stats — headline cards + filter options for the page.
exports.getWallpaperStats = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthWhere = { createdAt: { gte: startOfMonth } };

  const [statusGroups, dlTotal, statusGroupsMonth, dlMonth, resolutionGroups, categories] =
    await Promise.all([
      prisma.wallpaper.groupBy({ by: ['status'], _count: { _all: true } }),
      getTotalDownloads(),
      prisma.wallpaper.groupBy({ by: ['status'], where: monthWhere, _count: { _all: true } }),
      countDownloadEvents(monthWhere),
      prisma.wallpaper.groupBy({ by: ['resolution'], _count: { _all: true } }),
      prisma.category.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { name: true, slug: true } }),
    ]);

  const byStatus = (groups) => {
    const m = { active: 0, pending: 0, hidden: 0 };
    groups.forEach((g) => { if (m[g.status] !== undefined) m[g.status] = g._count._all; });
    return m;
  };
  const all = byStatus(statusGroups);
  const month = byStatus(statusGroupsMonth);
  const total = all.active + all.pending + all.hidden;
  const totalMonth = month.active + month.pending + month.hidden;

  const resolutions = resolutionGroups
    .filter((r) => r.resolution)
    .sort((a, b) => b._count._all - a._count._all)
    .map((r) => ({ label: r.resolution, value: r.resolution }));

  return {
    message: 'Wallpaper stats',
    data: {
      total,
      approved: all.active,
      pending: all.pending,
      rejected: all.hidden,
      downloads: dlTotal,
      thisMonth: {
        total: totalMonth,
        approved: month.active,
        pending: month.pending,
        rejected: month.hidden,
        downloads: dlMonth,
      },
      filters: {
        categories: categories.map((c) => ({ label: c.name, value: c.slug })),
        resolutions,
      },
    },
    statusCode: 200,
  };
};

// GET /admin/wallpapers/export — CSV of wallpapers, respecting the same filters.
exports.exportWallpapersCsv = async (query = {}) => {
  const where = {};
  if (query.status && WALLPAPER_STATUSES.includes(query.status)) where.status = query.status;
  if (query.category) Object.assign(where, categoryWhere(query.category));
  if (query.resolution) where.resolution = String(query.resolution).trim();
  const q = String(query.q || '').trim();
  if (q) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { categories: { has: q } },
          { tags: { has: q } },
          { uploadedBy: { is: { email: { contains: q, mode: 'insensitive' } } } },
        ],
      },
    ];
  }

  const rows = await prisma.wallpaper.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000,
    include: { uploadedBy: UPLOADER_SELECT },
  });

  const headers = ['Title', 'Category', 'Resolution', 'Status', 'Downloads', 'Views', 'Premium', 'Uploader', 'Uploader Email', 'Uploaded At'];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  rows.forEach((w) => {
    lines.push([
      w.title,
      w.category || '',
      w.resolution || '',
      w.status === 'active' ? 'Approved' : w.status === 'hidden' ? 'Rejected' : 'Pending',
      w.downloadCount,
      w.views,
      w.isPremium ? 'Yes' : 'No',
      w.uploadedBy ? `${w.uploadedBy.firstName || ''} ${w.uploadedBy.lastName || ''}`.trim() : 'HalalWalls',
      w.uploadedBy ? w.uploadedBy.email : '',
      new Date(w.createdAt).toISOString(),
    ].map(esc).join(','));
  });
  return { csv: lines.join('\n'), count: rows.length };
};

// ───────────────────────── Category management ─────────────────────────
// Per-category live wallpaper count + download total (active wallpapers only).
// Counts a wallpaper under every category it belongs to (primary + multi).
async function categoryUsage() {
  const walls = await prisma.wallpaper.findMany({
    where: { status: 'active' },
    select: { categorySlug: true, categorySlugs: true, downloadCount: true },
  });
  const bySlug = {};
  for (const w of walls) {
    const slugs = new Set([
      ...(w.categorySlug ? [w.categorySlug] : []),
      ...(Array.isArray(w.categorySlugs) ? w.categorySlugs : []),
    ]);
    for (const slug of slugs) {
      if (!bySlug[slug]) bySlug[slug] = { count: 0, downloads: 0 };
      bySlug[slug].count += 1;
      bySlug[slug].downloads += w.downloadCount || 0;
    }
  }
  return bySlug;
}

// GET /admin/categories — categories with counts/downloads/status (search/sort/paginate).
exports.listCategoriesAdmin = async (query = {}) => {
  const { page, limit, skip } = adminPage(query);
  const [cats, usage] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    categoryUsage(),
  ]);

  let rows = cats.map((c) => {
    const u = usage[c.slug] || { count: 0, downloads: 0 };
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description || '',
      image: c.image || null,
      isPremium: !!c.isPremium,
      wallpaperCount: u.count,
      downloads: u.downloads,
      isActive: c.isActive !== false,
      // Admin activate/deactivate toggle (hidden from nav/upload when inactive).
      status: c.isActive !== false ? 'active' : 'inactive',
      createdAt: c.createdAt,
    };
  });

  const q = String(query.q || '').trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.includes(q));
  if (query.status === 'active' || query.status === 'inactive') {
    rows = rows.filter((r) => r.status === query.status);
  }

  const sort = query.sort || 'latest';
  rows.sort((a, b) => {
    if (sort === 'wallpapers') return b.wallpaperCount - a.wallpaperCount;
    if (sort === 'downloads') return b.downloads - a.downloads;
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    return new Date(b.createdAt) - new Date(a.createdAt); // latest
  });

  const total = rows.length;
  return {
    message: 'Categories fetched',
    data: { categories: rows.slice(skip, skip + limit), pagination: buildMeta(total, page, limit) },
    statusCode: 200,
  };
};

// GET /admin/categories/stats — headline cards for the Categories page.
exports.getCategoryStats = async () => {
  const [cats, usage] = await Promise.all([
    prisma.category.findMany({ select: { slug: true, name: true, isActive: true } }),
    categoryUsage(),
  ]);
  let totalWallpapers = 0;
  let totalDownloads = 0;
  let active = 0;
  let mostPopular = null;
  cats.forEach((c) => {
    const u = usage[c.slug] || { count: 0, downloads: 0 };
    totalWallpapers += u.count;
    totalDownloads += u.downloads;
    if (c.isActive !== false) active += 1;
    if (!mostPopular || u.downloads > mostPopular.downloads) {
      mostPopular = { name: c.name, downloads: u.downloads };
    }
  });
  return {
    message: 'Category stats',
    data: { total: cats.length, active, totalWallpapers, totalDownloads, mostPopular },
    statusCode: 200,
  };
};

// GET /admin/wallpapers/:id
exports.getWallpaper = async (id) => {
  assertUuid(id, 'wallpaper id');
  const w = await prisma.wallpaper.findUnique({ where: { id }, include: { uploadedBy: UPLOADER_SELECT } });
  if (!w) throw fail('Wallpaper not found', 404);
  return { message: 'Wallpaper fetched', data: { wallpaper: serializeAdminWallpaper(w) }, statusCode: 200 };
};

// POST /admin/wallpapers — create from metadata + image URL (no media pipeline)
exports.createWallpaper = async (body = {}, adminId = null) => {
  const title = body.title && String(body.title).trim();
  if (!title) throw fail('Title is required', 400);
  const image = body.image && String(body.image).trim();
  if (!image) throw fail('An image URL is required', 400);
  if (body.status && !WALLPAPER_STATUSES.includes(body.status)) {
    throw fail(`status must be one of: ${WALLPAPER_STATUSES.join(', ')}`, 400);
  }

  const slug = await uniqueSlug(slugify(body.slug || title));

  const cats = await resolveCategories(body);

  const width = Number.isFinite(+body.width) ? +body.width : null;
  const height = Number.isFinite(+body.height) ? +body.height : null;
  const resolution = body.resolution
    ? String(body.resolution).trim()
    : width && height
      ? `${width}x${height}`
      : '';
  // Cascade: only same-or-smaller standard sizes the source can cover.
  const cascadeKeys =
    width && height
      ? resolutionKeysForSource(width, height)
      : Array.isArray(body.resolutions)
        ? body.resolutions
        : [];
  const preferred =
    (body.preferredResolution && String(body.preferredResolution).trim()) ||
    (width && height ? preferredResolutionForSource(width, height) : null) ||
    resolution;

  const created = await prisma.wallpaper.create({
    data: {
      title,
      slug,
      description: body.description ? String(body.description).trim() : '',
      category: cats.category,
      categorySlug: cats.categorySlug,
      categories: cats.categories,
      categorySlugs: cats.categorySlugs,
      tags: Array.isArray(body.tags) ? body.tags : [],
      image,
      originalUrl: body.originalUrl ? String(body.originalUrl).trim() : image,
      thumbnailUrl: body.thumbnailUrl ? String(body.thumbnailUrl).trim() : image,
      resolution,
      preferredResolution: preferred,
      resolutions: cascadeKeys,
      sizeMB: Number.isFinite(+body.sizeMB) ? +body.sizeMB : 0,
      width,
      height,
      author: body.author ? String(body.author).trim() : 'HalalWalls',
      isPremium: !!body.isPremium,
      isLive: !!body.isLive,
      status: body.status || 'active',
      uploadedById: adminId || null,
    },
    include: { uploadedBy: UPLOADER_SELECT },
  });

  return { message: 'Wallpaper created', data: { wallpaper: serializeAdminWallpaper(created) }, statusCode: 201 };
};

// PATCH /admin/wallpapers/:id — update any editable field
exports.updateWallpaper = async (id, body = {}) => {
  assertUuid(id, 'wallpaper id');

  const data = {};
  ['title', 'description', 'image', 'originalUrl', 'thumbnailUrl', 'resolution', 'preferredResolution', 'author'].forEach((k) => {
    if (body[k] !== undefined) data[k] = typeof body[k] === 'string' ? body[k].trim() : body[k];
  });
  // Multi-category: accept categorySlugs / categories arrays (or legacy single fields).
  if (
    body.categorySlugs !== undefined ||
    body.categories !== undefined ||
    body.categorySlug !== undefined ||
    body.category !== undefined
  ) {
    const cats = await resolveCategories(body);
    data.category = cats.category;
    data.categorySlug = cats.categorySlug;
    data.categories = cats.categories;
    data.categorySlugs = cats.categorySlugs;
  }
  if (body.tags !== undefined) data.tags = Array.isArray(body.tags) ? body.tags : [];
  if (body.resolutions !== undefined) data.resolutions = Array.isArray(body.resolutions) ? body.resolutions : [];
  if (body.sizeMB !== undefined) data.sizeMB = Number.isFinite(+body.sizeMB) ? +body.sizeMB : 0;
  if (body.width !== undefined) data.width = Number.isFinite(+body.width) ? +body.width : null;
  if (body.height !== undefined) data.height = Number.isFinite(+body.height) ? +body.height : null;

  // When dims change (or are present after update), rebuild cascade keys so
  // filters never list a wallpaper under a size it can't actually serve.
  if (data.width !== undefined || data.height !== undefined || body.resolutions === undefined) {
    const existing = await prisma.wallpaper.findUnique({
      where: { id },
      select: { width: true, height: true, resolution: true },
    });
    if (!existing) throw fail('Wallpaper not found', 404);
    const w = data.width !== undefined ? data.width : existing.width;
    const h = data.height !== undefined ? data.height : existing.height;
    if (w && h) {
      if (body.resolutions === undefined) data.resolutions = resolutionKeysForSource(w, h);
      if (body.preferredResolution === undefined) {
        data.preferredResolution = preferredResolutionForSource(w, h) || existing.resolution || `${w}x${h}`;
      }
      if (body.resolution === undefined && !existing.resolution) {
        data.resolution = `${w}x${h}`;
      }
    }
  }

  if (body.isPremium !== undefined) data.isPremium = !!body.isPremium;
  if (body.isLive !== undefined) data.isLive = !!body.isLive;
  if (body.status !== undefined) {
    if (!WALLPAPER_STATUSES.includes(body.status)) {
      throw fail(`status must be one of: ${WALLPAPER_STATUSES.join(', ')}`, 400);
    }
    data.status = body.status;
  }
  if (body.title !== undefined && !data.title) throw fail('Title cannot be empty', 400);
  if (body.slug !== undefined) {
    const s = slugify(body.slug);
    if (!s) throw fail('Invalid slug', 400);
    const existing = await prisma.wallpaper.findUnique({ where: { slug: s } });
    if (existing && existing.id !== id) throw fail('A wallpaper with this slug already exists', 409);
    data.slug = s;
  }
  if (Object.keys(data).length === 0) throw fail('No valid fields to update', 400);

  let updated;
  try {
    updated = await prisma.wallpaper.update({ where: { id }, data, include: { uploadedBy: UPLOADER_SELECT } });
  } catch (err) {
    if (err.code === 'P2025') throw fail('Wallpaper not found', 404);
    throw err;
  }
  return { message: 'Wallpaper updated', data: { wallpaper: serializeAdminWallpaper(updated) }, statusCode: 200 };
};

// DELETE /admin/wallpapers/:id (cascades favorites)
exports.deleteWallpaper = async (id) => {
  assertUuid(id, 'wallpaper id');
  try {
    await prisma.wallpaper.delete({ where: { id } });
  } catch (err) {
    if (err.code === 'P2025') throw fail('Wallpaper not found', 404);
    throw err;
  }
  return { message: 'Wallpaper deleted', data: { id }, statusCode: 200 };
};

// ───────────────────────── Moderation queue ─────────────────────────

// GET /admin/wallpapers/pending — user submissions awaiting review (FIFO)
exports.listPending = async (query = {}) => {
  const { page, limit, skip } = adminPage(query);
  const where = { status: 'pending' };
  const [rows, total] = await Promise.all([
    prisma.wallpaper.findMany({ where, orderBy: { createdAt: 'asc' }, skip, take: limit, include: { uploadedBy: UPLOADER_SELECT } }),
    prisma.wallpaper.count({ where }),
  ]);
  return {
    message: 'Pending wallpapers fetched',
    data: { wallpapers: rows.map(serializeAdminWallpaper), pagination: buildMeta(total, page, limit) },
    statusCode: 200,
  };
};

async function setWallpaperStatus(id, status, okMessage) {
  assertUuid(id, 'wallpaper id');
  let updated;
  try {
    updated = await prisma.wallpaper.update({ where: { id }, data: { status }, include: { uploadedBy: UPLOADER_SELECT } });
  } catch (err) {
    if (err.code === 'P2025') throw fail('Wallpaper not found', 404);
    throw err;
  }
  return { message: okMessage, data: { wallpaper: serializeAdminWallpaper(updated) }, statusCode: 200 };
}

// PATCH /admin/wallpapers/:id/approve → status active
exports.approve = async (id) => setWallpaperStatus(id, 'active', 'Wallpaper approved');

// PATCH /admin/wallpapers/:id/reject → status hidden
exports.reject = async (id) => setWallpaperStatus(id, 'hidden', 'Wallpaper rejected');

// ───────────────────────── Subscribers ─────────────────────────
// Premium members (real end-users with a paid plan). Revenue is estimated from
// the plan price (no payments table in the schema).
const SUB_PLAN_PRICE = { monthly: 2.99, yearly: 9.99, lifetime: 29.99 };
const SUB_PLANS = ['monthly', 'yearly', 'lifetime'];
const SUB_SCOPE = { isPremium: true, role: 'user', isDeleted: false };

const serializeSubscriber = (u) => ({
  id: u.id,
  name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
  email: u.email,
  avatar: u.avatar || null,
  plan: u.subscriptionPlan || 'premium',
  status: u.subscriptionStatus || 'active',
  revenue: SUB_PLAN_PRICE[u.subscriptionPlan] || 0,
  currentPeriodEnd: u.currentPeriodEnd,
  createdAt: u.createdAt,
});

// GET /admin/subscribers — premium members (search / plan filter / sort / paginate).
exports.listSubscribers = async (query = {}) => {
  const { page, limit, skip } = adminPage(query);
  const where = { ...SUB_SCOPE };
  if (query.plan && SUB_PLANS.includes(query.plan)) where.subscriptionPlan = query.plan;
  const q = String(query.q || '').trim();
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
    ];
  }
  const sortMap = {
    latest: [{ createdAt: 'desc' }],
    oldest: [{ createdAt: 'asc' }],
    name: [{ firstName: 'asc' }],
  };
  const orderBy = sortMap[query.sort] || sortMap.latest;

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true, firstName: true, lastName: true, email: true, avatar: true,
        subscriptionPlan: true, subscriptionStatus: true, currentPeriodEnd: true, createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    message: 'Subscribers fetched',
    data: { subscribers: rows.map(serializeSubscriber), pagination: buildMeta(total, page, limit) },
    statusCode: 200,
  };
};

// GET /admin/subscribers/stats — headline cards for the Subscribers page.
exports.getSubscriberStats = async () => {
  const groups = await prisma.user.groupBy({
    by: ['subscriptionPlan'],
    where: SUB_SCOPE,
    _count: { _all: true },
  });
  const plans = { monthly: 0, yearly: 0, lifetime: 0 };
  groups.forEach((g) => { if (g.subscriptionPlan && plans[g.subscriptionPlan] !== undefined) plans[g.subscriptionPlan] = g._count._all; });
  const total = plans.monthly + plans.yearly + plans.lifetime;
  const revenue = plans.monthly * SUB_PLAN_PRICE.monthly + plans.yearly * SUB_PLAN_PRICE.yearly + plans.lifetime * SUB_PLAN_PRICE.lifetime;
  return {
    message: 'Subscriber stats',
    data: {
      total,
      monthly: plans.monthly,
      yearly: plans.yearly,
      lifetime: plans.lifetime,
      revenue: Math.round(revenue * 100) / 100,
    },
    statusCode: 200,
  };
};

// ───────────────────────── Tag management ─────────────────────────
// Per-tag live usage from Wallpaper.tags[] (case-insensitive), via unnest.
async function tagUsage() {
  const rows = await prisma.$queryRaw`
    SELECT lower(tag) AS name, count(*)::int AS wp, coalesce(sum("downloadCount"), 0)::int AS dl
    FROM hw_wallpapers, unnest(tags) AS tag
    WHERE status = 'active'
    GROUP BY lower(tag)`;
  const map = {};
  rows.forEach((r) => { map[r.name] = { count: Number(r.wp), downloads: Number(r.dl) }; });
  return map;
}

// Build the union of managed Tag rows + tags actually used on wallpapers.
function unionTags(tags, usage) {
  const byKey = {};
  tags.forEach((t) => { byKey[t.name.toLowerCase()] = t; });
  const keys = new Set([...Object.keys(byKey), ...Object.keys(usage)]);
  return [...keys].map((k) => {
    const t = byKey[k];
    const u = usage[k] || { count: 0, downloads: 0 };
    const isActive = t ? t.isActive !== false : true;
    return {
      id: t ? t.id : k,
      name: t ? t.name : k,
      slug: t ? t.slug : k,
      description: t ? t.description : '',
      isActive,
      status: isActive ? 'active' : 'inactive',
      wallpaperCount: u.count,
      downloads: u.downloads,
      managed: !!t,
      createdAt: t ? t.createdAt : null,
    };
  });
}

// GET /admin/tags — union list with usage (search / status filter / sort / paginate).
exports.listTagsAdmin = async (query = {}) => {
  const { page, limit, skip } = adminPage(query);
  const [tags, usage] = await Promise.all([prisma.tag.findMany(), tagUsage()]);
  let rows = unionTags(tags, usage);

  const q = String(query.q || '').trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));
  if (query.status === 'active' || query.status === 'inactive') {
    rows = rows.filter((r) => r.status === query.status);
  }

  const sort = query.sort || 'wallpapers';
  rows.sort((a, b) => {
    if (sort === 'downloads') return b.downloads - a.downloads;
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    if (sort === 'latest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    return b.wallpaperCount - a.wallpaperCount; // "most used" default
  });

  const total = rows.length;
  return {
    message: 'Tags fetched',
    data: { tags: rows.slice(skip, skip + limit), pagination: buildMeta(total, page, limit) },
    statusCode: 200,
  };
};

// GET /admin/tags/stats — headline cards for the Tags page.
exports.getTagStats = async () => {
  const [tags, usage, wpTagged, dlAgg] = await Promise.all([
    prisma.tag.findMany(),
    tagUsage(),
    prisma.wallpaper.count({ where: { status: 'active', NOT: { tags: { isEmpty: true } } } }),
    prisma.wallpaper.aggregate({ _sum: { downloadCount: true } }),
  ]);
  const rows = unionTags(tags, usage);
  const active = rows.filter((r) => r.isActive).length;
  let mostUsed = null;
  rows.forEach((r) => { if (!mostUsed || r.wallpaperCount > mostUsed.count) mostUsed = { name: r.name, count: r.wallpaperCount }; });
  return {
    message: 'Tag stats',
    data: {
      total: rows.length,
      active,
      totalWallpapers: wpTagged,
      totalDownloads: dlAgg._sum.downloadCount || 0,
      mostUsed,
    },
    statusCode: 200,
  };
};

// POST /admin/tags — admin creates a tag.
exports.createTag = async (body = {}) => {
  const name = body.name && String(body.name).trim().replace(/^#/, '');
  if (!name) throw fail('Tag name is required', 400);
  const slug = slugify(name);
  if (!slug) throw fail('Could not derive a valid slug from the name', 400);
  if (await prisma.tag.findFirst({ where: { OR: [{ slug }, { name }] } })) {
    throw fail('This tag already exists', 409);
  }
  const tag = await prisma.tag.create({
    data: { name, slug, description: body.description ? String(body.description).trim() : '', isActive: body.isActive === undefined ? true : !!body.isActive },
  });
  return { message: 'Tag created', data: { tag }, statusCode: 201 };
};

// PATCH /admin/tags/:slug — update (upsert; used-only tags may not have a row yet).
exports.updateTag = async (slug, body = {}) => {
  const data = {};
  if (body.description !== undefined) data.description = String(body.description).trim();
  if (body.isActive !== undefined) data.isActive = !!body.isActive;
  if (body.name !== undefined && String(body.name).trim()) data.name = String(body.name).trim().replace(/^#/, '');
  const name = data.name || slug;
  const tag = await prisma.tag.upsert({
    where: { slug },
    update: data,
    create: { name, slug, description: data.description || '', isActive: data.isActive === undefined ? true : data.isActive },
  });
  return { message: 'Tag updated', data: { tag }, statusCode: 200 };
};

// DELETE /admin/tags/:slug — remove metadata row + strip the tag from every wallpaper.
exports.deleteTag = async (slug) => {
  const tag = await prisma.tag.findUnique({ where: { slug } });
  const name = tag ? tag.name : slug;
  if (tag) await prisma.tag.delete({ where: { slug } });
  await prisma.$executeRaw`
    UPDATE hw_wallpapers
    SET tags = coalesce((SELECT array_agg(t) FROM unnest(tags) t WHERE lower(t) <> lower(${name})), '{}')
    WHERE EXISTS (SELECT 1 FROM unnest(tags) t WHERE lower(t) = lower(${name}))`;
  return { message: 'Tag deleted', data: { slug }, statusCode: 200 };
};

// ───────────────────────── User management ─────────────────────────

// GET /admin/users — search / filter / paginate (with favorites + uploads counts)
exports.listUsers = async (query = {}) => {
  const { page, limit, skip } = adminPage(query);

  const where = {};
  if (query.role) {
    if (!['user', 'admin'].includes(query.role)) throw fail('role must be one of: user, admin', 400);
    where.role = query.role;
  }
  const verified = toBool(query.verified);
  if (verified !== undefined) where.emailVerified = verified;
  const prem = toBool(query.isPremium);
  if (prem !== undefined) where.isPremium = prem;
  if (query.status === 'active') where.isDeleted = false;
  if (query.status === 'deactivated') where.isDeleted = true;

  const q = String(query.q || '').trim();
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
    ];
  }

  const sortMap = {
    latest: { createdAt: 'desc' },
    oldest: { createdAt: 'asc' },
    name: { firstName: 'asc' },
    uploads: { uploadedWallpapers: { _count: 'desc' } },
  };
  const orderBy = sortMap[query.sort] || sortMap.latest;

  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy, skip, take: limit, include: USER_COUNTS }),
    prisma.user.count({ where }),
  ]);

  return {
    message: 'Users fetched',
    data: { users: rows.map(serializeAdminUser), pagination: buildMeta(total, page, limit) },
    statusCode: 200,
  };
};

// GET /admin/users/stats — headline cards for the Users page.
exports.getUserStats = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const USERS = { role: 'user', isDeleted: false };
  const [total, premium, verified, admins, newThisMonth, newPrevMonth] = await Promise.all([
    prisma.user.count({ where: USERS }),
    prisma.user.count({ where: { ...USERS, isPremium: true } }),
    prisma.user.count({ where: { ...USERS, emailVerified: true } }),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.user.count({ where: { role: 'user', createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { role: 'user', createdAt: { gte: startPrevMonth, lt: startOfMonth } } }),
  ]);
  const growth = newPrevMonth
    ? Math.round(((newThisMonth - newPrevMonth) / newPrevMonth) * 1000) / 10
    : (newThisMonth ? 100 : 0);
  return {
    message: 'User stats',
    data: { total, premium, verified, admins, newThisMonth, growth },
    statusCode: 200,
  };
};

// POST /admin/users — admin creates a user.
exports.createUser = async (body = {}) => {
  const bcrypt = require('bcryptjs');
  const firstName = body.firstName && String(body.firstName).trim();
  const email = body.email && String(body.email).trim().toLowerCase();
  const password = body.password && String(body.password);
  if (!firstName) throw fail('First name is required', 400);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail('A valid email is required', 400);
  if (!password || password.length < 8) throw fail('Password must be at least 8 characters', 400);
  const role = ['user', 'admin'].includes(body.role) ? body.role : 'user';
  if (await prisma.user.findUnique({ where: { email } })) throw fail('A user with this email already exists', 409);

  const created = await prisma.user.create({
    data: {
      firstName,
      lastName: body.lastName ? String(body.lastName).trim() : '',
      email,
      password: await bcrypt.hash(password, 10),
      role,
      // Admins are always premium members on the public site.
      isPremium: role === 'admin' ? true : !!body.isPremium,
      subscriptionPlan: role === 'admin' ? 'lifetime' : null,
      subscriptionStatus: role === 'admin' ? 'active' : null,
      emailVerified: body.emailVerified === undefined ? true : !!body.emailVerified,
      authProvider: 'local',
    },
    include: USER_COUNTS,
  });
  return { message: 'User created', data: { user: serializeAdminUser(created) }, statusCode: 201 };
};

// GET /admin/users/:id — single user + counts
exports.getUser = async (id) => {
  assertUuid(id, 'user id');
  const u = await prisma.user.findUnique({ where: { id }, include: USER_COUNTS });
  if (!u) throw fail('User not found', 404);
  return { message: 'User fetched', data: { user: serializeAdminUser(u) }, statusCode: 200 };
};

// PATCH /admin/users/:id — profile fields + admin overrides (role/premium/verified/status)
exports.updateUser = async (id, body = {}) => {
  assertUuid(id, 'user id');
  const data = {};
  ['firstName', 'lastName', 'bio', 'avatar', 'banner'].forEach((k) => {
    if (body[k] !== undefined) data[k] = typeof body[k] === 'string' ? body[k].trim() : body[k];
  });
  if (body.firstName !== undefined && !data.firstName) throw fail('First name cannot be empty', 400);

  // Admin overrides.
  if (body.isPremium !== undefined) data.isPremium = !!body.isPremium;
  if (body.emailVerified !== undefined) data.emailVerified = !!body.emailVerified;
  if (body.role !== undefined) {
    if (!['user', 'admin'].includes(body.role)) throw fail('role must be one of: user, admin', 400);
    // Don't allow demoting the last remaining admin.
    if (body.role === 'user') {
      const current = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (current && current.role === 'admin') {
        const admins = await prisma.user.count({ where: { role: 'admin' } });
        if (admins <= 1) throw fail('Cannot demote the last admin account', 400);
      }
    }
    data.role = body.role;
  }
  if (body.isDeleted !== undefined) {
    data.isDeleted = !!body.isDeleted;
    data.deletedAt = body.isDeleted ? new Date() : null;
    if (body.isDeleted) data.sessionsValidFrom = new Date(); // force sign-out on deactivate
  }

  if (Object.keys(data).length === 0) {
    throw fail('No valid fields to update', 400);
  }

  // Resolve final role so admins can never lose public-site premium.
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!existing) throw fail('User not found', 404);
  const finalRole = data.role || existing.role;
  if (finalRole === 'admin') {
    data.isPremium = true;
    data.subscriptionPlan = 'lifetime';
    data.subscriptionStatus = 'active';
  }

  let user;
  try {
    user = await prisma.user.update({ where: { id }, data, include: USER_COUNTS });
  } catch (err) {
    if (err.code === 'P2025') throw fail('User not found', 404);
    throw err;
  }
  return { message: 'User updated', data: { user: serializeAdminUser(user) }, statusCode: 200 };
};

// DELETE /admin/users/:id — with safety guards (no self-delete, keep ≥1 admin)
exports.deleteUser = async (id, requestingAdminId) => {
  assertUuid(id, 'user id');
  if (id === requestingAdminId) throw fail('You cannot delete your own account', 400);

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw fail('User not found', 404);

  if (target.role === 'admin') {
    const admins = await prisma.user.count({ where: { role: 'admin' } });
    if (admins <= 1) throw fail('Cannot delete the last admin account', 400);
  }

  // Favorites cascade-delete; uploaded wallpapers have uploadedById set to null.
  await prisma.user.delete({ where: { id } });
  return { message: 'User deleted', data: { id }, statusCode: 200 };
};

// ───────────────────────── Favorites analytics (read-only) ─────────────────────────

// GET /admin/favorites — most-favorited wallpapers (ranked by the join table)
exports.getFavoritesAnalytics = async (query = {}) => {
  const { page, limit, skip } = adminPage(query);

  const groups = await prisma.favorite.groupBy({
    by: ['wallpaperId'],
    _count: { wallpaperId: true },
    orderBy: { _count: { wallpaperId: 'desc' } },
    skip,
    take: limit,
  });

  const totalRows = await prisma.$queryRaw`SELECT count(DISTINCT "wallpaperId")::int AS n FROM hw_favorites`;
  const total = totalRows[0] ? Number(totalRows[0].n) : 0;

  const ids = groups.map((g) => g.wallpaperId);
  const wps = ids.length ? await prisma.wallpaper.findMany({ where: { id: { in: ids } } }) : [];
  const byId = new Map(wps.map((w) => [w.id, w]));

  const wallpapers = groups.map((g) => {
    const w = byId.get(g.wallpaperId);
    return {
      id: g.wallpaperId,
      favorites: g._count.wallpaperId, // authoritative count from the join table
      title: w ? w.title : null,
      slug: w ? w.slug : null,
      image: w ? w.image : null,
      category: w ? w.categorySlug || w.category : null,
      status: w ? w.status : null,
    };
  });

  return {
    message: 'Favorites analytics fetched',
    data: { wallpapers, pagination: buildMeta(total, page, limit) },
    statusCode: 200,
  };
};

// ───────────────────────── Contacts management ─────────────────────────

// GET /admin/contacts — list inbound messages (filter + paginate)
exports.listContacts = async (query = {}) => {
  const { page, limit, skip } = adminPage(query);

  const where = {};
  if (query.status) {
    if (!CONTACT_STATUSES.includes(query.status)) {
      throw fail(`status must be one of: ${CONTACT_STATUSES.join(', ')}`, 400);
    }
    where.status = query.status;
  }
  const q = String(query.q || '').trim();
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { message: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.contact.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.contact.count({ where }),
  ]);

  return {
    message: 'Contacts fetched',
    data: { contacts: rows.map(serializeContact), pagination: buildMeta(total, page, limit) },
    statusCode: 200,
  };
};

// PATCH /admin/contacts/:id — update status (new|read|resolved)
exports.updateContactStatus = async (id, body = {}) => {
  assertUuid(id, 'contact id');
  const { status } = body;
  if (!status || !CONTACT_STATUSES.includes(status)) {
    throw fail(`status is required and must be one of: ${CONTACT_STATUSES.join(', ')}`, 400);
  }
  let contact;
  try {
    contact = await prisma.contact.update({ where: { id }, data: { status } });
  } catch (err) {
    if (err.code === 'P2025') throw fail('Contact not found', 404);
    throw err;
  }
  return { message: 'Contact updated', data: { contact: serializeContact(contact) }, statusCode: 200 };
};

// DELETE /admin/contacts/:id
exports.deleteContact = async (id) => {
  assertUuid(id, 'contact id');
  try {
    await prisma.contact.delete({ where: { id } });
  } catch (err) {
    if (err.code === 'P2025') throw fail('Contact not found', 404);
    throw err;
  }
  return { message: 'Contact deleted', data: { id }, statusCode: 200 };
};
