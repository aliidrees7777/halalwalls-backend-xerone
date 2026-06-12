// Stats service — computes public aggregate counters (wallpaper count,
// total downloads, category count) from the Wallpaper & Category models.
// Structured stub for now; real aggregation implemented during API planning.
const Wallpaper = require('../models/wallpaper.schema');
const Category = require('../models/category.schema');

// Public aggregate stats for the landing page. Counts only active wallpapers.
exports.getPublicStats = async () => {
  const [totalWallpapers, downloadAgg, viewAgg, categorySlugs, categoryDocs] = await Promise.all([
    Wallpaper.countDocuments({ status: 'active' }),
    Wallpaper.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$downloadCount' } } },
    ]),
    Wallpaper.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$views' } } },
    ]),
    Wallpaper.distinct('categorySlug', { status: 'active' }),
    Category.countDocuments(),
  ]);

  const totalDownloads = (downloadAgg[0] && downloadAgg[0].total) || 0;
  const totalViews = (viewAgg[0] && viewAgg[0].total) || 0;
  // Prefer the Category collection; fall back to distinct slugs that actually
  // have active wallpapers (so the count is meaningful even before Categories
  // is finalized).
  const totalCategories = categoryDocs || categorySlugs.filter(Boolean).length;

  return {
    message: 'Stats fetched',
    data: { totalWallpapers, totalDownloads, totalCategories, totalViews },
    statusCode: 200,
  };
};
