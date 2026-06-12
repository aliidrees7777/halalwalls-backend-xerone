const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '' },
    image: { type: String, default: null },
    // `count` is a cached value; the API computes the live count from active
    // wallpapers, but we keep the field for seeds/admin convenience.
    count: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    // "Premium Walls"-style category flag (shown in the sidebar).
    isPremium: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'hw_categories' }
);

CategorySchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Category', CategorySchema);
