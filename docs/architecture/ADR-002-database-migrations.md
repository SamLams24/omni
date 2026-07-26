# ADR-002: Version the PostgreSQL schema

- Status: accepted for stabilization
- Date: 2026-07-26

## Context

The web application previously contained independent setup, reset, and
alteration scripts for the same tables. Their execution order was undocumented,
some definitions contradicted each other, and schema state could not be derived
from the repository. The largest setup script also mixed schema changes,
backfills, demo users, and demo products.

## Decision

`apps/web/db/migrations` is the only authoritative schema history.

- Migration files use the immutable `NNNN_name.sql` format.
- `pnpm db:migrate` applies pending files in lexical order.
- Every applied version, name, SHA-256 checksum, and timestamp is recorded in
  `schema_migrations`.
- A PostgreSQL advisory lock prevents concurrent deploys from applying the same
  migration.
- Each migration runs in its own transaction and rolls back on failure.
- A changed checksum or a database version missing locally stops deployment.
- Migrations are an explicit deployment operation. Application startup never
  applies them automatically.
- Development data lives in `db/seeds` and is never applied by migration.

The baseline creates the current application schema in dependency order. It is
also deliberately compatible with the known MVP database: missing columns are
added, existing vendors receive a facility, request price snapshots are
backfilled, and existing users receive empty wallets. Legacy authentication
tables are not recreated because Neon Auth is now the authentication authority.

Existing message foreign keys are redirected to application users as `NOT
VALID`: new writes are protected immediately while historical rows can be
audited before a later migration validates the constraints.

## Deployment procedure

1. Back up the target Neon database.
2. Configure `DATABASE_URL` for the intended environment.
3. Run `pnpm db:migrate:status` and review pending versions.
4. Run `pnpm db:migrate`.
5. Deploy the application only after migration succeeds.

Demo data requires both a non-production environment and
`ALLOW_DEVELOPMENT_SEED=true`.

## Consequences

- New environments can reproduce one reviewed schema.
- Production drift becomes visible instead of being silently overwritten.
- Concurrent deployments cannot race migrations.
- Schema changes now require explicit, forward-only migration review.
- Historical data that does not satisfy the new message foreign keys must be
  reconciled before those constraints can be validated.
