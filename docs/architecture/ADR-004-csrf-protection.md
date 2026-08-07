# ADR-004: CSRF protection for cookie-based sessions

- Status: accepted
- Date: 2026-08-07

## Context

Auth uses `HttpOnly` cookies (access + refresh), not `Authorization`
headers, so the browser attaches them automatically to any request to
`omni-backend` -- including one triggered by a malicious third-party page.
`SameSite=Lax` (the configured default, see `COOKIE_SAME_SITE`) blocks
cookies on cross-site *sub-requests* (fetch/XHR, iframes) but **not** on
top-level navigations, and provides no protection at all if a deployment
ever needs `SameSite=None` (e.g. a genuinely cross-origin frontend/backend
split in some environments). Treating `SameSite=Lax` alone as sufficient
CSRF protection was explicitly ruled out by the mission brief.

## Decision

Double-submit cookie pattern, implemented directly (no external CSRF
package -- the historical `csurf` package is deprecated/unmaintained):

1. On login/register/refresh, the backend sets a second, **non-HttpOnly**
   cookie `omni_csrf` containing a random 32-byte token (readable by
   frontend JS, unlike the session cookies).
2. Every mutating request (`POST`/`PUT`/`PATCH`/`DELETE`) must include that
   same token in an `X-CSRF-Token` header.
3. `CsrfGuard` (`src/common/guards/csrf.guard.ts`) compares the cookie
   value to the header value with a constant-time comparison and rejects
   the request (`403 CSRF_TOKEN_INVALID`) if they don't match or either is
   missing.
4. `GET`/`HEAD`/`OPTIONS` requests are exempt (no state change).
5. `POST /api/v1/auth/register` and `/auth/login` are `@SkipCsrf()`: no
   session cookie exists yet at that point, so there is nothing for an
   attacker to ride on -- discovered as a real chicken-and-egg bug during
   live testing (the very first register call was rejected because no
   `omni_csrf` cookie could exist before any session had ever been
   created). `POST /api/v1/auth/refresh` is also `@SkipCsrf()`: it is
   already protected by refresh-token rotation + reuse detection
   (`SessionService.rotateSession`), and only the legitimate browser can
   ever read the response body (new tokens) due to CORS, so a forged
   refresh call gains an attacker nothing. `logout`/`logout-all` remain
   CSRF-protected -- they run within an already-established session.
6. The webhook route (`/api/v1/payments/fedapay/webhook`) is exempt from
   this guard specifically -- it is authenticated by HMAC signature
   verification instead (see `docs/api/authentication.md` and the FedaPay
   module), not by cookies, so CSRF does not apply to it.

An attacker's page cannot read `omni_csrf` (different origin, cookie is
readable only by JS running on `omni-web-frontend`'s own origin) and
therefore cannot forge the header, even though the session cookies
themselves would be attached automatically to a forged request.

## Consequences

- The frontend's browser API client (`src/lib/api/browser-client.ts`)
  must read `omni_csrf` from `document.cookie` and attach it as
  `X-CSRF-Token` on every mutating call -- implemented once, centrally,
  not per call site.
- `SameSite=Lax` remains in place as defense-in-depth, not as the sole
  mechanism.
- No dependency on an unmaintained third-party CSRF package.
