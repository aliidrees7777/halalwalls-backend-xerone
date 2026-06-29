// Category controller — thin HTTP layer for the public category taxonomy.
// Delegates to CategoryService and emits res.sendSuccess(...).
const CategoryService = require('../services/category.service');

// GET /api/v1/categories
exports.listAll = async (req, res, next) => {
  try {
    const response = await CategoryService.listAll(req.query);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/categories/:slug
exports.getBySlug = async (req, res, next) => {
  try {
    const response = await CategoryService.getBySlug(req.params.slug);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/categories  (admin) — create a category
exports.create = async (req, res, next) => {
  try {
    const response = await CategoryService.create(req.body || {});
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/categories/:slug  (admin) — update a category
exports.update = async (req, res, next) => {
  try {
    const response = await CategoryService.update(req.params.slug, req.body || {});
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/categories/:slug  (admin) — delete a category
exports.remove = async (req, res, next) => {
  try {
    const response = await CategoryService.remove(req.params.slug);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};
