/**
 * optionalAuth() — attach req.user when a valid Bearer token is present.
 * Never rejects: guests continue with req.user unset.
 *
 * Used on public routes that still need identity for premium gating
 * (e.g. POST /wallpapers/:slug/download).
 */
const { verifyToken } = require('../helpers/jwt.helper');
const prisma = require('../lib/prisma');

const optionalAuth = () => async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next();

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return next();
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.isDeleted) return next();

    if (
      user.sessionsValidFrom &&
      decoded.iat &&
      decoded.iat < Math.floor(user.sessionsValidFrom.getTime() / 1000)
    ) {
      return next();
    }

    delete user.password;
    delete user.emailVerificationToken;
    delete user.passwordResetToken;

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = optionalAuth;
