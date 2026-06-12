// Admin controller — thin HTTP layer for staff moderation actions.
// Delegates to AdminService and emits res.sendSuccess(...).
const AdminService = require('../services/admin.service');

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
