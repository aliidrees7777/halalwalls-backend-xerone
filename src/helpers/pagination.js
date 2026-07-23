/**
 * Shared pagination helpers for list endpoints (admin + public).
 *
 * Keeps the page/limit parsing and the response `pagination` envelope identical
 * everywhere, matching the shape already used by the public wallpaper catalog.
 */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
/** Higher cap for admin “See all” list views (still bounded). */
const ADMIN_MAX_LIMIT = 5000;

// Parse + clamp page/limit from a query object → { page, limit, skip }.
// Pass `limit=all` (or 0 / -1) with a raised maxLimit to fetch up to that cap.
function parsePagination(query = {}, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const raw = String(query.limit ?? '').trim().toLowerCase();
  const wantsAll = raw === 'all' || raw === '0' || raw === '-1';
  const parsed = wantsAll ? maxLimit : parseInt(query.limit, 10);
  const limit = Math.min(maxLimit, Math.max(1, Number.isFinite(parsed) ? parsed : defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// Build the standard pagination envelope from a total count.
function buildMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit) || 0;
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

module.exports = { parsePagination, buildMeta, DEFAULT_LIMIT, MAX_LIMIT, ADMIN_MAX_LIMIT };
