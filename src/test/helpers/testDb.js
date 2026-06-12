/**
 * Self-contained test database harness.
 *
 * Spins up an in-memory MongoDB (mongodb-memory-server) so the suite never
 * touches the real cluster, points the app at it via MONGO_URI, then requires
 * the Express app (which connects on require). Idempotent: safe to call from
 * the shared mocha setup once per run.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

let mongod = null;
let app = null;

exports.start = async () => {
  if (app) return app;

  mongod = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGO_URI = mongod.getUri('HalalWalls-Test');

  // Force external integrations OFF during tests so the suite is deterministic
  // and never attempts a real Google verification, email send, or R2 upload —
  // even if the developer has real credentials in their local .env. (dotenv
  // won't override these once they're already set.)
  process.env.GOOGLE_CLIENT_ID = '';
  process.env.EMAIL_PROVIDER = '';
  process.env.SMTP_HOST = '';
  process.env.SMTP_USER = '';
  process.env.SENDGRID_API_KEY = '';
  process.env.R2_ACCOUNT_ID = '';
  process.env.R2_ACCESS_KEY_ID = '';
  process.env.R2_SECRET_ACCESS_KEY = '';
  process.env.R2_BUCKET = '';
  process.env.R2_PUBLIC_BASE_URL = '';
  process.env.R2_ENDPOINT = '';

  // Require AFTER MONGO_URI is set so the app connects to the in-memory DB.
  app = require('../../index');
  await mongoose.connection.asPromise();
  return app;
};

exports.stop = async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  mongod = null;
  app = null;
};

exports.clear = async () => {
  const collections = mongoose.connection.collections;
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({});
  }
};

exports.app = () => app;

// Creates a user directly (bypassing the API) for login-related tests.
exports.createUser = async ({
  email,
  password,
  authProvider = 'local',
  role = 'user',
}) => {
  const User = require('../../models/user.schema');
  const hashed = password ? await bcrypt.hash(password, 10) : null;
  return User.create({
    firstName: 'Test',
    lastName: 'User',
    email: email.toLowerCase(),
    password: hashed,
    role,
    authProvider,
  });
};

// Reads a (normally select:false) token field straight from the DB.
exports.getUserTokenField = async (email, field) => {
  const User = require('../../models/user.schema');
  const user = await User.findOne({ email: email.toLowerCase() }).select(`+${field}`);
  // field like 'passwordReset.token'
  return field.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), user);
};
