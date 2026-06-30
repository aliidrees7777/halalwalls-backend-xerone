/**
 * User service — the signed-in user's profile + favorite wallpapers.
 *
 * Auth-only: the controller passes req.user.id (a valid token is required by
 * the route's authorize() guard). Favorites live in the hw_favorites join table
 * (one row per user↔wallpaper). EACH wallpaper also keeps a denormalized
 * `favoritesCount` kept in sync — incremented when a user adds it, decremented
 * when removed. Adds/removes are idempotent (the table's unique constraint on
 * (userId, wallpaperId) means favoriting twice never double-counts).
 */
const prisma = require('../lib/prisma');
const stripe = require('../lib/stripe');
const { serializeUser } = require('../helpers/serialize');
const { serializeCard } = require('./wallpaper.service');

const fail = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// UUID v4-ish check so a malformed id returns a clean 400 instead of a DB error.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const assertValidId = (id) => {
  if (!UUID_RE.test(String(id))) throw fail('Invalid wallpaper id', 400);
};

// Ordered (oldest-first) list of the user's favorite wallpaper ids.
async function favoriteWallpaperIds(userId) {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { wallpaperId: true },
  });
  return rows.map((r) => r.wallpaperId);
}

// ── GET /me/favorites — the user's favorited wallpapers (active only) ──────
exports.listFavorites = async (userId) => {
  const favs = await prisma.favorite.findMany({
    where: { userId, wallpaper: { status: 'active' } },
    orderBy: { createdAt: 'asc' }, // preserve favorite order (most-recent last)
    include: { wallpaper: true },
  });

  const docs = favs.map((f) => f.wallpaper);
  const favSet = new Set(docs.map((d) => String(d.id)));
  return {
    message: 'Favorites fetched',
    data: { wallpapers: docs.map((d) => serializeCard(d, favSet)), count: docs.length },
    statusCode: 200,
  };
};

// ── POST /me/favorites/:wallpaperId — add (idempotent) ────────────────────
exports.addFavorite = async (userId, wallpaperId) => {
  assertValidId(wallpaperId);

  const wp = await prisma.wallpaper.findFirst({
    where: { id: wallpaperId, status: 'active' },
    select: { id: true, favoritesCount: true },
  });
  if (!wp) throw fail('Wallpaper not found', 404);

  // Idempotent add: create only if the (userId, wallpaperId) pair is new.
  const existing = await prisma.favorite.findUnique({
    where: { userId_wallpaperId: { userId, wallpaperId } },
  });

  let favoritesCount = wp.favoritesCount || 0;
  let added = false;
  if (!existing) {
    await prisma.favorite.create({ data: { userId, wallpaperId } });
    const updated = await prisma.wallpaper.update({
      where: { id: wallpaperId },
      data: { favoritesCount: { increment: 1 } },
      select: { favoritesCount: true },
    });
    favoritesCount = updated.favoritesCount;
    added = true;
  }

  return {
    message: added ? 'Added to favorites' : 'Already in favorites',
    data: {
      favorites: await favoriteWallpaperIds(userId),
      wallpaperId: String(wallpaperId),
      isFavorite: true,
      favoritesCount,
    },
    statusCode: 200,
  };
};

// ── DELETE /me/favorites/:wallpaperId — remove (idempotent) ───────────────
exports.removeFavorite = async (userId, wallpaperId) => {
  assertValidId(wallpaperId);

  const del = await prisma.favorite.deleteMany({ where: { userId, wallpaperId } });

  let favoritesCount = null;
  if (del.count === 1) {
    // Decrement only if the wallpaper still exists; guard against drifting < 0.
    const dec = await prisma.wallpaper.updateMany({
      where: { id: wallpaperId },
      data: { favoritesCount: { decrement: 1 } },
    });
    if (dec.count === 1) {
      const wp = await prisma.wallpaper.findUnique({
        where: { id: wallpaperId },
        select: { favoritesCount: true },
      });
      if (wp && wp.favoritesCount < 0) {
        await prisma.wallpaper.update({ where: { id: wallpaperId }, data: { favoritesCount: 0 } });
        favoritesCount = 0;
      } else if (wp) {
        favoritesCount = wp.favoritesCount;
      }
    }
  }

  return {
    message: del.count === 1 ? 'Removed from favorites' : 'Was not in favorites',
    data: {
      favorites: await favoriteWallpaperIds(userId),
      wallpaperId: String(wallpaperId),
      isFavorite: false,
      favoritesCount,
    },
    statusCode: 200,
  };
};

// ── GET /me — profile + favorites/uploads counts ─────────────────────────
exports.getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { favorites: { select: { wallpaperId: true } } },
  });
  if (!user) throw fail('User not found', 404);

  const uploadsCount = await prisma.wallpaper.count({ where: { uploadedById: userId } });
  return {
    message: 'Profile fetched',
    data: {
      user: serializeUser(user),
      favoritesCount: user.favorites.length,
      uploadsCount,
    },
    statusCode: 200,
  };
};

// ── PATCH /me — update editable profile fields (images as URLs) ──────────
const EDITABLE = ['firstName', 'lastName', 'bio', 'avatar', 'banner'];

exports.updateMe = async (userId, body = {}) => {
  const update = {};

  // Convenience: accept a full `name` and split it into first/last.
  if (body.name && body.firstName === undefined && body.lastName === undefined) {
    const parts = String(body.name).trim().split(/\s+/);
    update.firstName = parts.shift() || '';
    update.lastName = parts.join(' ');
  }

  for (const key of EDITABLE) {
    if (body[key] !== undefined) {
      update[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
    }
  }

  if (update.firstName !== undefined && !update.firstName) {
    throw fail('First name cannot be empty', 400);
  }
  if (Object.keys(update).length === 0) {
    throw fail('No valid fields to update (allowed: firstName, lastName, name, bio, avatar, banner)', 400);
  }

  let user;
  try {
    user = await prisma.user.update({
      where: { id: userId },
      data: update,
      include: { favorites: { select: { wallpaperId: true } } },
    });
  } catch (err) {
    if (err.code === 'P2025') throw fail('User not found', 404);
    throw err;
  }

  return { message: 'Profile updated', data: { user: serializeUser(user) }, statusCode: 200 };
};

// ── GET /me/uploads — wallpapers this user uploaded (all statuses) ────────
exports.listUploads = async (userId) => {
  const docs = await prisma.wallpaper.findMany({
    where: { uploadedById: userId },
    orderBy: { createdAt: 'desc' },
  });
  // The owner sees their own uploads regardless of status (incl. pending),
  // so each card carries its moderation status.
  const wallpapers = docs.map((d) => ({ ...serializeCard(d), status: d.status }));
  return {
    message: 'Uploads fetched',
    data: { wallpapers, count: wallpapers.length },
    statusCode: 200,
  };
};

// ── DELETE /me — permanently delete the signed-in user's own account ──────
// Cancels any live Stripe subscription (best-effort), guards against removing
// the last admin, then deletes the user. Favorites cascade-delete; uploaded
// wallpapers are kept with uploadedById set to null (per the schema's onDelete
// rules — same outcome as the admin delete-user path).
exports.deleteMe = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw fail('User not found', 404);

  // Never leave the platform without at least one admin.
  if (user.role === 'admin') {
    const admins = await prisma.user.count({ where: { role: 'admin' } });
    if (admins <= 1) throw fail('Cannot delete the last admin account', 400);
  }

  // Best-effort: stop future billing by cancelling the live subscription. A
  // failure here (Stripe down, already cancelled, lifetime plan, etc.) must not
  // block account deletion.
  if (stripe && user.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(user.stripeSubscriptionId);
    } catch {
      /* ignore — proceed with deletion regardless */
    }
  }

  await prisma.user.delete({ where: { id: userId } });
  return { message: 'Account deleted', data: { id: userId }, statusCode: 200 };
};
