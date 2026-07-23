/**
 * Resolve one or more categories from admin/upload payloads into:
 *   • primary `category` / `categorySlug` (backward-compatible single fields)
 *   • `categories` / `categorySlugs` arrays (full multi-category set)
 *
 * Accepts:
 *   categorySlugs: string[] | comma-separated string
 *   categories:    string[] | comma-separated string (labels)
 *   category / categorySlug: legacy single values (used when arrays omitted)
 */
const prisma = require('../lib/prisma');

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function parseList(input) {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : [];
  return raw.map((v) => String(v).trim()).filter(Boolean);
}

async function resolveCategories(body = {}) {
  const slugInputs = parseList(body.categorySlugs);
  const labelInputs = parseList(body.categories);

  // Legacy single-category fields when arrays are empty.
  if (!slugInputs.length && !labelInputs.length) {
    if (body.categorySlug) slugInputs.push(String(body.categorySlug).trim());
    else if (body.category) labelInputs.push(String(body.category).trim());
  }

  const ordered = [];
  const seen = new Set();

  const push = (slug, label) => {
    const s = slug ? slugify(slug) : '';
    if (!s || seen.has(s)) return;
    seen.add(s);
    ordered.push({ slug: s, label: label || null });
  };

  for (let i = 0; i < Math.max(slugInputs.length, labelInputs.length); i += 1) {
    push(slugInputs[i] || labelInputs[i], labelInputs[i] || null);
  }

  // Fill missing labels from the categories table.
  for (const item of ordered) {
    if (item.label) continue;
    // eslint-disable-next-line no-await-in-loop
    const cat = await prisma.category.findUnique({ where: { slug: item.slug } });
    if (cat) item.label = cat.name;
    else item.label = item.slug;
  }

  // If only labels were given, re-slugify from resolved names (already done via push).

  const categorySlugs = ordered.map((o) => o.slug);
  const categories = ordered.map((o) => o.label || o.slug);

  return {
    category: categories[0] || null,
    categorySlug: categorySlugs[0] || null,
    categories,
    categorySlugs,
  };
}

/** Prisma filter: wallpaper belongs to a category (primary or multi). */
function categoryWhere(slug) {
  const s = slugify(slug);
  if (!s) return {};
  return {
    OR: [{ categorySlug: s }, { categorySlugs: { has: s } }],
  };
}

module.exports = {
  resolveCategories,
  categoryWhere,
  slugify,
  parseList,
};
