// Admin controller — thin HTTP layer for staff CMS/dashboard actions.
// Delegates to AdminService and emits res.sendSuccess(...).
const AdminService = require('../services/admin.service');

// GET /api/v1/admin/overview — dashboard analytics counts.
exports.getOverview = async (req, res, next) => {
  try {
    const response = await AdminService.getOverview();
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

// ── User management ──
// GET /api/v1/admin/users
exports.listUsers = async (req, res, next) => {
  try {
    const response = await AdminService.listUsers(req.query);
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
