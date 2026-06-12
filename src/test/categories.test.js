const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');
const Category = require('../models/category.schema');
const Wallpaper = require('../models/wallpaper.schema');
const User = require('../models/user.schema');
const { signAccessToken } = require('../helpers/jwt.helper');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();

async function adminToken() {
  const admin = await User.create({ firstName: 'Site', lastName: 'Admin', email: 'admin@halalwalls.com', role: 'admin', authProvider: 'local' });
  return signAccessToken(admin);
}
async function userToken() {
  const u = await User.create({ firstName: 'Reg', email: 'user@example.com', role: 'user', authProvider: 'local' });
  return signAccessToken(u);
}

describe('Categories', () => {
  beforeEach(async () => {
    await testDb.clear();
    await Category.insertMany([
      { name: 'Anime', slug: 'anime', order: 2 },
      { name: 'Cars', slug: 'cars', order: 7 },
    ]);
    await Wallpaper.insertMany([
      { title: 'A1', slug: 'a1', categorySlug: 'anime', image: 'x', status: 'active' },
      { title: 'A2', slug: 'a2', categorySlug: 'anime', image: 'x', status: 'active' },
      { title: 'A3', slug: 'a3', categorySlug: 'anime', image: 'x', status: 'pending' }, // excluded from count
      { title: 'C1', slug: 'c1', categorySlug: 'cars', image: 'x', status: 'active' },
    ]);
  });

  it('GET /categories returns categories with live counts (active only)', async () => {
    const res = await chai.request(app()).get('/api/v1/categories');
    expect(res).to.have.status(200);
    const cats = res.body.data.categories;
    expect(cats).to.have.length(2);
    const anime = cats.find((c) => c.slug === 'anime');
    expect(anime.count).to.equal(2); // pending excluded
    expect(cats.find((c) => c.slug === 'cars').count).to.equal(1);
  });

  it('GET /categories/:slug returns one category', async () => {
    const res = await chai.request(app()).get('/api/v1/categories/anime');
    expect(res).to.have.status(200);
    expect(res.body.data.category.slug).to.equal('anime');
    expect(res.body.data.category.count).to.equal(2);
  });

  it('GET /categories/:slug 404 for unknown', async () => {
    const res = await chai.request(app()).get('/api/v1/categories/nope');
    expect(res).to.have.status(404);
  });

  it('POST /categories requires admin (401 without token, 403 for user)', async () => {
    const noAuth = await chai.request(app()).post('/api/v1/categories').send({ name: 'Nature' });
    expect(noAuth).to.have.status(401);

    const ut = await userToken();
    const asUser = await chai.request(app()).post('/api/v1/categories').set('Authorization', `Bearer ${ut}`).send({ name: 'Nature' });
    expect(asUser).to.have.status(403);
  });

  it('POST /categories (admin) creates a category with derived slug', async () => {
    const at = await adminToken();
    const res = await chai
      .request(app())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${at}`)
      .send({ name: 'Nature Scenes', order: 10 });
    expect(res).to.have.status(201);
    expect(res.body.data.category.slug).to.equal('nature-scenes');
    expect(res.body.data.category.count).to.equal(0);

    const dup = await chai.request(app()).post('/api/v1/categories').set('Authorization', `Bearer ${at}`).send({ name: 'Nature Scenes' });
    expect(dup).to.have.status(409);
  });

  it('PATCH and DELETE (admin)', async () => {
    const at = await adminToken();
    const patched = await chai.request(app()).patch('/api/v1/categories/cars').set('Authorization', `Bearer ${at}`).send({ description: 'Fast cars', isPremium: true });
    expect(patched).to.have.status(200);
    expect(patched.body.data.category.description).to.equal('Fast cars');
    expect(patched.body.data.category.isPremium).to.equal(true);

    const del = await chai.request(app()).delete('/api/v1/categories/cars').set('Authorization', `Bearer ${at}`);
    expect(del).to.have.status(200);
    expect(del.body.data.slug).to.equal('cars');
  });
});

describe('Resolutions', () => {
  it('GET /resolutions returns the fixed desktop/mobile set', async () => {
    const res = await chai.request(app()).get('/api/v1/resolutions');
    expect(res).to.have.status(200);
    expect(res.body.data.desktop).to.be.an('array').with.length(3);
    expect(res.body.data.mobile).to.include('1080×2400');
  });
});
