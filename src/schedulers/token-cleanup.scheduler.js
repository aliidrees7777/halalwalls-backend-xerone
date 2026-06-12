/**
 * Hourly cleanup of expired password-reset tokens.
 * Keeps stale single-use tokens from lingering in the hw_users collection.
 *
 * Gated off in test mode by index.js (the cron tick must not fire mid-test).
 */
const cron = require('node-cron');
const User = require('../models/user.schema');

cron.schedule('0 * * * *', async () => {
  try {
    const now = new Date();
    const result = await User.updateMany(
      { 'passwordReset.expiresAt': { $lt: now, $ne: null } },
      {
        $set: {
          'passwordReset.token': null,
          'passwordReset.expiresAt': null,
        },
      }
    );
    if (result.modifiedCount) {
      console.log(`🧹 [CRON token-cleanup] cleared expired tokens on ${result.modifiedCount} user(s)`);
    }
  } catch (error) {
    console.error('❌ [CRON token-cleanup] error:', error.message);
  }
});

console.log('⏰ token-cleanup scheduler registered (hourly)');
