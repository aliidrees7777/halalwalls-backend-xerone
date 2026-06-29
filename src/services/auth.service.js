const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('config');

const prisma = require('../lib/prisma');
const { ROLES } = require('../helpers/roles');
const { serializeUser } = require('../helpers/serialize');
const { signAccessToken } = require('../helpers/jwt.helper');
const { verifyGoogleIdToken } = require('../helpers/google.helper');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../helpers/email.helper');

const SALT_ROUNDS = 10;

// Load the user's favorite wallpaper ids alongside the row so serializeUser can
// echo them back (parity with the old embedded `favorites` array).
const WITH_FAVORITES = { favorites: { select: { wallpaperId: true } } };

const resetTtlMs = () => {
  const min = process.env.PASSWORD_RESET_EXPIRES_MIN ||
    (config.has('passwordResetExpiresMin') ? config.get('passwordResetExpiresMin') : 60);
  return Number(min) * 60 * 1000;
};

const verifyTtlMs = () => {
  const min = process.env.EMAIL_VERIFICATION_EXPIRES_MIN ||
    (config.has('emailVerificationExpiresMin') ? config.get('emailVerificationExpiresMin') : 1440);
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
// The account is created and a JWT is issued immediately (so the user is signed
// in), but the email starts UNVERIFIED and a verification link is emailed. The
// frontend can prompt the user to verify; verified status gates nothing yet.
exports.signup = async ({ firstName, lastName, email, password, role = ROLES.USER }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw fail('An account with this email already exists', 409);

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const verifyToken = newToken();

  const user = await prisma.user.create({
    data: {
      firstName: firstName.trim(),
      lastName: (lastName || '').trim(),
      email: normalizedEmail,
      password: hashed,
      role,
      authProvider: 'local',
      emailVerified: false,
      emailVerificationToken: verifyToken,
      emailVerificationExpires: new Date(Date.now() + verifyTtlMs()),
    },
  });

  // Send the verification link (console-stub until SMTP is configured).
  await sendVerificationEmail(normalizedEmail, verifyToken, user.firstName);

  const token = signAccessToken(user);

  return {
    message: 'Account created. Please check your email to verify your address.',
    data: { token, user: serializeUser(user) },
    statusCode: 201,
  };
};

// ─── Verify email ───────────────────────────────────────────────────────
exports.verifyEmail = async ({ token }) => {
  const user = await prisma.user.findFirst({ where: { emailVerificationToken: token } });
  if (!user) throw fail('Invalid or already-used verification link', 400);

  if (user.emailVerified) {
    return { message: 'Email already verified. You can sign in.', data: null, statusCode: 200 };
  }
  if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
    throw fail('Verification link has expired. Please request a new one.', 410);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, emailVerificationToken: null, emailVerificationExpires: null },
  });

  return { message: 'Email verified successfully.', data: { user: serializeUser(updated) }, statusCode: 200 };
};

// ─── Resend verification (authenticated) ────────────────────────────────
exports.resendVerification = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw fail('User not found', 404);
  if (user.emailVerified) {
    return { message: 'Your email is already verified.', data: null, statusCode: 200 };
  }

  const verifyToken = newToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: verifyToken,
      emailVerificationExpires: new Date(Date.now() + verifyTtlMs()),
    },
  });
  await sendVerificationEmail(user.email, verifyToken, user.firstName);

  return { message: 'Verification email sent. Please check your inbox.', data: null, statusCode: 200 };
};

// ─── Login (local) ──────────────────────────────────────────────────────
// Shared sign-in for user / admin. Optional `role` validates the account type.
exports.login = async ({ email, password, role }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: WITH_FAVORITES,
  });
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
    data: { token, user: serializeUser(user) },
    statusCode: 200,
  };
};

// ─── Forgot password ──────────────────────────────────────────────────────
// Generic success regardless of account existence (no user enumeration).
exports.forgotPassword = async ({ email }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (user && user.authProvider === 'local') {
    const token = newToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpires: new Date(Date.now() + resetTtlMs()) },
    });
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
  const user = await prisma.user.findFirst({ where: { passwordResetToken: token } });
  if (!user) throw fail('Invalid or already-used reset token', 400);

  if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    throw fail('Reset token has expired. Please request a new one.', 410);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(newPassword, SALT_ROUNDS),
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  return { message: 'Password has been reset successfully. You can now log in.', data: null, statusCode: 200 };
};

// ─── Google sign-in / sign-up ──────────────────────────────────────────────
exports.googleAuth = async ({ idToken }) => {
  const profile = await verifyGoogleIdToken(idToken);

  let user = await prisma.user.findUnique({
    where: { email: profile.email },
    include: WITH_FAVORITES,
  });

  if (!user) {
    // First-time Google user → create a standard user account. Google has
    // already verified the email, so it's verified immediately.
    user = await prisma.user.create({
      data: {
        firstName: profile.firstName,
        lastName: profile.lastName || '',
        email: profile.email,
        role: ROLES.USER,
        authProvider: 'google',
        googleId: profile.googleId,
        avatar: profile.avatar,
        emailVerified: !!profile.emailVerified,
      },
      include: WITH_FAVORITES,
    });
  } else {
    // Existing local account logging in with Google → link the Google id and
    // mark verified (Google confirmed ownership of the address).
    const patch = {};
    if (!user.googleId) patch.googleId = profile.googleId;
    if (!user.avatar && profile.avatar) patch.avatar = profile.avatar;
    if (!user.emailVerified && profile.emailVerified) patch.emailVerified = true;
    if (Object.keys(patch).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: patch,
        include: WITH_FAVORITES,
      });
    }
  }

  const token = signAccessToken(user);
  return {
    message: 'Signed in with Google successfully',
    data: { token, user: serializeUser(user) },
    statusCode: 200,
  };
};

// ─── Account & Security ─────────────────────────────────────────────────────

// POST /api/v1/auth/change-password — authenticated; keeps THIS session,
// logs out other devices (via sessionsValidFrom) and returns a fresh token.
exports.changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw fail('User not found', 404);
  if (user.authProvider === 'google' && !user.password) {
    throw fail('This account uses Google sign-in; a password cannot be changed here', 409);
  }

  const match = await bcrypt.compare(currentPassword, user.password || '');
  if (!match) throw fail('Current password is incorrect', 401);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(newPassword, SALT_ROUNDS),
      sessionsValidFrom: new Date(), // invalidate other devices
    },
  });

  const token = signAccessToken(updated); // fresh token for the current device
  return { message: 'Password changed successfully', data: { token }, statusCode: 200 };
};
