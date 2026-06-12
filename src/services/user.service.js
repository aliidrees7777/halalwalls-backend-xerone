/**
 * User service — the signed-in user's favorite wallpapers.
 *
 * Auth-only: the controller passes req.user.id (a valid token is required by
 * the route's authorize() guard). Favorites are stored as an array of Wallpaper
 * ids on the user, and EACH wallpaper keeps a `favoritesCount` that is kept in
 * sync — incremented when a user adds it, decremented when removed. Adds/removes
 * are idempotent (favoriting twice does not double-count).
 */
const mongoose = require('mongoose');
const User = require('../models/user.schema');
const Wallpaper = require('../models/wallpaper.schema');
const { serializeCard } = require('./wallpaper.service');

const fail = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const assertValidId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw fail('Invalid wallpaper id', 400);
};

const favoriteIds = (user) => (user.favorites || []).map((f) => String(f));

// ── GET /me/favorites — the user's favorited wallpapers (active only) ──────
exports.listFavorites = async (userId) => {
  const user = await User.findById(userId).select('favorites');
  if (!user) throw fail('User not found', 404);

  const ids = user.favorites || [];
  const docs = await Wallpaper.find({ _id: { $in: ids }, status: 'active' }).lean();

  // Preserve the user's favorite order (most-recent additions last).
  const order = new Map(ids.map((id, i) => [String(id), i]));
  docs.sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0));

  const favSet = new Set(ids.map(String));
  return {
    message: 'Favorites fetched',
    data: { wallpapers: docs.map((d) => serializeCard(d, favSet)), count: docs.length },
    statusCode: 200,
  };
};

// ── POST /me/favorites/:wallpaperId — add (idempotent) ────────────────────
exports.addFavorite = async (userId, wallpaperId) => {
  assertValidId(wallpaperId);

  const wp = await Wallpaper.findOne({ _id: wallpaperId, status: 'active' }).select('_id favoritesCount');
  if (!wp) throw fail('Wallpaper not found', 404);

  // $addToSet → only adds if not already present; modifiedCount tells us if new.
  const upd = await User.updateOne({ _id: userId }, { $addToSet: { favorites: wp._id } });
  if (upd.matchedCount === 0) throw fail('User not found', 404);

  let favoritesCount = wp.favoritesCount || 0;
  if (upd.modifiedCount === 1) {
    const updated = await Wallpaper.findByIdAndUpdate(
      wp._id,
      { $inc: { favoritesCount: 1 } },
      { new: true }
    ).select('favoritesCount');
    favoritesCount = updated.favoritesCount;
  }

  const user = await User.findById(userId).select('favorites');
  return {
    message: upd.modifiedCount === 1 ? 'Added to favorites' : 'Already in favorites',
    data: {
      favorites: favoriteIds(user),
      wallpaperId: String(wp._id),
      isFavorite: true,
      favoritesCount,
    },
    statusCode: 200,
  };
};

// ── DELETE /me/favorites/:wallpaperId — remove (idempotent) ───────────────
exports.removeFavorite = async (userId, wallpaperId) => {
  assertValidId(wallpaperId);

  const upd = await User.updateOne({ _id: userId }, { $pull: { favorites: wallpaperId } });
  if (upd.matchedCount === 0) throw fail('User not found', 404);

  let favoritesCount = null;
  if (upd.modifiedCount === 1) {
    const updated = await Wallpaper.findByIdAndUpdate(
      wallpaperId,
      { $inc: { favoritesCount: -1 } },
      { new: true }
    ).select('favoritesCount');
    if (updated) {
      // Guard against drifting below zero.
      if (updated.favoritesCount < 0) {
        await Wallpaper.updateOne({ _id: wallpaperId }, { $set: { favoritesCount: 0 } });
        favoritesCount = 0;
      } else {
        favoritesCount = updated.favoritesCount;
      }
    }
  }

  const user = await User.findById(userId).select('favorites');
  return {
    message: upd.modifiedCount === 1 ? 'Removed from favorites' : 'Was not in favorites',
    data: {
      favorites: favoriteIds(user),
      wallpaperId: String(wallpaperId),
      isFavorite: false,
      favoritesCount,
    },
    statusCode: 200,
  };
};

// ── GET /me — profile + favorites/uploads counts ─────────────────────────
exports.getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw fail('User not found', 404);

  const uploadsCount = await Wallpaper.countDocuments({ uploadedBy: userId });
  return {
    message: 'Profile fetched',
    data: {
      user: user.toPublicJSON(),
      favoritesCount: (user.favorites || []).length,
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

  update.updatedAt = Date.now();
  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true });
  if (!user) throw fail('User not found', 404);

  return { message: 'Profile updated', data: { user: user.toPublicJSON() }, statusCode: 200 };
};

// ── GET /me/uploads — wallpapers this user uploaded (all statuses) ────────
exports.listUploads = async (userId) => {
  const docs = await Wallpaper.find({ uploadedBy: userId }).sort({ createdAt: -1 }).lean();
  // The owner sees their own uploads regardless of status (incl. pending),
  // so each card carries its moderation status.
  const wallpapers = docs.map((d) => ({ ...serializeCard(d), status: d.status }));
  return {
    message: 'Uploads fetched',
    data: { wallpapers, count: wallpapers.length },
    statusCode: 200,
  };
};
