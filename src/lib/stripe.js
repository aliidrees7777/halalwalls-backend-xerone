/**
 * Stripe client singleton. Null when STRIPE_SECRET_KEY isn't configured, so the
 * subscription endpoints can report "payments not configured" cleanly instead
 * of crashing.
 */
const Stripe = require('stripe');

const key = process.env.STRIPE_SECRET_KEY || '';
const stripe = key ? new Stripe(key) : null;

module.exports = stripe;
