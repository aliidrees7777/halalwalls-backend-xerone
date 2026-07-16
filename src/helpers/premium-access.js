/**
 * Whether a user should receive premium entitlements on the public site
 * (premium wallpaper downloads, "No Ads", etc.).
 *
 * Admins always have full access, even without a Stripe subscription.
 */
function hasPremiumAccess(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return !!user.isPremium;
}

module.exports = { hasPremiumAccess };
