// Admin routes — CMS/dashboard surface for staff. Mounted at /api/v1/admin.
// Every route requires an admin token via authorize(['admin']).
const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const authorize = require('../middleware/authorize');

const admin = authorize(['admin']);

// ── Dashboard ──
router.get('/overview', admin, AdminController.getOverview);
router.get('/analytics', admin, AdminController.getAnalytics);
router.get('/activity', admin, AdminController.getActivity);
router.get('/storage', admin, AdminController.getStorage);

// ── Wallpaper management ──
router.get('/wallpapers', admin, AdminController.listWallpapers);
router.post('/wallpapers', admin, AdminController.createWallpaper);
// Moderation queue + stats/export — declared BEFORE '/wallpapers/:id' so these
// literal segments aren't captured as an id param.
router.get('/wallpapers/pending', admin, AdminController.listPending);
router.get('/wallpapers/stats', admin, AdminController.getWallpaperStats);
router.get('/wallpapers/export', admin, AdminController.exportWallpapers);
router.get('/wallpapers/:id', admin, AdminController.getWallpaper);
router.patch('/wallpapers/:id', admin, AdminController.updateWallpaper);
router.delete('/wallpapers/:id', admin, AdminController.deleteWallpaper);
router.patch('/wallpapers/:id/approve', admin, AdminController.approve);
router.patch('/wallpapers/:id/reject', admin, AdminController.reject);

// ── Category management ──
router.get('/categories/stats', admin, AdminController.getCategoryStats);
router.get('/categories', admin, AdminController.listCategories);

// ── Roles & Permissions ──
router.get('/roles', admin, AdminController.getRoles);
router.post('/roles', admin, AdminController.createRole);
router.patch('/roles/:id', admin, AdminController.updateRole);
router.delete('/roles/:id', admin, AdminController.deleteRole);

// ── Resolution management ──
router.get('/resolutions/stats', admin, AdminController.getResolutionStats);
router.get('/resolutions', admin, AdminController.listResolutions);
router.post('/resolutions', admin, AdminController.createResolution);
router.patch('/resolutions/:key', admin, AdminController.updateResolution);
router.delete('/resolutions/:key', admin, AdminController.deleteResolution);

// ── Tag management ──
router.get('/tags/stats', admin, AdminController.getTagStats);
router.get('/tags', admin, AdminController.listTags);
router.post('/tags', admin, AdminController.createTag);
router.patch('/tags/:slug', admin, AdminController.updateTag);
router.delete('/tags/:slug', admin, AdminController.deleteTag);

// ── Subscribers ──
router.get('/subscribers/stats', admin, AdminController.getSubscriberStats);
router.get('/subscribers', admin, AdminController.listSubscribers);

// ── User management ──
router.get('/users/stats', admin, AdminController.getUserStats);
router.get('/users', admin, AdminController.listUsers);
router.post('/users', admin, AdminController.createUser);
router.get('/users/:id', admin, AdminController.getUser);
router.patch('/users/:id', admin, AdminController.updateUser);
router.delete('/users/:id', admin, AdminController.deleteUser);

// ── Favorites analytics (read-only) ──
router.get('/favorites', admin, AdminController.listFavorites);

// ── Contacts ──
router.get('/contacts', admin, AdminController.listContacts);
router.patch('/contacts/:id', admin, AdminController.updateContact);
router.delete('/contacts/:id', admin, AdminController.deleteContact);

module.exports = router;
