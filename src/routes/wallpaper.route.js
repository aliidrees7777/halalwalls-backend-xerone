// Wallpaper routes — mounted at /api/v1/wallpapers.
// Public browse + free downloads. Premium wallpapers still gated in the service.
const express = require('express');
const router = express.Router();
const WallpaperController = require('../controllers/wallpaper.controller');

// Catalog with filters & pagination.
// Supports ?q= &category= &filter= &tag= &sort=(latest|popular|random|live) &page= &limit=
router.get('/', WallpaperController.listPublic);

// Popular tags (MUST be before /:slug so it isn't treated as a slug).
router.get('/tags', WallpaperController.listTags);

// Single wallpaper by its URL slug.
router.get('/:slug', WallpaperController.getBySlug);

// Wallpapers related to the given slug (same category, backfilled by latest).
router.get('/:slug/related', WallpaperController.related);

// Render + serve the download file. Public but token-gated (?dl= from POST /download).
router.get('/:slug/file', WallpaperController.downloadFile);

// Guests may download free wallpapers; premium gate is enforced in the service.
router.post('/:slug/download', WallpaperController.trackDownload);

module.exports = router;
