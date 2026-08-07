# Deploying omni-backend to Render

## Service configuration

- **Runtime:** Node
- **Repository:** `SamLams24/omni-backend`, branch `main`
- **Root Directory:** `.` (this repository's root -- not a subdirectory; that was the exact misconfiguration that broke a previous deployment of the old monorepo, see the root `docs/migration/omni-folder-removal.md` in the archived `SamLams24/omni` repo)
- **Build Command:** `pnpm install --frozen-lockfile && pnpm prisma:generate && pnpm build`
- **Pre-Deploy Command:** `pnpm prisma:migrate:deploy`
- **Start Command:** `pnpm start:prod`
- **Health Check Path:** `/api/v1/health` (public, no auth required -- returns `{"status":"ok"|"degraded","database":"up"|"down",...}`)

## Host/port binding

Nest's `app.listen(port)` (no explicit host argument) binds to `0.0.0.0` by default via Node's `http.Server`, which is what Render's proxy expects. No code change was needed for this.

## Trust proxy

**Not enabled.** Render sits in front of the app as a reverse proxy, so `req.ip` reports Render's internal proxy address rather than the real client IP. Two things in this codebase read `req.ip`: the global `ThrottlerModule` (rate limiting -- still limits correctly per upstream connection without the real IP) and `Session.ipAddress` (a non-authoritative audit field, never used for access control). Neither depends on IP accuracy for correctness, so `trust proxy` was deliberately left off rather than trusting `X-Forwarded-For` without first validating Render's exact proxy chain.

## Required environment variables

Set these in the Render service's Environment tab (never commit them):

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Render sets this automatically; the app already reads `process.env.PORT` |
| `DATABASE_URL` | Neon pooled connection string -- see `docs/deployment-neon.md` |
| `DIRECT_URL` | Neon direct (unpooled) connection string -- used only by `prisma migrate deploy` |
| `FRONTEND_URL` | the deployed Vercel frontend's origin, e.g. `https://omni-frontend.vercel.app` |
| `CORS_ORIGINS` | same as `FRONTEND_URL` (comma-separated if more than one, e.g. a custom domain plus the Vercel URL) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | long random values, generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`, never reuse the local dev values |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAME_SITE` | `lax` if frontend and backend end up on the same parent domain (recommended, see below); `none` only if they remain on fully separate domains (`*.vercel.app` + `*.onrender.com`) -- `none` additionally requires `COOKIE_SECURE=true`, which is already the case |
| `COOKIE_DOMAIN` | leave unset for separate domains; set to the shared parent domain (e.g. `.omni-domain.com`) once both apps sit under one domain |
| `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET` / `AUTH0_CALLBACK_URL` / `AUTH0_AUDIENCE` | see `docs/auth0-setup.md` -- leave unset to keep OIDC login scaffolded-but-disabled |
| `FEDAPAY_ENVIRONMENT` | `sandbox` until a real production FedaPay account exists, then `live` |
| `FEDAPAY_SECRET_KEY` / `FEDAPAY_PUBLIC_KEY` / `FEDAPAY_WEBHOOK_SECRET` | from the FedaPay dashboard |
| `OVERPASS_API_URL` | `https://overpass-api.de/api/interpreter` (default) or a self-hosted instance |
| `SWAGGER_ENABLED` | `false` in production |
| `LOG_LEVEL` | `info` |

## Manual steps I still need to do

1. Create the Render Web Service pointing at `SamLams24/omni-backend`.
2. Set every variable in the table above.
3. Set up the Neon database first (`docs/deployment-neon.md`) so `DATABASE_URL`/`DIRECT_URL` are ready before the first deploy.
4. Trigger the first deploy and confirm `/api/v1/health` returns `200`.
5. Point `omni-frontend`'s `NEXT_PUBLIC_API_URL` at the resulting Render URL.
