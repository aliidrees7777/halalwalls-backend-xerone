// Resolution routes — public, the fixed "browse by resolution" set.
// Mounted at /api/v1/resolutions.
const express = require('express');
const router = express.Router();
const ResolutionController = require('../controllers/resolution.controller');

router.get('/', ResolutionController.list);

module.exports = router;
