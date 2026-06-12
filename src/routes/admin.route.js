// Admin routes — moderation surface for staff: review the wallpaper upload
// queue (approve/reject) and read inbound contact messages. Mounted at
// /api/v1/admin. Every route requires an admin token via authorize(['admin']).
const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin.controller');
const authorize = require('../middleware/authorize');

// Wallpapers awaiting moderation.
router.get('/wallpapers/pending', authorize(['admin']), AdminController.listPending);

// Approve / reject a pending wallpaper.
router.patch('/wallpapers/:id/approve', authorize(['admin']), AdminController.approve);
router.patch('/wallpapers/:id/reject', authorize(['admin']), AdminController.reject);

// Inbound contact messages.
router.get('/contacts', authorize(['admin']), AdminController.listContacts);

module.exports = router;
