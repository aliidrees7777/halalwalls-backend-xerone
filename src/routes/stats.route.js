// Stats routes — public aggregate counters for the HalalWalls landing page
// (total wallpapers, downloads, categories). Mounted at /api/v1/stats.
const express = require('express');
const router = express.Router();
const StatsController = require('../controllers/stats.controller');

// Public aggregate stats — no auth.
router.get('/', StatsController.getPublicStats);

module.exports = router;
