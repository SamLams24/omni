# Omni — Complete Code Audit

**Audit Date:** August 4, 2026
**Auditor:** AI Analysis
**Repository:** github.com/Spark-Corp/omni
**Codebase analyzed:** `apps/web` (source of truth)

---

## Executive Summary

**Production Readiness Score: 3.5/10**

Omni is a hyperlocal discovery platform for African commerce. The codebase demonstrates ambitious scope (map, chat, wallet, delivery, subscriptions) but has **critical security vulnerabilities** and architectural issues that must be resolved before any production deployment.

### Verdict: NOT PRODUCTION READY

| Category | Score | Status |
|----------|-------|--------|
| Security | 2/10 | 🔴 CRITICAL |
| Authentication | 3/10 | 🔴 CRITICAL |
| Code Quality | 4/10 | 🟡 NEEDS WORK |
| Testing | 3/10 | 🔴 INSUFFICIENT |
| Documentation | 6/10 | 🟡 ADEQUATE |
| Architecture | 4/10 | 🟡 NEEDS WORK |

---

## 🔴 CRITICAL SECURITY ISSUES

### 1. Client-Controlled Identity (Severity: CRITICAL)

**Location:** Throughout `src/app/vendor/`, `src/components/`, `src/app/dashboard/`

**Problem:** User identity is read from `localStorage` and sent via `x-user-id` header:

```javascript
// From vendor/settings/page.jsx
const userId = JSON.parse(localStorage.getItem("omni_user")).id;
headers: { "x-user-id": userId }
```

**Impact:** Any user can impersonate any other user by modifying the header. This allows:
- Accessing other vendors' data
- Modifying other users' profiles
- Unauthorized financial operations

**Required Fix:** Server-side session validation only. Remove ALL `x-user-id` header usage. The `getAuthenticatedUser()` function exists and works correctly — it needs to be used consistently.

---

### 2. localStorage as Identity Source (Severity: CRITICAL)

**Location:** 48 occurrences across codebase

**Problem:** User state stored in `localStorage("omni_user")` is:
- Readable by any JavaScript code (XSS vulnerability)
- Writable by any code (identity spoofing)
- Not cryptographically signed

**Impact:** Complete authentication bypass possible via browser DevTools.

**Required Fix:** Replace with httpOnly, secure, SameSite cookies managed by server.

---

### 3. Financial Operations with Mock Logic (Severity: CRITICAL)

**Location audited:** `src/app/api/wallet/deposit/route.js`, `withdraw/route.js`

**Remediation status:** The simulated deposit was replaced by provider-verified,
idempotent FedaPay settlement. The simulated withdrawal debit was removed and
the endpoint now always fails closed until a payout provider is integrated.

**Historical risk resolved:** The old routes could mutate wallet balances
without a verified provider transaction and without idempotency. No simulated
deposit or withdrawal balance mutation remains reachable.

**Remaining work:** Integrate and verify a payout provider before enabling
withdrawals. Local subscription billing and activation have also been removed;
the module requires a dedicated, provider-verified billing design. Simulated
escrow mutations and their client-side payment choice have been removed. The
simulated courier wallet credit has also been removed; a real provider-backed
payout design is still required before courier settlement can be introduced.

---

### 4. Incomplete Auth Implementation (Severity: HIGH)

**File:** `src/lib/auth.ts`

**Current Implementation:**
```typescript
export async function getServerSession(request) {
  const authUrl = getAuthUrl();
  const cookie = request.headers.get('cookie');
  // Calls Neon Auth endpoint
}
```

**Issues:**
- Falls back to `null` silently on any error
- No token refresh mechanism
- Session timeout not enforced
- No CSRF protection

---

## 🟡 HIGH PRIORITY ISSUES

### 5. Dependency Management Broken

**File:** `apps/web/package.json`

**Problem:** `pnpm-lock.yaml` doesn't match `package.json` — clean install fails.

**Impact:** Cannot reproduce builds in CI/CD or new environments.

---

### 6. Test Coverage Insufficient

**Test Directory:** `apps/web/test/`

**Findings:**
- 24 test files exist
- Most tests are **mocks, not integration tests**
- Tests recreate simplified logic instead of importing real handlers
- No E2E tests (Playwright/Cypress)
- No real API endpoint testing

**Example from `api.test.js`:**
```javascript
// This tests nothing real — just mocks the SQL function
sql.mockResolvedValueOnce(mockVendors);
const result = await sql(query, params);
expect(result).toEqual(mockVendors);
```

---

### 7. Code Duplication

**Pattern:** `localStorage.getItem("omni_user")` repeated 48 times across codebase.

**Impact:** Maintenance nightmare. Every auth change requires updating dozens of files.

---

### 8. Mixed File Types

**Observation:** `.js`, `.jsx`, `.tsx` files mixed in same directories.

**Impact:** Inconsistent type safety. No TypeScript benefits in most files.

---

### 9. Large Files Need Splitting

**File:** `src/app/map/page.jsx`

**Size:** ~1,500 lines (per previous audit)

**Recommended Max:** 300 lines per component.

---

## 📊 Architecture Assessment

### What Works Well
- ✅ Neon PostgreSQL + PostGIS for geospatial queries
- ✅ React Router 7 with Vite
- ✅ Proper separation of API routes
- ✅ Runtime feature flags for mock features
- ✅ Database migrations exist (2 files)

### What Needs Improvement
- ❌ No consistent state management (Zustand installed but not used everywhere)
- ❌ React Query installed but not used for API calls
- ❌ No API versioning
- ❌ No rate limiting on most endpoints
- ❌ No request logging for audit trail

---

## 🗄️ Database Assessment

**Migrations:**
- `0001_baseline.sql`
- `0002_product_timestamps.sql`

**Issues:**
- Many ad-hoc SQL scripts in legacy directories
- No RLS policies visible in migrations
- Schema state cannot be reliably inferred

---

## 📋 Recommendations

### Phase 1: Immediate Security Fixes (1-2 weeks)

| # | Action | Priority |
|---|--------|----------|
| 1 | Remove ALL `x-user-id` header usage | CRITICAL |
| 2 | Remove ALL `localStorage` identity reads | CRITICAL |
| 3 | Implement proper httpOnly cookie auth | CRITICAL |
| 4 | Rotate all exposed credentials | CRITICAL |
| 5 | Disable/remove mock financial flows | CRITICAL |

### Phase 2: Code Quality (2-4 weeks)

| # | Action | Priority |
|---|--------|----------|
| 6 | Fix dependency lockfile | HIGH |
| 7 | Convert `.js` → `.tsx` with types | HIGH |
| 8 | Extract auth utility (remove duplication) | HIGH |
| 9 | Split map page into components | HIGH |
| 10 | Implement React Query for API calls | HIGH |

### Phase 3: Testing (2-3 weeks)

| # | Action | Priority |
|---|--------|----------|
| 11 | Write integration tests for API routes | HIGH |
| 12 | Add E2E tests for critical journeys | HIGH |
| 13 | Add security-focused tests | HIGH |
| 14 | Set up CI/CD with test gates | MEDIUM |

### Phase 4: Production Readiness (4-6 weeks)

| # | Action | Priority |
|---|--------|----------|
| 15 | Implement real payment provider | HIGH |
| 16 | Add Sentry/error tracking | MEDIUM |
| 17 | Add request logging | MEDIUM |
| 18 | Add API rate limiting | MEDIUM |
| 19 | Create proper design system | MEDIUM |

---

## 🎯 Bottom Line

**Do not deploy to production.** The codebase has critical security vulnerabilities that would allow complete account takeover and financial fraud.

**Immediate priorities:**
1. Fix authentication (remove client-controlled identity)
2. Fix dependency management
3. Write real tests
4. Then consider production deployment

---

*Audit based on code analysis of github.com/Spark-Corp/omni at commit HEAD*
