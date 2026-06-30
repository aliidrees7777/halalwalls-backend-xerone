const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');
const { removeImage } = require('../helpers/upload-storage');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();
const auth = (t) => ({ Authorization: `Bearer ${t}` });

// Build a minimal but valid JPEG whose SOF0 marker carries real dimensions, so
// the dimension reader (imageMeta.js) extracts a resolution from the bytes.
function makeJpeg(width, height) {
  const dims = Buffer.alloc(4);
  dims.writeUInt16BE(height, 0);
  dims.writeUInt16BE(width, 2);
  const sof = Buffer.concat([
    Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08]), // SOF0, length 17, precision 8
    dims,
    Buffer.from([0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]),
  ]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

describe('User wallpaper submission — POST /uploads', () => {
  let userTok;
  let user;
  let adminTok;
  // Track stored filenames so disk artifacts are cleaned up after the suite.
  const storedFiles = [];

  const track = (res) => {
    const url = res.body && res.body.data && res.body.data.wallpaper && res.body.data.wallpaper.image;
    const m = url && url.match(/\/uploads\/([^/]+)$/);
    if (m) storedFiles.push(m[1]);
  };

  // Submit a wallpaper as `tok`, with optional field overrides.
  const submit = (tok, fields = {}, filename = 'My Cool Wall.jpg') => {
    const req = chai.request(app()).post('/api/v1/uploads');
    if (tok) req.set(auth(tok));
    const f = { category: 'Anime', tags: 'anime, art', source: 'Drawn by me', ...fields };
    Object.entries(f).forEach(([k, v]) => {
      if (v !== undefined && v !== null) req.field(k, v);
    });
    return req.attach('image', makeJpeg(1280, 720), filename);
  };

  beforeEach(async () => {
    await testDb.clear();
    const u = await testDb.authUser('user');
    userTok = u.token;
    user = u.user;
    adminTok = (await testDb.authUser('admin')).token;
    await testDb.createCategory({ name: 'Anime', slug: 'anime' });
  });

  after(async () => {
    for (const f of storedFiles) await removeImage(f).catch(() => {});
  });

  it('401 for a guest (no token)', async () => {
    const res = await submit(null);
    expect(res).to.have.status(401);
  });

  it('400 when no image file is attached', async () => {
    const res = await chai
      .request(app())
      .post('/api/v1/uploads')
      .set(auth(userTok))
      .field('category', 'Anime');
    expect(res).to.have.status(400);
  });

  it('201 creates a pending wallpaper with image, dimensions, category, tags, and uploader', async () => {
    const res = await submit(userTok);
    track(res);

    expect(res).to.have.status(201);
    const w = res.body.data.wallpaper;
    expect(w.status).to.equal('pending');
    expect(w.slug).to.equal('my-cool-wall');
    expect(w.title).to.equal('My Cool Wall');
    expect(w.category).to.equal('anime'); // card exposes the slug
    expect(w.resolution).to.equal('1280x720');
    expect(w.isPremium).to.equal(false);
    expect(w.isLive).to.equal(false);
    expect(w.image).to.match(/^https?:\/\/.+\/uploads\/[^/]+\.jpg$/);

    // Verify the persisted row (fields not on the card).
    const row = await testDb.prisma().wallpaper.findUnique({ where: { id: w.id } });
    expect(row.status).to.equal('pending');
    expect(row.uploadedById).to.equal(user.id);
    expect(row.categorySlug).to.equal('anime');
    expect(row.category).to.equal('Anime');
    expect(row.tags).to.deep.equal(['anime', 'art']);
    expect(row.description).to.equal('Drawn by me');
    expect(row.width).to.equal(1280);
    expect(row.height).to.equal(720);
  });

  it('auto-uniquifies the slug on duplicate titles', async () => {
    const a = await submit(userTok);
    track(a);
    const b = await submit(userTok);
    track(b);
    expect(a.body.data.wallpaper.slug).to.equal('my-cool-wall');
    expect(b.body.data.wallpaper.slug).to.equal('my-cool-wall-2');
  });

  it('the submission surfaces in the admin moderation queue (GET /admin/wallpapers/pending)', async () => {
    const up = await submit(userTok);
    track(up);
    const id = up.body.data.wallpaper.id;

    const res = await chai
      .request(app())
      .get('/api/v1/admin/wallpapers/pending')
      .set(auth(adminTok));
    expect(res).to.have.status(200);
    expect(res.body.data.pagination.total).to.equal(1);
    const pending = res.body.data.wallpapers[0];
    expect(pending.id).to.equal(id);
    expect(pending.status).to.equal('pending');
    expect(pending.uploadedBy.id).to.equal(user.id);
  });

  it("the submission surfaces in the owner's uploads (GET /me/uploads) as pending", async () => {
    const up = await submit(userTok);
    track(up);

    const res = await chai.request(app()).get('/api/v1/me/uploads').set(auth(userTok));
    expect(res).to.have.status(200);
    expect(res.body.data.count).to.equal(1);
    expect(res.body.data.wallpapers[0].status).to.equal('pending');
    expect(res.body.data.wallpapers[0].slug).to.equal('my-cool-wall');
  });

  it('an approved submission becomes publicly visible', async () => {
    const up = await submit(userTok);
    track(up);
    const id = up.body.data.wallpaper.id;

    // Admin approves → status active.
    const approve = await chai
      .request(app())
      .patch(`/api/v1/admin/wallpapers/${id}/approve`)
      .set(auth(adminTok));
    expect(approve).to.have.status(200);
    expect(approve.body.data.wallpaper.status).to.equal('active');

    // Now it appears in the public catalog.
    const pub = await chai.request(app()).get('/api/v1/wallpapers');
    expect(pub.body.data.wallpapers.some((x) => x.id === id)).to.equal(true);
  });
});
