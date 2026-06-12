const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');
const Wallpaper = require('../models/wallpaper.schema');
const User = require('../models/user.schema');
const { signAccessToken } = require('../helpers/jwt.helper');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();

async function userToken() {
  const u = await User.create({ firstName: 'Dl', email: 'dl@example.com', role: 'user', authProvider: 'local' });
  return signAccessToken(u);
}

// Insert a small, deterministic catalog for the tests.
async function seedCatalog() {
  const now = Date.now();
  const rows = [
    { title: 'Anime One', categorySlug: 'anime', category: 'Anime', tags: ['anime'], downloadCount: 500, isLive: false },
    { title: 'Anime Two', categorySlug: 'anime', category: 'Anime', tags: ['anime', 'warrior'], downloadCount: 900, isLive: false },
    { title: 'Gaming One', categorySlug: 'gaming', category: 'Gaming', tags: ['gaming'], downloadCount: 100, isLive: false },
    { title: 'Live Space', categorySlug: 'space', category: 'Space', tags: ['space'], downloadCount: 300, isLive: true },
    { title: 'Hidden Draft', categorySlug: 'cars', category: 'Cars', tags: ['cars'], downloadCount: 999, status: 'pending' },
  ];
  await Wallpaper.insertMany(
    rows.map((r, i) => ({
      title: r.title,
      slug: r.title.toLowerCase().replace(/\s+/g, '-'),
      category: r.category,
      categorySlug: r.categorySlug,
      tags: r.tags,
      image: `https://example.com/${i}.jpg`,
      resolution: '1920x1080',
      preferredResolution: '1920x1080',
      width: 1920,
      height: 1080,
      sizeMB: 1.42,
      downloadCount: r.downloadCount,
      views: 0,
      isLive: !!r.isLive,
      status: r.status || 'active',
      createdAt: new Date(now - i * 1000),
    }))
  );
}

describe('Wallpapers catalog', () => {
  beforeEach(async () => {
    await testDb.clear();
    await seedCatalog();
  });

  it('GET /wallpapers — returns active wallpapers + pagination (excludes non-active)', async () => {
    const res = await chai.request(app()).get('/api/v1/wallpapers');
    expect(res).to.have.status(200);
    expect(res.body.status).to.equal('success');
    expect(res.body.data.wallpapers).to.be.an('array').with.length(4); // pending excluded
    expect(res.body.data.pagination).to.include.keys(['total', 'page', 'limit', 'totalPages']);
    expect(res.body.data.pagination.total).to.equal(4);
  });

  it('filters by category', async () => {
    const res = await chai.request(app()).get('/api/v1/wallpapers?category=anime');
    expect(res).to.have.status(200);
    expect(res.body.data.wallpapers).to.have.length(2);
    expect(res.body.data.wallpapers.every((w) => w.category === 'anime')).to.equal(true);
  });

  it('search (q) matches title/tags', async () => {
    const res = await chai.request(app()).get('/api/v1/wallpapers?q=warrior');
    expect(res).to.have.status(200);
    expect(res.body.data.wallpapers).to.have.length(1);
    expect(res.body.data.wallpapers[0].title).to.equal('Anime Two');
  });

  it('popular sort orders by downloadCount desc', async () => {
    const res = await chai.request(app()).get('/api/v1/wallpapers?sort=popular');
    expect(res).to.have.status(200);
    const counts = res.body.data.wallpapers.map((w) => w.downloadCount);
    expect(counts).to.deep.equal([...counts].sort((a, b) => b - a));
  });

  it('live filter returns only live wallpapers', async () => {
    const res = await chai.request(app()).get('/api/v1/wallpapers?filter=live');
    expect(res).to.have.status(200);
    expect(res.body.data.wallpapers).to.have.length(1);
    expect(res.body.data.wallpapers[0].isLive).to.equal(true);
  });

  it('pagination: limit + page', async () => {
    const res = await chai.request(app()).get('/api/v1/wallpapers?limit=2&page=1');
    expect(res).to.have.status(200);
    expect(res.body.data.wallpapers).to.have.length(2);
    expect(res.body.data.pagination.totalPages).to.equal(2);
    expect(res.body.data.pagination.hasNextPage).to.equal(true);
  });

  it('GET /wallpapers/:slug — detail shape + view increment', async () => {
    const res = await chai.request(app()).get('/api/v1/wallpapers/anime-two');
    expect(res).to.have.status(200);
    const w = res.body.data.wallpaper;
    expect(w).to.include.keys(['tags', 'tagSlugs', 'categoryLabel', 'publishedAt', 'originalResolution', 'preferredResolution']);
    expect(w.views).to.equal(1);
    expect(res.body.data.downloadResolutions.desktop).to.be.an('array');
  });

  it('GET /wallpapers/:slug — 404 for unknown', async () => {
    const res = await chai.request(app()).get('/api/v1/wallpapers/does-not-exist');
    expect(res).to.have.status(404);
    expect(res.body.status).to.equal('error');
  });

  it('GET /wallpapers/:slug/related — returns array (same category first)', async () => {
    const res = await chai.request(app()).get('/api/v1/wallpapers/anime-one/related');
    expect(res).to.have.status(200);
    expect(res.body.data.wallpapers).to.be.an('array');
    expect(res.body.data.wallpapers.find((w) => w.slug === 'anime-one')).to.equal(undefined);
  });

  it('POST /wallpapers/:slug/download — requires sign-in (401 for guests)', async () => {
    const res = await chai
      .request(app())
      .post('/api/v1/wallpapers/gaming-one/download')
      .send({ resolution: '1920x1080' });
    expect(res).to.have.status(401);
  });

  it('POST /wallpapers/:slug/download — increments downloadCount when signed in', async () => {
    const token = await userToken();
    const res = await chai
      .request(app())
      .post('/api/v1/wallpapers/gaming-one/download')
      .set('Authorization', `Bearer ${token}`)
      .send({ resolution: '1920x1080' });
    expect(res).to.have.status(200);
    expect(res.body.data.downloadCount).to.equal(101);
    expect(res.body.data).to.have.property('url');
  });
});
