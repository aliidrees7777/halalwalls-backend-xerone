const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const UNKNOWN_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('Admin — Moderation queue', () => {
  let adminTok;
  let userTok;

  beforeEach(async () => {
    await testDb.clear();
    adminTok = (await testDb.authUser('admin')).token;
    userTok = (await testDb.authUser('user')).token;
  });

  describe('GET /admin/wallpapers/pending', () => {
    it('lists ONLY pending submissions (oldest first)', async () => {
      await testDb.createWallpaper({ status: 'active' });
      await testDb.createWallpaper({ status: 'pending' });
      await testDb.createWallpaper({ status: 'pending' });
      await testDb.createWallpaper({ status: 'hidden' });

      const res = await chai.request(app()).get('/api/v1/admin/wallpapers/pending').set(auth(adminTok));
      expect(res).to.have.status(200);
      expect(res.body.data.pagination.total).to.equal(2);
      expect(res.body.data.wallpapers.every((w) => w.status === 'pending')).to.equal(true);
    });

    it('403 for a user / 401 guest', async () => {
      expect(await chai.request(app()).get('/api/v1/admin/wallpapers/pending').set(auth(userTok))).to.have.status(403);
      expect(await chai.request(app()).get('/api/v1/admin/wallpapers/pending')).to.have.status(401);
    });

    it('does not collide with GET /wallpapers/:id (route ordering)', async () => {
      // "pending" must hit the queue, not be treated as an :id (which would 400).
      const res = await chai.request(app()).get('/api/v1/admin/wallpapers/pending').set(auth(adminTok));
      expect(res).to.have.status(200);
      expect(res.body.data).to.have.property('wallpapers');
    });
  });

  describe('PATCH /admin/wallpapers/:id/approve', () => {
    it('moves pending → active', async () => {
      const w = await testDb.createWallpaper({ status: 'pending' });
      const res = await chai.request(app()).patch(`/api/v1/admin/wallpapers/${w.id}/approve`).set(auth(adminTok));
      expect(res).to.have.status(200);
      expect(res.body.data.wallpaper.status).to.equal('active');
    });

    it('400 bad id / 404 unknown / 403 user', async () => {
      expect(await chai.request(app()).patch('/api/v1/admin/wallpapers/not-a-uuid/approve').set(auth(adminTok))).to.have.status(400);
      expect(await chai.request(app()).patch(`/api/v1/admin/wallpapers/${UNKNOWN_ID}/approve`).set(auth(adminTok))).to.have.status(404);
      const w = await testDb.createWallpaper({ status: 'pending' });
      expect(await chai.request(app()).patch(`/api/v1/admin/wallpapers/${w.id}/approve`).set(auth(userTok))).to.have.status(403);
    });
  });

  describe('PATCH /admin/wallpapers/:id/reject', () => {
    it('moves pending → hidden', async () => {
      const w = await testDb.createWallpaper({ status: 'pending' });
      const res = await chai.request(app()).patch(`/api/v1/admin/wallpapers/${w.id}/reject`).set(auth(adminTok));
      expect(res).to.have.status(200);
      expect(res.body.data.wallpaper.status).to.equal('hidden');
    });

    it('404 unknown / 403 user', async () => {
      expect(await chai.request(app()).patch(`/api/v1/admin/wallpapers/${UNKNOWN_ID}/reject`).set(auth(adminTok))).to.have.status(404);
      const w = await testDb.createWallpaper({ status: 'pending' });
      expect(await chai.request(app()).patch(`/api/v1/admin/wallpapers/${w.id}/reject`).set(auth(userTok))).to.have.status(403);
    });
  });
});
