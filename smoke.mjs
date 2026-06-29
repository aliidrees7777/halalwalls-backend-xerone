// Live smoke test of the Prisma/Supabase data layer. Run against a booted server.
const BASE = process.env.SMOKE_BASE || 'http://localhost:3662';
const API = `${BASE}/api/v1`;
let pass = 0, fail = 0;
const results = [];

function check(name, cond, extra = '') {
  if (cond) { pass++; results.push(`  ✅ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; results.push(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

async function j(method, path, { body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const uniqEmail = `smoke_${Date.now()}@example.com`;

(async () => {
  // ── Public catalog ──
  let r = await j('GET', '/wallpapers');
  check('GET /wallpapers (latest)', r.status === 200 && Array.isArray(r.data?.data?.wallpapers), `total=${r.data?.data?.pagination?.total}`);
  const total = r.data?.data?.pagination?.total;
  check('  → 23 active wallpapers seeded', total === 23, `got ${total}`);
  const firstSlug = r.data?.data?.wallpapers?.[0]?.slug;

  r = await j('GET', '/wallpapers?category=space');
  const spaceCats = r.data?.data?.wallpapers?.every((w) => w.category === 'space');
  check('GET /wallpapers?category=space', r.status === 200 && spaceCats, `count=${r.data?.data?.wallpapers?.length}`);

  r = await j('GET', '/wallpapers?sort=popular&limit=3');
  const dc = r.data?.data?.wallpapers?.map((w) => w.downloadCount) || [];
  const sortedDesc = dc.every((v, i) => i === 0 || dc[i - 1] >= v);
  check('GET /wallpapers?sort=popular', r.status === 200 && sortedDesc, `downloads=${dc.join(',')}`);

  r = await j('GET', '/wallpapers?sort=random&limit=5');
  check('GET /wallpapers?sort=random', r.status === 200 && r.data?.data?.wallpapers?.length === 5);

  r = await j('GET', '/wallpapers?category=space&sort=popular');
  check('GET combined category+sort', r.status === 200 && r.data?.data?.filter?.mode === 'popular' && r.data?.data?.filter?.category === 'space');

  r = await j('GET', '/wallpapers?q=batman');
  check('GET /wallpapers?q=batman (search title)', r.status === 200 && r.data?.data?.wallpapers?.length >= 1, `hits=${r.data?.data?.wallpapers?.length}`);

  r = await j('GET', '/wallpapers?tag=galaxy');
  check('GET /wallpapers?tag=galaxy (array has)', r.status === 200 && r.data?.data?.wallpapers?.length >= 1, `hits=${r.data?.data?.wallpapers?.length}`);

  r = await j('GET', '/wallpapers?resolution=3840x2160');
  check('GET /wallpapers?resolution=3840x2160', r.status === 200 && r.data?.data?.wallpapers?.length >= 1, `hits=${r.data?.data?.wallpapers?.length}`);

  r = await j('GET', '/wallpapers/tags');
  check('GET /wallpapers/tags (unnest+group)', r.status === 200 && r.data?.data?.tags?.length >= 1, `top=${r.data?.data?.tags?.[0]?.tag}:${r.data?.data?.tags?.[0]?.count}`);

  // ── Detail + view increment ──
  let d1 = await j('GET', `/wallpapers/${firstSlug}`);
  let d2 = await j('GET', `/wallpapers/${firstSlug}`);
  const v1 = d1.data?.data?.wallpaper?.views, v2 = d2.data?.data?.wallpaper?.views;
  check('GET /wallpapers/:slug detail', d1.status === 200 && !!d1.data?.data?.wallpaper?.tagSlugs);
  check('  → views increments', typeof v1 === 'number' && v2 === v1 + 1, `${v1} → ${v2}`);
  check('  → downloadResolutions present', Array.isArray(d1.data?.data?.downloadResolutions?.desktop));

  r = await j('GET', `/wallpapers/${firstSlug}/related`);
  check('GET /wallpapers/:slug/related', r.status === 200 && Array.isArray(r.data?.data?.wallpapers));

  r = await j('GET', '/wallpapers/this-slug-does-not-exist');
  check('GET /wallpapers/:bad → 404', r.status === 404);

  let dl = await j('POST', `/wallpapers/${firstSlug}/download`, { body: { resolution: '1920x1080' } });
  check('POST /wallpapers/:slug/download without token → 401', dl.status === 401);

  // ── Categories ──
  r = await j('GET', '/categories');
  const cats = r.data?.data?.categories || [];
  const spaceCount = cats.find((c) => c.slug === 'space')?.count;
  check('GET /categories (live counts)', r.status === 200 && cats.length === 9, `count=${cats.length}`);
  check('  → space live count', spaceCount === 3, `got ${spaceCount}`);

  r = await j('GET', '/categories/anime');
  check('GET /categories/:slug', r.status === 200 && r.data?.data?.category?.slug === 'anime', `count=${r.data?.data?.category?.count}`);

  // ── Stats ──
  r = await j('GET', '/stats');
  const s = r.data?.data;
  check('GET /stats', r.status === 200 && s?.totalWallpapers === 23 && s?.totalCategories === 9, `dl=${s?.totalDownloads} views=${s?.totalViews}`);

  // ── Auth + favorites flow ──
  r = await j('POST', '/auth/signup', { body: { firstName: 'Smoke', email: uniqEmail, password: 'password123', confirmPassword: 'password123' } });
  check('POST /auth/signup', r.status === 201 && !!r.data?.data?.token, `verified=${r.data?.data?.user?.emailVerified}`);
  check('  → starts UNVERIFIED', r.data?.data?.user?.emailVerified === false);
  let token = r.data?.data?.token;

  r = await j('POST', '/auth/login', { body: { email: uniqEmail, password: 'password123' } });
  check('POST /auth/login', r.status === 200 && !!r.data?.data?.token && Array.isArray(r.data?.data?.user?.favorites));
  token = r.data?.data?.token;

  r = await j('GET', '/me', { token });
  check('GET /me (auth)', r.status === 200 && r.data?.data?.user?.email === uniqEmail, `uploads=${r.data?.data?.uploadsCount}`);

  r = await j('GET', '/me', {});
  check('GET /me without token → 401', r.status === 401);

  let dlAuth = await j('POST', `/wallpapers/${firstSlug}/download`, { token, body: { resolution: '1920x1080' } });
  check('POST /wallpapers/:slug/download (auth)', dlAuth.status === 200 && typeof dlAuth.data?.data?.downloadCount === 'number', `count=${dlAuth.data?.data?.downloadCount}`);

  // pick a wallpaper id to favorite
  let listed = await j('GET', '/wallpapers?limit=1');
  const wpId = listed.data?.data?.wallpapers?.[0]?.id;

  let add1 = await j('POST', `/me/favorites/${wpId}`, { token });
  check('POST /me/favorites/:id (add)', add1.status === 200 && add1.data?.data?.isFavorite === true, `favCount=${add1.data?.data?.favoritesCount}`);
  const favCountAfterAdd = add1.data?.data?.favoritesCount;

  let add2 = await j('POST', `/me/favorites/${wpId}`, { token });
  check('  → re-add is idempotent (no double count)', add2.data?.data?.favoritesCount === favCountAfterAdd, `still ${add2.data?.data?.favoritesCount}`);
  check('  → message says already', add2.data?.message?.toLowerCase().includes('already'));

  let favs = await j('GET', '/me/favorites', { token });
  check('GET /me/favorites', favs.status === 200 && favs.data?.data?.count === 1 && favs.data?.data?.wallpapers?.[0]?.isFavorite === true);

  let rm = await j('DELETE', `/me/favorites/${wpId}`, { token });
  check('DELETE /me/favorites/:id (remove)', rm.status === 200 && rm.data?.data?.isFavorite === false, `favCount=${rm.data?.data?.favoritesCount}`);

  let rm2 = await j('DELETE', `/me/favorites/${wpId}`, { token });
  check('  → re-remove idempotent', rm2.status === 200 && rm2.data?.message?.toLowerCase().includes('not in favorites'));

  let badFav = await j('POST', `/me/favorites/not-a-uuid`, { token });
  check('POST /me/favorites/:badid → 400', badFav.status === 400);

  // ── Profile update ──
  let pm = await j('PATCH', '/me', { token, body: { name: 'Smoke Tester', bio: 'hi' } });
  check('PATCH /me', pm.status === 200 && pm.data?.data?.user?.firstName === 'Smoke' && pm.data?.data?.user?.lastName === 'Tester' && pm.data?.data?.user?.bio === 'hi');

  // ── Change password (re-issues token, invalidates old) ──
  let cp = await j('POST', '/auth/change-password', { token, body: { currentPassword: 'password123', newPassword: 'newpass456', confirmNewPassword: 'newpass456' } });
  check('POST /auth/change-password', cp.status === 200 && !!cp.data?.data?.token);
  let oldTokenMe = await j('GET', '/me', { token });
  check('  → old token rejected (sessionsValidFrom)', oldTokenMe.status === 401);
  let newLogin = await j('POST', '/auth/login', { body: { email: uniqEmail, password: 'newpass456' } });
  check('  → login with NEW password works', newLogin.status === 200);

  // ── Contact ──
  r = await j('POST', '/contact', { body: { name: 'Smoke', email: 'smoke@e.com', reason: 'support', message: 'Hello there from smoke test' } });
  check('POST /contact', r.status === 201 && !!r.data?.data?.id && r.data?.data?.status === 'new');
  const smokeContactId = r.data?.data?.id;

  // ── Duplicate signup guard ──
  r = await j('POST', '/auth/signup', { body: { firstName: 'Dup', email: uniqEmail, password: 'password123', confirmPassword: 'password123' } });
  check('POST /auth/signup duplicate → 409', r.status === 409);

  // ═══════════════════════ ADMIN / CMS ═══════════════════════
  const adminLogin = await j('POST', '/auth/login', { body: { email: 'admin@halalwalls.com', password: 'Admin@12345' } });
  check('ADMIN login (role=admin)', adminLogin.status === 200 && adminLogin.data?.data?.user?.role === 'admin');
  const adminTok = adminLogin.data?.data?.token;
  const adminId = adminLogin.data?.data?.user?.id;
  const userTok = newLogin.data?.data?.token; // valid normal-user token (post change-password)

  // Analytics overview + guards
  r = await j('GET', '/admin/overview', { token: adminTok });
  check('GET /admin/overview', r.status === 200 && typeof r.data?.data?.users?.total === 'number', `users=${r.data?.data?.users?.total} wp=${r.data?.data?.wallpapers?.total} cats=${r.data?.data?.categories?.total}`);
  check('  → 401 without token', (await j('GET', '/admin/overview')).status === 401);
  check('  → 403 for a normal user', (await j('GET', '/admin/overview', { token: userTok })).status === 403);

  // Wallpaper management + moderation lifecycle (self-cleaning)
  const wc = await j('POST', '/admin/wallpapers', { token: adminTok, body: { title: `SMK WP ${Date.now()}`, image: 'https://cdn.test/smk.jpg', categorySlug: 'space', tags: ['smoke'] } });
  check('POST /admin/wallpapers (status active, uploader set)', wc.status === 201 && wc.data?.data?.wallpaper?.status === 'active' && !!wc.data?.data?.wallpaper?.uploadedById);
  const wid = wc.data?.data?.wallpaper?.id;
  check('GET /admin/wallpapers (all statuses)', (await j('GET', '/admin/wallpapers?limit=3', { token: adminTok })).status === 200);
  check('GET /admin/wallpapers/:id', (await j('GET', `/admin/wallpapers/${wid}`, { token: adminTok })).status === 200);
  check('PATCH /admin/wallpapers/:id → pending', (await j('PATCH', `/admin/wallpapers/${wid}`, { token: adminTok, body: { status: 'pending' } })).data?.data?.wallpaper?.status === 'pending');
  const pend = await j('GET', '/admin/wallpapers/pending', { token: adminTok });
  check('GET /admin/wallpapers/pending includes it', pend.status === 200 && pend.data?.data?.wallpapers?.some((w) => w.id === wid));
  check('PATCH /approve → active', (await j('PATCH', `/admin/wallpapers/${wid}/approve`, { token: adminTok })).data?.data?.wallpaper?.status === 'active');
  check('PATCH /reject → hidden', (await j('PATCH', `/admin/wallpapers/${wid}/reject`, { token: adminTok })).data?.data?.wallpaper?.status === 'hidden');
  check('DELETE /admin/wallpapers/:id (cleanup)', (await j('DELETE', `/admin/wallpapers/${wid}`, { token: adminTok })).status === 200);

  // User management
  check('GET /admin/users', (await j('GET', '/admin/users?limit=3', { token: adminTok })).status === 200);
  const ulist = await j('GET', `/admin/users?q=${encodeURIComponent(uniqEmail)}`, { token: adminTok });
  const smokeUserId = ulist.data?.data?.users?.[0]?.id;
  check('GET /admin/users?q= finds smoke user', !!smokeUserId);
  const up = await j('PATCH', `/admin/users/${smokeUserId}`, { token: adminTok, body: { firstName: 'AdmRenamed', isPremium: true, role: 'admin' } });
  check('PATCH /admin/users/:id (account only; premium+role ignored)', up.status === 200 && up.data?.data?.user?.firstName === 'AdmRenamed' && up.data?.data?.user?.isPremium === false && up.data?.data?.user?.role === 'user');
  check('DELETE own admin account → 400 (self guard)', (await j('DELETE', `/admin/users/${adminId}`, { token: adminTok })).status === 400);
  check('DELETE smoke user (cleanup)', (await j('DELETE', `/admin/users/${smokeUserId}`, { token: adminTok })).status === 200);

  // Favorites analytics
  check('GET /admin/favorites', (await j('GET', '/admin/favorites', { token: adminTok })).status === 200);

  // Contacts admin (resolve + delete the smoke contact)
  if (smokeContactId) {
    check('PATCH /admin/contacts/:id → resolved', (await j('PATCH', `/admin/contacts/${smokeContactId}`, { token: adminTok, body: { status: 'resolved' } })).data?.data?.contact?.status === 'resolved');
    check('DELETE /admin/contacts/:id (cleanup)', (await j('DELETE', `/admin/contacts/${smokeContactId}`, { token: adminTok })).status === 200);
  }

  // Categories CRUD (self-cleaning)
  const cslug = `smk-cat-${Date.now()}`;
  check('POST /categories (admin)', (await j('POST', '/categories', { token: adminTok, body: { name: `SMK Cat ${Date.now()}`, slug: cslug } })).status === 201);
  check('PATCH /categories/:slug', (await j('PATCH', `/categories/${cslug}`, { token: adminTok, body: { order: 5 } })).status === 200);
  check('DELETE /categories/:slug (cleanup)', (await j('DELETE', `/categories/${cslug}`, { token: adminTok })).status === 200);

  console.log('\n' + results.join('\n'));
  console.log(`\n${'─'.repeat(50)}\n  RESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('SMOKE CRASH:', e); process.exit(2); });
