const AuthService = require('../services/auth.service');
const { ROLES, ALL_ROLES, SIGNUP_ROLES } = require('../helpers/roles');

const EMAIL_RE = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;

const bad = (next, message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return next(error);
};

// POST /api/v1/auth/signup
// PUBLIC signup — creates a role=user account by default.
// (Admins are seeded/provisioned internally and cannot self-register.)
exports.signup = async (req, res, next) => {
  const { firstName, lastName, email, password, confirmPassword, role } = req.body || {};
  try {
    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) return bad(next, 'First name is required');
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) return bad(next, 'A valid email is required');
    if (!password || typeof password !== 'string') return bad(next, 'Password is required');
    if (password.length < 8) return bad(next, 'Password must be at least 8 characters');
    if (!confirmPassword || typeof confirmPassword !== 'string') return bad(next, 'Please confirm your password');
    if (password !== confirmPassword) return bad(next, 'Password and confirm password do not match');
    // Role: optional, defaults to user. Only user may self-register.
    if (role !== undefined && !SIGNUP_ROLES.includes(role)) {
      return bad(next, `role must be one of: ${SIGNUP_ROLES.join(', ')} (admins are provisioned internally)`);
    }

    const response = await AuthService.signup({ firstName, lastName, email, password, role: role || ROLES.USER });
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/login   (shared: user / admin)
exports.login = async (req, res, next) => {
  const { email, password, role } = req.body || {};
  try {
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) return bad(next, 'A valid email is required');
    if (!password || typeof password !== 'string') return bad(next, 'Password is required');
    if (role !== undefined && !ALL_ROLES.includes(role)) return bad(next, `role must be one of: ${ALL_ROLES.join(', ')}`);

    const response = await AuthService.login({ email, password, role });
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body || {};
  try {
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) return bad(next, 'A valid email is required');

    const response = await AuthService.forgotPassword({ email });
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/reset-password
exports.resetPassword = async (req, res, next) => {
  const { token, newPassword } = req.body || {};
  try {
    if (!token || typeof token !== 'string') return bad(next, 'Reset token is required');
    if (!newPassword || typeof newPassword !== 'string') return bad(next, 'New password is required');
    if (newPassword.length < 8) return bad(next, 'Password must be at least 8 characters');

    const response = await AuthService.resetPassword({ token: token.trim(), newPassword });
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/google
exports.google = async (req, res, next) => {
  // Accept either { idToken } or { credential } (Google Identity Services
  // posts the field as "credential").
  const idToken = (req.body && (req.body.idToken || req.body.credential)) || null;
  try {
    if (!idToken || typeof idToken !== 'string') return bad(next, 'Google idToken (credential) is required');

    const response = await AuthService.googleAuth({ idToken });
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/change-password   (authenticated, any role)
exports.changePassword = async (req, res, next) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body || {};
  try {
    if (!currentPassword || typeof currentPassword !== 'string') return bad(next, 'Current password is required');
    if (!newPassword || typeof newPassword !== 'string') return bad(next, 'New password is required');
    if (newPassword.length < 8) return bad(next, 'New password must be at least 8 characters');
    if (!confirmNewPassword || typeof confirmNewPassword !== 'string') return bad(next, 'Please confirm your new password');
    if (newPassword !== confirmNewPassword) return bad(next, 'New password and confirm password do not match');
    if (newPassword === currentPassword) return bad(next, 'New password must be different from the current password');

    const response = await AuthService.changePassword(req.user.id, { currentPassword, newPassword });
    res.sendSuccess(response.message, response.data, response.statusCode);
  } catch (error) {
    next(error);
  }
};
