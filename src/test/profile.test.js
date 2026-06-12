const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');
const Wallpaper = require('../models/wallpaper.schema');
const User = require('../models/user.schema');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();

async function signup(email) {
  const res = await chai
    .request(app())
    .post('/api/v1/auth/signup')
    .send({ firstName: 'Hossein', lastName: 'Rivandi', email, password: 'password123', confirmPassword: 'password123' });
  return { token: res.body.data.token, user: res.body.data.user };
}

describe('Profile (auth)', () => {
  let token;
  let userId;

  beforeEach(async () => {
    await testDb.clear();
    const s = await signup('profile@example.com');
    token = s.token;
    userId = s.user.id;
  });

  it('GET /me requires auth', async () => {
    const res = await chai.request(app()).get('/api/v1/me');
    expect(res).to.have.status(401);
  });

  it('GET /me returns profile + counts', async () => {
    // one favorite + two uploads (one pending)
    const wp = await Wallpaper.create({ title: 'W', slug: 'w', categorySlug: 'anime', image: 'x', status: 'active' });
    await chai.request(app()).post(`/api/v1/me/favorites/${wp._id}`).set('Authorization', `Bearer ${token}`);
    await Wallpaper.create({ title: 'U1', slug: 'u1', categorySlug: 'anime', image: 'x', status: 'active', uploadedBy: userId });
    await Wallpaper.create({ title: 'U2', slug: 'u2', categorySlug: 'anime', image: 'x', status: 'pending', uploadedBy: userId });

    const res = await chai.request(app()).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(res).to.have.status(200);
    expect(res.body.data.user).to.include.keys(['name', 'bio', 'banner', 'isPremium', 'email']);
    expect(res.body.data.user.name).to.equal('Hossein Rivandi');
    expect(res.body.data.user).to.not.have.property('password');
    expect(res.body.data.favoritesCount).to.equal(1);
    expect(res.body.data.uploadsCount).to.equal(2);
  });

  it('PATCH /me updates bio, avatar, banner and a full name', async () => {
    const res = await chai
      .request(app())
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Aisha Rahman', bio: 'Pro artist', avatar: 'https://cdn/a.jpg', banner: 'https://cdn/b.jpg' });
    expect(res).to.have.status(200);
    expect(res.body.data.user.name).to.equal('Aisha Rahman');
    expect(res.body.data.user.firstName).to.equal('Aisha');
    expect(res.body.data.user.bio).to.equal('Pro artist');
    expect(res.body.data.user.avatar).to.equal('https://cdn/a.jpg');
    expect(res.body.data.user.banner).to.equal('https://cdn/b.jpg');
  });

  it('PATCH /me cannot change email or role', async () => {
    await chai
      .request(app())
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'hacker@evil.com', role: 'admin', bio: 'ok' });
    const fresh = await User.findById(userId);
    expect(fresh.email).to.equal('profile@example.com');
    expect(fresh.role).to.equal('user');
    expect(fresh.bio).to.equal('ok');
  });

  it('PATCH /me 400 when no valid fields', async () => {
    const res = await chai
      .request(app())
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'nope@example.com' });
    expect(res).to.have.status(400);
  });

  it('GET /me/uploads returns the user uploads incl. pending, with status', async () => {
    await Wallpaper.create({ title: 'U1', slug: 'u1', categorySlug: 'anime', image: 'x', status: 'active', uploadedBy: userId });
    await Wallpaper.create({ title: 'U2', slug: 'u2', categorySlug: 'anime', image: 'x', status: 'pending', uploadedBy: userId });
    await Wallpaper.create({ title: 'Other', slug: 'other', categorySlug: 'anime', image: 'x', status: 'active' }); // not theirs

    const res = await chai.request(app()).get('/api/v1/me/uploads').set('Authorization', `Bearer ${token}`);
    expect(res).to.have.status(200);
    expect(res.body.data.wallpapers).to.have.length(2);
    expect(res.body.data.wallpapers.map((w) => w.status).sort()).to.deep.equal(['active', 'pending']);
  });
});
