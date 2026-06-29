// Admin service — CMS/dashboard business logic for staff (admin role only).
// Implemented per the Admin CRUD plan:
//   • Q1.2 — getOverview (analytics counts)
//   • Q1.3 — contacts management
//   • Q2.1/2.2 — wallpaper management (read + write)
//   • Q2.3 — moderation queue (pending / approve / reject)
const prisma = require('../lib/prisma');
const { parsePagination, buildMeta } = require('../helpers/pagination');

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
  isPremium: u.isPremium,
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
    prisma.wallpaper.aggregate({ _sum: { downloadCount: true, views: true } }),
    prisma.favorite.count(),
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
        totalDownloads: wpAgg._sum.downloadCount || 0,
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
  const { page, limit, skip } = parsePagination(query);

  const where = {};
  if (query.status) {
    if (!WALLPAPER_STATUSES.includes(query.status)) {
      throw fail(`status must be one of: ${WALLPAPER_STATUSES.join(', ')}`, 400);
    }
    where.status = query.status;
  }
  if (query.category) where.categorySlug = slugify(query.category);
  const prem = toBool(query.isPremium);
  if (prem !== undefined) where.isPremium = prem;
  const live = toBool(query.isLive);
  if (live !== undefined) where.isLive = live;

  const q = String(query.q || '').trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { categorySlug: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
      { tags: { has: q } },
    ];
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

  const categorySlug = body.categorySlug ? slugify(body.categorySlug) : null;
  let categoryLabel = body.category ? String(body.category).trim() : null;
  if (!categoryLabel && categorySlug) {
    const cat = await prisma.category.findUnique({ where: { slug: categorySlug } });
    if (cat) categoryLabel = cat.name;
  }

  const created = await prisma.wallpaper.create({
    data: {
      title,
      slug,
      description: body.description ? String(body.description).trim() : '',
      category: categoryLabel,
      categorySlug,
      tags: Array.isArray(body.tags) ? body.tags : [],
      image,
      originalUrl: body.originalUrl ? String(body.originalUrl).trim() : image,
      thumbnailUrl: body.thumbnailUrl ? String(body.thumbnailUrl).trim() : image,
      resolution: body.resolution ? String(body.resolution).trim() : '',
      preferredResolution: (body.preferredResolution || body.resolution || '').toString().trim(),
      resolutions: Array.isArray(body.resolutions) ? body.resolutions : [],
      sizeMB: Number.isFinite(+body.sizeMB) ? +body.sizeMB : 0,
      width: Number.isFinite(+body.width) ? +body.width : null,
      height: Number.isFinite(+body.height) ? +body.height : null,
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
  ['title', 'description', 'category', 'image', 'originalUrl', 'thumbnailUrl', 'resolution', 'preferredResolution', 'author'].forEach((k) => {
    if (body[k] !== undefined) data[k] = typeof body[k] === 'string' ? body[k].trim() : body[k];
  });
  if (body.categorySlug !== undefined) data.categorySlug = body.categorySlug ? slugify(body.categorySlug) : null;
  if (body.tags !== undefined) data.tags = Array.isArray(body.tags) ? body.tags : [];
  if (body.resolutions !== undefined) data.resolutions = Array.isArray(body.resolutions) ? body.resolutions : [];
  if (body.sizeMB !== undefined) data.sizeMB = Number.isFinite(+body.sizeMB) ? +body.sizeMB : 0;
  if (body.width !== undefined) data.width = Number.isFinite(+body.width) ? +body.width : null;
  if (body.height !== undefined) data.height = Number.isFinite(+body.height) ? +body.height : null;
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
  const { page, limit, skip } = parsePagination(query);
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

// ───────────────────────── User management ─────────────────────────

// GET /admin/users — search / filter / paginate (with favorites + uploads counts)
exports.listUsers = async (query = {}) => {
  const { page, limit, skip } = parsePagination(query);

  const where = {};
  if (query.role) {
    if (!['user', 'admin'].includes(query.role)) throw fail('role must be one of: user, admin', 400);
    where.role = query.role;
  }
  const verified = toBool(query.verified);
  if (verified !== undefined) where.emailVerified = verified;
  const prem = toBool(query.isPremium);
  if (prem !== undefined) where.isPremium = prem;

  const q = String(query.q || '').trim();
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: USER_COUNTS }),
    prisma.user.count({ where }),
  ]);

  return {
    message: 'Users fetched',
    data: { users: rows.map(serializeAdminUser), pagination: buildMeta(total, page, limit) },
    statusCode: 200,
  };
};

// GET /admin/users/:id — single user + counts
exports.getUser = async (id) => {
  assertUuid(id, 'user id');
  const u = await prisma.user.findUnique({ where: { id }, include: USER_COUNTS });
  if (!u) throw fail('User not found', 404);
  return { message: 'User fetched', data: { user: serializeAdminUser(u) }, statusCode: 200 };
};

// PATCH /admin/users/:id — account profile fields ONLY (no role/premium, per doc)
exports.updateUser = async (id, body = {}) => {
  assertUuid(id, 'user id');
  const data = {};
  ['firstName', 'lastName', 'bio', 'avatar', 'banner'].forEach((k) => {
    if (body[k] !== undefined) data[k] = typeof body[k] === 'string' ? body[k].trim() : body[k];
  });
  if (body.firstName !== undefined && !data.firstName) throw fail('First name cannot be empty', 400);
  if (Object.keys(data).length === 0) {
    throw fail('No valid fields to update (allowed: firstName, lastName, bio, avatar, banner)', 400);
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
  const { page, limit, skip } = parsePagination(query);

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
  const { page, limit, skip } = parsePagination(query);

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
