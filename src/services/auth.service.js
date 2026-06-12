const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('config');

const User = require('../models/user.schema');
const { ROLES } = require('../helpers/roles');
const { signAccessToken } = require('../helpers/jwt.helper');
const { verifyGoogleIdToken } = require('../helpers/google.helper');
const { sendPasswordResetEmail } = require('../helpers/email.helper');

const SALT_ROUNDS = 10;

const resetTtlMs = () => {
  const min = process.env.PASSWORD_RESET_EXPIRES_MIN ||
    (config.has('passwordResetExpiresMin') ? config.get('passwordResetExpiresMin') : 60);
  return Number(min) * 60 * 1000;
};

const newToken = () => crypto.randomBytes(32).toString('hex');

const fail = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ─── Signup ─────────────────────────────────────────────────────────────
// role: 'user' (default) | 'admin'. Public signup is restricted to 'user' by
// the controller; admins are provisioned internally.
// No email verification — the account is created and a JWT is issued
// immediately so the user is signed in right after registering.
exports.signup = async ({ firstName, lastName, email, password, role = ROLES.USER }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw fail('An account with this email already exists', 409);

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    firstName: firstName.trim(),
    lastName: (lastName || '').trim(),
    email: normalizedEmail,
    password: hashed,
    role,
    authProvider: 'local',
  });

  const token = signAccessToken(user);

  return {
    message: 'Account created successfully.',
    data: { token, user: user.toPublicJSON() },
    statusCode: 201,
  };
};

// ─── Login (local) ──────────────────────────────────────────────────────
// Shared sign-in for user / admin. Optional `role` validates the account type.
exports.login = async ({ email, password, role }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user) throw fail('Invalid email or password', 401);

  if (user.authProvider === 'google' && !user.password) {
    throw fail('This account uses Google sign-in. Please continue with Google.', 409);
  }

  const match = await bcrypt.compare(password, user.password || '');
  if (!match) throw fail('Invalid email or password', 401);

  // If a role was requested (portal tab), it must match the account's role.
  if (role && user.role !== role) {
    throw fail(`This account is not a ${role} account`, 403);
  }

  const token = signAccessToken(user);
  return {
    message: 'Logged in successfully',
    data: { token, user: user.toPublicJSON() },
    statusCode: 200,
  };
};

// ─── Forgot password ──────────────────────────────────────────────────────
// Generic success regardless of account existence (no user enumeration).
exports.forgotPassword = async ({ email }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (user && user.authProvider === 'local') {
    const token = newToken();
    user.passwordReset = { token, expiresAt: new Date(Date.now() + resetTtlMs()) };
    await user.save();
    await sendPasswordResetEmail(normalizedEmail, token, user.firstName);
  }

  return {
    message: 'If an account exists for that email, a password reset link has been sent.',
    data: null,
    statusCode: 200,
  };
};

// ─── Reset password ───────────────────────────────────────────────────────
exports.resetPassword = async ({ token, newPassword }) => {
  const user = await User.findOne({ 'passwordReset.token': token }).select(
    '+passwordReset.token +passwordReset.expiresAt'
  );
  if (!user) throw fail('Invalid or already-used reset token', 400);

  if (!user.passwordReset.expiresAt || user.passwordReset.expiresAt < new Date()) {
    throw fail('Reset token has expired. Please request a new one.', 410);
  }

  user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.passwordReset = { token: null, expiresAt: null };
  await user.save();

  return { message: 'Password has been reset successfully. You can now log in.', data: null, statusCode: 200 };
};

// ─── Google sign-in / sign-up ──────────────────────────────────────────────
exports.googleAuth = async ({ idToken }) => {
  const profile = await verifyGoogleIdToken(idToken);

  let user = await User.findOne({ email: profile.email });

  if (!user) {
    // First-time Google user → create a standard user account.
    user = await User.create({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      role: ROLES.USER,
      authProvider: 'google',
      googleId: profile.googleId,
      avatar: profile.avatar,
    });
  } else {
    // Existing local account logging in with Google → link the Google id.
    let changed = false;
    if (!user.googleId) { user.googleId = profile.googleId; changed = true; }
    if (!user.avatar && profile.avatar) { user.avatar = profile.avatar; changed = true; }
    if (changed) await user.save();
  }

  const token = signAccessToken(user);
  return {
    message: 'Signed in with Google successfully',
    data: { token, user: user.toPublicJSON() },
    statusCode: 200,
  };
};

// ─── Account & Security ─────────────────────────────────────────────────────

// POST /api/v1/auth/change-password — authenticated; keeps THIS session,
// logs out other devices (via sessionsValidFrom) and returns a fresh token.
exports.changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw fail('User not found', 404);
  if (user.authProvider === 'google' && !user.password) {
    throw fail('This account uses Google sign-in; a password cannot be changed here', 409);
  }

  const match = await bcrypt.compare(currentPassword, user.password || '');
  if (!match) throw fail('Current password is incorrect', 401);

  user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.sessionsValidFrom = new Date(); // invalidate other devices
  await user.save();

  const token = signAccessToken(user); // fresh token for the current device
  return { message: 'Password changed successfully', data: { token }, statusCode: 200 };
};
