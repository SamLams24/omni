-- Vendor verification: KYC state + OSM provenance on vendors,
-- and a payment-aware status on the (previously unused) subscriptions table.
-- Verification status itself is NEVER stored -- it is always derived at read
-- time by apps/web/src/lib/vendor-verification.ts from these raw facts, so
-- certification cannot outlive an expired subscription or a revoked KYC.

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendors_kyc_status_check'
  ) THEN
    ALTER TABLE vendors
      ADD CONSTRAINT vendors_kyc_status_check
      CHECK (kyc_status IN ('none', 'pending', 'approved', 'rejected', 'revoked'));
  END IF;
END $$;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMP;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS kyc_document_ref TEXT;

-- Provenance: every row in `vendors` today is an OMNI-native business.
-- These columns exist so a vendor can later be linked to the OpenStreetMap
-- object it was claimed from (for map-side de-duplication), without ever
-- importing raw, unverified OSM data as if it were an OMNI vendor.
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'omni';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendors_source_check'
  ) THEN
    ALTER TABLE vendors
      ADD CONSTRAINT vendors_source_check
      CHECK (source IN ('omni', 'osm'));
  END IF;
END $$;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS osm_type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendors_osm_type_check'
  ) THEN
    ALTER TABLE vendors
      ADD CONSTRAINT vendors_osm_type_check
      CHECK (osm_type IS NULL OR osm_type IN ('node', 'way', 'relation'));
  END IF;
END $$;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS osm_id BIGINT;

-- Prevents claiming the same OSM object twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_osm_identity
  ON vendors (osm_type, osm_id)
  WHERE osm_type IS NOT NULL AND osm_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_kyc_status ON vendors (kyc_status);

-- Existing vendors: no KYC has ever been collected, so every pre-existing
-- vendor is explicitly 'none' (already the column default) -> derives to
-- non_verifiee via deriveVerificationStatus, matching the rule that
-- existing vendors without an approved KYC must become non-verified.
UPDATE vendors SET kyc_status = 'none' WHERE kyc_status IS NULL;

-- Subscriptions: add the payment-aware status the table never had (it was
-- previously unused; only start_date/end_date existed, which cannot express
-- "paid" vs. "payment failed" vs. "cancelled").
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'inactive';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_status_check'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_status_check
      CHECK (status IN ('inactive', 'active', 'cancelled', 'expired', 'payment_failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_active_lookup
  ON subscriptions (user_id, type, status, end_date);
