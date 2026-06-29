const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();
const auth = (t) => ({ Authorization: `Bearer ${t}` });

// Categories CRUD already existed (admin create/update/delete + public read).
// These tests were lost with the old Mongo suite; restored here for Quarter 3.3.
describe('Categories — public read + admin CRUD', () => {
  let adminTok;
  let userTok;

  beforeEach(async () => {
    await testDb.clear();
    adminTok = (await testDb.authUser('admin')).token;
    userTok = (await testDb.authUser('user')).token;
  });

  describe('Public read', () => {
    it('GET /categories lists with LIVE active-wallpaper counts', async () => {
      await testDb.createCategory({ slug: 'space', name: 'Space', order: 1 });
      await testDb.createWallpaper({ categorySlug: 'space', status: 'active' });
      await testDb.createWallpaper({ categorySlug: 'space', status: 'active' });
      await testDb.createWallpaper({ categorySlug: 'space', status: 'pending' }); // not counted

      const res = await chai.request(app()).get('/api/v1/categories');
      expect(res).to.have.status(200);
      const space = res.body.data.categories.find((c) => c.slug === 'space');
      expect(space.count).to.equal(2); // only active
    });

    it('GET /categories/:slug — 200 then 404', async () => {
      await testDb.createCategory({ slug: 'anime', name: 'Anime' });
      expect(await chai.request(app()).get('/api/v1/categories/anime')).to.have.status(200);
      expect(await chai.request(app()).get('/api/v1/categories/nope')).to.have.status(404);
    });
  });

  describe('POST /categories (admin)', () => {
    it('201 creates, deriving slug from name', async () => {
      const res = await chai.request(app()).post('/api/v1/categories').set(auth(adminTok)).send({ name: 'Nature Scenes', order: 5 });
      expect(res).to.have.status(201);
      expect(res.body.data.category.slug).to.equal('nature-scenes');
    });
    it('400 missing name', async () => {
      expect(await chai.request(app()).post('/api/v1/categories').set(auth(adminTok)).send({})).to.have.status(400);
    });
    it('409 duplicate slug', async () => {
      await testDb.createCategory({ slug: 'gaming', name: 'Gaming' });
      const res = await chai.request(app()).post('/api/v1/categories').set(auth(adminTok)).send({ name: 'Gaming' });
      expect(res).to.have.status(409);
    });
    it('401 guest / 403 user', async () => {
      expect(await chai.request(app()).post('/api/v1/categories').send({ name: 'X' })).to.have.status(401);
      expect(await chai.request(app()).post('/api/v1/categories').set(auth(userTok)).send({ name: 'X' })).to.have.status(403);
    });
  });

  describe('PATCH /categories/:slug (admin)', () => {
    it('200 updates fields', async () => {
      await testDb.createCategory({ slug: 'cars', name: 'Cars' });
      const res = await chai.request(app()).patch('/api/v1/categories/cars').set(auth(adminTok)).send({ description: 'Fast cars', order: 9 });
      expect(res).to.have.status(200);
      expect(res.body.data.category.description).to.equal('Fast cars');
      expect(res.body.data.category.order).to.equal(9);
    });
    it('404 unknown / 403 user', async () => {
      expect(await chai.request(app()).patch('/api/v1/categories/nope').set(auth(adminTok)).send({ order: 1 })).to.have.status(404);
      await testDb.createCategory({ slug: 'sport', name: 'Sport' });
      expect(await chai.request(app()).patch('/api/v1/categories/sport').set(auth(userTok)).send({ order: 1 })).to.have.status(403);
    });
  });

  describe('DELETE /categories/:slug (admin)', () => {
    it('200 deletes and reports orphaned wallpapers', async () => {
      await testDb.createCategory({ slug: 'movies', name: 'Movies' });
      await testDb.createWallpaper({ categorySlug: 'movies' });
      const res = await chai.request(app()).delete('/api/v1/categories/movies').set(auth(adminTok));
      expect(res).to.have.status(200);
      expect(res.body.data.orphanedWallpapers).to.equal(1);
    });
    it('404 unknown / 403 user', async () => {
      expect(await chai.request(app()).delete('/api/v1/categories/nope').set(auth(adminTok))).to.have.status(404);
      await testDb.createCategory({ slug: 'islamic', name: 'Islamic' });
      expect(await chai.request(app()).delete('/api/v1/categories/islamic').set(auth(userTok))).to.have.status(403);
    });
  });
});
