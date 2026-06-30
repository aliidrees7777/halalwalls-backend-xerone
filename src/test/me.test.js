const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();
const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('User account — DELETE /me (self-delete)', () => {
  let userTok;
  let user;

  beforeEach(async () => {
    await testDb.clear();
    const u = await testDb.authUser('user');
    userTok = u.token;
    user = u.user;
  });

  it('401 for a guest (no token)', async () => {
    expect(await chai.request(app()).delete('/api/v1/me')).to.have.status(401);
  });

  it('deletes the account; favorites cascade; uploaded wallpapers are kept (uploader nulled)', async () => {
    const ownWp = await testDb.createWallpaper({ uploadedById: user.id });
    const favWp = await testDb.createWallpaper();
    await testDb.prisma().favorite.create({ data: { userId: user.id, wallpaperId: favWp.id } });

    const res = await chai.request(app()).delete('/api/v1/me').set(auth(userTok));
    expect(res).to.have.status(200);
    expect(res.body.data.id).to.equal(user.id);

    // The user row is gone.
    expect(await testDb.prisma().user.findUnique({ where: { id: user.id } })).to.equal(null);
    // Favorites cascade-deleted.
    expect(await testDb.prisma().favorite.count({ where: { userId: user.id } })).to.equal(0);
    // Uploaded wallpaper is preserved, but no longer attributed to the user.
    const keptOwn = await testDb.prisma().wallpaper.findUnique({ where: { id: ownWp.id } });
    expect(keptOwn).to.not.equal(null);
    expect(keptOwn.uploadedById).to.equal(null);
    // The favorited wallpaper itself is untouched.
    expect(await testDb.prisma().wallpaper.findUnique({ where: { id: favWp.id } })).to.not.equal(null);
  });

  it('invalidates the token after deletion (the user no longer exists)', async () => {
    await chai.request(app()).delete('/api/v1/me').set(auth(userTok));
    // authorize() reloads the user from the DB; a deleted user → 401.
    expect(await chai.request(app()).get('/api/v1/me').set(auth(userTok))).to.have.status(401);
  });

  it('blocks deleting the last admin, but allows it once another admin exists', async () => {
    const admin = await testDb.authUser('admin');
    // Only one admin → blocked.
    expect(await chai.request(app()).delete('/api/v1/me').set(auth(admin.token))).to.have.status(400);
    // A second admin exists → now deletable.
    await testDb.authUser('admin');
    expect(await chai.request(app()).delete('/api/v1/me').set(auth(admin.token))).to.have.status(200);
  });
});
