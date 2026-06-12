const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');
const Wallpaper = require('../models/wallpaper.schema');
const Contact = require('../models/contact.schema');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();

describe('Contact', () => {
  beforeEach(async () => {
    await testDb.clear();
  });

  it('POST /contact stores a message and returns 201', async () => {
    const res = await chai
      .request(app())
      .post('/api/v1/contact')
      .send({ name: 'Aisha', email: 'aisha@example.com', reason: 'Feedback', message: 'Love it!' });
    expect(res).to.have.status(201);
    expect(res.body.status).to.equal('success');
    expect(res.body.data).to.have.property('id');
    expect(res.body.data.status).to.equal('new');

    const saved = await Contact.findOne({ email: 'aisha@example.com' });
    expect(saved).to.not.equal(null);
    expect(saved.message).to.equal('Love it!');
    expect(saved.status).to.equal('new');
  });

  it('400 when required fields are missing', async () => {
    const res = await chai.request(app()).post('/api/v1/contact').send({ email: 'a@b.com' });
    expect(res).to.have.status(400);
  });

  it('400 on invalid email', async () => {
    const res = await chai
      .request(app())
      .post('/api/v1/contact')
      .send({ name: 'A', email: 'not-an-email', message: 'hi' });
    expect(res).to.have.status(400);
  });
});

describe('Stats', () => {
  beforeEach(async () => {
    await testDb.clear();
    await Wallpaper.insertMany([
      { title: 'A', slug: 'a', categorySlug: 'anime', image: 'x', status: 'active', downloadCount: 100, views: 300 },
      { title: 'B', slug: 'b', categorySlug: 'gaming', image: 'x', status: 'active', downloadCount: 50, views: 120 },
      { title: 'C', slug: 'c', categorySlug: 'anime', image: 'x', status: 'pending', downloadCount: 999, views: 999 },
    ]);
  });

  it('GET /stats returns counters over active wallpapers only', async () => {
    const res = await chai.request(app()).get('/api/v1/stats');
    expect(res).to.have.status(200);
    const d = res.body.data;
    expect(d.totalWallpapers).to.equal(2); // pending excluded
    expect(d.totalDownloads).to.equal(150); // 100 + 50 (pending's 999 excluded)
    expect(d.totalViews).to.equal(420);
    expect(d.totalCategories).to.equal(2); // anime, gaming (distinct active slugs)
  });
});
