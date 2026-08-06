# Vendor verification status

Every business shown on Omni carries exactly one of three states, always
**derived at read time** by `apps/web/src/lib/vendor-verification.ts` —
never stored as a persisted flag, so it can never go stale:

| KYC status | Subscription | Result |
|---|---|---|
| none / absent | any | Non vérifiée |
| pending | any | Non vérifiée |
| rejected | any | Non vérifiée |
| revoked | any | Non vérifiée |
| approved | not active/paid | Vérifiée |
| approved | active and paid | Certifiée |

Unclaimed OpenStreetMap businesses (`source: 'osm'`) are **always** "Non
vérifiée", regardless of any tag data. A listing appearing on OpenStreetMap
is not an Omni validation of any kind, and OSM data is never written into
the `vendors` table automatically.

## Certification is dynamic, not permanent

Certification requires KYC `approved` **and** an active, paid subscription
(`subscriptions.status = 'active'` and `end_date` is null or in the future).
The moment either condition stops holding — the subscription expires, is
cancelled, a payment fails, or the KYC is revoked — the derived status
changes on the very next read. There is nothing to "clean up" or expire via
a cron job, and no `is_certified` boolean can ever go out of sync with
reality because one never exists.

Downgrade path: `certifiee` → `verifiee` when the subscription stops being
active/paid but KYC is still `approved`; `verifiee` → `non_verifiee` if the
KYC is subsequently revoked or was never approved.

## Source of truth

`apps/web/src/lib/vendor-verification.ts` exports the single
`deriveVerificationStatus({ source, claimed, kycStatus, subscriptionActive })`
function used everywhere a status is needed:

- `apps/web/src/app/api/discovery/discovery-service.js` /
  `apps/web/src/app/api/discovery/geo.js` (`normalizeGeoRow`) — the map and
  nearby/search listings.
- `apps/web/src/app/api/vendors/my-vendor/route.js` — a vendor's own
  dashboard.
- `apps/web/src/app/api/discovery/osm/normalize.js` — every OSM-sourced
  record, hardcoded to `non_verifiee`.

SQL never computes the status itself. It only supplies the raw facts
(`vendors.kyc_status`, `vendors.user_id IS NOT NULL` as "claimed", and an
`EXISTS` check against `subscriptions` for an active, paid subscription);
the JS/TS layer applies `deriveVerificationStatus` exactly once per record.
Do not recompute this rule in a component or another route — attach
`verification_status` at the query boundary and pass it through.

## UI

`apps/web/src/components/VerificationBadge.jsx` renders the status as an
icon **and** text (never color alone), following the same
compact/full-pill convention as `SubscriptionBadge.jsx`. It's wired into
`FacilityCard.jsx`, the vendor dashboard, and the map's bottom sheet for
Omni-native facilities. OpenStreetMap entries on the map show a dedicated
disclosure instead ("Entreprise issue d'OpenStreetMap — Non vérifiée sur
Omni") rather than the badge, since the reason for "non vérifiée" is
different for an unclaimed external listing than for an Omni vendor
pending KYC.

## OpenStreetMap ingestion

`apps/web/src/lib/osm-overpass.js` queries the public Overpass API
(`overpass-api.de`) for a bounding box derived from the map viewport,
restricted to business-relevant tags (`shop`, a curated `amenity`
allowlist, `office`, `craft`, `healthcare`, a curated `tourism` allowlist).
Requests are capped to a 3km radius, use a 10-second timeout, and are
cached in-memory per bounding box for 5 minutes — best-effort only, since
this cache is per server process and does not persist across serverless
invocations. If Overpass is unreachable or errors, the route fails soft
(`{ facilities: [] }`, HTTP 200) so it never blocks or breaks the primary
Omni vendor list on the map.

`apps/web/src/app/api/discovery/osm/normalize.js` converts raw Overpass
elements into `osm:<type>:<id>`-identified records containing only fields
actually present in OSM tags — no rating, no product list, no online
status, and `verification_status` is always `'non_verifiee'`.

OSM results and Omni vendors are **not** automatically merged or
deduplicated by name — approximate name matching was explicitly ruled out
as unsafe. A vendor can only be linked to the OSM object it was
legitimately claimed from, via the optional `vendors.osm_type` /
`vendors.osm_id` columns (migration `0006`), which carry a partial unique
index preventing the same OSM object from being claimed twice.

## Environment variables

No new environment variables are required. The Overpass endpoint is a
fixed public URL, not configurable per environment.

## Applying migration 0006

```bash
cd apps/web
pnpm db:migrate:status   # dry run, shows pending migrations
pnpm db:migrate          # applies pending migrations, requires DATABASE_URL
```

Migration `0006_vendor_verification.sql`:

- adds `vendors.kyc_status` (`none` / `pending` / `approved` / `rejected` /
  `revoked`, default `none`), `vendors.kyc_reviewed_at`, and
  `vendors.kyc_document_ref`;
- adds `vendors.source` (`omni` / `osm`, default `omni`), `vendors.osm_type`
  (`node` / `way` / `relation`), and `vendors.osm_id`, with a partial unique
  index on `(osm_type, osm_id)`;
- adds `subscriptions.status` (`inactive` / `active` / `cancelled` /
  `expired` / `payment_failed`, default `inactive`) — the `subscriptions`
  table existed since `0001_baseline.sql` but had no way to express "paid";
- backfills every existing vendor to `kyc_status = 'none'` (already the
  column default) and every existing subscription to `status = 'inactive'`,
  so pre-existing vendors correctly derive to `non_verifiee` and no
  subscription is treated as active/paid without explicit confirmation.

Fully additive and idempotent (`IF NOT EXISTS` throughout); does not modify
`0001`–`0005`.

## Post-deploy checks

```sql
SELECT kyc_status, source, count(*) FROM vendors GROUP BY 1, 2;
-- every pre-existing vendor: kyc_status = 'none', source = 'omni'

SELECT status, count(*) FROM subscriptions GROUP BY 1;
-- every pre-existing row: status = 'inactive'
```
