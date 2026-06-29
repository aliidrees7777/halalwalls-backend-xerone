const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();

// Proves the Phase 1.1 loop end-to-end: embedded Postgres → Prisma → Express
// app → auth/RBAC. If this passes, the build→test→swagger loop is sound.
describe('Test harness (local Postgres)', () => {
  beforeEach(async () => {
    await testDb.clear();
  });

  it('health endpoint responds', async () => {
    const res = await chai.request(app()).get('/health');
    expect(res).to.have.status(200);
    expect(res.body.status).to.equal('success');
  });

  it('Prisma talks to the local DB (empty catalog)', async () => {
    const res = await chai.request(app()).get('/api/v1/wallpapers');
    expect(res).to.have.status(200);
    expect(res.body.data.pagination.total).to.equal(0);
  });

  it('created data flows through the API', async () => {
    await testDb.createWallpaper({ title: 'Harness One', status: 'active' });
    await testDb.createWallpaper({ title: 'Harness Two', status: 'active' });
    const res = await chai.request(app()).get('/api/v1/wallpapers');
    expect(res).to.have.status(200);
    expect(res.body.data.pagination.total).to.equal(2);
  });

  it('admin reaches an admin-guarded route; user gets 403; guest 401', async () => {
    const { token: adminTok } = await testDb.authUser('admin');
    const { token: userTok } = await testDb.authUser('user');

    const ok = await chai
      .request(app())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: 'Harness Cat' });
    expect(ok).to.have.status(201);

    const forbidden = await chai
      .request(app())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${userTok}`)
      .send({ name: 'Nope' });
    expect(forbidden).to.have.status(403);

    const guest = await chai.request(app()).post('/api/v1/categories').send({ name: 'Nope' });
    expect(guest).to.have.status(401);
  });
});
