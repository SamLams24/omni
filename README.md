# Omni

Omni is a hyperlocal discovery platform for finding businesses, services, and
available products around a user's current location.

> Repository status: active product stabilization. The current codebase is an
> MVP and must not yet be treated as production-ready.

## Source of truth

The maintained application currently lives in:

```text
apps/web
```

It is a React Router 7 application built with Vite and deployed on Vercel. It
uses Neon PostgreSQL/PostGIS for geospatial data.

The following directories are not production sources:

- `omni/apps/web`: legacy divergent copy of the web MVP;
- `omni/apps/nextjs`: experimental Next.js prototype;
- `apps/mobile`: Expo scaffold, not a functional mobile application yet.

Do not add features to a legacy or experimental directory. See
[`docs/architecture/ADR-001-source-of-truth.md`](docs/architecture/ADR-001-source-of-truth.md).

## Current capabilities

- interactive map and geolocation;
- nearby business and product search;
- business, facility, and product management;
- availability requests and messaging;
- early implementations of favorites, reviews, delivery, subscriptions, and
  wallet flows.

Some flows are incomplete or simulated. In particular, OTP authentication and
financial operations must not be considered production-ready.

## Local development

Omni web uses Node.js 22 and pnpm 11.7.0. From the repository root:

```bash
corepack enable
cd apps/web
pnpm install --frozen-lockfile
pnpm dev
```

Never commit local `.env` files. Start from `apps/web/.env.example` and keep
real values in the deployment platform or your local secret store.

Before opening a pull request, run:

```bash
cd apps/web
pnpm validate
```

## Documentation

- [Repository audit](docs/REPOSITORY_AUDIT.md)
- [Architecture decision: source of truth](docs/architecture/ADR-001-source-of-truth.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Product requirements](OMNI_PRD_v1.0.md)

## Contributing

All changes go through short-lived branches and pull requests. Before starting
work, read [CONTRIBUTING.md](CONTRIBUTING.md).
