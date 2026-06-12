const jwt = require('jsonwebtoken');
const config = require('config');

const getSecret = () =>
  process.env.JWT_SECRET || (config.has('jwtSecret') ? config.get('jwtSecret') : 'dev-secret');

const getExpiry = () =>
  process.env.JWT_EXPIRES_IN || (config.has('jwtExpiresIn') ? config.get('jwtExpiresIn') : '7d');

// Sign a short-lived access token. Payload carries the minimum needed to
// identify the user + their role on subsequent requests.
exports.signAccessToken = (user) =>
  jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    getSecret(),
    { expiresIn: getExpiry() }
  );

exports.verifyToken = (token) => jwt.verify(token, getSecret());
