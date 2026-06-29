// Wallpaper routes — mounted at /api/v1/wallpapers.
// Public = visibility only (browse/search/view). Downloading requires sign-in
// (a valid token), same as favorites — guests must sign up/in first.
const express = require('express');
const router = express.Router();
const WallpaperController = require('../controllers/wallpaper.controller');
const authorize = require('../middleware/authorize');

// ── Public (visibility) ──
// Catalog with filters & pagination.
// Supports ?q= &category= &filter= &tag= &sort=(latest|popular|random|live) &page= &limit=
router.get('/', WallpaperController.listPublic);

// Popular tags (MUST be before /:slug so it isn't treated as a slug).
router.get('/tags', WallpaperController.listTags);

// Single wallpaper by its URL slug.
router.get('/:slug', WallpaperController.getBySlug);

// Wallpapers related to the given slug (same category, backfilled by latest).
router.get('/:slug/related', WallpaperController.related);

// ── Auth-only ──
// Download requires sign-in. Increments the counter and returns the asset URL.
router.post('/:slug/download', authorize(['user', 'admin']), WallpaperController.trackDownload);

module.exports = router;
