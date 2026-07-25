# ADR-001: Establish the web source of truth

- Status: accepted for stabilization
- Date: 2026-07-25

## Context

The repository contains multiple divergent implementations:

- `apps/web`, a React Router/Vite application;
- `omni/apps/web`, an older divergent copy;
- `omni/apps/nextjs`, an experimental Next.js application;
- `apps/mobile`, an Expo scaffold.

This prevents reliable onboarding, testing, deployment, and ownership.

## Decision

`apps/web` is the only web product source of truth during stabilization.

All fixes and new product work must target `apps/web`. The Vercel project must
use `apps/web` as its root directory.

Legacy and experimental directories remain temporarily available for comparison
and migration analysis. They must not receive new features. Their removal will
be proposed in a separate pull request after confirming that they contain no
production-only code or deployment dependency.

The mobile scaffold is not considered a supported client until the web API and
authentication contracts are stable.

## Consequences

- New contributors have one clear entry point.
- Duplicate code can be compared and removed deliberately.
- Dependency management can be normalized within `apps/web`.
- Authentication, data access, and API contracts can be refactored once rather
  than across multiple prototypes.
- Any Vercel configuration pointing to a nested legacy directory must be
  migrated before that directory is deleted.

## Follow-up decisions

Separate ADRs will decide:

1. package manager and Node.js version;
2. authentication and authorization architecture;
3. database migration tooling;
4. API boundaries and versioning;
5. PWA-first versus native mobile delivery;
6. handling of wallet, payment, escrow, and delivery modules.
