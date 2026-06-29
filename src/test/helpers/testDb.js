/**
 * Self-contained test database harness — LOCAL Postgres only.
 *
 * Spins up a throwaway embedded PostgreSQL on localhost (via embedded-postgres),
 * points the app at it through DATABASE_URL/DIRECT_URL, applies the Prisma schema
 * with `prisma db push`, then requires the Express app. The real Supabase DB is
 * NEVER touched (a safety check refuses any non-local DATABASE_URL).
 *
 * NOTE: PostgreSQL refuses to run its server under a Windows administrator token,
 * so the suite must be launched from a NON-elevated shell (plain `npm test`).
 */
const EmbeddedPostgresModule = require('embedded-postgres');
const EmbeddedPostgres = EmbeddedPostgresModule.default || EmbeddedPostgresModule;
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const bcrypt = require('bcryptjs');

const TEST_PORT = Number(process.env.TEST_PG_PORT) || 55432;
const DB_NAME = 'halalwalls_test';
const BACKEND_ROOT = path.join(__dirname, '..', '..', '..');

let pg = null;
let app = null;
let prisma = null;

exports.start = async () => {
  if (app) return app;

  const dir = path.join(os.tmpdir(), 'halalwalls-pgtest');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}

  pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'postgres',
    password: 'postgres',
    port: TEST_PORT,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(DB_NAME);

  const url = `postgresql://postgres:postgres@localhost:${TEST_PORT}/${DB_NAME}`;

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;

  // SAFETY: never apply the schema to a remote/production database.
  if (!/@localhost|@127\.0\.0\.1/.test(process.env.DATABASE_URL)) {
    throw new Error('Refusing to run tests against a non-local DATABASE_URL');
  }

  // Force external integrations OFF so the suite is deterministic (no real
  // Google verification, Resend, or SMTP send).
  process.env.GOOGLE_CLIENT_ID = '';
  process.env.RESEND_API_KEY = '';
  process.env.SMTP_HOST = '';
  process.env.SMTP_USER = '';

  // Apply the Prisma schema to the fresh local DB.
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: BACKEND_ROOT,
    env: process.env,
    stdio: 'pipe',
  });

  // Require AFTER env is set so the Prisma client targets the local DB.
  app = require('../../index');
  prisma = require('../../lib/prisma');
  await prisma.$connect();
  return app;
};

exports.stop = async () => {
  if (prisma) { try { await prisma.$disconnect(); } catch {} }
  if (pg) { try { await pg.stop(); } catch {} }
  pg = null;
  app = null;
  prisma = null;
};

// Truncate every table between tests (FK-safe via CASCADE).
exports.clear = async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "hw_favorites","hw_wallpapers","hw_categories","hw_contacts","hw_users" RESTART IDENTITY CASCADE'
  );
};

exports.app = () => app;
exports.prisma = () => prisma;

// ── Factories ──────────────────────────────────────────────────────────────
const { signAccessToken } = require('../../helpers/jwt.helper');

let seq = 0;
const uniq = () => `${Date.now()}_${++seq}`;

exports.createUser = async (overrides = {}) => {
  const { password, ...rest } = overrides;
  return prisma.user.create({
    data: {
      firstName: rest.firstName || 'Test',
      lastName: rest.lastName || 'User',
      email: (rest.email || `user_${uniq()}@test.com`).toLowerCase(),
      password: password ? await bcrypt.hash(password, 10) : null,
      role: rest.role || 'user',
      authProvider: rest.authProvider || 'local',
      emailVerified: rest.emailVerified !== undefined ? rest.emailVerified : true,
      isPremium: rest.isPremium || false,
    },
  });
};

// Create an admin (or user) and return { user, token }.
exports.authUser = async (role = 'user', overrides = {}) => {
  const user = await exports.createUser({ ...overrides, role });
  return { user, token: signAccessToken(user) };
};

exports.tokenFor = (user) => signAccessToken(user);

exports.createCategory = async (overrides = {}) => {
  const n = uniq();
  return prisma.category.create({
    data: {
      name: overrides.name || `Cat ${n}`,
      slug: overrides.slug || `cat-${n}`,
      description: overrides.description || '',
      order: overrides.order || 0,
      isPremium: overrides.isPremium || false,
      image: overrides.image || null,
      count: overrides.count || 0,
    },
  });
};

exports.createWallpaper = async (overrides = {}) => {
  const n = uniq();
  return prisma.wallpaper.create({
    data: {
      title: overrides.title || `Wallpaper ${n}`,
      slug: overrides.slug || `wallpaper-${n}`,
      description: overrides.description || '',
      category: overrides.category || 'Space',
      categorySlug: overrides.categorySlug || 'space',
      tags: overrides.tags || ['test'],
      image: overrides.image || 'https://cdn.test/w.jpg',
      originalUrl: overrides.originalUrl || 'https://cdn.test/w.jpg',
      thumbnailUrl: overrides.thumbnailUrl || 'https://cdn.test/w.jpg',
      resolution: overrides.resolution || '1920x1080',
      preferredResolution: overrides.preferredResolution || '1920x1080',
      resolutions: overrides.resolutions || ['1920x1080'],
      sizeMB: overrides.sizeMB || 1.42,
      width: overrides.width || 1920,
      height: overrides.height || 1080,
      author: overrides.author || 'halalwalls',
      isPremium: overrides.isPremium || false,
      isLive: overrides.isLive || false,
      status: overrides.status || 'active',
      downloadCount: overrides.downloadCount || 0,
      views: overrides.views || 0,
      favoritesCount: overrides.favoritesCount || 0,
      uploadedById: overrides.uploadedById || null,
    },
  });
};

exports.createContact = async (overrides = {}) => {
  return prisma.contact.create({
    data: {
      name: overrides.name || 'Tester',
      email: (overrides.email || `contact_${uniq()}@test.com`).toLowerCase(),
      reason: overrides.reason || 'support',
      message: overrides.message || 'Hello from a test',
      status: overrides.status || 'new',
    },
  });
};
