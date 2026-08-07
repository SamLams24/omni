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
