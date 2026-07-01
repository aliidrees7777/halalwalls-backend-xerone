const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');
const authorize = require('../middleware/authorize');

// ─── Authentication (public, token-issuing) ─────────────────────────────
router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/reactivate', AuthController.reactivate);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);
router.post('/google', AuthController.google);
router.post('/verify-email', AuthController.verifyEmail);

// ─── Account & Security (authenticated, any role) ───────────────────────
router.post('/change-password', authorize(), AuthController.changePassword);
router.post('/resend-verification', authorize(), AuthController.resendVerification);

module.exports = router;
