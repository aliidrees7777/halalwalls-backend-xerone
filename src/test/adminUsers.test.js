const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const UNKNOWN_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('Admin — Manage users (read + write)', () => {
  let adminTok;
  let admin;
  let userTok;

  beforeEach(async () => {
    await testDb.clear();
    const a = await testDb.authUser('admin', { email: 'theadmin@test.com' });
    adminTok = a.token;
    admin = a.user;
    userTok = (await testDb.authUser('user')).token;
  });

  describe('GET /admin/users', () => {
    it('401 guest / 403 user', async () => {
      expect(await chai.request(app()).get('/api/v1/admin/users')).to.have.status(401);
      expect(await chai.request(app()).get('/api/v1/admin/users').set(auth(userTok))).to.have.status(403);
    });

    it('lists users with favorites/uploads counts', async () => {
      const res = await chai.request(app()).get('/api/v1/admin/users').set(auth(adminTok));
      expect(res).to.have.status(200);
      expect(res.body.data.pagination.total).to.equal(2); // admin + the user
      const sample = res.body.data.users[0];
      expect(sample).to.include.all.keys('id', 'email', 'role', 'emailVerified', 'isPremium', 'favoritesCount', 'uploadsCount', 'createdAt');
      expect(sample).to.not.have.property('password');
    });

    it('filters by role', async () => {
      const res = await chai.request(app()).get('/api/v1/admin/users?role=admin').set(auth(adminTok));
      expect(res.body.data.users.every((u) => u.role === 'admin')).to.equal(true);
      expect(res.body.data.pagination.total).to.equal(1);
    });

    it('400 invalid role', async () => {
      expect(await chai.request(app()).get('/api/v1/admin/users?role=root').set(auth(adminTok))).to.have.status(400);
    });

    it('searches by q (email)', async () => {
      await testDb.createUser({ email: 'findthisuser@test.com' });
      const res = await chai.request(app()).get('/api/v1/admin/users?q=findthisuser').set(auth(adminTok));
      expect(res.body.data.pagination.total).to.equal(1);
    });

    it('filters by verified', async () => {
      await testDb.createUser({ emailVerified: false });
      const res = await chai.request(app()).get('/api/v1/admin/users?verified=false').set(auth(adminTok));
      expect(res.body.data.users.every((u) => u.emailVerified === false)).to.equal(true);
    });

    it('paginates', async () => {
      for (let i = 0; i < 4; i++) await testDb.createUser();
      const res = await chai.request(app()).get('/api/v1/admin/users?page=1&limit=2').set(auth(adminTok));
      expect(res.body.data.users).to.have.lengthOf(2);
      expect(res.body.data.pagination.total).to.equal(6); // admin + user + 4
    });
  });

  describe('GET /admin/users/:id', () => {
    it('200 with accurate counts', async () => {
      const u = await testDb.createUser();
      const w = await testDb.createWallpaper();
      await testDb.prisma().favorite.create({ data: { userId: u.id, wallpaperId: w.id } });
      await testDb.createWallpaper({ uploadedById: u.id });

      const res = await chai.request(app()).get(`/api/v1/admin/users/${u.id}`).set(auth(adminTok));
      expect(res).to.have.status(200);
      expect(res.body.data.user.favoritesCount).to.equal(1);
      expect(res.body.data.user.uploadsCount).to.equal(1);
    });

    it('400 bad id / 404 unknown / 403 user', async () => {
      expect(await chai.request(app()).get('/api/v1/admin/users/not-a-uuid').set(auth(adminTok))).to.have.status(400);
      expect(await chai.request(app()).get(`/api/v1/admin/users/${UNKNOWN_ID}`).set(auth(adminTok))).to.have.status(404);
      const u = await testDb.createUser();
      expect(await chai.request(app()).get(`/api/v1/admin/users/${u.id}`).set(auth(userTok))).to.have.status(403);
    });
  });

  describe('PATCH /admin/users/:id', () => {
    it('updates account fields', async () => {
      const u = await testDb.createUser({ firstName: 'Old', bio: '' });
      const res = await chai.request(app()).patch(`/api/v1/admin/users/${u.id}`).set(auth(adminTok)).send({ firstName: 'New', bio: 'updated' });
      expect(res).to.have.status(200);
      expect(res.body.data.user.firstName).to.equal('New');
      expect(res.body.data.user.bio).to.equal('updated');
    });

    it('IGNORES premium and role (not editable per doc)', async () => {
      const u = await testDb.createUser({ role: 'user', isPremium: false });
      const res = await chai.request(app()).patch(`/api/v1/admin/users/${u.id}`).set(auth(adminTok)).send({ firstName: 'X', isPremium: true, role: 'admin' });
      expect(res).to.have.status(200);
      expect(res.body.data.user.isPremium).to.equal(false);
      expect(res.body.data.user.role).to.equal('user');
    });

    it('400 empty firstName / 400 no valid fields', async () => {
      const u = await testDb.createUser();
      expect(await chai.request(app()).patch(`/api/v1/admin/users/${u.id}`).set(auth(adminTok)).send({ firstName: '   ' })).to.have.status(400);
      expect(await chai.request(app()).patch(`/api/v1/admin/users/${u.id}`).set(auth(adminTok)).send({ isPremium: true })).to.have.status(400);
    });

    it('404 unknown / 403 user', async () => {
      expect(await chai.request(app()).patch(`/api/v1/admin/users/${UNKNOWN_ID}`).set(auth(adminTok)).send({ firstName: 'x' })).to.have.status(404);
      const u = await testDb.createUser();
      expect(await chai.request(app()).patch(`/api/v1/admin/users/${u.id}`).set(auth(userTok)).send({ firstName: 'x' })).to.have.status(403);
    });
  });

  describe('DELETE /admin/users/:id', () => {
    it('deletes a user; favorites cascade; uploaded wallpapers kept (uploader nulled)', async () => {
      const u = await testDb.createUser();
      const w = await testDb.createWallpaper();
      await testDb.prisma().favorite.create({ data: { userId: u.id, wallpaperId: w.id } });
      const uploaded = await testDb.createWallpaper({ uploadedById: u.id });

      const res = await chai.request(app()).delete(`/api/v1/admin/users/${u.id}`).set(auth(adminTok));
      expect(res).to.have.status(200);
      expect(await testDb.prisma().favorite.count()).to.equal(0); // cascaded
      const stillThere = await testDb.prisma().wallpaper.findUnique({ where: { id: uploaded.id } });
      expect(stillThere).to.not.equal(null);
      expect(stillThere.uploadedById).to.equal(null); // set null, content preserved
    });

    it('400 when admin tries to delete their own account', async () => {
      const res = await chai.request(app()).delete(`/api/v1/admin/users/${admin.id}`).set(auth(adminTok));
      expect(res).to.have.status(400);
    });

    it('allows deleting another admin when more than one exists', async () => {
      const other = await testDb.createUser({ role: 'admin', email: 'second-admin@test.com' });
      const res = await chai.request(app()).delete(`/api/v1/admin/users/${other.id}`).set(auth(adminTok));
      expect(res).to.have.status(200);
    });

    it('404 unknown / 403 user', async () => {
      expect(await chai.request(app()).delete(`/api/v1/admin/users/${UNKNOWN_ID}`).set(auth(adminTok))).to.have.status(404);
      const u = await testDb.createUser();
      expect(await chai.request(app()).delete(`/api/v1/admin/users/${u.id}`).set(auth(userTok))).to.have.status(403);
    });
  });
});
