# Omni repository audit

- Audit date: 2026-07-25
- Audited branch: `main`
- Baseline commit: `274ec536a4ad6a3fb962f9d582ca3fa3127b2225`

## Security Fixes (August 2026)

### Completed
- ✅ Removed all `x-user-id` header usage (insecure client-controlled identity)
- ✅ Removed all `localStorage.setItem('omni_user')` calls
- ✅ Replaced AuthGuard localStorage check with session validation
- ✅ Added comprehensive security regression tests

### Remaining
- ⚠️ Financial operations still use mock logic (protected by feature flag)
- ⚠️ No E2E tests for critical user journeys

## Executive summary

Omni has a demonstrable product concept and a substantial React web MVP, but
the repository is not yet production-ready. Its primary risks are duplicated
applications, non-reproducible dependency installation, fragmented
authentication, client-controlled identity, simulated financial operations,
unversioned database evolution, and tests that do not exercise the real
application.

## Application inventory

| Path | Purpose | Status |
| --- | --- | --- |
| `apps/web` | React Router/Vite web product | Source of truth |
| `omni/apps/web` | Divergent web copy | Legacy |
| `omni/apps/nextjs` | Next.js prototype | Experimental |
| `apps/mobile` | Expo scaffold | Non-functional |

## Critical findings

### Secrets

Production-like `.env` values were tracked in legacy directories. Deleting the
files does not invalidate credentials already present in Git history. All
affected credentials must be rotated.

### Authentication and authorization

- the custom OTP implementation accepts a fixed `123456` code;
- multiple authentication strategies coexist;
- client-side local storage is widely used as an identity source;
- many API routes trust an `x-user-id` request header;
- authorization is inconsistent across resources.

### Financial flows

Deposit and withdrawal routes contain mock-success behavior while changing
database balances. Wallet, escrow, refund, subscription, and settlement routes
must be disabled or isolated until provider-verified, idempotent flows exist.

### Dependencies

`npm ci` fails because `package-lock.json` does not match `package.json`.
`pnpm install --frozen-lockfile` also fails because the lockfile configuration
does not match the declared overrides. A clean environment cannot currently
reproduce the deployed build.

### Database

The repository contains many independent SQL setup and alteration scripts with
no authoritative migration history. Production schema state cannot be inferred
reliably from the repository.

### Tests

Current tests are primarily skeletons and mocks. Several recreate simplified
logic instead of importing real route handlers or components. There is no
reliable end-to-end safety net for critical user journeys.

## Maintainability findings

- the main map page is approximately 1,500 lines;
- landing, root, dashboard, and delivery pages contain several hundred lines
  each;
- new and old JavaScript, JSX, TypeScript, and generated integration code are
  mixed;
- data fetching and local-storage access are repeated across pages;
- React Query and Zustand are installed but not consistently applied;
- generated artifacts and temporary repair scripts are tracked.

## Product and design findings

The implemented scope extends beyond discovery into wallets, escrow, delivery,
subscriptions, disputes, KYC, and AI-assisted search. The initial production
scope must be narrowed before these high-risk modules are completed.

The existing visual direction is recognizable:

- near-black backgrounds (`#08080f`, `#050510`);
- emerald accent (`#10b981`, `#059669`);
- Space Grotesk headings;
- DM Sans or Inter body text;
- glass-like surfaces, soft borders, and map-centric interactions.

However, there is no official logo system, design-token source, asset set,
accessibility specification, or documented brand guideline.

## Recommended stabilization sequence

1. repository hygiene and credential rotation;
2. reproducible toolchain and CI;
3. authentication and authorization replacement;
4. authoritative database migrations;
5. API and domain modularization;
6. core discovery journey stabilization;
7. real integration and end-to-end tests;
8. design system and brand assets;
9. staged reintroduction of optional delivery and financial modules;
10. production observability and beta readiness review.
