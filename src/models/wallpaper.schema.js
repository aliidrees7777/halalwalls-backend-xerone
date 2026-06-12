const mongoose = require('mongoose');

const WallpaperSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '' },

    // `category` = human label (e.g. "Anime"); `categorySlug` = filter slug
    // (e.g. "anime") that matches the frontend FilterId union.
    category: { type: String, index: true },
    categorySlug: { type: String, index: true },
    tags: { type: [String], default: [] },

    // Display / preview URL shown in the grid and detail page.
    image: { type: String },
    // Full-resolution source asset.
    originalUrl: { type: String },
    // Small preview used in listings.
    thumbnailUrl: { type: String },

    // Card display resolution (e.g. "1920x1080") and the default download choice.
    resolution: { type: String, default: '' },
    preferredResolution: { type: String, default: '' },
    // Available resolution labels for this wallpaper.
    resolutions: { type: [String], default: [] },
    sizeMB: { type: Number, default: 0 },
    width: { type: Number },
    height: { type: Number },

    author: { type: String, default: 'HalalWalls' },
    isPremium: { type: Boolean, default: false },
    // Live/animated wallpaper (the "Live Walls" browse filter).
    isLive: { type: Boolean, default: false, index: true },
    status: { type: String, enum: ['active', 'pending', 'hidden'], default: 'active', index: true },
    downloadCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    // How many users have favorited this wallpaper (incremented/decremented as
    // users add/remove it via /api/v1/me/favorites).
    favoritesCount: { type: Number, default: 0 },

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'hw_wallpapers' }
);

// Full-text search across the most relevant fields.
WallpaperSchema.index({ title: 'text', tags: 'text', description: 'text' });
// Common access patterns: catalog by category, recent feed, popular feed.
WallpaperSchema.index({ categorySlug: 1, status: 1 });
WallpaperSchema.index({ status: 1, createdAt: -1 });
WallpaperSchema.index({ status: 1, downloadCount: -1 });

WallpaperSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

WallpaperSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    title: this.title,
    slug: this.slug,
    description: this.description,
    category: this.category,
    categorySlug: this.categorySlug,
    tags: this.tags,
    image: this.image,
    originalUrl: this.originalUrl,
    thumbnailUrl: this.thumbnailUrl,
    resolutions: this.resolutions,
    sizeMB: this.sizeMB,
    width: this.width,
    height: this.height,
    author: this.author,
    isPremium: this.isPremium,
    status: this.status,
    downloadCount: this.downloadCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Wallpaper', WallpaperSchema);
