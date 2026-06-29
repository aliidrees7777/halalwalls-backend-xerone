// Wallpaper controller — thin HTTP layer for the public wallpaper catalog.
// Each handler delegates to WallpaperService and emits the standard envelope
// via res.sendSuccess(message, data, statusCode). Errors bubble to next().
const WallpaperService = require('../services/wallpaper.service');

// GET /api/v1/wallpapers
// Public catalog: search, category, tag filters + sorting & pagination.
exports.listPublic = async (req, res, next) => {
  try {
    const response = await WallpaperService.listPublic(req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/wallpapers/tags
// Popular tags across the catalog (for the homepage tag pills).
exports.listTags = async (req, res, next) => {
  try {
    const response = await WallpaperService.listTags(req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/wallpapers/:slug
// Fetch a single wallpaper by slug.
exports.getBySlug = async (req, res, next) => {
  try {
    const response = await WallpaperService.getBySlug(req.params.slug);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/wallpapers/:slug/related
// Fetch wallpapers related to the given slug.
exports.related = async (req, res, next) => {
  try {
    const response = await WallpaperService.related(req.params.slug, req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/wallpapers/:slug/download
// Track a download (increments downloadCount) and return the asset URL.
exports.trackDownload = async (req, res, next) => {
  try {
    const response = await WallpaperService.trackDownload(req.params.slug, req.body || {});
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};
