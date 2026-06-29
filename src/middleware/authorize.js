/**
 * authorize() — JWT bearer-token guard + RBAC (STRICT role isolation).
 *
 * Roles: admin / user (see helpers/roles.js). Each role can ONLY access routes
 * for its own portal — there is NO cross-role access:
 *   • allowedRoles = []        → any authenticated user (shared, e.g. change-password).
 *   • allowedRoles = ['user']  → users only (admin → 403).
 *   • allowedRoles = ['admin'] → admins only.
 *
 * Usage:  router.get('/me', authorize(), controller.me)
 *         router.post('/x', authorize(['admin']), controller.x)
 */
const { verifyToken } = require('../helpers/jwt.helper');
const prisma = require('../lib/prisma');

const authorize = (allowedRoles = []) => async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      const error = new Error('Invalid or expired token');
      error.statusCode = 401;
      return next(error);
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      const error = new Error('User no longer exists');
      error.statusCode = 401;
      return next(error);
    }

    // "Log out of all devices" — reject tokens issued before sessionsValidFrom.
    // Second-granularity (iat is in seconds) so a token re-issued by
    // change-password (same second) stays valid while older ones are rejected.
    if (user.sessionsValidFrom && decoded.iat && decoded.iat < Math.floor(user.sessionsValidFrom.getTime() / 1000)) {
      const error = new Error('Session expired — please log in again');
      error.statusCode = 401;
      return next(error);
    }

    // RBAC (strict): the role must be explicitly allowed — no cross-role access.
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      const error = new Error('You do not have permission to access this resource');
      error.statusCode = 403;
      return next(error);
    }

    // Don't carry secrets on req.user.
    delete user.password;
    delete user.emailVerificationToken;
    delete user.passwordResetToken;

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authorize;
