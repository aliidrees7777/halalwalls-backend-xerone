// Contact routes — public "contact us" message submission.
// Mounted at /api/v1/contact.
const express = require('express');
const router = express.Router();
const ContactController = require('../controllers/contact.controller');

// Submit a contact message (public).
router.post('/', ContactController.submit);

module.exports = router;
