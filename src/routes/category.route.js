// Category routes — public reads of the wallpaper category taxonomy (browse all
// categories, view one by slug). Create/update/delete are operator (admin)
// actions so the upload form has real categories to pick from.
// Mounted at /api/v1/categories.
const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/category.controller');
const authorize = require('../middleware/authorize');

// ── Public ──
// All categories with live wallpaper counts (for nav / sidebar / upload form).
router.get('/', CategoryController.listAll);
// Single category by slug.
router.get('/:slug', CategoryController.getBySlug);

// ── Admin (operator-provisioned; seeded admin token required) ──
router.post('/', authorize(['admin']), CategoryController.create);
router.patch('/:slug', authorize(['admin']), CategoryController.update);
router.delete('/:slug', authorize(['admin']), CategoryController.remove);

module.exports = router;
