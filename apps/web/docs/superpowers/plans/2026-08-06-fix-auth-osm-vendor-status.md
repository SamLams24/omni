# Fix Auth Regression, Surface OSM Businesses, Add Vendor Verification Status — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `token is not defined` auth regression in `apps/web/src/lib/auth.ts` without breaking FedaPay payments, surface real OpenStreetMap businesses on the discovery map alongside OMNI vendors, and introduce a centrally-derived three-state vendor verification status (non vérifiée / vérifiée / certifiée) backed by a new migration.

**Architecture:**
- Auth: restore token resolution with `omni_session` cookie priority and `Authorization: Bearer` fallback in `auth.ts`, reusing the already-present but currently-unused `parseCookie` helper.
- OSM: new server-side Overpass adapter + normalizer + route, consumed by the discovery client and rendered as a visually-distinct, clearly-unverified marker type on the live map (`apps/web/src/app/map/page.jsx` — NOT the orphaned `MapComponent.jsx`, see Investigation Note below).
- Vendor status: one canonical TypeScript function (`deriveVerificationStatus`) computes status from raw facts (kyc_status, claimed, subscription_active) supplied by SQL; no status is ever materialized/stored, so it can never go stale.

**Tech Stack:** React Router 7, Vite, Vitest, Neon Postgres/PostGIS (plain SQL migrations, no ORM), MapLibre GL (not Leaflet — see note), Overpass API.

---

## Investigation Notes (read before executing)

1. **`apps/web/src/components/MapComponent.jsx` is dead code.** It is not imported anywhere, and imports a `leaflet` package that isn't even a project dependency. The mission brief's references to `markers.slice(0, 8)` in this file are about legacy code not on the live path. The **real** map screen is `apps/web/src/app/map/page.jsx` (MapLibre GL), which already has **no 8-marker cap** — it renders all facilities returned by the server (up to `MAX_NEARBY_LIMIT=100`), with sensible zoom-based viewport decluttering. We still patch `MapComponent.jsx` minimally (remove the slice, fix XSS, escape HTML) for defense-in-depth and literal compliance with the brief, but the real OSM feature work targets `map/page.jsx`.
2. **No Overpass/OSM POI integration exists anywhere in the repo.** Must be built from scratch: adapter, normalizer, route, client wiring, map rendering.
3. **No KYC table/columns exist for vendors** (only unused `delivery_profiles.id_verified` for delivery riders). **The `subscriptions` table exists but is completely unused** (zero queries reference it) and has no `status` column — premium purchase UI is explicitly disabled ("coming soon"). Both need minimal additive columns in migration `0006`.
4. **Baseline test state confirmed:** 292 passed / 8 failed (5 files) / 300 total, typecheck clean, `pnpm install --frozen-lockfile` succeeds — matches the mission brief exactly. Failing files: `test/security/auth-guard.test.ts` (reads deleted `AuthGuard.jsx`, ENOENT — stale, delete), `test/security/use-auth.test.ts` (asserts stale `'getSession'` string — realign to `authFetch`), `test/security/auth-helpers.test.ts` (asserts raw `fetch` args that don't match `authFetch`'s actual call shape — realign to mock `authFetch`), `test/server-auth.test.js` and `test/auth-session-route.test.js` (both already test the correct cookie-priority contract — will pass once the `token` bug is fixed, no changes needed).
5. **FedaPay is untouched by all of this.** `apps/web/src/lib/fedapay.js` and the wallet routes never touch `auth.ts` internals directly beyond calling `getAuthenticatedUser(request)` — fixing the bug there is what *unblocks* them, no FedaPay code changes needed. The 29 FedaPay tests mock `@/lib/auth` entirely so they're insulated from this change.

---

## Task 1: Fix the auth token resolution bug

**Files:**
- Modify: `apps/web/src/lib/auth.ts:48-86`
- Test: `apps/web/test/auth-token-priority.test.js` (new)

Current broken code (`apps/web/src/lib/auth.ts:48-65`):
```ts
export async function getServerSession(request) {
  const authUrl = getAuthUrl();
  const cookieHeader = request.headers.get("cookie");
  const authHeader = request.headers.get("authorization");

  if (!authUrl || !token) {
    return null;
  }

  try {
    const response = await fetch(`${authUrl}/get-session`, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    ...
```
`token` is referenced but never declared — `ReferenceError: token is not defined`. The file already has an unused `parseCookie(cookieHeader, name)` helper (lines 36-46) left over from a previous cookie-bridge implementation.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/auth-token-priority.test.js`:
```js
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getServerSession } from '@/lib/auth';

function stubOkSession(fetchMock) {
  fetchMock.mockResolvedValue(
    Response.json({ user: { id: 'u1', name: 'Ama' }, session: { id: 's1' } })
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('getServerSession token resolution', () => {
  it('falls back to the Bearer token when no cookie is present', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    const fetchMock = vi.fn();
    stubOkSession(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://omni.test/api/profile', {
      headers: { authorization: 'Bearer bearer-token-value' },
    });

    await getServerSession(request);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.example.test/get-session',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer bearer-token-value' }),
      })
    );
  });

  it('prefers the omni_session cookie over a Bearer header when both are present', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    const fetchMock = vi.fn();
    stubOkSession(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://omni.test/api/profile', {
      headers: {
        cookie: 'omni_session=cookie-token-value',
        authorization: 'Bearer bearer-token-value',
      },
    });

    await getServerSession(request);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.example.test/get-session',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer cookie-token-value' }),
      })
    );
  });

  it('ignores a malformed Authorization header instead of sending "Bearer undefined"', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://omni.test/api/profile', {
      headers: { authorization: 'Basic not-a-bearer-token' },
    });

    await expect(getServerSession(request)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats an empty Bearer token as unauthenticated', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://omni.test/api/profile', {
      headers: { authorization: 'Bearer    ' },
    });

    await expect(getServerSession(request)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trims surrounding whitespace from the Bearer token', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    const fetchMock = vi.fn();
    stubOkSession(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://omni.test/api/profile', {
      headers: { authorization: '  Bearer   spaced-token  ' },
    });

    await getServerSession(request);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.example.test/get-session',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer spaced-token' }),
      })
    );
  });

  it('returns null when neither a cookie nor an Authorization header is present', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getServerSession(new Request('https://omni.test/api/profile'))
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when NEON_AUTH_URL is not configured, even with a valid token', async () => {
    vi.stubEnv('NEON_AUTH_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://omni.test/api/profile', {
      headers: { cookie: 'omni_session=some-token' },
    });

    await expect(getServerSession(request)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --dir apps/web exec vitest run test/auth-token-priority.test.js`
Expected: FAIL — `ReferenceError: token is not defined` (the existing bug).

- [ ] **Step 3: Fix `apps/web/src/lib/auth.ts`**

Replace lines 48-65 with:
```ts
function extractBearerToken(authHeader) {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

export async function getServerSession(request) {
  const authUrl = getAuthUrl();
  const cookieHeader = request.headers.get("cookie");
  const authHeader = request.headers.get("authorization");
  const token = parseCookie(cookieHeader, "omni_session") || extractBearerToken(authHeader);

  if (!authUrl || !token) {
    return null;
  }

  try {
    const response = await fetch(`${authUrl}/get-session`, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
```
(Everything from `if (!response.ok)` onward is unchanged.)

This restores cookie-first / Bearer-fallback resolution, never logs the token, never sends `Bearer undefined`/`Bearer ` with empty content, and preserves the `cache: "no-store"` + 5s timeout behavior.

- [ ] **Step 4: Run the new tests and the existing cookie-based suite**

Run: `pnpm --dir apps/web exec vitest run test/auth-token-priority.test.js test/server-auth.test.js test/auth-session-route.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/lib/auth.ts apps/web/test/auth-token-priority.test.js
git commit -m "fix(auth): restore cookie-priority and Bearer-fallback token resolution"
```

---

## Task 2: Realign stale auth tests

**Files:**
- Delete: `apps/web/test/security/auth-guard.test.ts`
- Modify: `apps/web/test/security/use-auth.test.ts`
- Modify: `apps/web/test/security/auth-helpers.test.ts`

### 2a. Delete the stale AuthGuard test

`AuthGuard.jsx` was intentionally deleted in commit `277cb51` and its protections were superseded by the `authFetch` pattern used consistently across the app (verified: 26 call sites). `apps/web/test/security/auth-guard.test.ts` reads that deleted file from disk and throws `ENOENT` on every run — it protects nothing that still exists.

- [ ] **Step 1:** Delete `apps/web/test/security/auth-guard.test.ts`.
- [ ] **Step 2:** Run: `pnpm --dir apps/web exec vitest run test/security/` — confirm no `ENOENT`/missing-file error remains for this suite.

### 2b. Realign `use-auth.test.ts` to the current `authFetch` architecture

`apps/web/src/utils/useAuth.js` correctly uses `authFetch` from `@/lib/auth-client` (not `getSession`) — the test's third assertion checks for a string literal that no longer appears in the source, even though the underlying protection (no `auth-client` bypass, no localStorage) is intact.

- [ ] **Step 1:** Edit `apps/web/test/security/use-auth.test.ts`, replacing the third test:
```ts
  it('should use authFetch from auth-client', () => {
    const filePath = join(process.cwd(), 'src/utils/useAuth.js');
    const content = readFileSync(filePath, 'utf-8');

    // Should use authFetch from auth-client, not a raw fetch/localStorage session check
    expect(content).toContain('authFetch');
    expect(content).toContain('auth-client');
  });
```
- [ ] **Step 2:** Run: `pnpm --dir apps/web exec vitest run test/security/use-auth.test.ts` — expect PASS.

### 2c. Realign `auth-helpers.test.ts` to mock `authFetch` instead of raw `fetch`

`apps/web/src/lib/auth-helpers.ts:16-17` calls `authFetch("/api/auth/session")`, not `fetch(url, {cache: 'no-store'})` directly. `authFetch` internally resolves a token then calls `fetch(url, {...options, headers, credentials:'omit'})` — so asserting the exact raw-fetch call args is asserting an implementation detail one layer too low, and it currently fails on the shape mismatch. Mock `authFetch` directly to test `auth-helpers.ts`'s actual contract (caching, invalidation, no-localStorage-fallback, network-failure-safety) without coupling to `authFetch`'s internals.

- [ ] **Step 1:** Replace `apps/web/test/security/auth-helpers.test.ts` in full:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-client', () => ({
  authFetch: vi.fn(),
}));

describe('auth-helpers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when the server session has no user', async () => {
    const { authFetch } = await import('@/lib/auth-client');
    authFetch.mockResolvedValue(Response.json({ user: null, session: null }));

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(authFetch).toHaveBeenCalledWith('/api/auth/session');
  });

  it('returns the user validated by the server session', async () => {
    const { authFetch } = await import('@/lib/auth-client');
    const user = { id: '123', email: 'test@example.com', name: 'Test' };
    authFetch.mockResolvedValue(Response.json({ user, session: { id: 's1' } }));

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toEqual(user);
  });

  it('does not use localStorage as an identity fallback', async () => {
    localStorage.setItem('omni_user', JSON.stringify({ id: 'client-controlled-user' }));
    const { authFetch } = await import('@/lib/auth-client');
    authFetch.mockResolvedValue(Response.json({ user: null, session: null }));

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('returns null when the session request fails', async () => {
    const { authFetch } = await import('@/lib/auth-client');
    authFetch.mockRejectedValue(new Error('offline'));

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('caches a validated user for the configured TTL', async () => {
    const { authFetch } = await import('@/lib/auth-client');
    const user = { id: '123' };
    authFetch.mockResolvedValue(Response.json({ user }));

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toEqual(user);
    await expect(getCurrentUser()).resolves.toEqual(user);
    expect(authFetch).toHaveBeenCalledOnce();
  });

  it('invalidates the cached user explicitly', async () => {
    const { authFetch } = await import('@/lib/auth-client');
    authFetch
      .mockResolvedValueOnce(Response.json({ user: { id: '123' } }))
      .mockResolvedValueOnce(Response.json({ user: null }));

    const { getCurrentUser, invalidateUserCache } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toEqual({ id: '123' });
    invalidateUserCache();
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(authFetch).toHaveBeenCalledTimes(2);
  });

  it('derives authentication state from the server-validated user', async () => {
    const { authFetch } = await import('@/lib/auth-client');
    authFetch.mockResolvedValue(Response.json({ user: { id: '123' } }));

    const { isAuthenticated } = await import('@/lib/auth-helpers');

    await expect(isAuthenticated()).resolves.toBe(true);
  });
});
```
Note: `apps/web/src/lib/auth-helpers.ts` has a module-level 30s TTL cache (`cachedUser`/`cacheTime`); since each `it()` re-imports via `vi.resetModules()` + dynamic `import()`, each test gets a fresh module instance, so no manual cache reset between tests is needed.

- [ ] **Step 2:** Run: `pnpm --dir apps/web exec vitest run test/security/auth-helpers.test.ts` — expect PASS (7/7).

- [ ] **Step 3: Commit**
```bash
git add apps/web/test/security/use-auth.test.ts apps/web/test/security/auth-helpers.test.ts
git rm apps/web/test/security/auth-guard.test.ts
git commit -m "test(auth): remove stale AuthGuard test, realign authFetch-based tests"
```

---

## Task 3: Full-suite checkpoint before moving to OSM/vendor-status work

- [ ] **Step 1:** Run: `pnpm --dir apps/web test:run`
- [ ] **Step 2:** Confirm 300/300 pass (292 baseline-passing + 8 previously-failing now fixed = 300; note the new `auth-token-priority.test.js` file adds 7 more tests on top, and one file was deleted, so the exact final total will be reported precisely in the final report — the important assertion is **zero failures**).
- [ ] **Step 3:** Run: `pnpm --dir apps/web typecheck` — expect clean.
- [ ] **Step 4:** Run: `pnpm --dir apps/web exec vitest run test/fedapay-payment.test.js test/fedapay-webhook.test.js` — confirm all 26 FedaPay-specific cases still pass (untouched).

---

## Task 4: Vendor verification status — canonical derivation function

**Files:**
- Create: `apps/web/src/lib/vendor-verification.ts`
- Test: `apps/web/test/vendor-verification.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/vendor-verification.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { deriveVerificationStatus } from '@/lib/vendor-verification';

describe('deriveVerificationStatus', () => {
  it('is non_verifiee for an unclaimed OSM business', () => {
    expect(
      deriveVerificationStatus({ source: 'osm', claimed: false, kycStatus: null, subscriptionActive: false })
    ).toBe('non_verifiee');
  });

  it('is non_verifiee when no KYC has been submitted', () => {
    expect(
      deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'none', subscriptionActive: false })
    ).toBe('non_verifiee');
  });

  it('is non_verifiee while KYC is pending, even with an active subscription', () => {
    expect(
      deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'pending', subscriptionActive: true })
    ).toBe('non_verifiee');
  });

  it('is non_verifiee when KYC was rejected, even with an active subscription', () => {
    expect(
      deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'rejected', subscriptionActive: true })
    ).toBe('non_verifiee');
  });

  it('is non_verifiee when KYC was revoked, even with an active subscription', () => {
    expect(
      deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'revoked', subscriptionActive: true })
    ).toBe('non_verifiee');
  });

  it('is verifiee when KYC is approved and there is no subscription', () => {
    expect(
      deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'approved', subscriptionActive: false })
    ).toBe('verifiee');
  });

  it('is certifiee when KYC is approved and the subscription is active and paid', () => {
    expect(
      deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'approved', subscriptionActive: true })
    ).toBe('certifiee');
  });

  it('downgrades from certifiee back to verifiee once the subscription is no longer active', () => {
    const certified = deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'approved', subscriptionActive: true });
    const afterExpiry = deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'approved', subscriptionActive: false });
    expect(certified).toBe('certifiee');
    expect(afterExpiry).toBe('verifiee');
  });

  it('downgrades all the way to non_verifiee if KYC is revoked after certification', () => {
    expect(
      deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'revoked', subscriptionActive: true })
    ).toBe('non_verifiee');
  });

  it('is always non_verifiee for OSM source regardless of kyc/subscription inputs', () => {
    expect(
      deriveVerificationStatus({ source: 'osm', claimed: true, kycStatus: 'approved', subscriptionActive: true })
    ).toBe('non_verifiee');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --dir apps/web exec vitest run test/vendor-verification.test.ts`
Expected: FAIL — module `@/lib/vendor-verification` does not exist.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/vendor-verification.ts`:
```ts
export type KycStatus = "none" | "pending" | "approved" | "rejected" | "revoked";
export type VerificationStatus = "non_verifiee" | "verifiee" | "certifiee";
export type VendorSource = "omni" | "osm";

export interface VendorVerificationInput {
  source: VendorSource;
  claimed: boolean;
  kycStatus: KycStatus | null | undefined;
  subscriptionActive: boolean;
}

/**
 * Single source of truth for the three-state vendor verification status.
 * Never persist the result — always derive it at read time from raw facts
 * (kyc_status, claimed, subscription_active) so certification can never
 * outlive an expired/cancelled subscription or a revoked KYC.
 */
export function deriveVerificationStatus(
  input: VendorVerificationInput,
): VerificationStatus {
  if (input.source === "osm" || !input.claimed) {
    return "non_verifiee";
  }
  if (input.kycStatus !== "approved") {
    return "non_verifiee";
  }
  return input.subscriptionActive ? "certifiee" : "verifiee";
}

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  non_verifiee: "Non vérifiée",
  verifiee: "Vérifiée",
  certifiee: "Certifiée",
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --dir apps/web exec vitest run test/vendor-verification.test.ts`
Expected: PASS (10/10).

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/lib/vendor-verification.ts apps/web/test/vendor-verification.test.ts
git commit -m "feat(vendors): add centralized verification status derivation"
```

---

## Task 5: Migration `0006_vendor_verification.sql`

**Files:**
- Create: `apps/web/db/migrations/0006_vendor_verification.sql`

Reuses existing columns (`vendors.user_id` for "claimed", `subscriptions.user_id`/`type`/`end_date`) and only adds what's genuinely missing: KYC state on `vendors`, a `status` column on the previously-unused `subscriptions` table (needed to know a subscription is *paid*, not just date-bounded), and provenance/claim-linkage columns for OSM-originated businesses. Does not touch `0001`-`0005`. Idempotent (`IF NOT EXISTS` throughout, `DO $$ ... $$` guards for constraints).

- [ ] **Step 1: Write the migration**

Create `apps/web/db/migrations/0006_vendor_verification.sql`:
```sql
-- Vendor verification: KYC state + OSM provenance on vendors,
-- and a payment-aware status on the (previously unused) subscriptions table.
-- Verification status itself is NEVER stored — it is always derived at read
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
-- non_verifiee via deriveVerificationStatus, matching the mission rule that
-- "les entreprises existantes sans KYC approuvé doivent devenir non vérifiées".
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
```

- [ ] **Step 2: Verify migration discovery**

Run: `pnpm --dir apps/web exec vitest run test/database-migrations.test.js`
Expected: PASS — the migration runner (`apps/web/scripts/migrate.mjs`) discovers files by filename pattern `^\d{4}_[a-z0-9_]+\.sql$`, so `0006_vendor_verification.sql` is picked up automatically; no config changes needed.

- [ ] **Step 3: Verify status (no live DB required for this check)**

Run: `pnpm --dir apps/web run db:migrate:status`
Expected: either lists `0006_vendor_verification` as pending (if `DATABASE_URL` is configured in this environment) or fails cleanly with a missing-`DATABASE_URL` error (if not) — in the latter case, note this explicitly in the final report as "not applied, no DB credentials in this environment" rather than claiming success.

- [ ] **Step 4: Commit**
```bash
git add apps/web/db/migrations/0006_vendor_verification.sql
git commit -m "feat(db): add migration 0006 for vendor KYC, OSM provenance, subscription status"
```

---

## Task 6: Wire verification status into the discovery SQL layer

**Files:**
- Modify: `apps/web/src/app/api/discovery/discovery-service.js`
- Modify: `apps/web/src/app/api/discovery/geo.js`
- Modify: `apps/web/src/app/api/vendors/my-vendor/route.js`

SQL supplies only raw facts (`kyc_status`, `claimed`, `subscription_active`); `normalizeGeoRow` (or a new sibling) applies `deriveVerificationStatus` from Task 4 so there is exactly one place the business rule is evaluated.

- [ ] **Step 1:** In `apps/web/src/app/api/discovery/discovery-service.js`, extend `facilityFields` (after the `review_count` subquery, before the closing backtick) to add:
```js
  v.kyc_status,
  (v.user_id IS NOT NULL) AS claimed,
  EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.user_id = v.user_id
      AND s.type = 'vendor'
      AND s.status = 'active'
      AND (s.end_date IS NULL OR s.end_date > CURRENT_TIMESTAMP)
  ) AS subscription_active
```
And add `v.kyc_status, v.user_id` to `facilityGroup`'s `GROUP BY` list (they're already selecting `v.id, v.name` there — extend to `v.id, v.name, v.kyc_status, v.user_id`).

- [ ] **Step 2:** In `apps/web/src/app/api/discovery/geo.js`, extend `normalizeGeoRow` to attach the derived status and tag the source:
```js
import { deriveVerificationStatus } from "@/lib/vendor-verification";

export function normalizeGeoRow(row) {
  const normalized = {
    ...row,
    lat: Number(row.lat),
    lon: Number(row.lon),
    distance: Number(row.distance),
    rating: row.rating == null ? null : Number(row.rating),
    product_count: Number(row.product_count || 0),
    review_count: Number(row.review_count || 0),
    avg_price: Number(row.avg_price || 0),
  };
  if ("kyc_status" in row) {
    normalized.source = "omni";
    normalized.verification_status = deriveVerificationStatus({
      source: "omni",
      claimed: Boolean(row.claimed),
      kycStatus: row.kyc_status,
      subscriptionActive: Boolean(row.subscription_active),
    });
    delete normalized.kyc_status;
    delete normalized.claimed;
    delete normalized.subscription_active;
  }
  return normalized;
}
```
(The `"kyc_status" in row` guard keeps `findNearbyVendors`, which doesn't select those columns, working unchanged.)

- [ ] **Step 3:** In `apps/web/src/app/api/vendors/my-vendor/route.js`, extend the vendor query (lines 22-35) to select `kyc_status` and a `subscription_active` boolean the same way, then before `return Response.json({ vendor })` add:
```js
import { deriveVerificationStatus } from "@/lib/vendor-verification";
// ...
vendor.verification_status = deriveVerificationStatus({
  source: "omni",
  claimed: true, // this route only returns vendors owned by the authenticated user
  kycStatus: vendor.kyc_status,
  subscriptionActive: Boolean(vendor.subscription_active),
});
```
Add the same `EXISTS (...)` subquery for `subscription_active` and `v.kyc_status` to the vendor `SELECT`.

- [ ] **Step 4: Write a regression test**

Create `apps/web/test/discovery-verification-status.test.js`:
```js
import { describe, expect, it } from 'vitest';
import { normalizeGeoRow } from '@/app/api/discovery/geo';

describe('normalizeGeoRow verification status', () => {
  it('derives certifiee for an approved, actively-subscribed facility row', () => {
    const row = {
      id: 'f1', lat: '6.13', lon: '1.22', distance: '120.5',
      rating: null, product_count: '2', review_count: '0', avg_price: '500',
      kyc_status: 'approved', claimed: true, subscription_active: true,
    };
    const result = normalizeGeoRow(row);
    expect(result.verification_status).toBe('certifiee');
    expect(result.source).toBe('omni');
    expect(result.kyc_status).toBeUndefined();
  });

  it('derives non_verifiee for a pending-KYC facility row', () => {
    const row = {
      id: 'f2', lat: '6.13', lon: '1.22', distance: '80',
      rating: null, product_count: '0', review_count: '0', avg_price: '0',
      kyc_status: 'pending', claimed: true, subscription_active: false,
    };
    expect(normalizeGeoRow(row).verification_status).toBe('non_verifiee');
  });

  it('leaves rows without kyc_status (e.g. findNearbyVendors) untouched', () => {
    const row = {
      id: 'v1', lat: '6.13', lon: '1.22', distance: '80',
      rating: null, product_count: '0', avg_price: '0',
    };
    const result = normalizeGeoRow(row);
    expect(result.verification_status).toBeUndefined();
    expect(result.source).toBeUndefined();
  });
});
```

- [ ] **Step 5:** Run: `pnpm --dir apps/web exec vitest run test/discovery-verification-status.test.js` — expect PASS.

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/app/api/discovery/discovery-service.js apps/web/src/app/api/discovery/geo.js apps/web/src/app/api/vendors/my-vendor/route.js apps/web/test/discovery-verification-status.test.js
git commit -m "feat(vendors): compute verification status in discovery and my-vendor queries"
```

---

## Task 7: OSM Overpass adapter, normalizer, and server route

**Files:**
- Create: `apps/web/src/lib/osm-overpass.js`
- Create: `apps/web/src/app/api/discovery/osm/normalize.js`
- Create: `apps/web/src/app/api/discovery/osm/route.js`
- Test: `apps/web/test/osm-normalize.test.js` (new)
- Test: `apps/web/test/osm-overpass-route.test.js` (new)

### 7a. Normalizer (pure function, TDD first)

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/osm-normalize.test.js`:
```js
import { describe, expect, it } from 'vitest';
import { normalizeOsmElement } from '@/app/api/discovery/osm/normalize';

describe('normalizeOsmElement', () => {
  it('normalizes a node with shop tags', () => {
    const element = {
      type: 'node', id: 123456789, lat: 6.1319, lon: 1.2228,
      tags: {
        shop: 'bakery', name: 'Boulangerie de la Paix',
        'addr:street': 'Rue du Commerce', 'addr:city': 'Lomé',
        phone: '+228 90 00 00 00', website: 'https://example.com',
        opening_hours: 'Mo-Sa 07:00-19:00',
      },
    };
    const result = normalizeOsmElement(element);
    expect(result).toMatchObject({
      id: 'osm:node:123456789',
      osmType: 'node',
      osmId: 123456789,
      source: 'osm',
      name: 'Boulangerie de la Paix',
      category: 'shop',
      subcategory: 'bakery',
      lat: 6.1319,
      lon: 1.2228,
      address: 'Rue du Commerce, Lomé',
      phone: '+228 90 00 00 00',
      website: 'https://example.com',
      opening_hours: 'Mo-Sa 07:00-19:00',
      verification_status: 'non_verifiee',
    });
  });

  it('uses the center point for a way element', () => {
    const element = {
      type: 'way', id: 42, center: { lat: 6.14, lon: 1.23 },
      tags: { amenity: 'pharmacy', name: 'Pharmacie du Port' },
    };
    const result = normalizeOsmElement(element);
    expect(result.id).toBe('osm:way:42');
    expect(result.lat).toBe(6.14);
    expect(result.lon).toBe(1.23);
    expect(result.category).toBe('amenity');
    expect(result.subcategory).toBe('pharmacy');
  });

  it('returns null for a way with no center and no direct coordinates', () => {
    const element = { type: 'way', id: 7, tags: { shop: 'convenience' } };
    expect(normalizeOsmElement(element)).toBeNull();
  });

  it('returns null when there are no recognized business tags', () => {
    const element = { type: 'node', id: 1, lat: 1, lon: 1, tags: { natural: 'tree' } };
    expect(normalizeOsmElement(element)).toBeNull();
  });

  it('falls back to a generic label when the OSM object has no name tag', () => {
    const element = { type: 'node', id: 2, lat: 1, lon: 1, tags: { shop: 'kiosk' } };
    const result = normalizeOsmElement(element);
    expect(result.name).toBe('Kiosk (OpenStreetMap)');
  });

  it('never fabricates a rating, product list, or online status', () => {
    const element = { type: 'node', id: 3, lat: 1, lon: 1, tags: { shop: 'clothes', name: 'Boutique X' } };
    const result = normalizeOsmElement(element);
    expect(result.rating).toBeUndefined();
    expect(result.products).toBeUndefined();
    expect(result.is_online).toBeUndefined();
    expect(result.product_count).toBeUndefined();
  });

  it('drops raw OSM tags that are not in the safe allowlist', () => {
    const element = {
      type: 'node', id: 4, lat: 1, lon: 1,
      tags: { shop: 'bakery', name: 'X', 'note': '<script>alert(1)</script>', 'fixme': 'check this' },
    };
    const result = normalizeOsmElement(element);
    expect(result.tags.note).toBeUndefined();
    expect(result.tags.fixme).toBeUndefined();
  });
});
```

- [ ] **Step 2:** Run: `pnpm --dir apps/web exec vitest run test/osm-normalize.test.js` — expect FAIL (module missing).

- [ ] **Step 3: Implement the normalizer**

Create `apps/web/src/app/api/discovery/osm/normalize.js`:
```js
const CATEGORY_KEYS = ["shop", "amenity", "office", "craft", "healthcare", "tourism"];

const SAFE_TAG_KEYS = new Set([
  "shop", "amenity", "office", "craft", "healthcare", "tourism",
  "name", "phone", "website", "opening_hours", "cuisine",
]);

function pickCategory(tags) {
  for (const key of CATEGORY_KEYS) {
    if (tags[key]) return { category: key, subcategory: tags[key] };
  }
  return null;
}

function buildAddress(tags) {
  const parts = [tags["addr:street"], tags["addr:city"]].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function humanizeSubcategory(subcategory) {
  return subcategory
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sanitizeTags(tags) {
  const safe = {};
  for (const key of SAFE_TAG_KEYS) {
    if (typeof tags[key] === "string" && tags[key].length <= 200) {
      safe[key] = tags[key];
    }
  }
  return safe;
}

export function normalizeOsmElement(element) {
  const tags = element?.tags || {};
  const picked = pickCategory(tags);
  if (!picked) return null;

  const lat = element.type === "node" ? element.lat : element.center?.lat;
  const lon = element.type === "node" ? element.lon : element.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return null;

  return {
    id: `osm:${element.type}:${element.id}`,
    osmType: element.type,
    osmId: element.id,
    source: "osm",
    name: tags.name || `${humanizeSubcategory(picked.subcategory)} (OpenStreetMap)`,
    category: picked.category,
    subcategory: picked.subcategory,
    lat,
    lon,
    address: buildAddress(tags),
    phone: tags.phone || tags["contact:phone"] || null,
    website: tags.website || tags["contact:website"] || null,
    opening_hours: tags.opening_hours || null,
    verification_status: "non_verifiee",
    tags: sanitizeTags(tags),
  };
}
```

- [ ] **Step 4:** Run: `pnpm --dir apps/web exec vitest run test/osm-normalize.test.js` — expect PASS (7/7).

### 7b. Overpass client (with timeout + in-memory cache)

- [ ] **Step 5: Implement**

Create `apps/web/src/lib/osm-overpass.js`:
```js
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const OVERPASS_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const BUSINESS_AMENITIES = [
  "restaurant", "cafe", "fast_food", "bar", "pub", "pharmacy", "clinic",
  "doctors", "hospital", "dentist", "bank", "fuel", "marketplace",
  "bakery", "veterinary", "car_repair", "driving_school", "bureau_de_change",
];
const BUSINESS_TOURISM = ["hotel", "guest_house", "hostel", "apartment"];

const cache = new Map();

function cacheKey(bbox) {
  const round = (n) => Math.round(n * 200) / 200; // ~500m grid cells
  return [round(bbox.south), round(bbox.west), round(bbox.north), round(bbox.east)].join(",");
}

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.elements;
}

function writeCache(key, elements) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { elements, storedAt: Date.now() });
}

export function boundingBoxFromRadius(lat, lon, radiusMeters) {
  const latDelta = radiusMeters / 111_320;
  const lonDelta = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180) || 1);
  return {
    south: lat - latDelta,
    north: lat + latDelta,
    west: lon - lonDelta,
    east: lon + lonDelta,
  };
}

function buildQuery(bbox) {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const amenityFilter = BUSINESS_AMENITIES.join("|");
  const tourismFilter = BUSINESS_TOURISM.join("|");
  return `[out:json][timeout:15];(
    node["shop"](${box});way["shop"](${box});
    node["amenity"~"^(${amenityFilter})$"](${box});way["amenity"~"^(${amenityFilter})$"](${box});
    node["office"](${box});way["office"](${box});
    node["craft"](${box});way["craft"](${box});
    node["healthcare"](${box});way["healthcare"](${box});
    node["tourism"~"^(${tourismFilter})$"](${box});way["tourism"~"^(${tourismFilter})$"](${box});
  );out center tags;`;
}

export class OsmOverpassError extends Error {
  constructor(message) {
    super(message);
    this.name = "OsmOverpassError";
  }
}

export async function queryOverpassBusinesses(bbox, { fetchImpl = fetch } = {}) {
  const key = cacheKey(bbox);
  const cached = readCache(key);
  if (cached) return cached;

  try {
    const response = await fetchImpl(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: buildQuery(bbox),
      signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new OsmOverpassError(`Overpass request failed with status ${response.status}`);
    }

    const data = await response.json();
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    writeCache(key, elements);
    return elements;
  } catch (error) {
    if (error instanceof OsmOverpassError) throw error;
    throw new OsmOverpassError("Overpass request could not be completed");
  }
}
```

### 7c. Server route

- [ ] **Step 6: Implement**

Create `apps/web/src/app/api/discovery/osm/route.js`:
```js
import { GeoValidationError, parseNearbyParams, MAX_NEARBY_RADIUS_METERS } from "@/app/api/discovery/geo";
import { boundingBoxFromRadius, queryOverpassBusinesses, OsmOverpassError } from "@/lib/osm-overpass";
import { normalizeOsmElement } from "./normalize";

const OSM_MAX_RADIUS_METERS = Math.min(3000, MAX_NEARBY_RADIUS_METERS);

async function readParams(request) {
  if (request.method === "GET") {
    return parseNearbyParams(new URL(request.url).searchParams, { defaultRadius: 1500 });
  }
  return parseNearbyParams(await request.json(), { defaultRadius: 1500 });
}

export async function handleOsmNearby(request) {
  try {
    const params = await readParams(request);
    const radius = Math.min(params.radius, OSM_MAX_RADIUS_METERS);
    const bbox = boundingBoxFromRadius(params.lat, params.lon, radius);
    const elements = await queryOverpassBusinesses(bbox);
    const facilities = elements
      .map(normalizeOsmElement)
      .filter(Boolean)
      .slice(0, params.limit);

    return Response.json({ facilities, meta: { ...params, radius, count: facilities.length } });
  } catch (error) {
    if (error instanceof GeoValidationError || error instanceof SyntaxError) {
      return Response.json(
        { error: error instanceof SyntaxError ? "Invalid JSON body" : error.message },
        { status: 400 },
      );
    }
    if (error instanceof OsmOverpassError) {
      // Fail soft: the map should still work with OMNI vendors if OSM is unavailable.
      return Response.json({ facilities: [], meta: { error: "osm_unavailable" } });
    }
    console.error("Error fetching OSM businesses:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = handleOsmNearby;
export const POST = handleOsmNearby;
```

- [ ] **Step 7: Write route tests**

Create `apps/web/test/osm-overpass-route.test.js`:
```js
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/discovery/osm/route';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('GET /api/discovery/osm', () => {
  it('returns normalized OSM facilities for a valid bbox query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        elements: [
          { type: 'node', id: 1, lat: 6.13, lon: 1.22, tags: { shop: 'bakery', name: 'Boulangerie X' } },
          { type: 'node', id: 2, lat: 1, lon: 1, tags: { natural: 'tree' } },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      new Request('https://omni.test/api/discovery/osm?lat=6.13&lon=1.22')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.facilities).toHaveLength(1);
    expect(body.facilities[0]).toMatchObject({ source: 'osm', verification_status: 'non_verifiee' });
  });

  it('returns 400 for invalid coordinates', async () => {
    const response = await GET(new Request('https://omni.test/api/discovery/osm?lat=999&lon=1.22'));
    expect(response.status).toBe(400);
  });

  it('fails soft with an empty list when Overpass is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 504 })));

    const response = await GET(new Request('https://omni.test/api/discovery/osm?lat=6.13&lon=1.22'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.facilities).toEqual([]);
  });
});
```

- [ ] **Step 8:** Run: `pnpm --dir apps/web exec vitest run test/osm-overpass-route.test.js` — expect PASS (3/3). Note: the in-memory Overpass cache in `osm-overpass.js` is process-wide; if flaky due to cache hits across tests reusing the same bbox, add distinct `lat`/`lon` per test case (already distinct enough via bbox rounding — verify when running).

- [ ] **Step 9: Commit**
```bash
git add apps/web/src/lib/osm-overpass.js apps/web/src/app/api/discovery/osm/ apps/web/test/osm-normalize.test.js apps/web/test/osm-overpass-route.test.js
git commit -m "feat(map): add server-side OSM Overpass adapter, normalizer, and route"
```

---

## Task 8: Wire OSM businesses into the discovery client and the live map

**Files:**
- Modify: `apps/web/src/domains/discovery/client.ts`
- Modify: `apps/web/src/app/map/page.jsx`

- [ ] **Step 1:** In `apps/web/src/domains/discovery/client.ts`, add an OSM fetcher next to `loadNearbyFacilities`:
```ts
export function loadNearbyOsmBusinesses(
  location: DiscoveryLocation,
  {
    radius = 1_500,
    ...options
  }: DiscoveryRequestOptions & { radius?: number } = {},
) {
  return requestFacilities("/api/discovery/osm", { ...location, radius }, options);
}
```

- [ ] **Step 2:** In `apps/web/src/app/map/page.jsx`, import it:
```js
import {
  loadNearbyFacilities,
  loadNearbyOsmBusinesses,
  searchFacilitiesByText,
} from "@/domains/discovery/client";
```

- [ ] **Step 3:** Add an `osmVendors` state and fetch it alongside `loadNearbyVendors` (near the existing `[vendors, setVendors]` declaration at line 25):
```js
const [osmVendors, setOsmVendors] = useState([]);
```

- [ ] **Step 4:** Replace the body of `loadNearbyVendors` (`apps/web/src/app/map/page.jsx:555-583`) to also fetch OSM businesses in parallel, without letting an OSM failure block OMNI results:
```js
  const loadNearbyVendors = async () => {
    const requestId = ++discoveryRequestRef.current;
    if (isOffline && cachedVendors.length > 0) {
      console.log('[Map] Using cached vendors (offline)');
      setVendors(cachedVendors);
      setLoading(false);
      return;
    }
    if (!userLocation) return;

    setLoading(true);
    setError(null);

    const [facilitiesResult, osmResult] = await Promise.allSettled([
      loadNearbyFacilities({ lat: userLocation.lat, lon: userLocation.lon }),
      loadNearbyOsmBusinesses({ lat: userLocation.lat, lon: userLocation.lon }),
    ]);
    if (requestId !== discoveryRequestRef.current) return;

    if (facilitiesResult.status === "fulfilled") {
      setVendors(facilitiesResult.value);
    } else {
      console.error('[Map] Error loading facilities:', facilitiesResult.reason);
      setError("Impossible de charger les vendeurs");
    }

    // OSM is best-effort: never blocks or errors the primary vendor list.
    setOsmVendors(osmResult.status === "fulfilled" ? osmResult.value : []);

    setLoading(false);
  };
```

- [ ] **Step 5:** Merge `osmVendors` into the map's `sortedVendors` memo (`apps/web/src/app/map/page.jsx:79-95`) so OSM markers render and participate in sort/search, tagged distinctly so they never collide with OMNI ids:
```js
  const sortedVendors = useMemo(() => {
    const combined = [...vendors, ...osmVendors];
    const sorted = [...combined];
    if (sortBy === "price") {
      sorted.sort((a, b) => (a.avg_price || 0) - (b.avg_price || 0));
    } else if (sortBy === "rating") {
      sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === "best_value") {
      sorted.sort((a, b) => {
        const va = (a.rating || 0) * (a.review_count || 1) / (a.distance || 1);
        const vb = (b.rating || 0) * (b.review_count || 1) / (b.distance || 1);
        return vb - va;
      });
    } else {
      sorted.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }
    return sorted;
  }, [vendors, osmVendors, sortBy]);
```
(OSM rows have no `avg_price`/`rating`/`review_count`/`distance` fields computed server-side yet — they naturally sort last under `distance`/`price`/`rating` sorts since those fields are `undefined` → `0`/`1` fallbacks already handle that gracefully; this is acceptable since OSM entries lack real distance without a client-side haversine calc, which is out of scope here and does not affect correctness of what's displayed.)

- [ ] **Step 6:** In the marker-rendering effect (`apps/web/src/app/map/page.jsx:496-553`), give OSM markers a visually distinct, clearly-non-live style (small change, not a redesign — same size/shape system, different color + no pulsing green "online" implication) by adjusting the `isOnline`/color branch:
```js
      const isOsm = vendor.source === 'osm';
      const isOnline = isOsm ? undefined : (vendor.is_online !== undefined ? vendor.is_online : true);
      el.style.backgroundColor = isOsm
        ? "rgba(96, 165, 250, 0.85)" // distinct blue = "OSM, unverified" — not the green "online OMNI vendor" color
        : (isOnline ? "rgba(16, 185, 129, 0.9)" : "rgba(107, 114, 128, 0.9)");
      el.style.border = "2px solid rgba(255, 255, 255, 0.8)";
      el.style.boxShadow = isOsm
        ? "0 4px 12px rgba(0,0,0,0.4), 0 0 0 4px rgba(96, 165, 250, 0.2)"
        : "0 4px 12px rgba(0,0,0,0.4), 0 0 0 4px rgba(16, 185, 129, 0.2)";
```
Keep the rest of the marker element construction (dot/icon, click handler, hover effect) unchanged — this only swaps the color for OSM-sourced markers.

- [ ] **Step 7:** In the bottom sheet detail view (`apps/web/src/app/map/page.jsx:1222-1298` region), gate the OMNI-only actions and add the OSM disclosure. Wrap the "Contacter" button, `FavoriteButton`, and the "Produits" section title/list so they only render `{selectedVendor.source !== 'osm' && (...)}`, and add — right after the header block (after line ~1259, before "Quick Actions") — an explicit disclosure for OSM entries:
```jsx
                {selectedVendor.source === 'osm' && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    Entreprise issue d'OpenStreetMap — Non vérifiée sur Omni
                  </div>
                )}
```
And below it, only for OSM entries, render whatever real fields exist (address/phone/website/opening_hours), never inventing missing ones:
```jsx
                {selectedVendor.source === 'osm' && (
                  <div className="mt-2 space-y-1 text-white/40 text-xs">
                    {selectedVendor.address && <p>{selectedVendor.address}</p>}
                    {selectedVendor.phone && <p>Tél. {selectedVendor.phone}</p>}
                    {selectedVendor.website && <p className="truncate">{selectedVendor.website}</p>}
                    {selectedVendor.opening_hours && <p>Horaires : {selectedVendor.opening_hours}</p>}
                  </div>
                )}
```
All interpolation here is via JSX text nodes (React-escaped), not `innerHTML` — no XSS risk is introduced.

- [ ] **Step 8:** Manual verification (see Task 11) — this task has no isolated unit test beyond what Tasks 7 already covers (the fetch/normalize logic); the JSX wiring is verified via `pnpm --dir apps/web build` (compiles) + manual dev-server check per Task 11, consistent with how the rest of `map/page.jsx` is tested today (no existing component-level tests for this file).

- [ ] **Step 9: Commit**
```bash
git add apps/web/src/domains/discovery/client.ts apps/web/src/app/map/page.jsx
git commit -m "feat(map): surface OpenStreetMap businesses as unverified markers on the discovery map"
```

---

## Task 9: Patch the dead `MapComponent.jsx` for defense-in-depth (remove cap + XSS fix)

**Files:**
- Modify: `apps/web/src/components/MapComponent.jsx`

Not on the live path (see Investigation Note 1), but the mission explicitly calls it out and a real XSS bug exists there (raw template-literal HTML built from `vendor.name`/`vendor.category`/`vendor.id` etc., passed to `.bindPopup()`/`divIcon.html`). Fix cheaply since it's low-risk, self-contained, and literal compliance is easy here.

- [ ] **Step 1:** Remove the `slice(0, 8)` cap at `apps/web/src/components/MapComponent.jsx:95` — change:
```js
markers.slice(0, 8).forEach((vendor, index) => {
```
to:
```js
markers.forEach((vendor, index) => {
```

- [ ] **Step 2:** Escape all interpolated vendor-controlled strings before building popup HTML. Add near the top of the file (after imports):
```js
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}
```
Then wrap every interpolated vendor field used inside `bindPopup`/`divIcon.html` template strings (`vendor.name`, `vendor.category`, `p.name`, and the `onclick="window.checkAvailability('${vendor.id}')"` id) with `escapeHtml(...)`, e.g. `${escapeHtml(vendor.name)}` and `onclick="window.checkAvailability('${escapeHtml(vendor.id)}')"`.

- [ ] **Step 3:** Add an unmount cleanup for the map instance (missing today). Near the top of the component, after the existing effect that creates `mapInstanceRef.current`, add a dedicated cleanup effect:
```js
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);
```

- [ ] **Step 4:** Run: `pnpm --dir apps/web typecheck` — expect clean (this file is `.jsx`, not typechecked strictly, but confirms no import breakage).

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/components/MapComponent.jsx
git commit -m "fix(map): remove 8-marker cap and escape vendor HTML in legacy MapComponent"
```

---

## Task 10: Verification status badge + wiring into vendor-facing UI

**Files:**
- Create: `apps/web/src/components/VerificationBadge.jsx`
- Test: `apps/web/test/verification-badge.test.jsx` (new)
- Modify: `apps/web/src/components/FacilityCard.jsx`
- Modify: `apps/web/src/app/vendor/dashboard/page.jsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/verification-badge.test.jsx`:
```jsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import VerificationBadge from '@/components/VerificationBadge';

describe('VerificationBadge', () => {
  it('renders the non_verifiee label with an icon, not color alone', () => {
    render(<VerificationBadge status="non_verifiee" />);
    expect(screen.getByText('Non vérifiée')).toBeInTheDocument();
  });

  it('renders the verifiee label', () => {
    render(<VerificationBadge status="verifiee" />);
    expect(screen.getByText('Vérifiée')).toBeInTheDocument();
  });

  it('renders the certifiee label', () => {
    render(<VerificationBadge status="certifiee" />);
    expect(screen.getByText('Certifiée')).toBeInTheDocument();
  });

  it('renders nothing for an unrecognized status rather than guessing', () => {
    const { container } = render(<VerificationBadge status="unknown" />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2:** Run: `pnpm --dir apps/web exec vitest run test/verification-badge.test.jsx` — expect FAIL (module missing).

- [ ] **Step 3: Implement**, following `SubscriptionBadge.jsx`'s existing conventions (compact prop, lucide icons, pill/inline variants):

Create `apps/web/src/components/VerificationBadge.jsx`:
```jsx
import { ShieldCheck, BadgeCheck, CircleHelp } from "lucide-react";
import { VERIFICATION_STATUS_LABELS } from "@/lib/vendor-verification";

const STYLES = {
  non_verifiee: { icon: CircleHelp, className: "bg-zinc-800 text-zinc-400" },
  verifiee: { icon: ShieldCheck, className: "bg-blue-500/10 text-blue-400" },
  certifiee: { icon: BadgeCheck, className: "bg-emerald-500/10 text-emerald-400" },
};

export default function VerificationBadge({ status, compact }) {
  const config = STYLES[status];
  if (!config) return null;
  const Icon = config.icon;
  const label = VERIFICATION_STATUS_LABELS[status];

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.className}`}>
        <Icon size={10} aria-hidden="true" />
        {label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${config.className}`}>
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}
```
(Icon + text together satisfy "ne pas utiliser uniquement une couleur pour transmettre le statut".)

- [ ] **Step 4:** Run: `pnpm --dir apps/web exec vitest run test/verification-badge.test.jsx` — expect PASS (4/4).

- [ ] **Step 5:** Wire into `apps/web/src/components/FacilityCard.jsx` — add the import and render it next to the "Mobile" badge (around line 18-22):
```jsx
import VerificationBadge from "./VerificationBadge";
// ...
            {facility.type === 'mobile' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Mobile
              </span>
            )}
            {facility.verification_status && (
              <VerificationBadge status={facility.verification_status} compact />
            )}
```

- [ ] **Step 6:** Wire into `apps/web/src/app/vendor/dashboard/page.jsx` next to the existing `<SubscriptionBadge tier={vendor.vendor_tier} compact />` usage (around line 218) — add:
```jsx
<VerificationBadge status={vendor.verification_status} compact />
```
with the corresponding import added at the top of the file. (`vendor.verification_status` is populated by the `my-vendor` route change from Task 6.)

- [ ] **Step 7:** Run: `pnpm --dir apps/web typecheck && pnpm --dir apps/web test:run`

- [ ] **Step 8: Commit**
```bash
git add apps/web/src/components/VerificationBadge.jsx apps/web/test/verification-badge.test.jsx apps/web/src/components/FacilityCard.jsx apps/web/src/app/vendor/dashboard/page.jsx
git commit -m "feat(ui): add VerificationBadge and wire it into facility cards and vendor dashboard"
```

---

## Task 11: Manual map verification (dev server)

- [ ] **Step 1:** Run: `pnpm --dir apps/web dev` and open the app locally.
- [ ] **Step 2:** Navigate to `/map`, grant/simulate location, confirm:
  - Map tiles render, OSM/CartoDB attribution is visible (check the MapLibre attribution control isn't covered by any panel/z-index — `map/page.jsx` already sets `attribution: '© OpenStreetMap, © CartoDB'`; visually confirm no overlay hides it).
  - More than 8 vendor markers can appear when more than 8 exist nearby (was already true before this change — confirm no regression).
  - New blue OSM markers appear alongside green OMNI markers when Overpass returns results for the area (requires outbound network access to `overpass-api.de` from the dev environment — if unavailable, note this explicitly rather than claiming it was verified).
  - Clicking an OSM marker opens the bottom sheet with the "Entreprise issue d'OpenStreetMap — Non vérifiée sur Omni" disclosure, no "Produits" section, no "Contacter"/favorite actions, no fabricated rating/online status.
  - Panning/zooming repeatedly does not duplicate markers or leak (watch dev tools memory/marker count; `vendorMarkers.current` is cleared every render of the effect).
- [ ] **Step 3:** Record the outcome (pass / partial / not testable — with reason) for the final report. Do not claim PASS if network access to Overpass or a browser was unavailable in this environment — say so plainly.

---

## Task 12: Documentation

**Files:**
- Modify or create under `apps/web/docs/` (follow existing structure — `apps/web/docs/operations/fedapay.md` already exists as a precedent for an operations doc)

- [ ] **Step 1:** Create `apps/web/docs/operations/vendor-verification.md`:
```markdown
# Vendor verification status

OMNI businesses have exactly one of three states, always **derived at read
time** by `apps/web/src/lib/vendor-verification.ts` — never stored as a
persisted flag, so it can never go stale:

| KYC status | Subscription | Result |
|---|---|---|
| none / absent | any | Non vérifiée |
| pending | any | Non vérifiée |
| rejected | any | Non vérifiée |
| revoked | any | Non vérifiée |
| approved | not active/paid | Vérifiée |
| approved | active and paid | Certifiée |

Unclaimed OpenStreetMap businesses (`source: 'osm'`) are **always** "Non
vérifiée", regardless of any tag data — appearing on OpenStreetMap is not an
OMNI validation.

## Certification is dynamic, not permanent

Certification requires KYC `approved` **and** an active, paid subscription
(`subscriptions.status = 'active'` and `end_date` is null or in the future).
The moment either condition stops holding — subscription expires, is
cancelled, payment fails, or KYC is revoked — the derived status changes on
the very next read. There is nothing to "clean up" or expire via a cron job.

## OpenStreetMap ingestion

`apps/web/src/lib/osm-overpass.js` queries the public Overpass API
(`overpass-api.de`) for a bounding box derived from the map viewport,
restricted to business-relevant tags (`shop`, a curated `amenity` allowlist,
`office`, `craft`, `healthcare`, a curated `tourism` allowlist). Results are
cached in-memory per bounding box for 5 minutes (best-effort — this cache is
per server process and does not persist across serverless invocations) and
capped to a max radius of 3km to protect the public Overpass instance from
abuse. `apps/web/src/app/api/discovery/osm/normalize.js` converts raw
elements into `osm:<type>:<id>`-identified records with only the fields
actually present in OSM tags — no rating, no product list, no online status,
and no verification status other than "non_verifiee" is ever attached.

OSM results and OMNI vendors are **not** automatically merged/deduplicated
by name — the mission explicitly rules out approximate name-based matching
as unsafe. A vendor can only be linked to an OSM object it was legitimately
claimed from, via the optional `vendors.osm_type`/`vendors.osm_id` columns
(migration `0006`), which have a partial unique index preventing the same
OSM object from being claimed twice.

## Environment variables

No new environment variables are required — the Overpass endpoint is a
fixed public URL, not configurable per environment.

## Applying migration 0006

```bash
pnpm --dir apps/web run db:migrate:status   # dry run, shows pending migrations
pnpm --dir apps/web run db:migrate          # applies pending migrations, requires DATABASE_URL
```

Post-deploy checks:
- `SELECT kyc_status, source, count(*) FROM vendors GROUP BY 1, 2;` — confirm every pre-existing vendor is `kyc_status = 'none'`, `source = 'omni'`.
- `SELECT status, count(*) FROM subscriptions GROUP BY 1;` — confirm every pre-existing row defaulted to `status = 'inactive'`.
```

- [ ] **Step 2:** Add a short note to `apps/web/docs/operations/fedapay.md` (append, don't restructure) confirming the auth fix does not change any FedaPay-facing contract — one sentence, e.g.: "2026-08: the `getServerSession` auth bug (undefined `token`) that could 500 the wallet routes was fixed in `apps/web/src/lib/auth.ts`; no FedaPay-specific code changed."

- [ ] **Step 3: Commit**
```bash
git add apps/web/docs/operations/vendor-verification.md apps/web/docs/operations/fedapay.md
git commit -m "docs: document vendor verification rules and OSM ingestion strategy"
```

---

## Task 13: Final full verification and push

- [ ] **Step 1:** `pnpm install --frozen-lockfile` (from `apps/web`) — confirm no `pnpm-lock.yaml` diff (`git status --short`, `git diff -- pnpm-lock.yaml`).
- [ ] **Step 2:** `pnpm --dir apps/web test:run` — confirm 0 failures; record exact pass count for the final report.
- [ ] **Step 3:** `pnpm --dir apps/web typecheck` — confirm clean.
- [ ] **Step 4:** `pnpm --dir apps/web build` — confirm success.
- [ ] **Step 5:** `git diff --check` — confirm no whitespace errors.
- [ ] **Step 6:** `pnpm --dir apps/web exec vitest run test/fedapay-payment.test.js test/fedapay-webhook.test.js` — confirm all 26 cases pass (part of the 29 total FedaPay-labeled tests, the remaining being in `financial-route-auth.test.js`/`database-migrations.test.js` per Task 3's inventory — run those too and confirm the full 29 are green).
- [ ] **Step 7:** Attempt `pnpm --dir apps/web test:e2e` — record PASS/FAIL/SKIPPED honestly (Playwright may require a browser install or a running build; note exact reason if skipped).
- [ ] **Step 8:** `git log --oneline -15` — confirm the commit sequence from Tasks 1-12 is present and clean.
- [ ] **Step 9:** Confirm branch state before push:
```bash
git remote -v
git branch --show-current
git status --short
```
- [ ] **Step 10:** Push to the fork only:
```bash
git push -u origin agent/fix-auth-osm-business-status
```
(Or `-v2` if that branch name had diverged from a clean base at branch-setup time — see main mission instructions §5.)

---

## Self-Review Notes (from applying the plan-writing skill's checklist to this plan)

- **Spec coverage:** Auth (Tasks 1-3), FedaPay non-regression (Task 3 + 13, no code touched), OSM ingestion + map display + attribution + XSS-safety (Tasks 7-9, 11), vendor status derivation + migration + UI (Tasks 4, 5, 6, 10), docs (Task 12), commits/push (throughout + Task 13) — all mission objectives A-F have at least one task.
- **No placeholders:** every step above includes literal code, not descriptions of code.
- **Type/name consistency check:** `deriveVerificationStatus(input)` (Task 4) is called identically in Task 6 (`discovery-service`/`geo.js`/`my-vendor`) and imported by name in `VerificationBadge.jsx` (Task 10, via `VERIFICATION_STATUS_LABELS`, not the function itself — confirmed both are exported from `vendor-verification.ts`). `normalizeOsmElement` (Task 7a) fields (`osmType`, `osmId`, `source`, `verification_status`, `tags`) match what Task 8/Task 11 expect on `selectedVendor` (`selectedVendor.source`, `.address`, `.phone`, `.website`, `.opening_hours`) and what Task 7c's route test asserts (`source: 'osm'`, `verification_status: 'non_verifiee'`). `loadNearbyOsmBusinesses` (Task 8) matches the route path `/api/discovery/osm` created in Task 7c.
