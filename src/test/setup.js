/**
 * Mocha root hooks — shared across every *.test.js file.
 * Starts the in-memory DB once, clears collections between tests, tears down
 * at the end. Loaded via the `--file` flag in the npm test script.
 */
const testDb = require('./helpers/testDb');

before(async function () {
  this.timeout(120000); // first run may download the in-memory mongo binary
  await testDb.start();
});

after(async function () {
  this.timeout(30000);
  await testDb.stop();
});

beforeEach(async function () {
  await testDb.clear();
});
