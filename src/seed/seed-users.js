/**
 * Seed demo sign-in accounts into Supabase (hw_users).
 *
 * Run:  npm run seed:users
 *
 * Creates/updates two ready-to-use, email-verified accounts so the frontend can
 * sign in immediately after the Postgres migration. Idempotent (upsert by
 * email). Demo passwords are intentionally simple — rotate before production.
 */
require('../config/loadEnv'); // loads .env.local (dev) or .env.production (prod)
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const ACCOUNTS = [
  {
    firstName: 'Admin',
    lastName: 'HalalWalls',
    email: 'admin@halalwalls.com',
    password: 'Admin@12345',
    role: 'admin',
    // Full public-site entitlements (premium downloads, etc.) locally + prod.
    isPremium: true,
    subscriptionPlan: 'lifetime',
    subscriptionStatus: 'active',
  },
  {
    firstName: 'Demo',
    lastName: 'User',
    email: 'user@halalwalls.com',
    password: 'User@12345',
    role: 'user',
    isPremium: false,
    subscriptionPlan: null,
    subscriptionStatus: null,
  },
];

async function seedUsers() {
  await prisma.$connect();
  console.log('✅ Connected to HalalWalls DB (Supabase Postgres)');

  // Tidy up throwaway accounts created during smoke testing.
  const removed = await prisma.user.deleteMany({ where: { email: { startsWith: 'smoke_' } } });
  if (removed.count) console.log(`🧹 Removed ${removed.count} smoke-test user(s)`);

  for (const a of ACCOUNTS) {
    const password = await bcrypt.hash(a.password, 10);
    const data = {
      firstName: a.firstName,
      lastName: a.lastName,
      password,
      role: a.role,
      authProvider: 'local',
      emailVerified: true, // pre-verified so sign-in is frictionless
      isPremium: a.isPremium,
      subscriptionPlan: a.subscriptionPlan,
      subscriptionStatus: a.subscriptionStatus,
    };
    await prisma.user.upsert({
      where: { email: a.email },
      create: { email: a.email, ...data },
      update: data,
    });
    console.log(
      `👤 ${a.role.padEnd(5)} ${a.email}  (password: ${a.password}${a.isPremium ? ', premium' : ''})`,
    );
  }

  await prisma.$disconnect();
  console.log('✅ Seed users complete.');
  process.exit(0);
}

seedUsers().catch(async (err) => {
  console.error('❌ Seed users failed:', err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
