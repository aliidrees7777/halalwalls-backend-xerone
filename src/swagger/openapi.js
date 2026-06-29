/**
 * OpenAPI 3.0 specification for the HalalWalls Backend.
 *
 * Hand-written (mirrors the reference service style). Every documented endpoint
 * carries a concrete request example (where it takes a body) and a concrete
 * response example using the standard envelope, so the frontend can read and
 * test each API without guessing the shape.
 *
 * SCOPE: this skeleton documents the /api/v1/auth/* surface. The wallpaper /
 * category / stats / contact / me / uploads / admin paths are intentionally
 * left as a TODO block (see bottom of `paths`) to be filled in during API
 * planning, once those route/controller contracts are finalized by the
 * route-building agent.
 */
const TS = '2026-06-09T10:00:00.000Z';

// Success envelope example
const env = (message, data, method, path, statusCode = 200) => ({
  status: 'success',
  statusCode,
  message,
  data,
  service: 'halalwalls-backend',
  method,
  path,
  timestamp: TS,
});

// Error envelope example
const err = (statusCode, message, method, path) => ({
  status: 'error',
  statusCode,
  message,
  data: null,
  service: 'halalwalls-backend',
  method,
  path,
  timestamp: TS,
});

const jsonOk = (message, data, method, path, statusCode = 200) => ({
  'application/json': { example: env(message, data, method, path, statusCode) },
});
const jsonErr = (statusCode, message, method, path) => ({
  'application/json': { example: err(statusCode, message, method, path) },
});

// ── Reusable sample entities ──
// IDs are UUIDs (Postgres/Prisma) — matching what the API actually returns.
const USER_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const SAMPLE_USER = {
  id: USER_ID,
  firstName: 'Aisha',
  lastName: 'Rahman',
  name: 'Aisha Rahman',
  email: 'aisha@example.com',
  role: 'user',
  authProvider: 'local',
  emailVerified: false,
  avatar: null,
  banner: null,
  bio: '',
  isPremium: false,
  favorites: [],
  favoritesCount: 0,
  createdAt: TS,
};
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
// Admin-facing user shape (serializeAdminUser): no favorites array, adds counts.
const SAMPLE_ADMIN_USER = {
  id: USER_ID,
  firstName: 'Aisha',
  lastName: 'Rahman',
  name: 'Aisha Rahman',
  email: 'aisha@example.com',
  role: 'user',
  authProvider: 'local',
  emailVerified: true,
  isPremium: false,
  avatar: null,
  banner: null,
  bio: 'Wallpaper enthusiast',
  favoritesCount: 3,
  uploadsCount: 1,
  createdAt: TS,
  updatedAt: TS,
};

// ── Reusable sample wallpaper entities ──
const SAMPLE_WALLPAPER_CARD = {
  id: 'a1f0c1d2-1111-4aaa-9bbb-0000000000a1',
  slug: 'neon-metropolis',
  title: 'Neon Metropolis',
  image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1200&q=80',
  category: 'space',
  resolution: '1920x1080',
  isPremium: false,
  isLive: false,
  downloadCount: 1421,
  views: 4263,
};
const SAMPLE_WALLPAPER_DETAIL = {
  ...SAMPLE_WALLPAPER_CARD,
  description: 'Neon Metropolis — Space wallpaper in stunning detail.',
  categoryLabel: 'Space',
  tags: ['neon', 'city', 'night'],
  tagSlugs: ['neon-wallpapers', 'city-wallpapers', 'night-wallpapers'],
  author: 'halalwalls',
  publishedAt: 'March 4, 2026',
  originalResolution: '1920×1080',
  originalSizeMB: 1.42,
  preferredResolution: '1920x1080',
  resolutions: ['1920x1080', '2560x1440', '3840x2160'],
  originalUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1200&q=80',
  relatedIds: ['a1f0c1d2-2222-4aaa-9bbb-0000000000a2', 'a1f0c1d2-3333-4aaa-9bbb-0000000000a3'],
};
const SAMPLE_PAGINATION = { total: 23, page: 1, limit: 18, totalPages: 2, hasNextPage: true, hasPrevPage: false };
const SAMPLE_DOWNLOAD_RESOLUTIONS = {
  desktop: [{ label: '1920×1080', width: 1920, height: 1080, fileSizeMB: 1.42, device: 'desktop' }],
  mobile: [{ label: '1080×2400', width: 1080, height: 2400, fileSizeMB: 1.64, device: 'mobile' }],
};
const SAMPLE_CONTACT_ID = 'd1e2f3a4-b5c6-4d70-8e90-0000000000c1';
const SAMPLE_WP_ID = 'a1f0c1d2-1111-4aaa-9bbb-0000000000a1';
const SAMPLE_ADMIN_WALLPAPER = {
  id: SAMPLE_WP_ID,
  title: 'Neon Metropolis',
  slug: 'neon-metropolis',
  description: 'Neon Metropolis — Space wallpaper in stunning detail.',
  category: 'Space',
  categorySlug: 'space',
  tags: ['neon', 'city', 'night'],
  image: 'https://cdn.halalwalls.com/neon.jpg',
  originalUrl: 'https://cdn.halalwalls.com/neon.jpg',
  thumbnailUrl: 'https://cdn.halalwalls.com/neon.jpg',
  resolution: '1920x1080',
  preferredResolution: '1920x1080',
  resolutions: ['1920x1080', '2560x1440', '3840x2160'],
  sizeMB: 1.42,
  width: 1920,
  height: 1080,
  author: 'HalalWalls',
  isPremium: false,
  isLive: false,
  status: 'active',
  downloadCount: 1421,
  views: 4263,
  favoritesCount: 12,
  uploadedById: USER_ID,
  uploadedBy: { id: USER_ID, name: 'Aisha Rahman', email: 'aisha@example.com' },
  createdAt: TS,
  updatedAt: TS,
};

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'HalalWalls API',
    description:
      'HalalWalls — a curated wallpaper catalog backend.\n\n' +
      '### User roles & sign-up\n' +
      '- **user** — **self-signup** via `POST /api/v1/auth/signup` (default role). A **JWT is returned immediately** so the user is signed in right away; the account starts **unverified** and a verification email is sent (`POST /api/v1/auth/verify-email`). Verification does not yet gate access.\n' +
      '- **admin** — **seeded / provisioned only — NO self-signup** (signup with `role: "admin"` is rejected). Manages the catalog under `/api/v1/admin/*`.\n\n' +
      '**Login is role-aware:** `POST /api/v1/auth/login` works for both roles and the response includes `user.role` — the frontend uses it to route to the correct view.\n\n' +
      '### Response envelope\n' +
      'Every response (success and error) uses: `status`, `statusCode`, `message`, `data`, `service`, `method`, `path`, `timestamp`.',
    version: '1.0.0',
    contact: { name: 'HalalWalls' },
  },
  // No hardcoded `servers` — Swagger UI uses the SAME origin it's served from.
  // (An explicit override is still possible via SWAGGER_SERVER_URL.)
  tags: [
    { name: 'Health', description: 'Service health' },
    { name: 'Auth', description: 'Authentication — self-signup for USER (returns a JWT immediately; account starts unverified and a verification email is sent); role-aware LOGIN for user / admin. Admins are seeded (no self-signup).' },
    { name: 'Account & Security', description: 'Change password (Bearer, any role)' },
    { name: 'Wallpapers', description: 'Public wallpaper catalog — list/search/filter (browse modes latest|popular|random|live + category slugs), detail, related, and download tracking. No auth required.' },
    { name: 'Favorites', description: 'The signed-in user\'s favorite wallpapers (Bearer token required). Adding/removing keeps each wallpaper\'s favoritesCount in sync. Idempotent.' },
    { name: 'Profile', description: 'The signed-in user\'s own profile (Bearer token): get profile + counts, update editable fields (name, bio, avatar, banner — images as URLs), and list their uploaded wallpapers.' },
    { name: 'Contact', description: 'Public "contact us" form submission.' },
    { name: 'Stats', description: 'Public aggregate counters for the landing page.' },
    { name: 'Categories', description: 'Wallpaper category taxonomy (separate from the browse filters). Public list/detail with live counts; create/update/delete are admin (operator) actions used to populate the upload form.' },
    { name: 'Resolutions', description: 'Fixed "browse by resolution" set (desktop/mobile).' },
    { name: 'Admin', description: 'CMS / admin dashboard (admin role only — Bearer token). Analytics overview, plus management of contacts, wallpapers, moderation, users, categories and favorites. Admins are seeded/provisioned, never self-registered.' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT from /api/v1/auth/login' },
    },
    schemas: {
      ApiEnvelope: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['success', 'error'] },
          statusCode: { type: 'integer' },
          message: { type: 'string' },
          data: { nullable: true },
          service: { type: 'string', example: 'halalwalls-backend' },
          method: { type: 'string' },
          path: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      UserPublic: {
        type: 'object',
        description: 'Public-safe user shape returned by auth + profile endpoints (no password/tokens).',
        properties: {
          id: { type: 'string', format: 'uuid' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          name: { type: 'string', description: 'Derived "firstName lastName".' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['user', 'admin'] },
          authProvider: { type: 'string', enum: ['local', 'google'] },
          emailVerified: { type: 'boolean' },
          avatar: { type: 'string', nullable: true, description: 'Image URL' },
          banner: { type: 'string', nullable: true, description: 'Image URL' },
          bio: { type: 'string' },
          isPremium: { type: 'boolean' },
          favorites: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'Favorited wallpaper ids' },
          favoritesCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // ── Request bodies ──
      SignupRequest: {
        type: 'object',
        description: 'Self-registration (role is always "user" — admins cannot self-register). password and confirmPassword must match.',
        required: ['firstName', 'email', 'password', 'confirmPassword'],
        properties: {
          firstName: { type: 'string', example: 'Aisha' },
          lastName: { type: 'string', example: 'Rahman' },
          email: { type: 'string', format: 'email', example: 'aisha@example.com' },
          password: { type: 'string', minLength: 8, example: 'password123' },
          confirmPassword: { type: 'string', minLength: 8, example: 'password123' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'aisha@example.com' },
          password: { type: 'string', example: 'password123' },
          role: { type: 'string', enum: ['user', 'admin'], description: 'Optional — must match the account' },
        },
      },
      EmailRequest: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email', example: 'aisha@example.com' } } },
      ResetPasswordRequest: { type: 'object', required: ['token', 'newPassword'], properties: { token: { type: 'string', example: 'bd596b3f0233a1be…' }, newPassword: { type: 'string', minLength: 8, example: 'brandnew123' } } },
      GoogleAuthRequest: { type: 'object', description: 'Provide idToken OR credential.', properties: { idToken: { type: 'string', example: 'eyJhbGciOi…' }, credential: { type: 'string' } } },
      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword', 'confirmNewPassword'],
        properties: {
          currentPassword: { type: 'string', example: 'password123' },
          newPassword: { type: 'string', minLength: 8, example: 'NewPass@456' },
          confirmNewPassword: { type: 'string', minLength: 8, example: 'NewPass@456' },
        },
      },
      // ── Wallpaper schemas ──
      Pagination: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          totalPages: { type: 'integer' },
          hasNextPage: { type: 'boolean' },
          hasPrevPage: { type: 'boolean' },
        },
      },
      WallpaperCard: {
        type: 'object',
        description: 'Grid card shape (matches the frontend Wallpaper type).',
        properties: {
          id: { type: 'string' },
          slug: { type: 'string' },
          title: { type: 'string' },
          image: { type: 'string' },
          category: { type: 'string', description: 'category slug (FilterId)', example: 'space' },
          resolution: { type: 'string', example: '1920x1080' },
          isPremium: { type: 'boolean' },
          isLive: { type: 'boolean' },
          downloadCount: { type: 'integer' },
          views: { type: 'integer' },
        },
      },
      WallpaperDetail: {
        allOf: [
          { $ref: '#/components/schemas/WallpaperCard' },
          {
            type: 'object',
            properties: {
              description: { type: 'string' },
              categoryLabel: { type: 'string', example: 'Space' },
              tags: { type: 'array', items: { type: 'string' } },
              tagSlugs: { type: 'array', items: { type: 'string' } },
              author: { type: 'string' },
              publishedAt: { type: 'string', example: 'March 4, 2026' },
              originalResolution: { type: 'string', example: '1920×1080' },
              originalSizeMB: { type: 'number' },
              preferredResolution: { type: 'string' },
              resolutions: { type: 'array', items: { type: 'string' } },
              originalUrl: { type: 'string' },
              relatedIds: { type: 'array', items: { type: 'string' } },
            },
          },
        ],
      },
    },
  },
  paths: {
    // ───────────────────────── Health ─────────────────────────
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: { 200: { description: 'Service healthy', content: jsonOk('Service healthy', { service: 'halalwalls-backend', uptime: 123.45 }, 'GET', '/health') } },
      },
    },

    // ───────────────────────── Auth ─────────────────────────
    '/api/v1/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'User signup (creates role=user)',
        description:
          'Self-registration. The account is created and a **JWT is returned immediately** (the user is signed in). ' +
          'The account starts **unverified** and a verification email is sent — confirm via `POST /api/v1/auth/verify-email`. ' +
          '`admin` cannot self-register. password and confirmPassword must match.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SignupRequest' }, example: { firstName: 'Aisha', lastName: 'Rahman', email: 'aisha@example.com', password: 'password123', confirmPassword: 'password123' } } },
        },
        responses: {
          201: { description: 'Account created (unverified); JWT returned + verification email sent', content: jsonOk('Account created. Please check your email to verify your address.', { token: TOKEN, user: SAMPLE_USER }, 'POST', '/api/v1/auth/signup', 201) },
          400: { description: 'Validation error', content: jsonErr(400, 'Password and confirm password do not match', 'POST', '/api/v1/auth/signup') },
          409: { description: 'Email already exists', content: jsonErr(409, 'An account with this email already exists', 'POST', '/api/v1/auth/signup') },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in — USER / ADMIN (one shared endpoint)',
        description:
          '**Shared sign-in for user / admin.** `data.user.role` tells the frontend which view to open. An optional `role` in the body must match the account.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
              examples: {
                user: { summary: 'User login', value: { email: 'aisha@example.com', password: 'password123', role: 'user' } },
                admin: { summary: 'Admin login (seeded)', value: { email: 'admin@halalwalls.com', password: 'Admin@123', role: 'admin' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'JWT and user returned (data.user.role identifies the role)', content: jsonOk('Logged in successfully', { token: TOKEN, user: SAMPLE_USER }, 'POST', '/api/v1/auth/login') },
          400: { description: 'Validation error', content: jsonErr(400, 'A valid email is required', 'POST', '/api/v1/auth/login') },
          401: { description: 'Invalid credentials', content: jsonErr(401, 'Invalid email or password', 'POST', '/api/v1/auth/login') },
          403: { description: 'Role mismatch (optional role did not match the account)', content: jsonErr(403, 'This account is not an admin account', 'POST', '/api/v1/auth/login') },
          409: { description: 'Account uses Google sign-in' },
        },
      },
    },
    '/api/v1/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request password reset',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/EmailRequest' }, example: { email: 'aisha@example.com' } } } },
        responses: { 200: { description: 'Generic success (no email enumeration)', content: jsonOk('If an account exists for that email, a password reset link has been sent.', null, 'POST', '/api/v1/auth/forgot-password') } },
      },
    },
    '/api/v1/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password with token',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordRequest' }, example: { token: 'bd596b3f0233a1be…', newPassword: 'brandnew123' } } } },
        responses: {
          200: { description: 'Password reset', content: jsonOk('Password has been reset successfully. You can now log in.', null, 'POST', '/api/v1/auth/reset-password') },
          400: { description: 'Invalid token', content: jsonErr(400, 'Invalid or already-used reset token', 'POST', '/api/v1/auth/reset-password') },
          410: { description: 'Token expired' },
        },
      },
    },
    '/api/v1/auth/google': {
      post: {
        tags: ['Auth'],
        summary: 'Google sign-in / sign-up',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GoogleAuthRequest' }, example: { idToken: 'eyJhbGciOi…google-id-token' } } } },
        responses: {
          200: { description: 'JWT and user returned', content: jsonOk('Signed in with Google successfully', { token: TOKEN, user: { ...SAMPLE_USER, authProvider: 'google' } }, 'POST', '/api/v1/auth/google') },
          401: { description: 'Invalid Google credential', content: jsonErr(401, 'Invalid or expired Google credential', 'POST', '/api/v1/auth/google') },
          503: { description: 'GOOGLE_CLIENT_ID not configured', content: jsonErr(503, 'Google sign-in is not configured on the server (missing GOOGLE_CLIENT_ID)', 'POST', '/api/v1/auth/google') },
        },
      },
    },

    '/api/v1/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verify email with the token from the verification link',
        description: 'Local sign-ups start unverified and receive a verification link (`APP_URL/verify-email?token=…`). Google sign-ups are verified automatically.',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['token'], properties: { token: { type: 'string', example: 'a1b2c3d4…' } } }, example: { token: 'a1b2c3d4e5f6…' } } } },
        responses: {
          200: { description: 'Email verified', content: jsonOk('Email verified successfully.', { user: { ...SAMPLE_USER, emailVerified: true } }, 'POST', '/api/v1/auth/verify-email') },
          400: { description: 'Invalid token', content: jsonErr(400, 'Invalid or already-used verification link', 'POST', '/api/v1/auth/verify-email') },
          410: { description: 'Token expired' },
        },
      },
    },

    // ───────────────────────── Account & Security ─────────────────────────
    '/api/v1/auth/resend-verification': {
      post: {
        tags: ['Account & Security'],
        summary: 'Resend the email-verification link (authenticated)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Verification email sent (or already verified)', content: jsonOk('Verification email sent. Please check your inbox.', null, 'POST', '/api/v1/auth/resend-verification') },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'POST', '/api/v1/auth/resend-verification') },
        },
      },
    },
    '/api/v1/auth/change-password': {
      post: {
        tags: ['Account & Security'],
        summary: 'Change password (authenticated, any role)',
        description: 'newPassword and confirmNewPassword must match. Returns a fresh token.',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ChangePasswordRequest' }, example: { currentPassword: 'password123', newPassword: 'NewPass@456', confirmNewPassword: 'NewPass@456' } } } },
        responses: {
          200: { description: 'Password changed; fresh token returned', content: jsonOk('Password changed successfully', { token: TOKEN }, 'POST', '/api/v1/auth/change-password') },
          400: { description: 'Validation error', content: jsonErr(400, 'New password and confirm password do not match', 'POST', '/api/v1/auth/change-password') },
          401: { description: 'Not authenticated / current password wrong', content: jsonErr(401, 'Current password is incorrect', 'POST', '/api/v1/auth/change-password') },
          409: { description: 'Google account (no password to change)' },
        },
      },
    },

    // ───────────────────────── Wallpapers ─────────────────────────
    '/api/v1/wallpapers': {
      get: {
        tags: ['Wallpapers'],
        summary: 'List / search / filter wallpapers (paginated)',
        description:
          'Public catalog. One selector drives both **browse modes** and **categories**:\n' +
          '- `category` (or `filter`) = a **browse mode** (`latest`, `popular`, `random`, `live`) **or** a **category slug** ' +
          '(`islamic, anime, superheroes, minimalist, gaming, movies, cars, sport, space`).\n' +
          '- `sort` may explicitly set the browse mode and overrides the selector.\n' +
          '- `q` searches title / category / tags. `tag` filters by an exact tag.\n' +
          'Only `status: active` wallpapers are returned.',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search title / category / tags', example: 'batman' },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Category slug OR browse mode', example: 'anime' },
          { name: 'filter', in: 'query', schema: { type: 'string' }, description: 'Alias of category (browse mode or slug)' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['latest', 'popular', 'random', 'live'] }, description: 'Explicit browse mode (overrides)' },
          { name: 'tag', in: 'query', schema: { type: 'string' }, example: 'neon' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 18, maximum: 60 } },
        ],
        responses: {
          200: {
            description: 'Paginated wallpapers',
            content: jsonOk(
              'Wallpapers fetched',
              {
                wallpapers: [SAMPLE_WALLPAPER_CARD],
                pagination: SAMPLE_PAGINATION,
                filter: { mode: 'latest', category: null, q: null, tag: null },
              },
              'GET',
              '/api/v1/wallpapers'
            ),
          },
        },
      },
    },
    '/api/v1/wallpapers/tags': {
      get: {
        tags: ['Wallpapers'],
        summary: 'Popular tags across the catalog (homepage tag pills)',
        description: 'Most-used tags across active wallpapers, with counts, most popular first. Powers the homepage tag pills.',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 24, maximum: 60 }, description: 'Max tags to return' },
        ],
        responses: {
          200: {
            description: 'Popular tags with counts',
            content: jsonOk('Tags fetched', { tags: [{ tag: 'night', count: 3 }, { tag: 'galaxy', count: 2 }, { tag: 'anime', count: 1 }] }, 'GET', '/api/v1/wallpapers/tags'),
          },
        },
      },
    },
    '/api/v1/wallpapers/{slug}': {
      get: {
        tags: ['Wallpapers'],
        summary: 'Get a wallpaper by slug (increments views)',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' }, example: 'neon-metropolis' }],
        responses: {
          200: {
            description: 'Wallpaper detail + download resolutions',
            content: jsonOk(
              'Wallpaper fetched',
              { wallpaper: SAMPLE_WALLPAPER_DETAIL, downloadResolutions: SAMPLE_DOWNLOAD_RESOLUTIONS },
              'GET',
              '/api/v1/wallpapers/neon-metropolis'
            ),
          },
          404: { description: 'Not found', content: jsonErr(404, 'Wallpaper not found', 'GET', '/api/v1/wallpapers/unknown') },
        },
      },
    },
    '/api/v1/wallpapers/{slug}/related': {
      get: {
        tags: ['Wallpapers'],
        summary: 'Related wallpapers (same category, backfilled by latest)',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' }, example: 'neon-metropolis' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 8, maximum: 24 } },
        ],
        responses: {
          200: { description: 'Related wallpapers', content: jsonOk('Related wallpapers fetched', { wallpapers: [SAMPLE_WALLPAPER_CARD] }, 'GET', '/api/v1/wallpapers/neon-metropolis/related') },
          404: { description: 'Not found', content: jsonErr(404, 'Wallpaper not found', 'GET', '/api/v1/wallpapers/unknown/related') },
        },
      },
    },
    '/api/v1/wallpapers/{slug}/download': {
      post: {
        tags: ['Wallpapers'],
        summary: 'Track a download (auth required — sign-in to download)',
        description: 'Downloading requires a signed-in user (public is visibility-only). Increments downloadCount and returns the asset URL.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' }, example: 'neon-metropolis' }],
        requestBody: {
          required: false,
          content: { 'application/json': { schema: { type: 'object', properties: { resolution: { type: 'string', example: '1920x1080' } } }, example: { resolution: '1920x1080' } } },
        },
        responses: {
          200: { description: 'Download tracked', content: jsonOk('Download tracked', { url: SAMPLE_WALLPAPER_CARD.image, downloadCount: 1422, resolution: '1920x1080' }, 'POST', '/api/v1/wallpapers/neon-metropolis/download') },
          401: { description: 'Not authenticated (guest must sign in)', content: jsonErr(401, 'Authentication required', 'POST', '/api/v1/wallpapers/neon-metropolis/download') },
          404: { description: 'Not found', content: jsonErr(404, 'Wallpaper not found', 'POST', '/api/v1/wallpapers/unknown/download') },
        },
      },
    },

    // ───────────────────────── Profile (auth) ─────────────────────────
    '/api/v1/me': {
      get: {
        tags: ['Profile'],
        summary: "Get the signed-in user's profile + counts",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Profile + favorites/uploads counts',
            content: jsonOk(
              'Profile fetched',
              {
                user: {
                  ...SAMPLE_USER,
                  bio: 'Wallpaper enthusiast',
                  favorites: ['a1f0c1d2-1111-4aaa-9bbb-0000000000a1', 'a1f0c1d2-2222-4aaa-9bbb-0000000000a2', 'a1f0c1d2-3333-4aaa-9bbb-0000000000a3'],
                  favoritesCount: 3,
                },
                favoritesCount: 3,
                uploadsCount: 1,
              },
              'GET',
              '/api/v1/me'
            ),
          },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'GET', '/api/v1/me') },
        },
      },
      patch: {
        tags: ['Profile'],
        summary: 'Update editable profile fields (name, bio, avatar, banner)',
        description: 'Only firstName/lastName (or a full `name`), bio, avatar and banner are editable. avatar/banner are image URLs. email, role and password are NOT editable here.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  name: { type: 'string', description: 'Full name; split into first/last if firstName/lastName omitted' },
                  bio: { type: 'string' },
                  avatar: { type: 'string', description: 'Image URL' },
                  banner: { type: 'string', description: 'Image URL' },
                },
              },
              example: { name: 'Aisha Rahman', bio: 'Pro artist & photographer', avatar: 'https://cdn/me.jpg', banner: 'https://cdn/banner.jpg' },
            },
          },
        },
        responses: {
          200: { description: 'Updated profile', content: jsonOk('Profile updated', { user: { ...SAMPLE_USER, name: 'Aisha Rahman', bio: 'Pro artist & photographer' } }, 'PATCH', '/api/v1/me') },
          400: { description: 'No valid fields / empty name', content: jsonErr(400, 'No valid fields to update', 'PATCH', '/api/v1/me') },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'PATCH', '/api/v1/me') },
        },
      },
    },
    '/api/v1/me/uploads': {
      get: {
        tags: ['Profile'],
        summary: "List the signed-in user's uploaded wallpapers (all statuses)",
        description: 'Returns the owner\'s uploads including pending ones (each card carries its `status`).',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "The user's uploads", content: jsonOk('Uploads fetched', { wallpapers: [{ ...SAMPLE_WALLPAPER_CARD, status: 'pending' }], count: 1 }, 'GET', '/api/v1/me/uploads') },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'GET', '/api/v1/me/uploads') },
        },
      },
    },

    // ───────────────────────── Favorites (auth) ─────────────────────────
    '/api/v1/me/favorites': {
      get: {
        tags: ['Favorites'],
        summary: "List the signed-in user's favorite wallpapers",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Favorite wallpapers', content: jsonOk('Favorites fetched', { wallpapers: [{ ...SAMPLE_WALLPAPER_CARD, isFavorite: true, favoritesCount: 12 }], count: 1 }, 'GET', '/api/v1/me/favorites') },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'GET', '/api/v1/me/favorites') },
        },
      },
    },
    '/api/v1/me/favorites/{wallpaperId}': {
      post: {
        tags: ['Favorites'],
        summary: 'Add a wallpaper to favorites (idempotent; bumps favoritesCount)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'wallpaperId', in: 'path', required: true, schema: { type: 'string' }, example: 'a1f0c1d2-1111-4aaa-9bbb-0000000000a1' }],
        responses: {
          200: { description: 'Added (or already present)', content: jsonOk('Added to favorites', { favorites: ['a1f0c1d2-1111-4aaa-9bbb-0000000000a1'], wallpaperId: 'a1f0c1d2-1111-4aaa-9bbb-0000000000a1', isFavorite: true, favoritesCount: 13 }, 'POST', '/api/v1/me/favorites/a1f0c1d2-1111-4aaa-9bbb-0000000000a1') },
          400: { description: 'Invalid wallpaper id', content: jsonErr(400, 'Invalid wallpaper id', 'POST', '/api/v1/me/favorites/xyz') },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'POST', '/api/v1/me/favorites/a1f0c1d2-1111-4aaa-9bbb-0000000000a1') },
          404: { description: 'Wallpaper not found', content: jsonErr(404, 'Wallpaper not found', 'POST', '/api/v1/me/favorites/a1f0c1d2-1111-4aaa-9bbb-0000000000a1') },
        },
      },
      delete: {
        tags: ['Favorites'],
        summary: 'Remove a wallpaper from favorites (idempotent; lowers favoritesCount)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'wallpaperId', in: 'path', required: true, schema: { type: 'string' }, example: 'a1f0c1d2-1111-4aaa-9bbb-0000000000a1' }],
        responses: {
          200: { description: 'Removed (or was not present)', content: jsonOk('Removed from favorites', { favorites: [], wallpaperId: 'a1f0c1d2-1111-4aaa-9bbb-0000000000a1', isFavorite: false, favoritesCount: 12 }, 'DELETE', '/api/v1/me/favorites/a1f0c1d2-1111-4aaa-9bbb-0000000000a1') },
          400: { description: 'Invalid wallpaper id', content: jsonErr(400, 'Invalid wallpaper id', 'DELETE', '/api/v1/me/favorites/xyz') },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'DELETE', '/api/v1/me/favorites/a1f0c1d2-1111-4aaa-9bbb-0000000000a1') },
        },
      },
    },

    // ───────────────────────── Contact ─────────────────────────
    '/api/v1/contact': {
      post: {
        tags: ['Contact'],
        summary: 'Submit a contact-us message',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'message'],
                properties: {
                  name: { type: 'string', example: 'Aisha Rahman' },
                  email: { type: 'string', format: 'email', example: 'aisha@example.com' },
                  reason: { type: 'string', example: 'Feedback' },
                  message: { type: 'string', example: 'Love the wallpapers!' },
                },
              },
              example: { name: 'Aisha Rahman', email: 'aisha@example.com', reason: 'Feedback', message: 'Love the wallpapers!' },
            },
          },
        },
        responses: {
          201: { description: 'Message received', content: jsonOk("Thanks! Your message has been received — we'll get back to you soon.", { id: 'd1e2f3a4-b5c6-4d70-8e90-0000000000c1', status: 'new' }, 'POST', '/api/v1/contact', 201) },
          400: { description: 'Validation error', content: jsonErr(400, 'Name, email and message are required', 'POST', '/api/v1/contact') },
        },
      },
    },

    // ───────────────────────── Stats ─────────────────────────
    '/api/v1/stats': {
      get: {
        tags: ['Stats'],
        summary: 'Public aggregate counters',
        description: 'Counts only active wallpapers. `totalDownloads`/`totalViews` are summed across the catalog.',
        responses: {
          200: { description: 'Aggregate stats', content: jsonOk('Stats fetched', { totalWallpapers: 23, totalDownloads: 18452, totalCategories: 9, totalViews: 55321 }, 'GET', '/api/v1/stats') },
        },
      },
    },

    // ───────────────────────── Categories ─────────────────────────
    '/api/v1/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List all categories (with live wallpaper counts)',
        responses: {
          200: {
            description: 'Categories',
            content: jsonOk('Categories fetched', { categories: [{ id: 'c1a2b3c4-d5e6-4f70-8a90-0000000000e1', name: 'Anime', slug: 'anime', description: 'Anime characters, scenes and posters.', image: null, isPremium: false, order: 2, count: 5 }] }, 'GET', '/api/v1/categories'),
          },
        },
      },
      post: {
        tags: ['Categories'],
        summary: 'Create a category (admin)',
        description: 'Operator-only. `slug` is derived from `name` if omitted. Admins are provisioned/seeded — not self-registered.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, slug: { type: 'string' }, description: { type: 'string' }, image: { type: 'string' }, order: { type: 'integer' }, isPremium: { type: 'boolean' } } }, example: { name: 'Nature', description: 'Landscapes & scenery', order: 10 } } },
        },
        responses: {
          201: { description: 'Created', content: jsonOk('Category created', { category: { id: 'c1a2b3c4-d5e6-4f70-8a90-0000000000e9', name: 'Nature', slug: 'nature', description: 'Landscapes & scenery', image: null, isPremium: false, order: 10, count: 0 } }, 'POST', '/api/v1/categories', 201) },
          400: { description: 'Name required', content: jsonErr(400, 'Category name is required', 'POST', '/api/v1/categories') },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'POST', '/api/v1/categories') },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'POST', '/api/v1/categories') },
          409: { description: 'Slug exists', content: jsonErr(409, 'A category with this slug already exists', 'POST', '/api/v1/categories') },
        },
      },
    },
    '/api/v1/categories/{slug}': {
      get: {
        tags: ['Categories'],
        summary: 'Get a category by slug (with live count)',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' }, example: 'anime' }],
        responses: {
          200: { description: 'Category', content: jsonOk('Category fetched', { category: { id: 'c1a2b3c4-d5e6-4f70-8a90-0000000000e1', name: 'Anime', slug: 'anime', description: '', image: null, isPremium: false, order: 2, count: 5 } }, 'GET', '/api/v1/categories/anime') },
          404: { description: 'Not found', content: jsonErr(404, 'Category not found', 'GET', '/api/v1/categories/unknown') },
        },
      },
      patch: {
        tags: ['Categories'],
        summary: 'Update a category (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' }, example: 'anime' }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, image: { type: 'string' }, order: { type: 'integer' }, isPremium: { type: 'boolean' } } }, example: { description: 'Updated description', order: 3 } } } },
        responses: {
          200: { description: 'Updated', content: jsonOk('Category updated', { category: { id: 'c1a2b3c4-d5e6-4f70-8a90-0000000000e1', name: 'Anime', slug: 'anime', description: 'Updated description', image: null, isPremium: false, order: 3, count: 5 } }, 'PATCH', '/api/v1/categories/anime') },
          404: { description: 'Not found', content: jsonErr(404, 'Category not found', 'PATCH', '/api/v1/categories/unknown') },
        },
      },
      delete: {
        tags: ['Categories'],
        summary: 'Delete a category (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' }, example: 'nature' }],
        responses: {
          200: { description: 'Deleted', content: jsonOk('Category deleted', { slug: 'nature', orphanedWallpapers: 0 }, 'DELETE', '/api/v1/categories/nature') },
          404: { description: 'Not found', content: jsonErr(404, 'Category not found', 'DELETE', '/api/v1/categories/unknown') },
        },
      },
    },

    // ───────────────────────── Resolutions ─────────────────────────
    '/api/v1/resolutions': {
      get: {
        tags: ['Resolutions'],
        summary: 'Fixed browse-by-resolution set (desktop/mobile)',
        responses: {
          200: { description: 'Resolution chips', content: jsonOk('Resolutions fetched', { desktop: ['1920×1080', '2560×1440', '3840×2160'], mobile: ['1080×2400', '1290×2796', '1320×2868'] }, 'GET', '/api/v1/resolutions') },
        },
      },
    },

    // ───────────────────────── Admin / CMS ─────────────────────────
    '/api/v1/admin/overview': {
      get: {
        tags: ['Admin'],
        summary: 'Dashboard analytics overview (admin)',
        description: 'Aggregate counters for the CMS dashboard: users, wallpapers (by status), categories, contacts (by status) and engagement totals. Admin only.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Aggregate counts',
            content: jsonOk(
              'Admin overview',
              {
                users: { total: 128, admins: 2, regular: 126, premium: 14, verified: 110, unverified: 18 },
                wallpapers: { total: 240, active: 210, pending: 8, hidden: 22, live: 12, premium: 30 },
                categories: { total: 9 },
                contacts: { total: 17, new: 5, read: 9, resolved: 3 },
                engagement: { totalDownloads: 38801, totalViews: 116405, totalFavorites: 542 },
              },
              'GET',
              '/api/v1/admin/overview'
            ),
          },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'GET', '/api/v1/admin/overview') },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'GET', '/api/v1/admin/overview') },
        },
      },
    },
    '/api/v1/admin/contacts': {
      get: {
        tags: ['Admin'],
        summary: 'List inbound contact messages (admin)',
        description: 'Paginated list of contact-form submissions, newest first. Filter by `status` and/or search `q` (email/name/message).',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['new', 'read', 'resolved'] }, description: 'Filter by status' },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search email / name / message' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          200: {
            description: 'Paginated contacts',
            content: jsonOk(
              'Contacts fetched',
              {
                contacts: [{ id: SAMPLE_CONTACT_ID, name: 'Aisha Rahman', email: 'aisha@example.com', reason: 'Feedback', message: 'Love the wallpapers!', status: 'new', createdAt: TS }],
                pagination: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false },
              },
              'GET',
              '/api/v1/admin/contacts'
            ),
          },
          400: { description: 'Invalid status filter', content: jsonErr(400, 'status must be one of: new, read, resolved', 'GET', '/api/v1/admin/contacts') },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'GET', '/api/v1/admin/contacts') },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'GET', '/api/v1/admin/contacts') },
        },
      },
    },
    '/api/v1/admin/contacts/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Update a contact message status (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: SAMPLE_CONTACT_ID }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['new', 'read', 'resolved'] } } }, example: { status: 'resolved' } } },
        },
        responses: {
          200: { description: 'Updated', content: jsonOk('Contact updated', { contact: { id: SAMPLE_CONTACT_ID, name: 'Aisha Rahman', email: 'aisha@example.com', reason: 'Feedback', message: 'Love the wallpapers!', status: 'resolved', createdAt: TS } }, 'PATCH', `/api/v1/admin/contacts/${SAMPLE_CONTACT_ID}`) },
          400: { description: 'Invalid status / id', content: jsonErr(400, 'status is required and must be one of: new, read, resolved', 'PATCH', `/api/v1/admin/contacts/${SAMPLE_CONTACT_ID}`) },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'PATCH', `/api/v1/admin/contacts/${SAMPLE_CONTACT_ID}`) },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'PATCH', `/api/v1/admin/contacts/${SAMPLE_CONTACT_ID}`) },
          404: { description: 'Not found', content: jsonErr(404, 'Contact not found', 'PATCH', `/api/v1/admin/contacts/${SAMPLE_CONTACT_ID}`) },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete a contact message (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: SAMPLE_CONTACT_ID }],
        responses: {
          200: { description: 'Deleted', content: jsonOk('Contact deleted', { id: SAMPLE_CONTACT_ID }, 'DELETE', `/api/v1/admin/contacts/${SAMPLE_CONTACT_ID}`) },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'DELETE', `/api/v1/admin/contacts/${SAMPLE_CONTACT_ID}`) },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'DELETE', `/api/v1/admin/contacts/${SAMPLE_CONTACT_ID}`) },
          404: { description: 'Not found', content: jsonErr(404, 'Contact not found', 'DELETE', `/api/v1/admin/contacts/${SAMPLE_CONTACT_ID}`) },
        },
      },
    },

    '/api/v1/admin/wallpapers': {
      get: {
        tags: ['Admin'],
        summary: 'List wallpapers — all statuses (admin)',
        description: 'Full catalog management view (active + pending + hidden). Search/filter/sort/paginate. Unlike the public list, this returns every status and the full record incl. uploader.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'pending', 'hidden'] } },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'categorySlug' },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search title / category / tags' },
          { name: 'isPremium', in: 'query', schema: { type: 'boolean' } },
          { name: 'isLive', in: 'query', schema: { type: 'boolean' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['latest', 'oldest', 'popular', 'views', 'title'], default: 'latest' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          200: {
            description: 'Paginated wallpapers (all statuses)',
            content: jsonOk('Wallpapers fetched', { wallpapers: [SAMPLE_ADMIN_WALLPAPER], pagination: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false } }, 'GET', '/api/v1/admin/wallpapers'),
          },
          400: { description: 'Invalid status', content: jsonErr(400, 'status must be one of: active, pending, hidden', 'GET', '/api/v1/admin/wallpapers') },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'GET', '/api/v1/admin/wallpapers') },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'GET', '/api/v1/admin/wallpapers') },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a wallpaper from metadata + image URL (admin)',
        description: 'Creates a catalog wallpaper. The image is provided as a URL (the media-upload/processing pipeline is separate). `slug` is derived from `title` and auto-uniquified. Defaults `status` to `active`.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'image'],
                properties: {
                  title: { type: 'string' },
                  image: { type: 'string', description: 'Image URL (required)' },
                  slug: { type: 'string', description: 'Optional; derived from title if omitted' },
                  description: { type: 'string' },
                  category: { type: 'string', description: 'Display label; derived from categorySlug if omitted' },
                  categorySlug: { type: 'string', example: 'space' },
                  tags: { type: 'array', items: { type: 'string' } },
                  originalUrl: { type: 'string' },
                  thumbnailUrl: { type: 'string' },
                  resolution: { type: 'string', example: '1920x1080' },
                  resolutions: { type: 'array', items: { type: 'string' } },
                  sizeMB: { type: 'number' },
                  width: { type: 'integer' },
                  height: { type: 'integer' },
                  author: { type: 'string' },
                  isPremium: { type: 'boolean' },
                  isLive: { type: 'boolean' },
                  status: { type: 'string', enum: ['active', 'pending', 'hidden'], default: 'active' },
                },
              },
              example: { title: 'Neon Metropolis', image: 'https://cdn.halalwalls.com/neon.jpg', categorySlug: 'space', tags: ['neon', 'city', 'night'], resolution: '1920x1080' },
            },
          },
        },
        responses: {
          201: { description: 'Created', content: jsonOk('Wallpaper created', { wallpaper: SAMPLE_ADMIN_WALLPAPER }, 'POST', '/api/v1/admin/wallpapers', 201) },
          400: { description: 'Validation error', content: jsonErr(400, 'An image URL is required', 'POST', '/api/v1/admin/wallpapers') },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'POST', '/api/v1/admin/wallpapers') },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'POST', '/api/v1/admin/wallpapers') },
        },
      },
    },
    '/api/v1/admin/wallpapers/pending': {
      get: {
        tags: ['Admin'],
        summary: 'Moderation queue — pending submissions (admin)',
        description: 'User-submitted wallpapers awaiting review (status = pending), oldest first. Approve/reject them via the endpoints below.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          200: { description: 'Pending wallpapers', content: jsonOk('Pending wallpapers fetched', { wallpapers: [{ ...SAMPLE_ADMIN_WALLPAPER, status: 'pending' }], pagination: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false } }, 'GET', '/api/v1/admin/wallpapers/pending') },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'GET', '/api/v1/admin/wallpapers/pending') },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'GET', '/api/v1/admin/wallpapers/pending') },
        },
      },
    },
    '/api/v1/admin/wallpapers/{id}': {
      get: {
        tags: ['Admin'],
        summary: 'Get a wallpaper by id — any status (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: SAMPLE_WP_ID }],
        responses: {
          200: { description: 'Wallpaper', content: jsonOk('Wallpaper fetched', { wallpaper: SAMPLE_ADMIN_WALLPAPER }, 'GET', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}`) },
          400: { description: 'Invalid id', content: jsonErr(400, 'Invalid wallpaper id', 'GET', '/api/v1/admin/wallpapers/not-a-uuid') },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'GET', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}`) },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'GET', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}`) },
          404: { description: 'Not found', content: jsonErr(404, 'Wallpaper not found', 'GET', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}`) },
        },
      },
      patch: {
        tags: ['Admin'],
        summary: 'Update a wallpaper (admin)',
        description: 'Update any editable field, including `status`, `isPremium`, `isLive`, tags and image URLs. Changing `slug` to one already in use returns 409.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: SAMPLE_WP_ID }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, slug: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' }, categorySlug: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, image: { type: 'string' }, originalUrl: { type: 'string' }, thumbnailUrl: { type: 'string' }, resolution: { type: 'string' }, preferredResolution: { type: 'string' }, resolutions: { type: 'array', items: { type: 'string' } }, sizeMB: { type: 'number' }, width: { type: 'integer' }, height: { type: 'integer' }, author: { type: 'string' }, isPremium: { type: 'boolean' }, isLive: { type: 'boolean' }, status: { type: 'string', enum: ['active', 'pending', 'hidden'] } } }, example: { title: 'Neon Metropolis (Remastered)', status: 'active', isPremium: true } } },
        },
        responses: {
          200: { description: 'Updated', content: jsonOk('Wallpaper updated', { wallpaper: { ...SAMPLE_ADMIN_WALLPAPER, isPremium: true } }, 'PATCH', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}`) },
          400: { description: 'Validation error', content: jsonErr(400, 'status must be one of: active, pending, hidden', 'PATCH', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}`) },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'PATCH', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}`) },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'PATCH', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}`) },
          404: { description: 'Not found', content: jsonErr(404, 'Wallpaper not found', 'PATCH', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}`) },
          409: { description: 'Slug already exists', content: jsonErr(409, 'A wallpaper with this slug already exists', 'PATCH', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}`) },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete a wallpaper (admin)',
        description: 'Permanently deletes the wallpaper. Its favorites are removed automatically (cascade).',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: SAMPLE_WP_ID }],
        responses: {
          200: { description: 'Deleted', content: jsonOk('Wallpaper deleted', { id: SAMPLE_WP_ID }, 'DELETE', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}`) },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'DELETE', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}`) },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'DELETE', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}`) },
          404: { description: 'Not found', content: jsonErr(404, 'Wallpaper not found', 'DELETE', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}`) },
        },
      },
    },
    '/api/v1/admin/wallpapers/{id}/approve': {
      patch: {
        tags: ['Admin'],
        summary: 'Approve a pending wallpaper → active (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: SAMPLE_WP_ID }],
        responses: {
          200: { description: 'Approved (status → active)', content: jsonOk('Wallpaper approved', { wallpaper: { ...SAMPLE_ADMIN_WALLPAPER, status: 'active' } }, 'PATCH', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}/approve`) },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'PATCH', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}/approve`) },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'PATCH', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}/approve`) },
          404: { description: 'Not found', content: jsonErr(404, 'Wallpaper not found', 'PATCH', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}/approve`) },
        },
      },
    },
    '/api/v1/admin/wallpapers/{id}/reject': {
      patch: {
        tags: ['Admin'],
        summary: 'Reject a pending wallpaper → hidden (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: SAMPLE_WP_ID }],
        responses: {
          200: { description: 'Rejected (status → hidden)', content: jsonOk('Wallpaper rejected', { wallpaper: { ...SAMPLE_ADMIN_WALLPAPER, status: 'hidden' } }, 'PATCH', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}/reject`) },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'PATCH', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}/reject`) },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'PATCH', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}/reject`) },
          404: { description: 'Not found', content: jsonErr(404, 'Wallpaper not found', 'PATCH', `/api/v1/admin/wallpapers/${SAMPLE_WP_ID}/reject`) },
        },
      },
    },

    '/api/v1/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List users — search / filter / paginate (admin)',
        description: 'Each user includes `favoritesCount` and `uploadsCount`. Filter by `role`, `verified`, `isPremium`; search `q` (email/first/last name).',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['user', 'admin'] } },
          { name: 'verified', in: 'query', schema: { type: 'boolean' }, description: 'Filter by emailVerified' },
          { name: 'isPremium', in: 'query', schema: { type: 'boolean' } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search email / first / last name' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          200: {
            description: 'Paginated users',
            content: jsonOk('Users fetched', { users: [SAMPLE_ADMIN_USER], pagination: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false } }, 'GET', '/api/v1/admin/users'),
          },
          400: { description: 'Invalid role filter', content: jsonErr(400, 'role must be one of: user, admin', 'GET', '/api/v1/admin/users') },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'GET', '/api/v1/admin/users') },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'GET', '/api/v1/admin/users') },
        },
      },
    },
    '/api/v1/admin/users/{id}': {
      get: {
        tags: ['Admin'],
        summary: 'Get a user by id + counts (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: USER_ID }],
        responses: {
          200: { description: 'User', content: jsonOk('User fetched', { user: SAMPLE_ADMIN_USER }, 'GET', `/api/v1/admin/users/${USER_ID}`) },
          400: { description: 'Invalid id', content: jsonErr(400, 'Invalid user id', 'GET', '/api/v1/admin/users/not-a-uuid') },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'GET', `/api/v1/admin/users/${USER_ID}`) },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'GET', `/api/v1/admin/users/${USER_ID}`) },
          404: { description: 'Not found', content: jsonErr(404, 'User not found', 'GET', `/api/v1/admin/users/${USER_ID}`) },
        },
      },
      patch: {
        tags: ['Admin'],
        summary: 'Update a user — account fields only (admin)',
        description: 'Editable fields: firstName, lastName, bio, avatar, banner. **Role and premium are NOT editable here** (premium is subscription-driven; role is provisioned).',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: USER_ID }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { firstName: { type: 'string' }, lastName: { type: 'string' }, bio: { type: 'string' }, avatar: { type: 'string' }, banner: { type: 'string' } } }, example: { firstName: 'Aisha', bio: 'Updated by admin' } } },
        },
        responses: {
          200: { description: 'Updated', content: jsonOk('User updated', { user: { ...SAMPLE_ADMIN_USER, bio: 'Updated by admin' } }, 'PATCH', `/api/v1/admin/users/${USER_ID}`) },
          400: { description: 'No valid fields / empty name', content: jsonErr(400, 'No valid fields to update (allowed: firstName, lastName, bio, avatar, banner)', 'PATCH', `/api/v1/admin/users/${USER_ID}`) },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'PATCH', `/api/v1/admin/users/${USER_ID}`) },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'PATCH', `/api/v1/admin/users/${USER_ID}`) },
          404: { description: 'Not found', content: jsonErr(404, 'User not found', 'PATCH', `/api/v1/admin/users/${USER_ID}`) },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete a user (admin)',
        description: 'Safety guards: an admin cannot delete their own account, and the last remaining admin cannot be deleted. The user’s favorites are removed (cascade); wallpapers they uploaded are kept (uploader set to null).',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: USER_ID }],
        responses: {
          200: { description: 'Deleted', content: jsonOk('User deleted', { id: USER_ID }, 'DELETE', `/api/v1/admin/users/${USER_ID}`) },
          400: { description: 'Guard hit (self-delete / last admin)', content: jsonErr(400, 'You cannot delete your own account', 'DELETE', `/api/v1/admin/users/${USER_ID}`) },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'DELETE', `/api/v1/admin/users/${USER_ID}`) },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'DELETE', `/api/v1/admin/users/${USER_ID}`) },
          404: { description: 'Not found', content: jsonErr(404, 'User not found', 'DELETE', `/api/v1/admin/users/${USER_ID}`) },
        },
      },
    },
    '/api/v1/admin/favorites': {
      get: {
        tags: ['Admin'],
        summary: 'Favorites analytics — most-favorited wallpapers (admin)',
        description: 'Read-only ranking of wallpapers by favorite count (from the join table), highest first. Zero-favorite wallpapers are excluded. Paginated.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          200: {
            description: 'Ranked wallpapers + counts',
            content: jsonOk(
              'Favorites analytics fetched',
              {
                wallpapers: [
                  { id: SAMPLE_WP_ID, favorites: 42, title: 'Neon Metropolis', slug: 'neon-metropolis', image: 'https://cdn.halalwalls.com/neon.jpg', category: 'space', status: 'active' },
                ],
                pagination: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false },
              },
              'GET',
              '/api/v1/admin/favorites'
            ),
          },
          401: { description: 'Not authenticated', content: jsonErr(401, 'Authentication required', 'GET', '/api/v1/admin/favorites') },
          403: { description: 'Not an admin', content: jsonErr(403, 'You do not have permission to access this resource', 'GET', '/api/v1/admin/favorites') },
        },
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // Admin/CMS CRUD plan — all quarters' endpoints are now documented above.
    // Categories management lives under the public-style /api/v1/categories
    // paths (create/update/delete are admin-guarded).
    // Parked (needs credentials / media pipeline):
    //   Uploads — POST /api/v1/uploads  (image processing → Hostinger VPS storage)
    // ─────────────────────────────────────────────────────────────────────
  },
};
