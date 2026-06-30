// Subscription routes — mounted at /api/v1/subscriptions. All require a signed-in
// user. (The Stripe webhook is registered separately in index.js because it
// needs the raw request body for signature verification.)
const express = require('express');
const router = express.Router();
const SubscriptionController = require('../controllers/subscription.controller');
const authorize = require('../middleware/authorize');

router.post('/checkout', authorize(['user', 'admin']), SubscriptionController.createCheckout);
router.post('/confirm', authorize(['user', 'admin']), SubscriptionController.confirm);
router.get('/me', authorize(['user', 'admin']), SubscriptionController.status);
router.post('/portal', authorize(['user', 'admin']), SubscriptionController.portal);

module.exports = router;
