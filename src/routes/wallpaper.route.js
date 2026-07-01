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

// Render + serve the actual download file at a requested resolution. Public but
// token-gated: the ?dl= token is issued by POST /download only after the premium
// gate passes (window.open downloads can't carry an auth header).
router.get('/:slug/file', WallpaperController.downloadFile);

// ── Auth-only ──
// Start a download: enforce the premium gate, increment the counter, and return
// a signed link to the file endpoint above.
router.post('/:slug/download', authorize(['user', 'admin']), WallpaperController.trackDownload);

module.exports = router;
