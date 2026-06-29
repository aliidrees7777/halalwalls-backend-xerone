/**
 * Hourly cleanup of expired password-reset tokens.
 * Keeps stale single-use tokens from lingering in the hw_users collection.
 *
 * Gated off in test mode by index.js (the cron tick must not fire mid-test).
 */
const cron = require('node-cron');
const prisma = require('../lib/prisma');

cron.schedule('0 * * * *', async () => {
  try {
    const now = new Date();
    const result = await prisma.user.updateMany({
      where: { passwordResetExpires: { lt: now, not: null } },
      data: { passwordResetToken: null, passwordResetExpires: null },
    });
    if (result.count) {
      console.log(`🧹 [CRON token-cleanup] cleared expired tokens on ${result.count} user(s)`);
    }
  } catch (error) {
    console.error('❌ [CRON token-cleanup] error:', error.message);
  }
});

console.log('⏰ token-cleanup scheduler registered (hourly)');
