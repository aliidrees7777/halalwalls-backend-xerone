// User ("me") routes — authenticated self-service surface: the signed-in
// user's profile and favorite wallpapers. Mounted at /api/v1/me.
// Every route requires a valid user (or admin) token via authorize().
const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user.controller');
const authorize = require('../middleware/authorize');

// Current user's profile + counts.
router.get('/', authorize(['user', 'admin']), UserController.getMe);

// Update editable profile fields (name, bio, avatar, banner).
router.patch('/', authorize(['user', 'admin']), UserController.updateMe);

// Permanently delete the current user's own account.
router.delete('/', authorize(['user', 'admin']), UserController.deleteMe);

// Wallpapers uploaded by the current user (all statuses).
router.get('/uploads', authorize(['user', 'admin']), UserController.listUploads);

// List the current user's favorite wallpapers.
router.get('/favorites', authorize(['user', 'admin']), UserController.listFavorites);

// Add a wallpaper to the current user's favorites.
router.post('/favorites/:wallpaperId', authorize(['user', 'admin']), UserController.addFavorite);

// Remove a wallpaper from the current user's favorites.
router.delete('/favorites/:wallpaperId', authorize(['user', 'admin']), UserController.removeFavorite);

module.exports = router;
