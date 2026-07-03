/**
 * Subscription service — Stripe Checkout (monthly premium) + webhook sync.
 *
 * Flow: createCheckoutSession → Stripe-hosted Checkout → on payment, Stripe fires
 * webhooks → handleWebhook syncs the user's subscription fields and flips
 * isPremium. createPortalSession opens Stripe's Billing Portal (manage/cancel).
 */
const prisma = require('../lib/prisma');
const stripe = require('../lib/stripe');
const Stripe = require('stripe');

const fail = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const ensureStripe = () => {
  if (!stripe || typeof stripe.checkout === 'undefined') {
    throw fail('Payments are not configured on the server', 503);
  }
};

const isStripeError = (err) =>
  err instanceof Stripe.errors.StripeError ||
  (err && typeof err.type === 'string' && err.type.startsWith('Stripe'));

const mapCheckoutError = (err, context = 'checkout') => {
  if (err && err.statusCode) return err;
  if (isStripeError(err)) {
    const detail = (err.raw && err.raw.message) || err.message || 'unknown payment error';
    // eslint-disable-next-line no-console
    console.error(`[stripe:${context}] ${err.type || 'StripeError'} ${err.code || ''} — ${detail}`);
    return fail(`Payment could not be started: ${detail}`, 502);
  }
  if (err && err.code && String(err.code).startsWith('P')) {
    // eslint-disable-next-line no-console
    console.error(`[stripe:${context}] database error ${err.code}:`, err.message);
    return fail('Could not save billing details. Please try again.', 500);
  }
  // eslint-disable-next-line no-console
  console.error(`[stripe:${context}] unexpected error:`, err);
  return fail(err && err.message ? err.message : 'Payment could not be started', 502);
};

// plan key -> Stripe price + Checkout mode. Monthly/yearly recur; lifetime is a
// one-time payment (premium forever, no renewal).
const PLANS = {
  monthly: { price: () => process.env.STRIPE_PRICE_MONTHLY || '', mode: 'subscription' },
  yearly: { price: () => process.env.STRIPE_PRICE_YEARLY || '', mode: 'subscription' },
  lifetime: { price: () => process.env.STRIPE_PRICE_LIFETIME || '', mode: 'payment' },
};

const APP_URL = () => process.env.APP_URL || 'http://localhost:3661';
const SUCCESS_URL = () => process.env.STRIPE_SUCCESS_URL || `${APP_URL()}/?status=success`;
const CANCEL_URL = () => process.env.STRIPE_CANCEL_URL || `${APP_URL()}/?status=cancelled`;

const ACTIVE_STATES = ['active', 'trialing'];

// Ensure the user has a *valid* Stripe Customer; returns the customer id.
// Recreates it if the stored id is missing/deleted (e.g. removed in Stripe).
async function ensureCustomer(user) {
  try {
    if (user.stripeCustomerId) {
      try {
        const existing = await stripe.customers.retrieve(user.stripeCustomerId);
        if (existing && !existing.deleted) return user.stripeCustomerId;
      } catch {
        // falls through to create a fresh customer below
      }
    }
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
      metadata: { userId: user.id },
    });
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  } catch (err) {
    throw mapCheckoutError(err, 'customer');
  }
}

// ── POST /subscriptions/checkout ─────────────────────────────────────────
exports.createCheckoutSession = async (userId, planKey = 'monthly') => {
  try {
    ensureStripe();
    const plan = PLANS[planKey];
    if (!plan) throw fail('Unknown subscription plan', 400);
    const priceId = plan.price();
    if (!priceId) throw fail(`No price is configured for the ${planKey} plan`, 503);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw fail('User not found', 404);
    // Premium members may switch/upgrade plans. Block only redundant purchases:
    // the exact same plan, or anything once lifetime is owned (nothing to upgrade).
    if (user.isPremium) {
      if (user.subscriptionPlan === 'lifetime') {
        throw fail('You already have lifetime premium access', 409);
      }
      if (user.subscriptionPlan === planKey) {
        throw fail('You are already on this plan', 409);
      }
    }

    const customerId = await ensureCustomer(user);
    const success = SUCCESS_URL();
    const params = {
      mode: plan.mode,
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${success}${success.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: CANCEL_URL(),
      metadata: { userId: user.id, plan: planKey },
    };
    // Recurring plans carry the metadata onto the Subscription too, so webhooks
    // for renewals/cancellations can find the user and plan.
    if (plan.mode === 'subscription') {
      params.subscription_data = { metadata: { userId: user.id, plan: planKey } };
    }
    const session = await stripe.checkout.sessions.create(params);

    return {
      message: 'Checkout session created',
      data: { url: session.url, id: session.id },
      statusCode: 200,
    };
  } catch (err) {
    throw mapCheckoutError(err, 'checkout');
  }
};

// ── POST /subscriptions/confirm ──────────────────────────────────────────
// Fallback for environments without webhooks (e.g. local dev without the Stripe
// CLI): activate premium from a completed Checkout Session on the success return.
exports.confirmCheckout = async (userId, sessionId) => {
  ensureStripe();
  if (!sessionId) throw fail('Missing checkout session id', 400);

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    throw fail('Payment is not completed yet', 402);
  }
  if (session.mode === 'payment') {
    // Lifetime one-time payment.
    await activateLifetime({ id: userId }, session.customer);
  } else if (session.subscription) {
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    const sub = await stripe.subscriptions.retrieve(subId);
    const plan = (session.metadata && session.metadata.plan) || 'monthly';
    sub.metadata = { userId, plan, ...(sub.metadata || {}) };
    await syncFromSubscription(sub);
  }
  return exports.getStatus(userId);
};

// ── GET /subscriptions/me ────────────────────────────────────────────────
exports.getStatus = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw fail('User not found', 404);
  return {
    message: 'Subscription status',
    data: {
      isPremium: user.isPremium,
      status: user.subscriptionStatus,
      plan: user.subscriptionPlan,
      currentPeriodEnd: user.currentPeriodEnd,
    },
    statusCode: 200,
  };
};

// ── POST /subscriptions/portal ───────────────────────────────────────────
exports.createPortalSession = async (userId) => {
  ensureStripe();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw fail('User not found', 404);
  if (!user.stripeCustomerId) throw fail('No billing account found for this user', 404);

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${APP_URL()}/profile`,
  });
  return { message: 'Billing portal session created', data: { url: session.url }, statusCode: 200 };
};

// ── Webhook ──────────────────────────────────────────────────────────────
async function syncFromSubscription(sub) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer && sub.customer.id;
  const userId = sub.metadata && sub.metadata.userId;
  const plan = (sub.metadata && sub.metadata.plan) || 'monthly';
  const where = userId ? { id: userId } : { stripeCustomerId: customerId };
  const active = ACTIVE_STATES.includes(sub.status);

  const user = await prisma.user.findFirst({ where });
  if (!user) return;

  // Lifetime is permanent — never let a leftover recurring-subscription event
  // downgrade a lifetime member.
  if (user.subscriptionPlan === 'lifetime') return;

  // Ignore a cancellation/inactive event for a subscription that is no longer
  // the user's current one (e.g. the old plan we replaced during an upgrade).
  if (!active && user.stripeSubscriptionId && user.stripeSubscriptionId !== sub.id) return;

  // On an upgrade/switch, the new active sub replaces a different old one —
  // remember it so we can cancel it (after switching) to avoid double billing.
  const oldSubToCancel =
    active && user.stripeSubscriptionId && user.stripeSubscriptionId !== sub.id
      ? user.stripeSubscriptionId
      : null;

  // current_period_end moved under items in recent API versions — read defensively.
  const periodEnd =
    sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId || user.stripeCustomerId || undefined,
      subscriptionStatus: sub.status,
      subscriptionPlan: plan,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      isPremium: active,
    },
  });

  // Cancel the replaced subscription AFTER switching, so its cancellation event
  // is ignored by the guard above (current sub is now the new one).
  if (oldSubToCancel) {
    try {
      await stripe.subscriptions.cancel(oldSubToCancel);
    } catch {
      /* already gone */
    }
  }
}

// One-time (lifetime) payment — premium forever. Cancels any existing recurring
// subscription (lifetime supersedes it) and clears the subscription id.
async function activateLifetime(where, customerId) {
  const user = await prisma.user.findFirst({ where });
  const oldSub = user && user.stripeSubscriptionId ? user.stripeSubscriptionId : null;

  await prisma.user.updateMany({
    where,
    data: {
      stripeCustomerId: customerId || undefined,
      stripeSubscriptionId: null,
      subscriptionStatus: 'lifetime',
      subscriptionPlan: 'lifetime',
      currentPeriodEnd: null,
      isPremium: true,
    },
  });

  if (oldSub) {
    try {
      await stripe.subscriptions.cancel(oldSub);
    } catch {
      /* already gone */
    }
  }
}

exports.handleWebhook = async (rawBody, signature) => {
  ensureStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';

  let event;
  if (secret) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      throw fail(`Webhook signature verification failed: ${err.message}`, 400);
    }
  } else {
    // No webhook secret configured (e.g. local dev without the Stripe CLI) —
    // accept the event unverified so the flow can still be tested.
    event = typeof rawBody === 'string' || Buffer.isBuffer(rawBody) ? JSON.parse(rawBody.toString()) : rawBody;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode === 'payment') {
        // Lifetime one-time payment.
        const userId = session.metadata && session.metadata.userId;
        const where = userId ? { id: userId } : { stripeCustomerId: session.customer };
        await activateLifetime(where, session.customer);
      } else if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        sub.metadata = { ...(session.metadata || {}), ...(sub.metadata || {}) };
        await syncFromSubscription(sub);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await syncFromSubscription(event.data.object);
      break;
    }
    default:
      break;
  }

  return { received: true, type: event.type };
};
