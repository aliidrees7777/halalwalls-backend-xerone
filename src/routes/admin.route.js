// Admin routes — CMS/dashboard surface for staff. Mounted at /api/v1/admin.
// Every route requires an admin token via authorize(['admin']).
const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const authorize = require('../middleware/authorize');

const admin = authorize(['admin']);

// ── Dashboard ──
router.get('/overview', admin, AdminController.getOverview);

// ── Wallpaper management ──
router.get('/wallpapers', admin, AdminController.listWallpapers);
router.post('/wallpapers', admin, AdminController.createWallpaper);
// Moderation queue — declared BEFORE '/wallpapers/:id' so "pending" isn't
// captured as an id param.
router.get('/wallpapers/pending', admin, AdminController.listPending);
router.get('/wallpapers/:id', admin, AdminController.getWallpaper);
router.patch('/wallpapers/:id', admin, AdminController.updateWallpaper);
router.delete('/wallpapers/:id', admin, AdminController.deleteWallpaper);
router.patch('/wallpapers/:id/approve', admin, AdminController.approve);
router.patch('/wallpapers/:id/reject', admin, AdminController.reject);

// ── User management ──
router.get('/users', admin, AdminController.listUsers);
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
