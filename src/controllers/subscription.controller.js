// Subscription controller — thin HTTP layer over the Stripe subscription flow.
const SubscriptionService = require('../services/subscription.service');

// POST /api/v1/subscriptions/checkout — start a Stripe Checkout (auth required).
exports.createCheckout = async (req, res, next) => {
  try {
    const plan = (req.body || {}).plan || 'monthly';
    const response = await SubscriptionService.createCheckoutSession(req.user.id, plan);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/subscriptions/confirm — activate premium from a paid Checkout
// Session (fallback when webhooks aren't reaching the server, e.g. local).
exports.confirm = async (req, res, next) => {
  try {
    const response = await SubscriptionService.confirmCheckout(req.user.id, (req.body || {}).sessionId);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/subscriptions/me — the signed-in user's subscription status.
exports.status = async (req, res, next) => {
  try {
    const response = await SubscriptionService.getStatus(req.user.id);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/subscriptions/portal — open the Stripe Billing Portal (manage/cancel).
exports.portal = async (req, res, next) => {
  try {
    const response = await SubscriptionService.createPortalSession(req.user.id);
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/webhooks/stripe — Stripe events (raw body; no auth; not the envelope).
exports.webhook = async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const result = await SubscriptionService.handleWebhook(req.body, signature);
    res.json(result);
  } catch (error) {
    console.error('⚠️  [stripe webhook]', error.message);
    res.status(error.statusCode || 400).json({ error: error.message });
  }
};
