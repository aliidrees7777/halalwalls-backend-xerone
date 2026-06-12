const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');
const Wallpaper = require('../models/wallpaper.schema');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();

async function makeWallpaper(slug) {
  return Wallpaper.create({
    title: slug,
    slug,
    category: 'Anime',
    categorySlug: 'anime',
    image: `https://example.com/${slug}.jpg`,
    resolution: '1920x1080',
    status: 'active',
  });
}

// Sign up a fresh user and return their bearer token.
async function signupToken(email) {
  const res = await chai
    .request(app())
    .post('/api/v1/auth/signup')
    .send({ firstName: 'Fav', email, password: 'password123', confirmPassword: 'password123' });
  return res.body.data.token;
}

describe('Favorites (auth)', () => {
  let token;
  let wp;

  beforeEach(async () => {
    await testDb.clear();
    token = await signupToken('fav@example.com');
    wp = await makeWallpaper('anime-one');
  });

  it('requires authentication', async () => {
    const res = await chai.request(app()).get('/api/v1/me/favorites');
    expect(res).to.have.status(401);
  });

  it('starts empty', async () => {
    const res = await chai.request(app()).get('/api/v1/me/favorites').set('Authorization', `Bearer ${token}`);
    expect(res).to.have.status(200);
    expect(res.body.data.wallpapers).to.be.an('array').with.length(0);
  });

  it('adds a favorite and bumps the wallpaper favoritesCount', async () => {
    const res = await chai
      .request(app())
      .post(`/api/v1/me/favorites/${wp._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res).to.have.status(200);
    expect(res.body.data.isFavorite).to.equal(true);
    expect(res.body.data.favoritesCount).to.equal(1);
    expect(res.body.data.favorites).to.include(String(wp._id));

    const fresh = await Wallpaper.findById(wp._id).lean();
    expect(fresh.favoritesCount).to.equal(1);
  });

  it('is idempotent — favoriting twice does not double-count', async () => {
    await chai.request(app()).post(`/api/v1/me/favorites/${wp._id}`).set('Authorization', `Bearer ${token}`);
    const res = await chai.request(app()).post(`/api/v1/me/favorites/${wp._id}`).set('Authorization', `Bearer ${token}`);
    expect(res).to.have.status(200);
    expect(res.body.data.favoritesCount).to.equal(1);
    const fresh = await Wallpaper.findById(wp._id).lean();
    expect(fresh.favoritesCount).to.equal(1);
  });

  it('lists the favorited wallpaper with isFavorite=true', async () => {
    await chai.request(app()).post(`/api/v1/me/favorites/${wp._id}`).set('Authorization', `Bearer ${token}`);
    const res = await chai.request(app()).get('/api/v1/me/favorites').set('Authorization', `Bearer ${token}`);
    expect(res.body.data.wallpapers).to.have.length(1);
    expect(res.body.data.wallpapers[0].isFavorite).to.equal(true);
    expect(res.body.data.wallpapers[0].favoritesCount).to.equal(1);
  });

  it('removes a favorite and lowers the count', async () => {
    await chai.request(app()).post(`/api/v1/me/favorites/${wp._id}`).set('Authorization', `Bearer ${token}`);
    const res = await chai.request(app()).delete(`/api/v1/me/favorites/${wp._id}`).set('Authorization', `Bearer ${token}`);
    expect(res).to.have.status(200);
    expect(res.body.data.isFavorite).to.equal(false);
    expect(res.body.data.favoritesCount).to.equal(0);
    const fresh = await Wallpaper.findById(wp._id).lean();
    expect(fresh.favoritesCount).to.equal(0);
  });

  it('count reflects two different users favoriting the same wallpaper', async () => {
    const token2 = await signupToken('fav2@example.com');
    await chai.request(app()).post(`/api/v1/me/favorites/${wp._id}`).set('Authorization', `Bearer ${token}`);
    const res = await chai.request(app()).post(`/api/v1/me/favorites/${wp._id}`).set('Authorization', `Bearer ${token2}`);
    expect(res.body.data.favoritesCount).to.equal(2);
  });

  it('400 on invalid wallpaper id, 404 on unknown id', async () => {
    const bad = await chai.request(app()).post('/api/v1/me/favorites/not-an-id').set('Authorization', `Bearer ${token}`);
    expect(bad).to.have.status(400);
    const missing = await chai
      .request(app())
      .post('/api/v1/me/favorites/66f1a10000000000000000ff')
      .set('Authorization', `Bearer ${token}`);
    expect(missing).to.have.status(404);
  });
});
