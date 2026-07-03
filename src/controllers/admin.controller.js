// Admin controller — thin HTTP layer for staff CMS/dashboard actions.
// Delegates to AdminService and emits res.sendSuccess(...).
const AdminService = require('../services/admin.service');
const AnalyticsService = require('../services/analytics.service');
const ResolutionService = require('../services/resolution.service');
const RoleService = require('../services/role.service');

// ── Roles & Permissions ──
exports.getRoles = async (req, res, next) => {
  try { const r = await RoleService.getPage(); res.sendSuccess(r.message, r.data, r.statusCode); } catch (e) { next(e); }
};
exports.createRole = async (req, res, next) => {
  try { const r = await RoleService.createRole(req.body || {}); res.sendSuccess(r.message, r.data, r.statusCode); } catch (e) { next(e); }
};
exports.updateRole = async (req, res, next) => {
  try { const r = await RoleService.updateRole(req.params.id, req.body || {}); res.sendSuccess(r.message, r.data, r.statusCode); } catch (e) { next(e); }
};
exports.deleteRole = async (req, res, next) => {
  try { const r = await RoleService.deleteRole(req.params.id); res.sendSuccess(r.message, r.data, r.statusCode); } catch (e) { next(e); }
};

// ── Resolution management ──
exports.listResolutions = async (req, res, next) => {
  try {
    const r = await ResolutionService.listAdmin(req.query);
    res.sendSuccess(r.message, r.data, r.statusCode);
  } catch (error) { next(error); }
};
exports.getResolutionStats = async (req, res, next) => {
  try {
    const r = await ResolutionService.getStats();
    res.sendSuccess(r.message, r.data, r.statusCode);
  } catch (error) { next(error); }
};
exports.createResolution = async (req, res, next) => {
  try {
    const r = await ResolutionService.create(req.body || {});
    res.sendSuccess(r.message, r.data, r.statusCode);
  } catch (error) { next(error); }
};
exports.updateResolution = async (req, res, next) => {
  try {
    const r = await ResolutionService.update(req.params.key, req.body || {});
    res.sendSuccess(r.message, r.data, r.statusCode);
  } catch (error) { next(error); }
};
exports.deleteResolution = async (req, res, next) => {
  try {
    const r = await ResolutionService.remove(req.params.key);
    res.sendSuccess(r.message, r.data, r.statusCode);
  } catch (error) { next(error); }
};

// GET /api/v1/admin/overview — dashboard analytics counts.
exports.getOverview = async (req, res, next) => {
  try {
    const response = await AdminService.getOverview();
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/analytics — real dashboard metrics (cards, trend, plans, activity).
exports.getAnalytics = async (req, res, next) => {
  try {
    const response = await AnalyticsService.getDashboard({ range: req.query.range });
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/activity — paginated recent-activity feed.
exports.getActivity = async (req, res, next) => {
  try {
    const response = await AnalyticsService.getActivity(req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/storage — real media storage usage.
exports.getStorage = async (req, res, next) => {
  try {
    const response = await AnalyticsService.getStorage();
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// ── Wallpaper management ──
// GET /api/v1/admin/wallpapers
exports.listWallpapers = async (req, res, next) => {
  try {
    const response = await AdminService.listWallpapers(req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/wallpapers/stats
exports.getWallpaperStats = async (req, res, next) => {
  try {
    const response = await AdminService.getWallpaperStats();
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/wallpapers/export — CSV download.
exports.exportWallpapers = async (req, res, next) => {
  try {
    const { csv } = await AdminService.exportWallpapersCsv(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="wallpapers.csv"');
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/wallpapers/:id
exports.getWallpaper = async (req, res, next) => {
  try {
    const response = await AdminService.getWallpaper(req.params.id);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/admin/wallpapers
exports.createWallpaper = async (req, res, next) => {
  try {
    const response = await AdminService.createWallpaper(req.body || {}, req.user.id);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/admin/wallpapers/:id
exports.updateWallpaper = async (req, res, next) => {
  try {
    const response = await AdminService.updateWallpaper(req.params.id, req.body || {});
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/admin/wallpapers/:id
exports.deleteWallpaper = async (req, res, next) => {
  try {
    const response = await AdminService.deleteWallpaper(req.params.id);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// ── Category management ──
// GET /api/v1/admin/categories
exports.listCategories = async (req, res, next) => {
  try {
    const response = await AdminService.listCategoriesAdmin(req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/categories/stats
exports.getCategoryStats = async (req, res, next) => {
  try {
    const response = await AdminService.getCategoryStats();
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// ── Tag management ──
exports.listTags = async (req, res, next) => {
  try {
    const response = await AdminService.listTagsAdmin(req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};
exports.getTagStats = async (req, res, next) => {
  try {
    const response = await AdminService.getTagStats();
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};
exports.createTag = async (req, res, next) => {
  try {
    const response = await AdminService.createTag(req.body || {});
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};
exports.updateTag = async (req, res, next) => {
  try {
    const response = await AdminService.updateTag(req.params.slug, req.body || {});
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};
exports.deleteTag = async (req, res, next) => {
  try {
    const response = await AdminService.deleteTag(req.params.slug);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// ── Subscribers ──
// GET /api/v1/admin/subscribers
exports.listSubscribers = async (req, res, next) => {
  try {
    const response = await AdminService.listSubscribers(req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/subscribers/stats
exports.getSubscriberStats = async (req, res, next) => {
  try {
    const response = await AdminService.getSubscriberStats();
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// ── User management ──
// GET /api/v1/admin/users/stats
exports.getUserStats = async (req, res, next) => {
  try {
    const response = await AdminService.getUserStats();
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/users
exports.listUsers = async (req, res, next) => {
  try {
    const response = await AdminService.listUsers(req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/admin/users
exports.createUser = async (req, res, next) => {
  try {
    const response = await AdminService.createUser(req.body || {});
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/users/:id
exports.getUser = async (req, res, next) => {
  try {
    const response = await AdminService.getUser(req.params.id);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/admin/users/:id
exports.updateUser = async (req, res, next) => {
  try {
    const response = await AdminService.updateUser(req.params.id, req.body || {});
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/admin/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    const response = await AdminService.deleteUser(req.params.id, req.user.id);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// ── Favorites analytics ──
// GET /api/v1/admin/favorites
exports.listFavorites = async (req, res, next) => {
  try {
    const response = await AdminService.getFavoritesAnalytics(req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// ── Moderation queue ──
// GET /api/v1/admin/wallpapers/pending
exports.listPending = async (req, res, next) => {
  try {
    const response = await AdminService.listPending(req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/admin/wallpapers/:id/approve
exports.approve = async (req, res, next) => {
  try {
    const response = await AdminService.approve(req.params.id, req.body);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/admin/wallpapers/:id/reject
exports.reject = async (req, res, next) => {
  try {
    const response = await AdminService.reject(req.params.id, req.body);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/contacts
exports.listContacts = async (req, res, next) => {
  try {
    const response = await AdminService.listContacts(req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/admin/contacts/:id
exports.updateContact = async (req, res, next) => {
  try {
    const response = await AdminService.updateContactStatus(req.params.id, req.body || {});
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/admin/contacts/:id
exports.deleteContact = async (req, res, next) => {
  try {
    const response = await AdminService.deleteContact(req.params.id);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};
