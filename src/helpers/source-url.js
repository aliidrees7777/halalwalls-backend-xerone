/**
 * Parse a social / credit source string into a full URL + display username.
 *
 * Examples:
 *   https://www.instagram.com/aforaleee  → { url, username: "aforaleee" }
 *   https://tiktok.com/@user             → { url, username: "user" }
 *   https://halalwalls.com               → { url, username: null }  (site root)
 *   plain text / invalid                 → { url: raw, username: null }
 */
const PATH_RESERVED = new Set([
  'p', 'reel', 'reels', 'stories', 'tv', 'status', 'watch', 'channel', 'c',
  'user', 'users', 'explore', 'tags', 'share', 'video', 'photos', 'about',
  'home', 'login', 'signup', 'in', // linkedin.com/in/… still uses next segment
]);

function parseSourceUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return { url: '', username: null };

  let url;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    url = new URL(withProto);
  } catch {
    return { url: raw, username: null };
  }

  // Drop trailing slash noise; keep query for the redirect target.
  const href = url.href;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 0) {
    return { url: href, username: null };
  }

  // LinkedIn: /in/username
  if (url.hostname.includes('linkedin.com') && parts[0]?.toLowerCase() === 'in' && parts[1]) {
    return { url: href, username: decodeURIComponent(parts[1].replace(/^@/, '')) };
  }

  const first = decodeURIComponent(parts[0].replace(/^@/, ''));
  if (!first || PATH_RESERVED.has(first.toLowerCase())) {
    return { url: href, username: null };
  }

  return { url: href, username: first };
}

module.exports = { parseSourceUrl };
