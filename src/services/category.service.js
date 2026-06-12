// Category service — the wallpaper category taxonomy (distinct from the browse
// filters latest/popular/random/live). Public reads expose categories with a
// LIVE count of active wallpapers per category; create/update/delete are
// operator (admin) actions so the upload form has real categories to pick from.
const Category = require('../models/category.schema');
const Wallpaper = require('../models/wallpaper.schema');

const fail = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const serialize = (c, count) => ({
  id: String(c._id),
  name: c.name,
  slug: c.slug,
  description: c.description || '',
  image: c.image || null,
  isPremium: !!c.isPremium,
  order: c.order || 0,
  count: typeof count === 'number' ? count : c.count || 0,
});

// Map of categorySlug -> active wallpaper count.
const liveCounts = async () => {
  const rows = await Wallpaper.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$categorySlug', n: { $sum: 1 } } },
  ]);
  return rows.reduce((m, r) => ((m[r._id] = r.n), m), {});
};

// ── GET /categories — all categories with live wallpaper counts ──────────
exports.listAll = async () => {
  const [cats, counts] = await Promise.all([
    Category.find().sort({ order: 1, name: 1 }).lean(),
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
  const cat = await Category.findOne({ slug }).lean();
  if (!cat) throw fail('Category not found', 404);
  const count = await Wallpaper.countDocuments({ status: 'active', categorySlug: slug });
  return { message: 'Category fetched', data: { category: serialize(cat, count) }, statusCode: 200 };
};

// ── POST /categories — create (admin) ────────────────────────────────────
exports.create = async (body = {}) => {
  const { name, description, image, order, isPremium } = body;
  if (!name || !String(name).trim()) throw fail('Category name is required', 400);

  const slug = slugify(body.slug || name);
  if (!slug) throw fail('Could not derive a valid slug from the name', 400);
  if (await Category.exists({ slug })) throw fail('A category with this slug already exists', 409);

  const cat = await Category.create({
    name: String(name).trim(),
    slug,
    description: description ? String(description).trim() : '',
    image: image || null,
    order: Number.isFinite(+order) ? +order : 0,
    isPremium: !!isPremium,
  });
  return { message: 'Category created', data: { category: serialize(cat, 0) }, statusCode: 201 };
};

// ── PATCH /categories/:slug — update (admin) ─────────────────────────────
exports.update = async (slug, body = {}) => {
  const update = {};
  ['name', 'description', 'image', 'order', 'isPremium'].forEach((k) => {
    if (body[k] !== undefined) {
      if (k === 'order') update.order = Number.isFinite(+body.order) ? +body.order : 0;
      else if (k === 'isPremium') update.isPremium = !!body.isPremium;
      else update[k] = typeof body[k] === 'string' ? body[k].trim() : body[k];
    }
  });
  if (Object.keys(update).length === 0) throw fail('No valid fields to update', 400);
  update.updatedAt = Date.now();

  const cat = await Category.findOneAndUpdate({ slug }, { $set: update }, { new: true, runValidators: true }).lean();
  if (!cat) throw fail('Category not found', 404);
  const count = await Wallpaper.countDocuments({ status: 'active', categorySlug: slug });
  return { message: 'Category updated', data: { category: serialize(cat, count) }, statusCode: 200 };
};

// ── DELETE /categories/:slug — remove (admin) ────────────────────────────
exports.remove = async (slug) => {
  const cat = await Category.findOneAndDelete({ slug }).lean();
  if (!cat) throw fail('Category not found', 404);
  const orphaned = await Wallpaper.countDocuments({ categorySlug: slug });
  return {
    message: 'Category deleted',
    data: { slug, orphanedWallpapers: orphaned },
    statusCode: 200,
  };
};
