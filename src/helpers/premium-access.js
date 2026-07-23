/**
 * Whether a user should receive premium entitlements on the public site
 * (premium wallpaper downloads, "No Ads", etc.).
 *
 * Admins always have full access, even without a Stripe subscription and
 * even if `isPremium` was cleared in the database (e.g. after a password
 * reset or manual user edit).
 */
function hasPremiumAccess(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return !!user.isPremium;
}

/**
 * Persist premium flags for admin accounts so DB + public UI stay in sync.
 * No-op for non-admins or admins already marked premium with a plan.
 * Returns the (possibly refreshed) user row.
 */
async function ensureAdminPremium(prisma, user) {
  if (!user || user.role !== 'admin') return user;
  const needs =
    !user.isPremium ||
    user.subscriptionPlan !== 'lifetime' ||
    user.subscriptionStatus !== 'active';
  if (!needs) return user;
  return prisma.user.update({
    where: { id: user.id },
    data: {
      isPremium: true,
      subscriptionPlan: 'lifetime',
      subscriptionStatus: 'active',
    },
  });
}

module.exports = { hasPremiumAccess, ensureAdminPremium };
