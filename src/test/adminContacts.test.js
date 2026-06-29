const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('Admin — Manage contacts', () => {
  let adminTok;
  let userTok;

  beforeEach(async () => {
    await testDb.clear();
    adminTok = (await testDb.authUser('admin')).token;
    userTok = (await testDb.authUser('user')).token;
  });

  describe('GET /admin/contacts', () => {
    it('401 guest / 403 user', async () => {
      expect(await chai.request(app()).get('/api/v1/admin/contacts')).to.have.status(401);
      expect(await chai.request(app()).get('/api/v1/admin/contacts').set(auth(userTok))).to.have.status(403);
    });

    it('lists contacts with pagination, newest first', async () => {
      await testDb.createContact({ email: 'a@test.com', status: 'new' });
      await testDb.createContact({ email: 'b@test.com', status: 'read' });
      await testDb.createContact({ email: 'c@test.com', status: 'resolved' });

      const res = await chai.request(app()).get('/api/v1/admin/contacts').set(auth(adminTok));
      expect(res).to.have.status(200);
      expect(res.body.data.contacts).to.have.lengthOf(3);
      expect(res.body.data.pagination.total).to.equal(3);
      expect(res.body.data.contacts[0]).to.include.all.keys('id', 'name', 'email', 'reason', 'message', 'status', 'createdAt');
    });

    it('filters by status', async () => {
      await testDb.createContact({ status: 'new' });
      await testDb.createContact({ status: 'new' });
      await testDb.createContact({ status: 'resolved' });

      const res = await chai.request(app()).get('/api/v1/admin/contacts?status=new').set(auth(adminTok));
      expect(res).to.have.status(200);
      expect(res.body.data.pagination.total).to.equal(2);
      expect(res.body.data.contacts.every((c) => c.status === 'new')).to.equal(true);
    });

    it('400 on an invalid status filter', async () => {
      const res = await chai.request(app()).get('/api/v1/admin/contacts?status=bogus').set(auth(adminTok));
      expect(res).to.have.status(400);
    });

    it('searches by q (email/name/message)', async () => {
      await testDb.createContact({ email: 'findme@test.com', message: 'hello' });
      await testDb.createContact({ email: 'other@test.com', message: 'world' });

      const res = await chai.request(app()).get('/api/v1/admin/contacts?q=findme').set(auth(adminTok));
      expect(res).to.have.status(200);
      expect(res.body.data.pagination.total).to.equal(1);
    });

    it('paginates', async () => {
      for (let i = 0; i < 5; i++) await testDb.createContact();
      const res = await chai.request(app()).get('/api/v1/admin/contacts?page=1&limit=2').set(auth(adminTok));
      expect(res.body.data.contacts).to.have.lengthOf(2);
      expect(res.body.data.pagination).to.include({ total: 5, page: 1, limit: 2, totalPages: 3, hasNextPage: true, hasPrevPage: false });
    });
  });

  describe('PATCH /admin/contacts/:id', () => {
    it('updates status new → resolved', async () => {
      const c = await testDb.createContact({ status: 'new' });
      const res = await chai.request(app()).patch(`/api/v1/admin/contacts/${c.id}`).set(auth(adminTok)).send({ status: 'resolved' });
      expect(res).to.have.status(200);
      expect(res.body.data.contact.status).to.equal('resolved');
    });

    it('400 invalid status', async () => {
      const c = await testDb.createContact();
      const res = await chai.request(app()).patch(`/api/v1/admin/contacts/${c.id}`).set(auth(adminTok)).send({ status: 'nope' });
      expect(res).to.have.status(400);
    });

    it('400 malformed id', async () => {
      const res = await chai.request(app()).patch('/api/v1/admin/contacts/not-a-uuid').set(auth(adminTok)).send({ status: 'read' });
      expect(res).to.have.status(400);
    });

    it('404 unknown id', async () => {
      const res = await chai.request(app()).patch('/api/v1/admin/contacts/7c9e6679-7425-40de-944b-e07fc1f90ae7').set(auth(adminTok)).send({ status: 'read' });
      expect(res).to.have.status(404);
    });

    it('403 for a user', async () => {
      const c = await testDb.createContact();
      const res = await chai.request(app()).patch(`/api/v1/admin/contacts/${c.id}`).set(auth(userTok)).send({ status: 'read' });
      expect(res).to.have.status(403);
    });
  });

  describe('DELETE /admin/contacts/:id', () => {
    it('deletes a contact', async () => {
      const c = await testDb.createContact();
      const res = await chai.request(app()).delete(`/api/v1/admin/contacts/${c.id}`).set(auth(adminTok));
      expect(res).to.have.status(200);
      const remaining = await testDb.prisma().contact.count();
      expect(remaining).to.equal(0);
    });

    it('404 unknown id', async () => {
      const res = await chai.request(app()).delete('/api/v1/admin/contacts/7c9e6679-7425-40de-944b-e07fc1f90ae7').set(auth(adminTok));
      expect(res).to.have.status(404);
    });

    it('403 for a user', async () => {
      const c = await testDb.createContact();
      const res = await chai.request(app()).delete(`/api/v1/admin/contacts/${c.id}`).set(auth(userTok));
      expect(res).to.have.status(403);
    });
  });
});
