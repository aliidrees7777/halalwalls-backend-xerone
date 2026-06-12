# HalalWalls Backend

Node.js + Express + MongoDB (Mongoose) backend for the **HalalWalls** wallpaper
website. Serves a curated wallpaper catalog with categories, search, favorites,
downloads, uploads and platform stats, plus user authentication and an admin
catalog-management surface.

## Stack

- **Runtime:** Node.js + Express 4
- **Database:** MongoDB Atlas via Mongoose 8 (collections prefixed `hw_*`)
- **Auth:** JWT (`jsonwebtoken`) + bcrypt; optional Google sign-in (`google-auth-library`)
- **Storage:** Cloudflare R2 / S3 (`@aws-sdk/client-s3`) with a local `/uploads` fallback
- **Email:** SMTP (`nodemailer`) or SendGrid (`@sendgrid/mail`)
- **Validation:** Joi · **Config:** `config` · **Scheduling:** `node-cron`
- **Docs:** Swagger UI (OpenAPI 3.0)
- **Tests:** Mocha + Chai + chai-http + `mongodb-memory-server`

## Architecture

Layered MS-style structure:

```
config → routes → controllers → services → models
```

plus `helpers`, `middleware`, `schedulers`, `seed`, `swagger`, `test`. Every
request — success or error — returns the same envelope via `res.sendSuccess`
(see `src/helpers/response.helper.js`).

```
src/
  index.js          # app entry: CORS, JSON, logging, envelope, routes, swagger, db
  config/           # development.json / production.json / test.json
  routes/           # express routers (one per resource)
  controllers/      # request handlers
  services/         # business logic
  models/           # mongoose schemas (hw_* collections)
  helpers/          # response envelope, jwt, credentials, ...
  middleware/       # auth / role guards, validation
  schedulers/       # node-cron jobs (e.g. token cleanup)
  seed/seed.js      # starter categories + wallpapers
  swagger/          # OpenAPI spec + UI mount
  test/             # mocha suite (in-memory mongo)
```

## Setup

```bash
cp .env.example .env   # then fill in MONGO_URI and other values
npm install
npm run seed           # populate starter categories & sample wallpapers
npm run dev            # start dev server on http://localhost:4000
```

- **API server:** http://localhost:4000
- **Swagger UI:** http://localhost:4000/api-docs (raw OpenAPI JSON at `/api-docs.json`)
- **Tests:** `npm test` (uses an in-memory MongoDB — no real cluster needed)

## Standard response envelope

```json
{
  "status": "success",
  "statusCode": 200,
  "message": "Wallpapers fetched successfully",
  "data": {},
  "service": "halalwalls-backend",
  "method": "GET",
  "path": "/api/v1/wallpapers",
  "timestamp": "2026-06-09T10:00:00.000Z"
}
```

## API surface

Mounted under `/api/v1`:

| Prefix | Purpose |
|--------|---------|
| `/auth` | signup, login, forgot/reset password, Google, change-password |
| `/wallpapers` | public wallpaper catalog (list, detail, download) |
| `/categories` | public category list / detail |
| `/stats` | public headline platform stats |
| `/contact` | contact-form submission |
| `/me` | current user profile & favorites (Bearer) |
| `/uploads` | image upload to R2 / local (Bearer) |
| `/admin` | catalog & user management (admin role only) |

> Auth endpoints are documented in Swagger; the remaining surfaces are stubbed
> as a TODO in `src/swagger/openapi.js` and filled in during API planning.

## Roles

- **user** — self-signup via `POST /api/v1/auth/signup` (default role); JWT returned immediately, no email verification.
- **admin** — seeded / provisioned only (no self-signup); manages the catalog under `/api/v1/admin/*`.

## Environment variables

See **`.env.example`** for the full list. Key groups:

| Var | Notes |
|-----|-------|
| `NODE_ENV`, `PORT` | runtime / server port (default 4000) |
| `MONGO_URI` | MongoDB Atlas connection string (DB `HalalWalls`) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | JWT signing (default expiry 7d) |
| `PASSWORD_RESET_EXPIRES_MIN` | reset-token TTL (default 60) |
| `APP_URL` | frontend URL used in reset-email links |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | Google sign-in (CLIENT_ID required to enable; 503 until set) |
| `EMAIL_PROVIDER` (`smtp`\|`sendgrid`), `EMAIL_FROM`, `EMAIL_FROM_NAME` | email sender |
| `SMTP_*` | SMTP transport (when `EMAIL_PROVIDER=smtp`) |
| `SENDGRID_API_KEY`, `SENDGRID_RESET_TEMPLATE_ID` | SendGrid (when `EMAIL_PROVIDER=sendgrid`) |
| `R2_*` | Cloudflare R2 / S3 image storage (all five required to enable; else local `/uploads`) |
| `SWAGGER_SERVER_URL` | optional — pins the Swagger "Servers" dropdown |

## Notes

- **No email verification** — signup creates the account and returns a JWT immediately; login returns a JWT.
- **Integrations are config-gated** — Google sign-in returns `503` until `GOOGLE_CLIENT_ID` is set; uploads fall back to local `/uploads` until all `R2_*` vars are present.
- **Tests force all integrations off** and run against an in-memory MongoDB, so the suite is deterministic and never touches the real cluster.
