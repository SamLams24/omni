# Extract omni-backend and omni-web-frontend into standalone repositories

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `omni-backend/` and `omni-web-frontend/` out of the `SamLams24/omni` monorepo into two standalone, independently-buildable repositories (`SamLams24/omni-backend`, `SamLams24/omni-frontend`) ready for Render/Vercel/Neon deployment, without deleting anything from the monorepo and without any force-push.

**Architecture:** `git subtree split --prefix=<app> -b split/<app>` rewrites history so each app's own commits become a self-contained branch with the app's contents at the branch root. Standalone-readiness work (READMEs, CI, deployment docs, missing scripts, env vars) is done *inside* the monorepo's app folders first and committed there, so the subtree split carries it over automatically. Each new repo's `pnpm-lock.yaml` is generated fresh (neither app currently has its own — only the monorepo root does) after the split, in a real standalone clone, then committed and pushed as a follow-up commit.

**Tech Stack:** git subtree, pnpm 10.18.3, Node 22, GitHub Actions, NestJS 11 / Prisma 6.19.2, Next.js 16.

**Confirmed before writing this plan:**
- `git ls-remote` on both `https://github.com/SamLams24/omni-frontend.git` and `https://github.com/SamLams24/omni-backend.git` returned nothing → **both are genuinely empty**, no README/license commit to reconcile.
- Neither `omni-backend/` nor `omni-web-frontend/` has any `workspace:`, `../`, or relative-parent import/config reference — verified via grep across `apps/`, `omni-backend/src`, `omni-web-frontend/src`, `package.json`, `pnpm-workspace.yaml`.
- Only `pnpm-lock.yaml` at the **monorepo root** exists; neither app package has its own.
- `omni-backend/test/app.e2e-spec.ts` is unmodified `nest new` boilerplate — it expects `GET /` → `"Hello World!"`, which doesn't exist in this app. Running it now: **FAILS** (`expected 200, got 404`). This is fixed in Task 3, not skipped.
- `omni-backend`'s Jest unit tests (121 of them) never touch a real database — `health.service.spec.ts` mocks `PrismaService` entirely, including the "database down" case. CI does not strictly need Postgres for `pnpm test`, but Task 9's workflow adds a real Postgres service anyway because `test:e2e` (fixed in Task 3) boots the real `AppModule`, and `AppModule`'s `PrismaService.onModuleInit()` calls `$connect()`.
- `omni-backend/README.md` and `omni-web-frontend/README.md` are both untouched framework boilerplate (NestJS badge README / `create-next-app` default) — full rewrite, not "unnecessary refactor."

---

## Part 1 — Make `omni-backend` standalone-ready (inside the monorepo)

### Task 1: Add Neon `directUrl` support to Prisma

**Files:**
- Modify: `omni-backend/prisma/schema.prisma:22-25`
- Modify: `omni-backend/src/config/env.validation.ts`
- Modify: `omni-backend/.env.example`

- [ ] **Step 1: Add `directUrl` to the datasource block**

In `omni-backend/prisma/schema.prisma`, replace:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

with:

```prisma
// Neon (and other pooled Postgres providers) need two connection strings:
// DATABASE_URL is the pooled endpoint the running app uses for queries;
// DIRECT_URL is the unpooled endpoint Prisma Migrate/CLI needs, since
// schema migrations don't work reliably through a transaction-mode
// pooler (PgBouncer). Locally, both env vars simply point at the same
// plain PostgreSQL instance -- see docs/deployment-neon.md for the
// production values.
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

- [ ] **Step 2: Add `DIRECT_URL` and `AUTH0_AUDIENCE` to env validation**

In `omni-backend/src/config/env.validation.ts`, change:

```typescript
  DATABASE_URL: z.url(),
```

to:

```typescript
  DATABASE_URL: z.url(),
  // Defaults to DATABASE_URL locally (a single plain Postgres instance
  // has no pooled/direct distinction); Neon production sets this to the
  // unpooled connection string. See docs/deployment-neon.md.
  DIRECT_URL: z.url().optional(),
```

and after the existing `AUTH0_CALLBACK_URL: z.url().optional(),` line, add:

```typescript
  AUTH0_AUDIENCE: z.string().optional(),
```

- [ ] **Step 3: Update `.env.example`**

In `omni-backend/.env.example`, change:

```env
DATABASE_URL=postgresql://postgres:CHANGE_ME@localhost:5432/omni_dev?schema=public
```

to:

```env
DATABASE_URL=postgresql://postgres:CHANGE_ME@localhost:5432/omni_dev?schema=public
# Neon production only: the unpooled connection string, used by `prisma
# migrate deploy`. Leave unset locally -- Prisma falls back to
# DATABASE_URL when DIRECT_URL is absent. See docs/deployment-neon.md.
DIRECT_URL=
```

and after `AUTH0_CALLBACK_URL=`, add:

```env
AUTH0_AUDIENCE=
```

- [ ] **Step 4: Regenerate the Prisma client and verify**

Run: `cd omni-backend && npx prisma validate && npx prisma generate`
Expected: `The schema at prisma\schema.prisma is valid 🚀` then successful client generation, no errors.

- [ ] **Step 5: Typecheck**

Run: `cd omni-backend && npx tsc --noEmit -p tsconfig.json`
Expected: no output (clean).

---

### Task 2: Add the `prisma:migrate:deploy` script

**Files:**
- Modify: `omni-backend/package.json`

- [ ] **Step 1: Add the script**

In `omni-backend/package.json`, in `"scripts"`, change:

```json
    "prisma:migrate": "prisma migrate dev",
```

to:

```json
    "prisma:migrate": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
```

- [ ] **Step 2: Verify it runs against the local dev database**

Run: `cd omni-backend && pnpm prisma:migrate:deploy`
Expected: `No pending migrations to apply.` (all migrations are already applied locally from earlier work).

---

### Task 3: Fix the stale e2e test

**Files:**
- Modify: `omni-backend/test/app.e2e-spec.ts`

- [ ] **Step 1: Replace the boilerplate test with a real one**

Replace the full contents of `omni-backend/test/app.e2e-spec.ts` with:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/api/v1/health (GET) is public and reports database connectivity', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        if (res.body.status !== 'ok' && res.body.status !== 'degraded') {
          throw new Error(`Unexpected health status: ${res.body.status}`);
        }
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
```

- [ ] **Step 2: Run it against the real local database to confirm it passes for real**

Run: `cd omni-backend && npx jest --config ./test/jest-e2e.json`
Expected: `Tests: 1 passed, 1 total`.

- [ ] **Step 3: Commit is deferred to Task 13 (batched with the rest of Part 1)**

---

### Task 4: Confirm Render-compatible host/port binding

**Files:**
- Read only: `omni-backend/src/main.ts`

- [ ] **Step 1: Check the current listen call**

Run: `grep -n "app.listen" omni-backend/src/main.ts`
Expected: a line like `await app.listen(port);`.

- [ ] **Step 2: Render requires binding to `0.0.0.0`, not just a port**

Nest's `app.listen(port)` with no host binds to `0.0.0.0` by default in Node's underlying `http.Server.listen()` when no host is given as a string — this already works on Render as-is. **No code change needed.** Document this explicitly in `docs/deployment-render.md` (Task 7) instead of adding a redundant explicit `'0.0.0.0'` argument that would change nothing.

---

### Task 5: Decide and document the trust-proxy stance

**Files:**
- Read only: `omni-backend/src/main.ts`, `omni-backend/src/app.module.ts`

- [ ] **Step 1: Check what currently reads the client IP**

Run: `grep -rn "req.ip\|request.ip\|ThrottlerModule" omni-backend/src`
Expected: `ThrottlerModule.forRoot(...)` in `app.module.ts` (rate limiting) and `req.ip` in `omni-backend/src/modules/auth/auth.controller.ts`'s `sessionMeta()` helper (stored on `Session.ipAddress`, informational only, never used for access control).

- [ ] **Step 2: No code change — document the decision**

Express (which Nest's default platform wraps) does not trust `X-Forwarded-For` unless `app.set('trust proxy', ...)` is called, which this app never does. Behind Render's reverse proxy, `req.ip` will therefore report Render's internal proxy IP, not the real client IP, for both the throttler and the informational `Session.ipAddress` field. **Decision: do not enable `trust proxy`.** Neither use depends on an accurate client IP for correctness (the throttler still rate-limits per-connection; `ipAddress` is a non-authoritative audit field) — enabling it without validating Render's specific proxy chain would risk trusting a spoofable header for no real benefit here. Document this reasoning in `docs/deployment-render.md` (Task 7) so it's a recorded decision, not silence.

---

### Task 6: Write the backend README

**Files:**
- Modify: `omni-backend/README.md` (full rewrite)

- [ ] **Step 1: Replace the entire file**

Replace all of `omni-backend/README.md` with:

```markdown
# OMNI Backend

NestJS 11 API for OMNI: businesses, map/OSM, KYC, subscriptions, FedaPay payments, and a minimal admin portal, backed by PostgreSQL via Prisma.

## Stack

- NestJS 11, TypeScript strict
- Prisma 6.19.2 + PostgreSQL
- Argon2id password hashing (`@node-rs/argon2`), JWT access tokens + rotating opaque refresh tokens, HttpOnly cookies
- RBAC (`Role`/`Permission`/`UserRole`/`RolePermission`), double-submit-cookie CSRF
- Auth0/OIDC as an external identity provider only (OMNI owns its own sessions) -- see `docs/auth0-setup.md`. Currently scaffolded but non-functional: no real Auth0 tenant credentials exist in this environment.
- FedaPay (official SDK) for premium subscription payments -- USSD push with hosted-checkout fallback, idempotent webhook
- Overpass API for live OpenStreetMap data, merged with OMNI's own businesses

## Modules

`auth`, `business`, `map`, `kyc`, `subscription`, `payment`, `user` (admin user management).

## Local development

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL, JWT secrets, etc.
pnpm prisma:generate
pnpm prisma:migrate    # applies migrations to your local dev database
pnpm prisma:seed       # creates demo accounts -- see docs/setup below
pnpm start:dev
```

The API listens on `http://localhost:4000/api/v1` by default. Swagger docs at `/api/v1/docs` when `SWAGGER_ENABLED=true`.

## Testing

```bash
pnpm test        # unit tests (Jest, fully mocked -- no database needed)
pnpm test:e2e     # e2e test (boots the real app, needs a real DATABASE_URL)
pnpm lint
pnpm typecheck
pnpm build
```

## Deployment

- [`docs/deployment-render.md`](docs/deployment-render.md) -- Render (API hosting)
- [`docs/deployment-neon.md`](docs/deployment-neon.md) -- Neon (production PostgreSQL)
- [`docs/auth0-setup.md`](docs/auth0-setup.md) -- Auth0 tenant configuration (manual, not automated by this repo)

## Environment variables

See `.env.example` for the full list. Never commit a real `.env` file -- it's gitignored.
```

- [ ] **Step 2: Verify it renders sensibly**

Run: `cat omni-backend/README.md | head -5`
Expected: `# OMNI Backend` as the first line.

---

### Task 7: Write `docs/deployment-render.md`

**Files:**
- Create: `omni-backend/docs/deployment-render.md`

- [ ] **Step 1: Create the file**

Create `omni-backend/docs/deployment-render.md`:

```markdown
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
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `test -f omni-backend/docs/deployment-render.md && echo "exists"`
Expected: `exists`.

---

### Task 8: Write `docs/deployment-neon.md`

**Files:**
- Create: `omni-backend/docs/deployment-neon.md`

- [ ] **Step 1: Create the file**

Create `omni-backend/docs/deployment-neon.md`:

```markdown
# Deploying the production database to Neon

## Why two connection strings

Neon's default connection string routes through PgBouncer in transaction-pooling mode, which Prisma Migrate cannot use reliably for schema changes (it needs session-level features PgBouncer's transaction mode doesn't expose). Neon also always offers a direct (unpooled) connection string. This repo's `prisma/schema.prisma` datasource block is configured for exactly this split:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled -- used by the running app
  directUrl = env("DIRECT_URL")     // unpooled -- used by `prisma migrate deploy`
}
```

## Setup steps

1. Create a Neon project (https://console.neon.tech).
2. Create a database inside it, e.g. `omni_production`.
3. In the Neon dashboard's Connection Details panel, copy **both** connection strings:
   - The **pooled** one (hostname contains `-pooler`) → this is `DATABASE_URL`.
   - The **direct** one (no `-pooler`) → this is `DIRECT_URL`.
4. Add both as environment variables on the Render service (`docs/deployment-render.md`), never committed to git.
5. On the very first deploy, Render's Pre-Deploy Command (`pnpm prisma:migrate:deploy`) applies every migration in `prisma/migrations/` to the fresh Neon database.

## What NOT to do

- **Never run `prisma migrate dev` against Neon production** -- it's an interactive, dev-only workflow that can prompt to reset data. Production always uses `prisma migrate deploy`, which only applies already-committed, already-reviewed migration files.
- **Never run `prisma db seed` against Neon production.** The seed script (`prisma/seed.ts`) creates fixed demo accounts (`admin@omni.dev`, `vendor@omni.dev`, `buyer@omni.dev`, all with the same well-known password) that must only ever exist in local/CI databases. Production either has no seed step at all, or a separate, real admin-account-creation process outside of this script.
- **Never point CI tests at the Neon production database.** CI uses its own disposable Postgres service container (see `.github/workflows/ci.yml` and `docs/deployment-neon.md`'s CI section is intentionally absent because CI never touches Neon at all).

## Backup and rollback

Neon takes automatic point-in-time-recovery snapshots on paid tiers (check the current plan's retention window in the Neon dashboard before relying on it). For a bad migration:

1. `prisma migrate deploy` only ever *adds* new migrations forward -- it does not support an automatic "undo."
2. To roll back, write and commit a new migration that reverses the change, then deploy it the normal way (`git push` → Render pre-deploy runs it).
3. For a genuine data-loss incident, restore via Neon's point-in-time recovery from the dashboard, then re-run any migrations applied after the restore point.

## Manual steps I still need to do

1. Create the Neon project and database.
2. Copy the pooled and direct connection strings into Render's environment variables.
3. Decide and configure Neon's backup/PITR retention window for the plan in use.
```

- [ ] **Step 2: Verify**

Run: `test -f omni-backend/docs/deployment-neon.md && echo "exists"`
Expected: `exists`.

---

### Task 9: Write `docs/auth0-setup.md`

**Files:**
- Create: `omni-backend/docs/auth0-setup.md`

- [ ] **Step 1: Create the file**

Create `omni-backend/docs/auth0-setup.md`:

```markdown
# Auth0 tenant configuration

Auth0 is used **only as an OIDC identity provider** for Google/Facebook social login -- it never owns an OMNI session. `IdentityService.linkOrCreateFromOidc` (real, unit-tested) is what actually links a verified Auth0 identity to an OMNI `User` and issues OMNI's own JWT/session; `OidcController`'s `/auth/oidc/start` and `/auth/oidc/callback` routes are currently a deliberate stub returning `503 AUTH0_NOT_CONFIGURED` because no real Auth0 tenant exists yet in any environment this code has run in.

## What needs to be created manually (not automated by this repo)

1. An Auth0 tenant (or an application inside an existing one).
2. A "Regular Web Application" for `omni-backend` (the OIDC callback is handled server-side).
3. Google and Facebook social connections enabled on that application.
4. The following Application URIs, one entry per environment that needs to work:

   | Setting | Local | Vercel Preview | Production |
   |---|---|---|---|
   | Allowed Callback URLs | `http://localhost:4000/api/v1/auth/oidc/callback` | `https://<render-preview-domain>/api/v1/auth/oidc/callback` | `https://<render-production-domain>/api/v1/auth/oidc/callback` |
   | Allowed Logout URLs | `http://localhost:3000` | the Vercel preview URL | the production frontend URL |
   | Allowed Web Origins | `http://localhost:3000` | the Vercel preview URL | the production frontend URL |
   | Allowed Origins (CORS) | `http://localhost:3000` | the Vercel preview URL | the production frontend URL |

5. Copy from the Auth0 application's settings page into the backend's environment variables (`docs/deployment-render.md`):
   - `AUTH0_DOMAIN` (e.g. `your-tenant.us.auth0.com`)
   - `AUTH0_CLIENT_ID`
   - `AUTH0_CLIENT_SECRET`
   - `AUTH0_CALLBACK_URL` (must exactly match one of the Allowed Callback URLs above)
   - `AUTH0_AUDIENCE` (only if using an Auth0 API identifier; leave unset otherwise)

## What this repo does NOT do

- It does not call the Auth0 Management API to create the tenant/application/connections for you -- that's a one-time manual setup in the Auth0 dashboard.
- It does not implement the actual `openid-client`/passport-auth0 token exchange yet (`OidcController` is a stub). Wiring that up is future work once real credentials exist to test against -- see the code comments in `omni-backend/src/modules/auth/oidc.controller.ts`.

## Manual steps I still need to do

1. Create the Auth0 tenant/application and enable Google + Facebook connections.
2. Fill in the Allowed URLs table above for every environment (localhost now; Render preview/production once those domains exist).
3. Set the five `AUTH0_*` environment variables on Render.
4. Implement the real OIDC token exchange in `OidcController` once the above is done and testable.
```

- [ ] **Step 2: Verify**

Run: `test -f omni-backend/docs/auth0-setup.md && echo "exists"`
Expected: `exists`.

---

### Task 10: Add the backend CI workflow

**Files:**
- Create: `omni-backend/.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow file**

Create `omni-backend/.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: omni
          POSTGRES_PASSWORD: omni
          POSTGRES_DB: omni_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      NODE_ENV: test
      DATABASE_URL: postgresql://omni:omni@localhost:5432/omni_test?schema=public
      DIRECT_URL: postgresql://omni:omni@localhost:5432/omni_test?schema=public
      FRONTEND_URL: http://localhost:3000
      CORS_ORIGINS: http://localhost:3000
      JWT_ACCESS_SECRET: ci-only-access-secret-not-a-real-secret-value
      JWT_REFRESH_SECRET: ci-only-refresh-secret-not-a-real-secret-value

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.18.3

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma:generate
      - run: pnpm prisma:migrate:deploy
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm test:e2e
      - run: pnpm build
```

- [ ] **Step 2: Verify the YAML is syntactically valid**

Run: `cd omni-backend && node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))" 2>&1 || python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>&1 || echo "no yaml parser available locally -- validated by eye instead"`
Expected: no parse error (or the fallback message if neither parser is installed locally -- the file will still be validated for real the first time GitHub Actions runs it after the repo is pushed).

---

### Task 11: Add `render.yaml`

**Files:**
- Create: `omni-backend/render.yaml`

- [ ] **Step 1: Create the file**

Create `omni-backend/render.yaml`:

```yaml
# Render Blueprint. This declares the service shape for reproducibility;
# it does not create the service by itself and does not set secrets --
# every environment variable below with no `value` must be filled in
# manually in the Render dashboard after the service is created (or via
# `sync: false` fields, which Render always prompts for interactively).
# See docs/deployment-render.md for the full variable reference.
services:
  - type: web
    name: omni-backend
    runtime: node
    plan: starter
    region: oregon
    branch: main
    buildCommand: pnpm install --frozen-lockfile && pnpm prisma:generate && pnpm build
    preDeployCommand: pnpm prisma:migrate:deploy
    startCommand: pnpm start:prod
    healthCheckPath: /api/v1/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: DIRECT_URL
        sync: false
      - key: FRONTEND_URL
        sync: false
      - key: CORS_ORIGINS
        sync: false
      - key: JWT_ACCESS_SECRET
        generateValue: true
      - key: JWT_REFRESH_SECRET
        generateValue: true
      - key: COOKIE_SECURE
        value: "true"
      - key: COOKIE_SAME_SITE
        value: lax
      - key: FEDAPAY_ENVIRONMENT
        value: sandbox
      - key: FEDAPAY_SECRET_KEY
        sync: false
      - key: FEDAPAY_PUBLIC_KEY
        sync: false
      - key: FEDAPAY_WEBHOOK_SECRET
        sync: false
      - key: SWAGGER_ENABLED
        value: "false"
      - key: LOG_LEVEL
        value: info
```

- [ ] **Step 2: Verify no secret values are present**

Run: `grep -E "value:.*(secret|key|password)" -i omni-backend/render.yaml | grep -v "sync: false\|generateValue"`
Expected: no output (nothing matched -- confirms no real secret values were accidentally hardcoded).

---

### Task 12: Rebuild, retest, and commit Part 1

**Files:** none new -- verification and commit only.

- [ ] **Step 1: Full verification**

Run: `cd omni-backend && pnpm lint && pnpm typecheck && pnpm test && npx jest --config ./test/jest-e2e.json && pnpm build`
Expected: all green -- 121 unit tests + 1 e2e test passing, clean lint/typecheck, successful `nest build`.

- [ ] **Step 2: Commit**

```bash
git add omni-backend/
git commit -m "chore(backend): prepare NestJS app for standalone repository

Adds Neon directUrl support, a prisma:migrate:deploy script, fixes the
stale nest-new e2e boilerplate to actually test this app (GET
/api/v1/health instead of a nonexistent Hello World route), documents
the deliberate no-trust-proxy decision, and adds a real README plus
Render/Neon/Auth0 deployment docs, a CI workflow, and a render.yaml
blueprint -- all staged ahead of the repository split so subtree split
carries them over automatically."
```

---

## Part 2 — Make `omni-web-frontend` standalone-ready (inside the monorepo)

### Task 13: Rename the frontend package

**Files:**
- Modify: `omni-web-frontend/package.json`

- [ ] **Step 1: Change the name field**

In `omni-web-frontend/package.json`, change:

```json
  "name": "omni-web-frontend",
```

to:

```json
  "name": "omni-frontend",
```

- [ ] **Step 2: Verify nothing else references the old name**

Run: `grep -rn "omni-web-frontend" omni-web-frontend/ --include="*.json" --include="*.ts" --include="*.tsx" --include="*.mjs" | grep -v node_modules`
Expected: no output (the pnpm workspace filter references in the *root* `package.json`/`pnpm-workspace.yaml` are outside this app's own directory and are untouched here -- they still work today and become irrelevant once the split repo has no workspace at all).

---

### Task 14: Add Auth0 public env placeholders

**Files:**
- Modify: `omni-web-frontend/.env.example`

- [ ] **Step 1: Append the two variables**

Append to `omni-web-frontend/.env.example`:

```env

# Not yet consumed by any frontend code -- Auth0 login is scaffolded
# server-side only (see omni-backend's docs/auth0-setup.md) and has no
# client-side entry point yet. Documented here so the values are ready
# once that UI exists.
NEXT_PUBLIC_AUTH0_DOMAIN=
NEXT_PUBLIC_AUTH0_CLIENT_ID=
```

- [ ] **Step 2: Verify**

Run: `cat omni-web-frontend/.env.example`
Expected: five original lines plus the two new ones, no secrets present.

---

### Task 15: Write the frontend README

**Files:**
- Modify: `omni-web-frontend/README.md` (full rewrite)

- [ ] **Step 1: Replace the entire file**

Replace all of `omni-web-frontend/README.md` with:

```markdown
# OMNI Frontend

Next.js 16 (App Router) frontend for OMNI: an interactive map of businesses, a seller journey (create a business, submit KYC, subscribe to premium via FedaPay), a buyer journey (explore, business details), a minimal admin portal, and a delivery placeholder.

## Stack

- Next.js 16, App Router, TypeScript strict, Turbopack
- next-intl v4 -- `/fr` (default) and `/en`, every user-facing string translated
- TanStack Query for client-side data fetching/mutations
- MapLibre GL (npm package, not a CDN script) for the interactive map
- Tailwind CSS v4

## Local development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Requires `omni-backend` running locally (default `http://localhost:4000/api/v1`) -- see that repository's README.

## Testing

```bash
pnpm test        # Vitest
pnpm lint
pnpm typecheck
pnpm build
```

## Routes

- `/` -- landing page
- `/login`, `/register` -- auth
- `/map` -- interactive map (OSM + OMNI businesses)
- `/explore`, `/business/[id]` -- buyer journey
- `/profile` -- read-only user profile
- `/seller`, `/seller/business/new`, `/seller/business/[id]/kyc`, `/seller/business/[id]/subscription` -- seller journey
- `/admin`, `/admin/{users,businesses,kyc,subscriptions,payments}` -- admin portal
- `/delivery` -- visual shell only; the real delivery workflow is not implemented (shows "coming soon")

## Deployment

See [`docs/deployment-vercel.md`](docs/deployment-vercel.md).

## Environment variables

See `.env.example`. All variables here are `NEXT_PUBLIC_*` and safe to expose to the browser -- no backend secret ever belongs in this app.
```

- [ ] **Step 2: Verify**

Run: `head -3 omni-web-frontend/README.md`
Expected: `# OMNI Frontend` as the first line.

---

### Task 16: Write `docs/deployment-vercel.md`

**Files:**
- Create: `omni-web-frontend/docs/deployment-vercel.md`

- [ ] **Step 1: Create the file**

Create `omni-web-frontend/docs/deployment-vercel.md`:

```markdown
# Deploying omni-frontend to Vercel

## Project configuration

- **Framework Preset:** Next.js (auto-detected)
- **Repository:** `SamLams24/omni-frontend`, branch `main`
- **Root Directory:** `./` (this repository's root -- there is no nested app folder anymore; a previous deployment of the old monorepo broke specifically because Root Directory pointed at a stale nested path, see `docs/migration/omni-folder-removal.md` in the archived `SamLams24/omni` repo)
- **Install Command:** `pnpm install --frozen-lockfile`
- **Build Command:** `pnpm build` (Vercel's default for a detected Next.js project already runs this; no override needed unless Vercel's auto-detection is wrong)

Don't add a custom `vercel.json` unless a real, specific need comes up -- Next.js's own auto-detection on Vercel already handles routing, headers, and output correctly for this app.

## Required environment variables

| Variable | Development | Production |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://<this-project's-vercel-domain>` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api/v1` | `https://<render-backend-domain>/api/v1` |
| `NEXT_PUBLIC_MAP_DEFAULT_LAT` | `6.1319` | same (Lomé, Togo) unless the default map center changes |
| `NEXT_PUBLIC_MAP_DEFAULT_LON` | `1.2228` | same |
| `NEXT_PUBLIC_MAP_DEFAULT_ZOOM` | `13` | same |
| `NEXT_PUBLIC_AUTH0_DOMAIN` / `NEXT_PUBLIC_AUTH0_CLIENT_ID` | unset | unset until a client-side Auth0 entry point exists (see omni-backend's `docs/auth0-setup.md`) |

Set all `NEXT_PUBLIC_*` values in Vercel's Project Settings → Environment Variables, scoped per environment (Development/Preview/Production). None of these are secret -- they're inlined into the client bundle by design -- but `NEXT_PUBLIC_API_URL` still needs a different value per environment (see the Preview section below).

## Preview deployments and CORS

Vercel gives every PR/branch a unique preview URL (`omni-frontend-git-<branch>-<team>.vercel.app`). This app's `credentials: "include"` fetches only work if the backend's `CORS_ORIGINS` includes the exact preview origin, and cookies are only usable across `omni-frontend.vercel.app`-style origins if `COOKIE_SAME_SITE=none` (which additionally requires `COOKIE_SECURE=true`, see `docs/deployment-render.md`).

**Decision (documented, not left implicit):** do not add a wildcard `*.vercel.app` to the backend's `CORS_ORIGINS` -- that would let any Vercel project (not just previews of this one) send credentialed requests. Options going forward, to choose once preview testing against the live backend actually becomes a real need:
1. Point every preview at the same shared staging backend URL and add that one fixed origin to `CORS_ORIGINS`, or
2. Add a small, explicit allowlist of the specific preview URLs actually in use, updated manually.

**Production** always uses a strict, single-origin `CORS_ORIGINS` value (the real production frontend domain only).

## Manual steps I still need to do

1. Import `SamLams24/omni-frontend` into Vercel.
2. Set the environment variables in the table above (Production scope first; Preview once the CORS decision above is made).
3. Deploy `omni-backend` to Render first, so `NEXT_PUBLIC_API_URL` has a real value.
4. Trigger the first deploy and confirm the site loads and `/map` fetches real data from the deployed backend.
```

- [ ] **Step 2: Verify**

Run: `test -f omni-web-frontend/docs/deployment-vercel.md && echo "exists"`
Expected: `exists`.

---

### Task 17: Add the frontend CI workflow

**Files:**
- Create: `omni-web-frontend/.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow file**

Create `omni-web-frontend/.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    env:
      NEXT_PUBLIC_APP_URL: http://localhost:3000
      NEXT_PUBLIC_API_URL: http://localhost:4000/api/v1
      NEXT_PUBLIC_MAP_DEFAULT_LAT: "6.1319"
      NEXT_PUBLIC_MAP_DEFAULT_LON: "1.2228"
      NEXT_PUBLIC_MAP_DEFAULT_ZOOM: "13"

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.18.3

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: Verify the YAML is syntactically valid**

Run: `cd omni-web-frontend && node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))" 2>&1 || echo "no yaml parser available locally -- validated by eye instead"`
Expected: no parse error (or the fallback message).

---

### Task 18: Rebuild, retest, and commit Part 2

**Files:** none new -- verification and commit only.

- [ ] **Step 1: Full verification**

Run: `cd omni-web-frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all green -- 15 tests passing, clean lint/typecheck, successful `next build` with all 33 routes.

- [ ] **Step 2: Commit**

```bash
git add omni-web-frontend/
git commit -m "chore(frontend): prepare Next.js app for standalone repository

Renames the package to omni-frontend, documents the Vercel preview/CORS
strategy, adds Auth0 public env placeholders (not yet consumed -- no
client-side entry point exists), a real README, and a CI workflow --
all staged ahead of the repository split so subtree split carries them
over automatically."
```

---

## Part 3 — Document the transition in the historical repo

### Task 19: Note the new repositories in the root README

**Files:**
- Modify: `README.md` (repo root)

- [ ] **Step 1: Read the current root README to find a sensible insertion point**

Run: `head -30 README.md`

- [ ] **Step 2: Add a transition notice near the top**

Insert, immediately after the root README's title/first paragraph (exact surrounding text depends on Step 1's output -- insert a new section, don't replace existing content):

```markdown
> **Repository transition in progress.** `omni-backend/` and
> `omni-web-frontend/` have been extracted into two standalone
> repositories, which are now the sources of truth for development and
> deployment:
>
> - Frontend: https://github.com/SamLams24/omni-frontend
> - Backend: https://github.com/SamLams24/omni-backend
>
> This repository (`SamLams24/omni`) remains as an archive and migration
> reference for now. The `omni-backend/` and `omni-web-frontend/`
> folders here are not deleted yet -- that happens in a separate,
> later operation once the new repositories' deployments are verified.
```

- [ ] **Step 3: Commit — on `refactor/clean-next-nest-architecture` only, never on `main`**

```bash
git branch --show-current
```

Expected: `refactor/clean-next-nest-architecture`. If it prints anything else, STOP and do not commit -- this step must never run on `main`.

```bash
git add README.md
git commit -m "docs: note that omni-backend/omni-web-frontend are extracted into standalone repositories

SamLams24/omni-frontend and SamLams24/omni-backend are now the sources
of truth for those two apps. This repository stays as an archive/
migration reference; the app folders are intentionally not deleted
here yet -- that is a separate follow-up once the new repos' Vercel/
Render deployments are verified."
```

---

## Part 4 — Extract via `git subtree split`

### Task 20: Split `omni-backend` into its own branch

**Files:** none — git operation only.

- [ ] **Step 1: Run the split**

Run: `git subtree split --prefix=omni-backend -b split/omni-backend`
Expected: prints a series of commit hashes ending in one final SHA, then exits 0. This creates a new local branch `split/omni-backend` — it does not touch `refactor/clean-next-nest-architecture` or any remote.

- [ ] **Step 2: Sanity-check the split branch's root**

Run: `git ls-tree -r --name-only split/omni-backend | head -5`
Expected: paths like `package.json`, `README.md`, `src/main.ts` — i.e. `omni-backend`'s own contents sitting directly at the tree root, with no `omni-backend/` prefix anywhere.

---

### Task 21: Split `omni-web-frontend` into its own branch

**Files:** none — git operation only.

- [ ] **Step 1: Run the split**

Run: `git subtree split --prefix=omni-web-frontend -b split/omni-frontend`
Expected: same shape of output as Task 20, creates local branch `split/omni-frontend`.

- [ ] **Step 2: Sanity-check the split branch's root**

Run: `git ls-tree -r --name-only split/omni-frontend | head -5`
Expected: paths like `package.json`, `README.md`, `src/app/layout.tsx` (or similar) at the tree root.

---

## Part 5 — Push to the new repositories

### Task 22: Push `omni-backend`

**Files:** none — git operation only.

- [ ] **Step 1: Add the remote (if not already added)**

Run: `git remote add omni-backend-repo https://github.com/SamLams24/omni-backend.git 2>&1 || echo "remote already exists"`

- [ ] **Step 2: Re-confirm the remote is still empty right before pushing (state may have changed since the plan was written)**

Run: `git ls-remote omni-backend-repo`
Expected: no output. If this now shows commits, STOP — do not force-push; re-plan the push as a normal merge instead.

- [ ] **Step 3: Push as `main`**

Run: `git push omni-backend-repo split/omni-backend:main`
Expected: `* [new branch]      split/omni-backend -> main`.

---

### Task 23: Push `omni-frontend`

**Files:** none — git operation only.

- [ ] **Step 1: Add the remote**

Run: `git remote add omni-frontend-repo https://github.com/SamLams24/omni-frontend.git 2>&1 || echo "remote already exists"`

- [ ] **Step 2: Re-confirm empty**

Run: `git ls-remote omni-frontend-repo`
Expected: no output. Same STOP condition as Task 22 Step 2 if not.

- [ ] **Step 3: Push as `main`**

Run: `git push omni-frontend-repo split/omni-frontend:main`
Expected: `* [new branch]      split/omni-frontend -> main`.

---

## Part 6 — Generate standalone lockfiles

### Task 24: Generate and push the backend's own lockfile

**Files:** none in the monorepo — this operates on a fresh external clone.

- [ ] **Step 1: Clone fresh, outside the monorepo**

Run: `git clone https://github.com/SamLams24/omni-backend.git /tmp/omni-backend-lockfile-gen`

- [ ] **Step 2: Generate the lockfile**

Run: `cd /tmp/omni-backend-lockfile-gen && pnpm install`
Expected: succeeds, creates `pnpm-lock.yaml` in this clone (this app never had its own before — only the monorepo root did).

- [ ] **Step 3: Verify the app still builds with the freshly generated lockfile**

Run: `cd /tmp/omni-backend-lockfile-gen && pnpm typecheck && pnpm build`
Expected: clean typecheck, successful build — same result as inside the monorepo, proving the standalone dependency graph resolves identically.

- [ ] **Step 4: Commit and push the lockfile**

```bash
cd /tmp/omni-backend-lockfile-gen
git add pnpm-lock.yaml
git commit -m "chore: add standalone pnpm-lock.yaml

Generated fresh in a real standalone clone -- this package only ever
had a lockfile shared at the monorepo root before extraction."
git push origin main
```

---

### Task 25: Generate and push the frontend's own lockfile

**Files:** none in the monorepo — this operates on a fresh external clone.

- [ ] **Step 1: Clone fresh, outside the monorepo**

Run: `git clone https://github.com/SamLams24/omni-frontend.git /tmp/omni-frontend-lockfile-gen`

- [ ] **Step 2: Generate the lockfile**

Run: `cd /tmp/omni-frontend-lockfile-gen && pnpm install`
Expected: succeeds, creates `pnpm-lock.yaml`.

- [ ] **Step 3: Verify the app still builds**

Run: `cd /tmp/omni-frontend-lockfile-gen && cp .env.example .env.local && pnpm typecheck && pnpm build`
Expected: clean typecheck, successful `next build`.

- [ ] **Step 4: Commit and push the lockfile**

```bash
cd /tmp/omni-frontend-lockfile-gen
git add pnpm-lock.yaml
git commit -m "chore: add standalone pnpm-lock.yaml

Generated fresh in a real standalone clone -- this package only ever
had a lockfile shared at the monorepo root before extraction."
git push origin main
```

---

## Part 7 — Final clean-clone verification (the real proof of independence)

### Task 26: Re-clone both repos into brand-new directories and run the full frozen-lockfile verification

**Files:** none in the monorepo — fresh external clones, a *second* clone distinct from Tasks 24/25's (those already have node_modules from the `pnpm install` that generated the lockfile; this step proves `--frozen-lockfile` works for someone who has never touched this repo before).

- [ ] **Step 1: Clone backend fresh**

Run: `git clone https://github.com/SamLams24/omni-backend.git /tmp/omni-backend-verify`

- [ ] **Step 2: Full backend verification**

```bash
cd /tmp/omni-backend-verify
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: every command exits 0. Record PASS/FAIL for each in the final report table (Section G).

- [ ] **Step 3: Clone frontend fresh**

Run: `git clone https://github.com/SamLams24/omni-frontend.git /tmp/omni-frontend-verify`

- [ ] **Step 4: Full frontend verification**

```bash
cd /tmp/omni-frontend-verify
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
cp .env.example .env.local
pnpm build
```

Expected: every command exits 0. Record PASS/FAIL for each in the final report table.

- [ ] **Step 5: Search both fresh clones for any lingering reference to the monorepo**

Run: `grep -rln "omni-web-frontend\|\.\./omni\b\|SamLams24/omni\b" /tmp/omni-backend-verify /tmp/omni-frontend-verify --include="*.json" --include="*.ts" --include="*.tsx" --include="*.md" --include="*.yml" | grep -v node_modules`
Expected: at most the intentional README/docs mentions of `SamLams24/omni` as the archived source repo (from Tasks 6/15's READMEs, which is fine and expected) — no functional code path referencing it.

---

## Part 8 — Push the monorepo's own commits

### Task 27: Push the standalone-prep + transition-notice commits already made on `refactor/clean-next-nest-architecture`

**Files:** none — git operation only.

- [ ] **Step 1: Confirm branch and pending commits**

Run: `git status --short && git log origin/refactor/clean-next-nest-architecture..HEAD --oneline`
Expected: clean working tree; the log shows exactly the 3 commits from Tasks 12, 18, and 19.

- [ ] **Step 2: Push (normal push, no force — already explicitly authorized)**

Run: `git push origin refactor/clean-next-nest-architecture`
Expected: a normal fast-forward push, no rejection.

---

## Self-review notes (from the plan-writing skill's required self-check)

- **Spec coverage:** every numbered section of the mission (1–58) maps to a task above except: Section 40 (Playwright e2e for the frontend) — not implemented, since no browser tooling exists in this environment; documented as NOT STARTED in the final report rather than faked. Section 33 (structured logging) — no code change needed, NestJS's default Logger already writes to stdout/stderr and never logs secrets (verified: no `console.log`/`Logger.log` call anywhere logs a password, cookie, JWT, or FedaPay/DATABASE_URL value); noted as an existing-good-state finding in the final report, not a new task.
- **No placeholders:** every file-creation step above has full, real file contents, not descriptions of content.
- **Type/name consistency:** `prisma:migrate:deploy` (Task 2) is the exact script name used in `docs/deployment-render.md` (Task 7)'s Pre-Deploy Command and `render.yaml` (Task 11)'s `preDeployCommand` and the CI workflow (Task 10). `omni-frontend` (Task 13's new package name) is used consistently in Task 15's README and nowhere does a stale `omni-web-frontend` reference remain in that app's own files (checked in Task 13 Step 2).
