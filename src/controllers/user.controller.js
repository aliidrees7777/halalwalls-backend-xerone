// User ("me") controller — thin HTTP layer for the signed-in user's profile
// and favorites. Passes the authenticated user's id (req.user.id) to
// UserService and emits res.sendSuccess(...). Errors bubble to next().
const UserService = require('../services/user.service');

// GET /api/v1/me — current user's profile + counts.
exports.getMe = async (req, res, next) => {
  try {
    const response = await UserService.getMe(req.user.id);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/me — update editable profile fields.
exports.updateMe = async (req, res, next) => {
  try {
    const response = await UserService.updateMe(req.user.id, req.body || {});
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/me/uploads — wallpapers uploaded by the current user.
exports.listUploads = async (req, res, next) => {
  try {
    const response = await UserService.listUploads(req.user.id, req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/me/favorites
exports.listFavorites = async (req, res, next) => {
  try {
    const response = await UserService.listFavorites(req.user.id, req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/me/favorites/:wallpaperId
exports.addFavorite = async (req, res, next) => {
  try {
    const response = await UserService.addFavorite(req.user.id, req.params.wallpaperId);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/me/favorites/:wallpaperId
exports.removeFavorite = async (req, res, next) => {
  try {
    const response = await UserService.removeFavorite(req.user.id, req.params.wallpaperId);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};
