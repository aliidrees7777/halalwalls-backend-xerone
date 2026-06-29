/**
 * Google OAuth helper — verifies a Google ID token (the "credential" the
 * Google Identity Services button returns on the frontend) server-side.
 *
 * This is the proper, recommended server verification flow: the frontend
 * does the OAuth dance with Google and posts us the resulting ID token; we
 * cryptographically verify it against Google's public keys and confirm the
 * audience matches OUR client id. No client secret is required for ID-token
 * verification.
 */
const { OAuth2Client } = require('google-auth-library');
const { getReal } = require('./credentials.helper');

// Returns a REAL client id, or '' if only a placeholder/dummy is present
// (in which case the endpoint reports "not configured" cleanly).
const getClientId = () => getReal('GOOGLE_CLIENT_ID', 'googleClientId');

exports.verifyGoogleIdToken = async (idToken) => {
  const clientId = getClientId();

  if (!clientId) {
    const error = new Error('Google sign-in is not configured on the server (missing GOOGLE_CLIENT_ID)');
    error.statusCode = 503;
    throw error;
  }

  const client = new OAuth2Client(clientId);

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch (err) {
    const error = new Error('Invalid or expired Google credential');
    error.statusCode = 401;
    throw error;
  }

  if (!payload || !payload.email) {
    const error = new Error('Google credential did not contain an email');
    error.statusCode = 401;
    throw error;
  }

  return {
    googleId: payload.sub,
    email: String(payload.email).toLowerCase(),
    emailVerified: !!payload.email_verified,
    firstName: payload.given_name || payload.name || 'User',
    lastName: payload.family_name || '',
    avatar: payload.picture || null,
  };
};
