/**
 * Shared pagination helpers for list endpoints (admin + public).
 *
 * Keeps the page/limit parsing and the response `pagination` envelope identical
 * everywhere, matching the shape already used by the public wallpaper catalog.
 */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Parse + clamp page/limit from a query object → { page, limit, skip }.
function parsePagination(query = {}, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
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

module.exports = { parsePagination, buildMeta, DEFAULT_LIMIT, MAX_LIMIT };
