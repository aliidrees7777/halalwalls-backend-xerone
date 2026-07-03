/**
 * Stripe client singleton. Null when STRIPE_SECRET_KEY isn't configured, so the
 * subscription endpoints can report "payments not configured" cleanly instead
 * of crashing.
 */
const Stripe = require('stripe');

const key = process.env.STRIPE_SECRET_KEY || '';
const stripe = key ? new Stripe(key) : null;

const PLAN_ENV_KEYS = {
  monthly: 'STRIPE_PRICE_MONTHLY',
  yearly: 'STRIPE_PRICE_YEARLY',
  lifetime: 'STRIPE_PRICE_LIFETIME',
};

function getStripeStatus() {
  const plans = Object.fromEntries(
    Object.entries(PLAN_ENV_KEYS).map(([plan, envKey]) => [plan, process.env[envKey] || '']),
  );
  const missingPlans = Object.entries(plans)
    .filter(([, priceId]) => !priceId)
    .map(([plan]) => plan);
  return {
    configured: !!stripe,
    missingPlans,
    plans,
  };
}

function logStripeStatusOnStartup() {
  if (process.env.NODE_ENV === 'test') return;
  const status = getStripeStatus();
  if (!status.configured) {
    // eslint-disable-next-line no-console
    console.warn('💳 Stripe: STRIPE_SECRET_KEY is not set — subscriptions are disabled.');
    return;
  }
  // eslint-disable-next-line no-console
  console.log('💳 Stripe: secret key configured.');
  if (status.missingPlans.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `⚠️  Stripe: missing price IDs for: ${status.missingPlans.join(', ')} (set STRIPE_PRICE_* env vars).`,
    );
  }
}

logStripeStatusOnStartup();

module.exports = stripe;
module.exports.getStripeStatus = getStripeStatus;
