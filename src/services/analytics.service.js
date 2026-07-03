/**
 * Analytics service — real dashboard metrics from the DB (admin only).
 *
 * Powers the admin Dashboard home: the top cards, the downloads trend chart, the
 * subscription-plan breakdown and the recent-activity feed. All values are
 * computed live from Postgres via Prisma.
 *
 * Counts scope: "users" everywhere means real end-users (role = user, not
 * soft-deleted) — platform admins are excluded from user/premium/subscription
 * metrics. "Wallpapers" means the whole platform library.
 *
 * Downloads trend: every download writes a row to hw_download_events, so the
 * trend is a real downloads-per-day series over the selected range. The
 * "Total Downloads" card stays the cumulative Wallpaper.downloadCount sum (it
 * includes downloads recorded before event-logging existed).
 */
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const { buildMeta } = require('../helpers/pagination');

// Same monthly/yearly/lifetime prices the app charges — used to estimate revenue
// from the premium-plan mix (no payments table in the schema).
const PLAN_PRICE = { monthly: 2.99, yearly: 9.99, lifetime: 29.99 };

// Supported trend windows for the dashboard date filter.
const RANGES = {
  '7d': { days: 7, label: 'Last 7 days' },
  '14d': { days: 14, label: 'Last 14 days' },
  '30d': { days: 30, label: 'Last 30 days' },
  month: { days: null, label: 'This month' }, // start-of-month → today
};
const DEFAULT_RANGE = '14d';

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// End-user scope (excludes admins + deactivated accounts).
const USER_SCOPE = { role: 'user', isDeleted: false };

exports.getDashboard = async (options = {}) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // ── resolve the trend range ──
  const rangeKey = RANGES[options.range] ? options.range : DEFAULT_RANGE;
  const range = RANGES[rangeKey];
  const today = startOfDay(now);
  const trendStart =
    range.days === null
      ? startOfDay(startOfMonth)
      : (() => {
          const s = startOfDay(now);
          s.setDate(s.getDate() - (range.days - 1));
          return s;
        })();
  // Number of day-buckets to render (inclusive of today).
  const dayCount =
    range.days === null
      ? Math.round((today - startOfDay(startOfMonth)) / 86400000) + 1
      : range.days;

  const [
    wpTotal,
    wpThisMonth,
    userTotal,
    userThisMonth,
    premiumUsers,
    downloadsAgg,
    planGroups,
    recentWallpapers,
    recentUsers,
    dailyDownloads,
    topCategoryGroups,
  ] = await Promise.all([
    prisma.wallpaper.count(),
    prisma.wallpaper.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: USER_SCOPE }),
    prisma.user.count({ where: { ...USER_SCOPE, createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { ...USER_SCOPE, isPremium: true } }),
    prisma.wallpaper.aggregate({ _sum: { downloadCount: true } }),
    prisma.user.groupBy({
      by: ['subscriptionPlan'],
      where: { ...USER_SCOPE, isPremium: true },
      _count: { _all: true },
    }),
    prisma.wallpaper.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { title: true, status: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: USER_SCOPE,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { firstName: true, lastName: true, email: true, isPremium: true, subscriptionPlan: true, createdAt: true },
    }),
    prisma.$queryRaw`
      SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS n
      FROM hw_download_events
      WHERE "createdAt" >= ${trendStart}
      GROUP BY day
      ORDER BY day`,
    prisma.wallpaper.groupBy({
      by: ['category'],
      where: { status: 'active' },
      _count: { _all: true },
      orderBy: { _count: { category: 'desc' } },
      take: 6,
    }),
  ]);

  const totalDownloads = downloadsAgg._sum.downloadCount || 0;

  // ── subscription plan breakdown (real, from premium end-users) ──
  const plans = { monthly: 0, yearly: 0, lifetime: 0 };
  planGroups.forEach((g) => {
    if (g.subscriptionPlan && plans[g.subscriptionPlan] !== undefined) {
      plans[g.subscriptionPlan] = g._count._all;
    }
  });
  const planTotal = plans.monthly + plans.yearly + plans.lifetime;
  const pct = (n) => (planTotal ? Math.round((n / planTotal) * 1000) / 10 : 0);
  const revenue =
    plans.monthly * PLAN_PRICE.monthly +
    plans.yearly * PLAN_PRICE.yearly +
    plans.lifetime * PLAN_PRICE.lifetime;

  // ── downloads trend (per day, gap-filled to a continuous range) ──
  const byDay = new Map(
    dailyDownloads.map((r) => [startOfDay(r.day).getTime(), Number(r.n)]),
  );
  const series = [];
  for (let i = 0; i < dayCount; i += 1) {
    const d = new Date(trendStart);
    d.setDate(trendStart.getDate() + i);
    series.push({ date: d.toISOString().slice(0, 10), value: byDay.get(startOfDay(d).getTime()) || 0 });
  }
  const rangeDownloads = series.reduce((sum, p) => sum + p.value, 0);

  // ── recent activity (merge recent uploads + registrations, newest first) ──
  const activity = [];
  recentWallpapers.forEach((w) => {
    activity.push({
      type: w.status === 'active' ? 'wallpaper_approved' : 'wallpaper_uploaded',
      title: w.status === 'active' ? 'Wallpaper approved' : 'New wallpaper uploaded',
      subtitle: w.title,
      at: w.createdAt,
    });
  });
  recentUsers.forEach((u) => {
    if (u.isPremium) {
      activity.push({
        type: 'subscription',
        title: 'New subscription',
        subtitle: `${u.subscriptionPlan || 'premium'} — ${u.email}`,
        at: u.createdAt,
      });
    } else {
      activity.push({
        type: 'user',
        title: 'New user registered',
        subtitle: u.email,
        at: u.createdAt,
      });
    }
  });
  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const recentActivity = activity.slice(0, 6);

  const topCategories = topCategoryGroups
    .filter((g) => g.category)
    .map((g) => ({ name: g.category, count: g._count._all }));

  return {
    message: 'Dashboard analytics',
    data: {
      cards: {
        totalWallpapers: wpTotal,
        totalUsers: userTotal,
        premiumUsers,
        totalDownloads,
        totalRevenue: Math.round(revenue * 100) / 100,
      },
      thisMonth: { wallpapers: wpThisMonth, users: userThisMonth },
      subscriptions: {
        total: planTotal,
        revenue: Math.round(revenue * 100) / 100,
        breakdown: [
          { plan: 'monthly', count: plans.monthly, percent: pct(plans.monthly) },
          { plan: 'yearly', count: plans.yearly, percent: pct(plans.yearly) },
          { plan: 'lifetime', count: plans.lifetime, percent: pct(plans.lifetime) },
        ],
      },
      trend: {
        label: 'Downloads per day',
        range: rangeKey,
        rangeLabel: range.label,
        total: rangeDownloads,
        options: Object.entries(RANGES).map(([key, r]) => ({ key, label: r.label })),
        series,
      },
      topCategories,
      recentActivity,
    },
    statusCode: 200,
  };
};

// ── GET /admin/activity — paginated recent-activity feed ─────────────────
// There is no dedicated audit-log table, so the feed is a merge of the most
// recent wallpapers (uploads/approvals) + user registrations/subscriptions,
// newest first. POOL bounds how far back the feed reaches.
const ACTIVITY_POOL = 100;

exports.getActivity = async (options = {}) => {
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(options.limit, 10) || 15));

  const [wallpapers, users] = await Promise.all([
    prisma.wallpaper.findMany({
      orderBy: { createdAt: 'desc' },
      take: ACTIVITY_POOL,
      select: { id: true, title: true, slug: true, status: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { role: 'user', isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: ACTIVITY_POOL,
      select: { id: true, email: true, isPremium: true, subscriptionPlan: true, createdAt: true },
    }),
  ]);

  const activity = [];
  wallpapers.forEach((w) => {
    activity.push({
      type: w.status === 'active' ? 'wallpaper_approved' : 'wallpaper_uploaded',
      title: w.status === 'active' ? 'Wallpaper approved' : 'New wallpaper uploaded',
      subtitle: w.title,
      slug: w.slug,
      at: w.createdAt,
    });
  });
  users.forEach((u) => {
    if (u.isPremium) {
      activity.push({
        type: 'subscription',
        title: 'New subscription',
        subtitle: `${u.subscriptionPlan || 'premium'} — ${u.email}`,
        at: u.createdAt,
      });
    } else {
      activity.push({ type: 'user', title: 'New user registered', subtitle: u.email, at: u.createdAt });
    }
  });
  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const total = activity.length;
  const start = (page - 1) * limit;
  const items = activity.slice(start, start + limit);

  return {
    message: 'Activity feed',
    data: { activity: items, pagination: buildMeta(total, page, limit) },
    statusCode: 200,
  };
};

// ── GET /admin/storage — real media storage usage ────────────────────────
// "Used" is the actual on-disk size of the backend's /uploads directory
// (originals + thumbnails + render cache). "Quota" is the hosting plan's
// storage allowance (STORAGE_QUOTA_GB env — set this to your Hostinger plan).
// Walking the tree is cached briefly so the dashboard doesn't re-scan on every hit.
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const STORAGE_QUOTA_GB = Number(process.env.STORAGE_QUOTA_GB) || 100;
const STORAGE_TTL_MS = 60 * 1000;
let storageCache = null; // { at, data }

async function dirStats(dir) {
  let bytes = 0;
  let files = 0;
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return { bytes, files }; // dir doesn't exist yet
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      const sub = await dirStats(full);
      bytes += sub.bytes;
      files += sub.files;
    } else {
      try {
        // eslint-disable-next-line no-await-in-loop
        const st = await fs.promises.stat(full);
        bytes += st.size;
        files += 1;
      } catch {
        /* file vanished mid-scan — skip */
      }
    }
  }
  return { bytes, files };
}

exports.getStorage = async () => {
  const now = Date.now();
  if (storageCache && now - storageCache.at < STORAGE_TTL_MS) {
    return { message: 'Storage usage', data: storageCache.data, statusCode: 200 };
  }

  const { bytes: usedBytes, files } = await dirStats(UPLOAD_DIR);
  const quotaBytes = STORAGE_QUOTA_GB * 1024 ** 3;

  // Best-effort real disk stats for the partition (Node ≥ 18.15 supports statfs).
  let disk = null;
  try {
    if (fs.promises.statfs) {
      const s = await fs.promises.statfs(UPLOAD_DIR);
      disk = {
        totalBytes: s.blocks * s.bsize,
        freeBytes: s.bavail * s.bsize,
      };
    }
  } catch {
    /* statfs unsupported on this platform */
  }

  const data = {
    usedBytes,
    quotaBytes,
    quotaGB: STORAGE_QUOTA_GB,
    remainingBytes: Math.max(0, quotaBytes - usedBytes),
    percent: quotaBytes ? Math.round((usedBytes / quotaBytes) * 1000) / 10 : 0,
    fileCount: files,
    disk,
  };
  storageCache = { at: now, data };
  return { message: 'Storage usage', data, statusCode: 200 };
};
