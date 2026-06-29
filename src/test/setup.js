/**
 * Mocha root hooks — start the local test DB once before the suite, stop after.
 */
const testDb = require('./helpers/testDb');

before(async function () {
  this.timeout(180000); // first run may download the embedded postgres binary
  await testDb.start();
});

after(async function () {
  this.timeout(30000);
  await testDb.stop();
});
