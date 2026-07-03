// Resolution service — the admin-managed resolution catalog + its live usage.
// Public `listPublic` drives the "browse by resolution" nav + download sizes;
// admin functions power the Resolutions page. Usage is derived from
// Wallpaper.resolution (wallpapers) + DownloadEvent.resolution (downloads).
const prisma = require('../lib/prisma');
const { parsePagination, buildMeta } = require('../helpers/pagination');

const fail = (m, s) => { const e = new Error(m); e.statusCode = s; return e; };
const DEVICES = ['desktop', 'mobile'];
const keyOf = (w, h) => `${w}x${h}`;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function aspectOf(w, h) { if (!w || !h) return ''; const g = gcd(w, h) || 1; return `${w / g}:${h / g}`; }
function parseWH(s) {
  const m = String(s || '').toLowerCase().match(/(\d+)\s*[x×]\s*(\d+)/);
  return m ? { width: +m[1], height: +m[2] } : null;
}

// Maps of "WxH" -> wallpaper count / download count.
async function usage() {
  const [wp, dl] = await Promise.all([
    prisma.wallpaper.groupBy({ by: ['resolution'], where: { status: 'active' }, _count: { _all: true } }),
    prisma.downloadEvent.groupBy({ by: ['resolution'], _count: { _all: true } }),
  ]);
  const wpMap = {};
  wp.forEach((r) => { const p = parseWH(r.resolution); if (p) { const k = keyOf(p.width, p.height); wpMap[k] = (wpMap[k] || 0) + r._count._all; } });
  const dlMap = {};
  dl.forEach((r) => { const p = parseWH(r.resolution); if (p) { const k = keyOf(p.width, p.height); dlMap[k] = (dlMap[k] || 0) + r._count._all; } });
  return { wpMap, dlMap };
}

// Managed catalog rows only (no auto-surfaced native resolutions), with their
// live usage attached. The catalog is exactly what admins curate.
function mapRows(rows, wpMap, dlMap) {
  return rows.map((r) => {
    const k = keyOf(r.width, r.height);
    const isActive = r.isActive !== false;
    return {
      id: r.id,
      key: k,
      label: r.label,
      width: r.width,
      height: r.height,
      aspectRatio: r.aspectRatio || aspectOf(r.width, r.height),
      device: r.device,
      fileSizeMB: r.fileSizeMB,
      isActive,
      status: isActive ? 'active' : 'inactive',
      wallpaperCount: wpMap[k] || 0,
      downloads: dlMap[k] || 0,
      managed: true,
      createdAt: r.createdAt,
    };
  });
}

// ── Public: GET /resolutions ── active catalog for nav + download sizes.
exports.listPublic = async () => {
  const rows = await prisma.resolution.findMany({
    where: { isActive: true },
    orderBy: [{ device: 'asc' }, { order: 'asc' }, { width: 'desc' }],
  });
  const list = rows.map((r) => ({
    label: r.label, width: r.width, height: r.height, fileSizeMB: r.fileSizeMB,
    device: r.device, aspectRatio: r.aspectRatio || aspectOf(r.width, r.height),
  }));
  return {
    message: 'Resolutions fetched',
    data: {
      desktop: list.filter((r) => r.device === 'desktop').map((r) => r.label),
      mobile: list.filter((r) => r.device === 'mobile').map((r) => r.label),
      list,
    },
    statusCode: 200,
  };
};

// ── Admin: GET /admin/resolutions ── union list with usage.
exports.listAdmin = async (query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  const [rows, u] = await Promise.all([prisma.resolution.findMany(), usage()]);
  let out = mapRows(rows, u.wpMap, u.dlMap);
  const q = String(query.q || '').trim().toLowerCase();
  if (q) out = out.filter((r) => r.label.toLowerCase().includes(q) || r.key.includes(q));
  if (query.status === 'active' || query.status === 'inactive') out = out.filter((r) => r.status === query.status);
  if (query.device && DEVICES.includes(query.device)) out = out.filter((r) => r.device === query.device);
  const sort = query.sort || 'width';
  out.sort((a, b) => {
    if (sort === 'wallpapers') return b.wallpaperCount - a.wallpaperCount;
    if (sort === 'downloads') return b.downloads - a.downloads;
    if (sort === 'widthAsc') return a.width - b.width;
    if (sort === 'latest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    return b.width - a.width; // width high → low
  });
  const total = out.length;
  return {
    message: 'Resolutions fetched',
    data: { resolutions: out.slice(skip, skip + limit), pagination: buildMeta(total, page, limit) },
    statusCode: 200,
  };
};

exports.getStats = async () => {
  const [rows, u, wpAssigned] = await Promise.all([
    prisma.resolution.findMany(),
    usage(),
    prisma.wallpaper.count({ where: { status: 'active', NOT: { resolution: '' } } }),
  ]);
  const out = mapRows(rows, u.wpMap, u.dlMap);
  const active = out.filter((r) => r.isActive).length;
  const totalDownloads = out.reduce((s, r) => s + r.downloads, 0);
  let mostPopular = null;
  out.forEach((r) => { if (!mostPopular || r.wallpaperCount > mostPopular.count) mostPopular = { label: r.label, count: r.wallpaperCount }; });
  return {
    message: 'Resolution stats',
    data: { total: out.length, active, totalDownloads, wallpapersAssigned: wpAssigned, mostPopular },
    statusCode: 200,
  };
};

exports.create = async (body = {}) => {
  const width = parseInt(body.width, 10);
  const height = parseInt(body.height, 10);
  if (!width || !height) throw fail('Width and height are required', 400);
  if (await prisma.resolution.findUnique({ where: { width_height: { width, height } } })) {
    throw fail('This resolution already exists', 409);
  }
  const resolution = await prisma.resolution.create({
    data: {
      label: (body.label && String(body.label).trim()) || `${width}×${height}`,
      width, height,
      aspectRatio: (body.aspectRatio && String(body.aspectRatio).trim()) || aspectOf(width, height),
      device: DEVICES.includes(body.device) ? body.device : (height > width ? 'mobile' : 'desktop'),
      fileSizeMB: Number.isFinite(+body.fileSizeMB) ? +body.fileSizeMB : 0,
      isActive: body.isActive === undefined ? true : !!body.isActive,
    },
  });
  return { message: 'Resolution created', data: { resolution }, statusCode: 201 };
};

// key = "WIDTHxHEIGHT"; upsert so used-only resolutions can be edited into the catalog.
exports.update = async (k, body = {}) => {
  const p = parseWH(k);
  if (!p) throw fail('Invalid resolution key', 400);
  const data = {};
  if (body.label !== undefined) data.label = String(body.label).trim();
  if (body.aspectRatio !== undefined) data.aspectRatio = String(body.aspectRatio).trim();
  if (body.device !== undefined && DEVICES.includes(body.device)) data.device = body.device;
  if (body.fileSizeMB !== undefined) data.fileSizeMB = Number.isFinite(+body.fileSizeMB) ? +body.fileSizeMB : 0;
  if (body.isActive !== undefined) data.isActive = !!body.isActive;
  const resolution = await prisma.resolution.upsert({
    where: { width_height: { width: p.width, height: p.height } },
    update: data,
    create: {
      label: data.label || `${p.width}×${p.height}`, width: p.width, height: p.height,
      aspectRatio: data.aspectRatio || aspectOf(p.width, p.height),
      device: data.device || (p.height > p.width ? 'mobile' : 'desktop'),
      fileSizeMB: data.fileSizeMB || 0,
      isActive: data.isActive === undefined ? true : data.isActive,
    },
  });
  return { message: 'Resolution updated', data: { resolution }, statusCode: 200 };
};

exports.remove = async (k) => {
  const p = parseWH(k);
  if (!p) throw fail('Invalid resolution key', 400);
  try {
    await prisma.resolution.delete({ where: { width_height: { width: p.width, height: p.height } } });
  } catch (e) {
    if (e.code === 'P2025') throw fail('Resolution not found', 404);
    throw e;
  }
  return { message: 'Resolution deleted', data: { key: k }, statusCode: 200 };
};
