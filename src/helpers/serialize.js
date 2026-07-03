/**
 * Plain serializers for Prisma rows.
 *
 * Prisma returns plain objects (no document methods), so the public-shape
 * mapping (the old `toPublicJSON`) lives here as plain functions.
 */

/**
 * Public-safe user shape. Strips password + token fields and exposes a derived
 * `name`, plus the user's favorite wallpaper ids and count.
 *
 * Favorites can be supplied two ways:
 *   • `favoriteIds` — an explicit array of wallpaper-id strings, OR
 *   • a `user.favorites` relation loaded as Favorite rows ({ wallpaperId }).
 * When neither is present, favorites default to an empty list.
 */
function serializeUser(user, favoriteIds) {
  const ids = Array.isArray(favoriteIds)
    ? favoriteIds.map(String)
    : Array.isArray(user.favorites)
      ? user.favorites.map((f) => String(f.wallpaperId != null ? f.wallpaperId : f))
      : [];

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    email: user.email,
    role: user.role,
    authProvider: user.authProvider,
    emailVerified: !!user.emailVerified,
    avatar: user.avatar,
    banner: user.banner,
    bio: user.bio || '',
    isPremium: !!user.isPremium,
    subscriptionPlan: user.subscriptionPlan || null,
    subscriptionStatus: user.subscriptionStatus || null,
    favorites: ids,
    favoritesCount: ids.length,
    createdAt: user.createdAt,
  };
}

module.exports = { serializeUser };
