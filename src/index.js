require('./config/loadEnv'); // loads .env.local (dev) or .env.production (prod)
const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('config');
const prisma = require('./lib/prisma');

const { requestLogger, successHandler, errorHandler } = require('./helpers/response.helper');

const SERVICE = 'halalwalls-backend';
const app = express();

// Behind nginx on the VPS — trust the proxy so req.protocol / req.get('host')
// reflect the real public URL (used to build upload + download file links).
app.set('trust proxy', true);

// ── CORS — allow API calls from any origin (browser, mobile, tools) ──
// Wide-open by design. `origin: true` reflects whatever Origin the browser
// sends back in Access-Control-Allow-Origin, which (unlike a literal '*')
// also works when a client sends credentials (cookies / withCredentials).
// The SAME options must be applied to both the actual request and the
// OPTIONS preflight, otherwise the preflight and response disagree.
const corsOptions = {
  origin: true,
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization,x-vendor-id,x-api-key',
  exposedHeaders: 'Content-Length,Content-Disposition',
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // explicit preflight for all routes

// Stripe webhook — MUST receive the raw body for signature verification, so it
// is registered BEFORE express.json() (which would otherwise consume the body).
app.post(
  '/api/v1/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  require('./controllers/subscription.controller').webhook
);

// 2 MB limit accommodates browser-compressed profile avatar/banner data URLs
// (interim, until the Hostinger upload pipeline stores them as file URLs).
app.use(express.json({ limit: '2mb' }));
app.use(requestLogger);
app.use(successHandler(SERVICE));

// Serve uploaded wallpaper images from local disk (Hostinger VPS storage).
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Background processes — gated off in test mode (the cron tick must not
// fire during request/response tests).
if (process.env.NODE_ENV !== 'test') {
  require('./schedulers/token-cleanup.scheduler');
}

// ── Database (Supabase Postgres via Prisma) ──
async function connectDB() {
  await prisma.$connect();
  console.log('✅ Database connected (HalalWalls — Supabase Postgres)');
}
connectDB().catch((err) => console.error('❌ Database connection error:', err.message));

// ── API docs (Swagger UI) — off in test mode ──
if (process.env.NODE_ENV !== 'test') {
  const { mountSwagger } = require('./swagger/setup');
  mountSwagger(app);
}

// ── Routes ──
app.get('/health', (req, res) =>
  res.sendSuccess('Service healthy', { service: SERVICE, uptime: process.uptime() })
);
app.use('/api/v1/auth', require('./routes/auth.route'));
app.use('/api/v1/wallpapers', require('./routes/wallpaper.route'));
app.use('/api/v1/categories', require('./routes/category.route'));
app.use('/api/v1/resolutions', require('./routes/resolution.route'));
app.use('/api/v1/stats', require('./routes/stats.route'));
app.use('/api/v1/contact', require('./routes/contact.route'));
app.use('/api/v1/me', require('./routes/user.route'));
app.use('/api/v1/uploads', require('./routes/upload.route'));
app.use('/api/v1/admin', require('./routes/admin.route'));
app.use('/api/v1/subscriptions', require('./routes/subscription.route'));

// 404 — unmatched routes flow through the standard error envelope.
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
});

app.use(errorHandler(SERVICE));

const PORT = process.env.PORT || config.get('port');
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 ${SERVICE} (HalalWalls) running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`📖 API docs: http://localhost:${PORT}/api-docs`);
  });
}

module.exports = app;
