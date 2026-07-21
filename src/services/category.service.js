// Category service — the wallpaper category taxonomy (distinct from the browse
// filters latest/popular/random/live). Public reads expose categories with a
// LIVE count of active wallpapers per category; create/update/delete are
// operator (admin) actions so the upload form has real categories to pick from.
const prisma = require('../lib/prisma');

const fail = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const serialize = (c, count) => ({
  id: String(c.id),
  name: c.name,
  slug: c.slug,
  description: c.description || '',
  image: c.image || null,
  isPremium: !!c.isPremium,
  isActive: c.isActive !== false,
  order: c.order || 0,
  count: typeof count === 'number' ? count : c.count || 0,
});

// Map of categorySlug -> active wallpaper count.
// Premium / premium-walls categories count wallpapers flagged isPremium.
const PREMIUM_SLUGS = new Set(['premium', 'premium-walls', 'premiumwalls']);

const liveCounts = async () => {
  const [rows, premiumCount] = await Promise.all([
    prisma.wallpaper.groupBy({
      by: ['categorySlug'],
      where: { status: 'active' },
      _count: { _all: true },
    }),
    prisma.wallpaper.count({ where: { status: 'active', isPremium: true } }),
  ]);
  return rows.reduce((m, r) => {
    if (r.categorySlug) m[r.categorySlug] = r._count._all;
    return m;
  }, /** @type {Record<string, number>} */ ({
    premium: premiumCount,
    'premium-walls': premiumCount,
    premiumwalls: premiumCount,
  }));
};

// ── GET /categories — active categories with live wallpaper counts ───────
// Public surface (nav, upload form): only active categories are returned.
exports.listAll = async () => {
  const [cats, counts] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    liveCounts(),
  ]);
  return {
    message: 'Categories fetched',
    data: { categories: cats.map((c) => serialize(c, counts[c.slug] || 0)) },
    statusCode: 200,
  };
};

// ── GET /categories/:slug — one category + its live count ────────────────
exports.getBySlug = async (slug) => {
  const cat = await prisma.category.findUnique({ where: { slug } });
  if (!cat) throw fail('Category not found', 404);
  const count = PREMIUM_SLUGS.has(slug)
    ? await prisma.wallpaper.count({ where: { status: 'active', isPremium: true } })
    : await prisma.wallpaper.count({ where: { status: 'active', categorySlug: slug } });
  return { message: 'Category fetched', data: { category: serialize(cat, count) }, statusCode: 200 };
};

// ── POST /categories — create (admin) ────────────────────────────────────
exports.create = async (body = {}) => {
  const { name, description, image, order, isPremium } = body;
  if (!name || !String(name).trim()) throw fail('Category name is required', 400);

  const slug = slugify(body.slug || name);
  if (!slug) throw fail('Could not derive a valid slug from the name', 400);
  if (await prisma.category.findUnique({ where: { slug } })) {
    throw fail('A category with this slug already exists', 409);
  }

  const cat = await prisma.category.create({
    data: {
      name: String(name).trim(),
      slug,
      description: description ? String(description).trim() : '',
      image: image || null,
      order: Number.isFinite(+order) ? +order : 0,
      isPremium: !!isPremium,
      isActive: body.isActive === undefined ? true : !!body.isActive,
    },
  });
  return { message: 'Category created', data: { category: serialize(cat, 0) }, statusCode: 201 };
};

// ── PATCH /categories/:slug — update (admin) ─────────────────────────────
exports.update = async (slug, body = {}) => {
  const update = {};
  ['name', 'description', 'image', 'order', 'isPremium', 'isActive'].forEach((k) => {
    if (body[k] !== undefined) {
      if (k === 'order') update.order = Number.isFinite(+body.order) ? +body.order : 0;
      else if (k === 'isPremium') update.isPremium = !!body.isPremium;
      else if (k === 'isActive') update.isActive = !!body.isActive;
      else update[k] = typeof body[k] === 'string' ? body[k].trim() : body[k];
    }
  });
  if (Object.keys(update).length === 0) throw fail('No valid fields to update', 400);

  let cat;
  try {
    cat = await prisma.category.update({ where: { slug }, data: update });
  } catch (err) {
    if (err.code === 'P2025') throw fail('Category not found', 404);
    throw err;
  }
  const count = await prisma.wallpaper.count({ where: { status: 'active', categorySlug: slug } });
  return { message: 'Category updated', data: { category: serialize(cat, count) }, statusCode: 200 };
};

// ── DELETE /categories/:slug — remove (admin) ────────────────────────────
exports.remove = async (slug) => {
  try {
    await prisma.category.delete({ where: { slug } });
  } catch (err) {
    if (err.code === 'P2025') throw fail('Category not found', 404);
    throw err;
  }
  const orphaned = await prisma.wallpaper.count({ where: { categorySlug: slug } });
  return {
    message: 'Category deleted',
    data: { slug, orphanedWallpapers: orphaned },
    statusCode: 200,
  };
};
