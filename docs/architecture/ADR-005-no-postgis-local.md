# ADR-005: Plain lat/lon columns instead of PostGIS geography (local dev constraint)

- Status: accepted
- Date: 2026-08-07

## Context

`docs/architecture/target-architecture.md` (Lot 1) planned `Business.location`
as `Unsupported("geography(Point,4326)")`, matching legacy `apps/web`'s
PostGIS-backed `vendors.location`. When actually running
`prisma migrate dev` against the real local PostgreSQL 17 instance for this
mission, the migration failed:

```
ERREUR: le type « geography » n'existe pas
```

`CREATE EXTENSION postgis;` against the real local `omni_dev` database then
failed with `Could not open extension control file
".../share/extension/postgis.control": No such file or directory` -- the
PostGIS extension is not merely disabled, it was never installed alongside
this PostgreSQL 17 instance. Installing it requires Stack Builder (admin
rights, a separate EDB download) which is out of scope to attempt
unattended mid-migration.

## Decision

`Business.latitude`/`Business.longitude` are plain `Decimal(10,8)`/
`Decimal(11,8)` columns, not a PostGIS geography column. Proximity queries
compute distance with the Haversine formula (in SQL via `$queryRaw`, or in
application code), the same fallback pattern legacy `apps/web` already uses
for non-PostGIS-indexed matching in `apps/web/src/domains/delivery/geo.js`
(trip-to-request distance matching does not use PostGIS there either).

## Consequences

- No spatial index (`GIST`) -- acceptable for the current, small
  development dataset. A plain `(latitude, longitude)` btree index can be
  added if bounding-box pre-filtering is needed before the Haversine
  calculation.
- If PostGIS is installed later (`docs/setup/postgresql.md` documents the
  manual step), migrating to a real `geography` column is a schema change
  local to the `map`/`businesses` modules -- no DTO consumed by the
  frontend needs to change, since `latitude`/`longitude` numbers are what
  crosses that boundary either way.
- This is a local-development-environment constraint, not a design
  preference -- re-evaluate if/when a shared staging database with PostGIS
  available is provisioned.
