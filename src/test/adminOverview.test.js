const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();

describe('Admin — GET /admin/overview', () => {
  beforeEach(async () => {
    await testDb.clear();
  });

  it('401 without a token', async () => {
    const res = await chai.request(app()).get('/api/v1/admin/overview');
    expect(res).to.have.status(401);
  });

  it('403 for a normal user', async () => {
    const { token } = await testDb.authUser('user');
    const res = await chai.request(app()).get('/api/v1/admin/overview').set('Authorization', `Bearer ${token}`);
    expect(res).to.have.status(403);
  });

  it('200 for an admin with the correct envelope shape', async () => {
    const { token } = await testDb.authUser('admin');
    const res = await chai.request(app()).get('/api/v1/admin/overview').set('Authorization', `Bearer ${token}`);
    expect(res).to.have.status(200);
    const d = res.body.data;
    expect(d).to.have.all.keys('users', 'wallpapers', 'categories', 'contacts', 'engagement');
    expect(d.users).to.include.all.keys('total', 'admins', 'regular', 'premium', 'verified', 'unverified');
    expect(d.wallpapers).to.include.all.keys('total', 'active', 'pending', 'hidden', 'live', 'premium');
    expect(d.contacts).to.include.all.keys('total', 'new', 'read', 'resolved');
    expect(d.engagement).to.include.all.keys('totalDownloads', 'totalViews', 'totalFavorites');
  });

  it('counts reflect the actual data', async () => {
    const { token, user: admin } = await testDb.authUser('admin'); // 1 admin
    const u1 = await testDb.createUser({ role: 'user', isPremium: true, emailVerified: true });
    await testDb.createUser({ role: 'user', emailVerified: false }); // unverified

    await testDb.createCategory();
    await testDb.createCategory();

    await testDb.createWallpaper({ status: 'active', downloadCount: 10, views: 100, isLive: true });
    await testDb.createWallpaper({ status: 'active', downloadCount: 5, views: 50, isPremium: true });
    await testDb.createWallpaper({ status: 'pending' });
    await testDb.createWallpaper({ status: 'hidden' });

    await testDb.createContact({ status: 'new' });
    await testDb.createContact({ status: 'resolved' });

    // a favorite for u1
    const wp = await testDb.createWallpaper({ status: 'active' });
    await testDb.prisma().favorite.create({ data: { userId: u1.id, wallpaperId: wp.id } });

    const res = await chai.request(app()).get('/api/v1/admin/overview').set('Authorization', `Bearer ${token}`);
    expect(res).to.have.status(200);
    const d = res.body.data;

    expect(d.users.total).to.equal(3); // admin + u1 + unverified
    expect(d.users.admins).to.equal(1);
    expect(d.users.regular).to.equal(2);
    expect(d.users.premium).to.equal(1);
    expect(d.users.verified).to.equal(2); // admin + u1 (factory verifies by default)
    expect(d.users.unverified).to.equal(1);

    expect(d.wallpapers.total).to.equal(5); // 2 active + pending + hidden + 1 active(fav)
    expect(d.wallpapers.active).to.equal(3);
    expect(d.wallpapers.pending).to.equal(1);
    expect(d.wallpapers.hidden).to.equal(1);
    expect(d.wallpapers.live).to.equal(1);
    expect(d.wallpapers.premium).to.equal(1);

    expect(d.categories.total).to.equal(2);

    expect(d.contacts.total).to.equal(2);
    expect(d.contacts.new).to.equal(1);
    expect(d.contacts.resolved).to.equal(1);

    expect(d.engagement.totalDownloads).to.equal(15);
    expect(d.engagement.totalViews).to.equal(150);
    expect(d.engagement.totalFavorites).to.equal(1);
  });
});
