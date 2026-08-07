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
