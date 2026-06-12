const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: '' },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      validate: {
        validator: (v) => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(v),
        message: 'Please enter a valid email',
      },
    },
    // Hashed. select:false so it never leaks on normal queries.
    password: { type: String, select: false, default: null },

    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String, default: null },
    avatar: { type: String, default: null },
    // Profile extras (editable via PATCH /me; images stored as URLs).
    bio: { type: String, default: '', trim: true },
    banner: { type: String, default: null },
    isPremium: { type: Boolean, default: false },

    // Wallpapers this user has favorited.
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Wallpaper', default: [] }],

    // Password reset tokens are hidden by default.
    passwordReset: {
      token: { type: String, default: null, select: false },
      expiresAt: { type: Date, default: null, select: false },
    },

    // "Log out of all devices": any JWT issued before this instant is rejected
    // by the authorize() middleware. Null = no global logout yet.
    sessionsValidFrom: { type: Date, default: null },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'hw_users' }
);

UserSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Strip sensitive fields whenever a user document is serialized.
UserSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    name: `${this.firstName || ''} ${this.lastName || ''}`.trim(),
    email: this.email,
    role: this.role,
    authProvider: this.authProvider,
    avatar: this.avatar,
    banner: this.banner,
    bio: this.bio || '',
    isPremium: !!this.isPremium,
    favorites: Array.isArray(this.favorites) ? this.favorites.map((f) => f.toString()) : [],
    favoritesCount: Array.isArray(this.favorites) ? this.favorites.length : 0,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', UserSchema);
