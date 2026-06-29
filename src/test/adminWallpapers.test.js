const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const UNKNOWN_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('Admin — Manage wallpapers (read + write)', () => {
  let adminTok;
  let admin;
  let userTok;

  beforeEach(async () => {
    await testDb.clear();
    const a = await testDb.authUser('admin');
    adminTok = a.token;
    admin = a.user;
    userTok = (await testDb.authUser('user')).token;
  });

  describe('GET /admin/wallpapers', () => {
    it('401 guest / 403 user', async () => {
      expect(await chai.request(app()).get('/api/v1/admin/wallpapers')).to.have.status(401);
      expect(await chai.request(app()).get('/api/v1/admin/wallpapers').set(auth(userTok))).to.have.status(403);
    });

    it('lists wallpapers of ALL statuses', async () => {
      await testDb.createWallpaper({ status: 'active' });
      await testDb.createWallpaper({ status: 'pending' });
      await testDb.createWallpaper({ status: 'hidden' });
      const res = await chai.request(app()).get('/api/v1/admin/wallpapers').set(auth(adminTok));
      expect(res).to.have.status(200);
      expect(res.body.data.pagination.total).to.equal(3);
      expect(res.body.data.wallpapers[0]).to.include.all.keys('id', 'title', 'slug', 'status', 'downloadCount', 'favoritesCount', 'createdAt', 'updatedAt');
    });

    it('filters by status', async () => {
      await testDb.createWallpaper({ status: 'active' });
      await testDb.createWallpaper({ status: 'pending' });
      const res = await chai.request(app()).get('/api/v1/admin/wallpapers?status=pending').set(auth(adminTok));
      expect(res.body.data.pagination.total).to.equal(1);
      expect(res.body.data.wallpapers[0].status).to.equal('pending');
    });

    it('400 on invalid status', async () => {
      const res = await chai.request(app()).get('/api/v1/admin/wallpapers?status=bogus').set(auth(adminTok));
      expect(res).to.have.status(400);
    });

    it('searches by q (title)', async () => {
      await testDb.createWallpaper({ title: 'Aurora Borealis' });
      await testDb.createWallpaper({ title: 'Desert Dunes' });
      const res = await chai.request(app()).get('/api/v1/admin/wallpapers?q=aurora').set(auth(adminTok));
      expect(res.body.data.pagination.total).to.equal(1);
    });

    it('filters by isPremium', async () => {
      await testDb.createWallpaper({ isPremium: true });
      await testDb.createWallpaper({ isPremium: false });
      const res = await chai.request(app()).get('/api/v1/admin/wallpapers?isPremium=true').set(auth(adminTok));
      expect(res.body.data.pagination.total).to.equal(1);
    });

    it('sorts by popular (downloadCount desc)', async () => {
      await testDb.createWallpaper({ downloadCount: 5 });
      await testDb.createWallpaper({ downloadCount: 50 });
      const res = await chai.request(app()).get('/api/v1/admin/wallpapers?sort=popular').set(auth(adminTok));
      expect(res.body.data.wallpapers[0].downloadCount).to.equal(50);
    });

    it('paginates', async () => {
      for (let i = 0; i < 5; i++) await testDb.createWallpaper();
      const res = await chai.request(app()).get('/api/v1/admin/wallpapers?page=2&limit=2').set(auth(adminTok));
      expect(res.body.data.wallpapers).to.have.lengthOf(2);
      expect(res.body.data.pagination).to.include({ total: 5, page: 2, limit: 2, totalPages: 3, hasNextPage: true, hasPrevPage: true });
    });
  });

  describe('GET /admin/wallpapers/:id', () => {
    it('200 returns the full record', async () => {
      const w = await testDb.createWallpaper({ title: 'Solo' });
      const res = await chai.request(app()).get(`/api/v1/admin/wallpapers/${w.id}`).set(auth(adminTok));
      expect(res).to.have.status(200);
      expect(res.body.data.wallpaper.title).to.equal('Solo');
    });
    it('400 bad id / 404 unknown / 403 user', async () => {
      expect(await chai.request(app()).get('/api/v1/admin/wallpapers/not-a-uuid').set(auth(adminTok))).to.have.status(400);
      expect(await chai.request(app()).get(`/api/v1/admin/wallpapers/${UNKNOWN_ID}`).set(auth(adminTok))).to.have.status(404);
      const w = await testDb.createWallpaper();
      expect(await chai.request(app()).get(`/api/v1/admin/wallpapers/${w.id}`).set(auth(userTok))).to.have.status(403);
    });
  });

  describe('POST /admin/wallpapers', () => {
    it('201 creates from title + image; defaults status active; records uploader', async () => {
      const res = await chai.request(app()).post('/api/v1/admin/wallpapers').set(auth(adminTok))
        .send({ title: 'Created Wallpaper', image: 'https://cdn.test/x.jpg', categorySlug: 'space', tags: ['a', 'b'] });
      expect(res).to.have.status(201);
      const w = res.body.data.wallpaper;
      expect(w.slug).to.equal('created-wallpaper');
      expect(w.status).to.equal('active');
      expect(w.uploadedById).to.equal(admin.id);
      expect(w.originalUrl).to.equal('https://cdn.test/x.jpg'); // mirrors image when omitted
    });

    it('400 when title or image missing', async () => {
      expect(await chai.request(app()).post('/api/v1/admin/wallpapers').set(auth(adminTok)).send({ image: 'https://cdn/x.jpg' })).to.have.status(400);
      expect(await chai.request(app()).post('/api/v1/admin/wallpapers').set(auth(adminTok)).send({ title: 'No image' })).to.have.status(400);
    });

    it('400 invalid status', async () => {
      const res = await chai.request(app()).post('/api/v1/admin/wallpapers').set(auth(adminTok)).send({ title: 'X', image: 'https://cdn/x.jpg', status: 'bogus' });
      expect(res).to.have.status(400);
    });

    it('auto-uniquifies slug on duplicate titles', async () => {
      const a = await chai.request(app()).post('/api/v1/admin/wallpapers').set(auth(adminTok)).send({ title: 'Same Title', image: 'https://cdn/x.jpg' });
      const b = await chai.request(app()).post('/api/v1/admin/wallpapers').set(auth(adminTok)).send({ title: 'Same Title', image: 'https://cdn/x.jpg' });
      expect(a.body.data.wallpaper.slug).to.equal('same-title');
      expect(b.body.data.wallpaper.slug).to.equal('same-title-2');
    });

    it('403 for a user', async () => {
      const res = await chai.request(app()).post('/api/v1/admin/wallpapers').set(auth(userTok)).send({ title: 'X', image: 'https://cdn/x.jpg' });
      expect(res).to.have.status(403);
    });
  });

  describe('PATCH /admin/wallpapers/:id', () => {
    it('updates editable fields', async () => {
      const w = await testDb.createWallpaper({ title: 'Old', status: 'active', isPremium: false });
      const res = await chai.request(app()).patch(`/api/v1/admin/wallpapers/${w.id}`).set(auth(adminTok))
        .send({ title: 'New Title', status: 'hidden', isPremium: true, tags: ['x'] });
      expect(res).to.have.status(200);
      const u = res.body.data.wallpaper;
      expect(u.title).to.equal('New Title');
      expect(u.status).to.equal('hidden');
      expect(u.isPremium).to.equal(true);
      expect(u.tags).to.deep.equal(['x']);
    });

    it('400 invalid status / 400 bad id / 404 unknown', async () => {
      const w = await testDb.createWallpaper();
      expect(await chai.request(app()).patch(`/api/v1/admin/wallpapers/${w.id}`).set(auth(adminTok)).send({ status: 'bogus' })).to.have.status(400);
      expect(await chai.request(app()).patch('/api/v1/admin/wallpapers/not-a-uuid').set(auth(adminTok)).send({ title: 'x' })).to.have.status(400);
      expect(await chai.request(app()).patch(`/api/v1/admin/wallpapers/${UNKNOWN_ID}`).set(auth(adminTok)).send({ title: 'x' })).to.have.status(404);
    });

    it('409 when changing slug to an existing one', async () => {
      const a = await testDb.createWallpaper({ slug: 'taken-slug' });
      const b = await testDb.createWallpaper({ slug: 'other-slug' });
      const res = await chai.request(app()).patch(`/api/v1/admin/wallpapers/${b.id}`).set(auth(adminTok)).send({ slug: 'taken-slug' });
      expect(res).to.have.status(409);
      // changing to its own slug is fine
      const same = await chai.request(app()).patch(`/api/v1/admin/wallpapers/${a.id}`).set(auth(adminTok)).send({ slug: 'taken-slug' });
      expect(same).to.have.status(200);
    });

    it('403 for a user', async () => {
      const w = await testDb.createWallpaper();
      expect(await chai.request(app()).patch(`/api/v1/admin/wallpapers/${w.id}`).set(auth(userTok)).send({ title: 'x' })).to.have.status(403);
    });
  });

  describe('DELETE /admin/wallpapers/:id', () => {
    it('deletes and cascades favorites', async () => {
      const u = await testDb.createUser();
      const w = await testDb.createWallpaper();
      await testDb.prisma().favorite.create({ data: { userId: u.id, wallpaperId: w.id } });

      const res = await chai.request(app()).delete(`/api/v1/admin/wallpapers/${w.id}`).set(auth(adminTok));
      expect(res).to.have.status(200);
      expect(await testDb.prisma().wallpaper.count()).to.equal(0);
      expect(await testDb.prisma().favorite.count()).to.equal(0); // cascaded
    });

    it('404 unknown / 403 user', async () => {
      expect(await chai.request(app()).delete(`/api/v1/admin/wallpapers/${UNKNOWN_ID}`).set(auth(adminTok))).to.have.status(404);
      const w = await testDb.createWallpaper();
      expect(await chai.request(app()).delete(`/api/v1/admin/wallpapers/${w.id}`).set(auth(userTok))).to.have.status(403);
    });
  });
});
