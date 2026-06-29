// Stats service — computes public aggregate counters (wallpaper count,
// total downloads/views, category count) from the Wallpaper & Category tables.
const prisma = require('../lib/prisma');

// Public aggregate stats for the landing page. Counts only active wallpapers.
exports.getPublicStats = async () => {
  const [totalWallpapers, sums, distinctSlugs, categoryCount] = await Promise.all([
    prisma.wallpaper.count({ where: { status: 'active' } }),
    prisma.wallpaper.aggregate({
      where: { status: 'active' },
      _sum: { downloadCount: true, views: true },
    }),
    prisma.wallpaper.findMany({
      where: { status: 'active' },
      distinct: ['categorySlug'],
      select: { categorySlug: true },
    }),
    prisma.category.count(),
  ]);

  const totalDownloads = sums._sum.downloadCount || 0;
  const totalViews = sums._sum.views || 0;
  // Prefer the Category table; fall back to distinct slugs that actually have
  // active wallpapers (so the count is meaningful even before Categories is
  // finalized).
  const totalCategories = categoryCount || distinctSlugs.filter((r) => r.categorySlug).length;

  return {
    message: 'Stats fetched',
    data: { totalWallpapers, totalDownloads, totalCategories, totalViews },
    statusCode: 200,
  };
};
