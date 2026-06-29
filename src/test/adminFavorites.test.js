const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();
const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('Admin — Favorites analytics (read-only)', () => {
  let adminTok;
  let userTok;

  beforeEach(async () => {
    await testDb.clear();
    adminTok = (await testDb.authUser('admin')).token;
    userTok = (await testDb.authUser('user')).token;
  });

  const favorite = (userId, wallpaperId) => testDb.prisma().favorite.create({ data: { userId, wallpaperId } });

  it('401 guest / 403 user', async () => {
    expect(await chai.request(app()).get('/api/v1/admin/favorites')).to.have.status(401);
    expect(await chai.request(app()).get('/api/v1/admin/favorites').set(auth(userTok))).to.have.status(403);
  });

  it('ranks wallpapers by favorite count (desc), excludes zero-favorite ones', async () => {
    const [u1, u2, u3] = await Promise.all([testDb.createUser(), testDb.createUser(), testDb.createUser()]);
    const w1 = await testDb.createWallpaper({ title: 'Most Loved' });
    const w2 = await testDb.createWallpaper({ title: 'Liked' });
    await testDb.createWallpaper({ title: 'Nobody' }); // 0 favorites

    await favorite(u1.id, w1.id);
    await favorite(u2.id, w1.id);
    await favorite(u3.id, w1.id); // w1 = 3
    await favorite(u1.id, w2.id); // w2 = 1

    const res = await chai.request(app()).get('/api/v1/admin/favorites').set(auth(adminTok));
    expect(res).to.have.status(200);
    expect(res.body.data.pagination.total).to.equal(2); // only w1 + w2 have favorites
    expect(res.body.data.wallpapers[0]).to.include({ id: w1.id, favorites: 3, title: 'Most Loved' });
    expect(res.body.data.wallpapers[1]).to.include({ id: w2.id, favorites: 1 });
  });

  it('paginates the ranking', async () => {
    const [u1, u2] = await Promise.all([testDb.createUser(), testDb.createUser()]);
    const w1 = await testDb.createWallpaper();
    const w2 = await testDb.createWallpaper();
    await favorite(u1.id, w1.id);
    await favorite(u2.id, w1.id);
    await favorite(u1.id, w2.id);

    const res = await chai.request(app()).get('/api/v1/admin/favorites?limit=1').set(auth(adminTok));
    expect(res.body.data.wallpapers).to.have.lengthOf(1);
    expect(res.body.data.wallpapers[0].id).to.equal(w1.id); // most-favorited first
    expect(res.body.data.pagination.total).to.equal(2);
  });

  it('returns an empty ranking when there are no favorites', async () => {
    const res = await chai.request(app()).get('/api/v1/admin/favorites').set(auth(adminTok));
    expect(res).to.have.status(200);
    expect(res.body.data.wallpapers).to.have.lengthOf(0);
    expect(res.body.data.pagination.total).to.equal(0);
  });
});
