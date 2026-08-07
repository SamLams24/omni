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
- **Never point CI tests at the Neon production database.** CI uses its own disposable Postgres service container (see `.github/workflows/ci.yml`) -- it never touches Neon at all.

## Backup and rollback

Neon takes automatic point-in-time-recovery snapshots on paid tiers (check the current plan's retention window in the Neon dashboard before relying on it). For a bad migration:

1. `prisma migrate deploy` only ever *adds* new migrations forward -- it does not support an automatic "undo."
2. To roll back, write and commit a new migration that reverses the change, then deploy it the normal way (`git push` → Render pre-deploy runs it).
3. For a genuine data-loss incident, restore via Neon's point-in-time recovery from the dashboard, then re-run any migrations applied after the restore point.

## Manual steps I still need to do

1. Create the Neon project and database.
2. Copy the pooled and direct connection strings into Render's environment variables.
3. Decide and configure Neon's backup/PITR retention window for the plan in use.
