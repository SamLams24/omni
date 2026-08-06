# Simplify Auth: JWT via Authorization Header

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the broken cookie bridge by sending the Neon Auth JWT in the `Authorization` header instead of the `omni_session` cookie.

**Architecture:** Keep Neon Auth SDK for identity (sign-in/sign-up/sign-out). Remove all cookie management. Client sends JWT via `Authorization: Bearer <token>` header. Server reads JWT from header instead of cookie. One helper function `authFetch()` auto-injects the header on all authenticated client requests.

**Tech Stack:** Neon Auth SDK (`@neondatabase/neon-js/auth`), React Router 7, Hono (API routes), PostgreSQL/Neon

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/auth-client.js` | **Rewrite** | Remove cookie bridge, add `getAuthToken()` and `authFetch()` |
| `src/lib/auth.ts` | **Modify** | Read JWT from `Authorization` header instead of `omni_session` cookie |
| `src/app/api/auth/session/route.js` | **Simplify** | Remove cookie debug logging |
| `src/app/api/auth/set-session/route.js` | **Delete** | No longer needed |
| `src/app/api/auth/clear-session/route.js` | **Delete** | No longer needed |
| `src/app/root.tsx` | **Simplify** | Remove `syncAuthSession` fallback, use `authFetch` |
| `src/components/GlobalNav.jsx` | **Simplify** | Remove `syncAuthSession` fallback |
| `src/app/map/page.jsx` | **Simplify** | Remove `syncAuthSession` fallback |
| `src/utils/useAuth.js` | **Modify** | Use `authFetch` for session checks |
| `src/app/settings/page.jsx` | **Modify** | Use `authFetch` instead of raw `getSession` + `signOut` |
| `src/app/user/profile/page.jsx` | **Modify** | Use `authFetch` |
| `src/app/vendor/layout.jsx` | **Modify** | Use `authFetch` |
| `src/app/vendor/onboarding/page.jsx` | **Modify** | Use `authFetch` |
| `src/utils/useUser.js` | **Modify** | Use `authFetch` |
| `src/components/AuthGuard.jsx` | **Delete** | Dead code, never imported |

---

## Task 1: Rewrite `auth-client.js` — Remove Cookie Bridge, Add `authFetch`

**Files:**
- Modify: `src/lib/auth-client.js`

**What changes:**
- Remove `setSessionCookie()`, `clearSessionCookie()`, `syncAuthSession()`
- Add `getAuthToken()` — returns raw JWT from Neon Auth SDK
- Add `authFetch(url, options)` — wraps `fetch()` with `Authorization: Bearer <token>` header
- Simplify `signInWithCredentials`, `signUpWithCredentials`, `signOut` (no cookie calls)
- Keep `getSession()` — calls Neon Auth SDK directly (client-side)

- [ ] **Step 1: Rewrite auth-client.js**

```javascript
import { createAuthClient } from '@neondatabase/neon-js/auth';

let authClient;

export function getClientAuthUrl() {
  return (process.env.NEXT_PUBLIC_NEON_AUTH_URL || import.meta.env.VITE_NEON_AUTH_URL || '').replace(/\/+$/, '') || null;
}

function getAuthClient() {
  const authUrl = getClientAuthUrl();
  if (!authUrl) {
    throw new Error('Authentication is not configured');
  }
  authClient ||= createAuthClient(authUrl, {
    fetchOptions: { credentials: 'include' },
  });
  return authClient;
}

export async function getSession() {
  const result = await getAuthClient().getSession();
  if (result.error) {
    return { user: null, session: null };
  }
  return {
    user: result.data?.user || null,
    session: result.data?.session || null,
  };
}

export async function getAuthToken() {
  try {
    const client = getAuthClient();
    const { data, error } = await client.token();
    if (error || !data?.token) return null;
    return data.token;
  } catch {
    return null;
  }
}

export async function authFetch(url, options = {}) {
  const token = await getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers, credentials: 'omit' });
}

export async function signInWithCredentials({ email, password }) {
  const client = getAuthClient();
  return await client.signIn.email({ email, password });
}

export async function signUpWithCredentials({ email, password, name }) {
  const client = getAuthClient();
  return await client.signUp.email({ email, password, name });
}

export async function signOut() {
  const client = getAuthClient();
  return await client.signOut();
}

export async function checkAuth() {
  const { user } = await getSession();
  return !!user;
}
```

- [ ] **Step 2: Verify no import errors**

Run: `grep -r "syncAuthSession\|setSessionCookie\|clearSessionCookie" src/` to find all references that need updating.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth-client.js
git commit -m "refactor(auth): remove cookie bridge, add authFetch with Authorization header"
```

---

## Task 2: Update `auth.ts` — Read JWT from Authorization Header

**Files:**
- Modify: `src/lib/auth.ts`

**What changes:**
- `getServerSession()` reads JWT from `Authorization` header instead of `omni_session` cookie
- Remove `parseCookie()` function
- Remove debug `console.log` statements

- [ ] **Step 1: Rewrite getServerSession in auth.ts**

Replace the entire file with:

```typescript
import { neon, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const dbUrl = process.env.DATABASE_URL;
const sql = dbUrl ? neon(dbUrl) : null;

function getAuthUrl() {
  return (process.env.NEON_AUTH_URL || import.meta.env.VITE_NEON_AUTH_URL || '').replace(/\/+$/, '') || null;
}

async function ensureAppUser(authUser) {
  if (!sql) return;
  try {
    const email = authUser.email || `${authUser.id.replace(/-/g, '')}@omni.app`;
    await sql`
      INSERT INTO users (id, name, email)
      VALUES (${authUser.id}::uuid, ${authUser.name || 'Utilisateur'}, ${email})
      ON CONFLICT (id) DO UPDATE
        SET name = COALESCE(EXCLUDED.name, users.name),
            email = COALESCE(EXCLUDED.email, users.email),
            updated_at = CURRENT_TIMESTAMP
    `;
  } catch (error) {
    console.error('[Auth] Failed to sync authenticated user');
  }
}

export async function getServerSession(request) {
  const authUrl = getAuthUrl();
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!authUrl || !token) {
    return null;
  }

  try {
    const response = await fetch(`${authUrl}/get-session`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data?.user?.id) {
      return null;
    }

    await ensureAppUser(data.user);
    return {
      data: {
        user: data.user,
        session: data.session || {},
      },
    };
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(request) {
  const session = await getServerSession(request);
  return session?.data?.user || null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "refactor(auth): read JWT from Authorization header instead of cookie"
```

---

## Task 3: Simplify Session Route & Delete Cookie Routes

**Files:**
- Modify: `src/app/api/auth/session/route.js`
- Delete: `src/app/api/auth/set-session/route.js`
- Delete: `src/app/api/auth/clear-session/route.js`

- [ ] **Step 1: Simplify session route**

Replace `src/app/api/auth/session/route.js` with:

```javascript
import { getServerSession } from "@/lib/auth";

export async function GET(request) {
  try {
    const session = await getServerSession(request);
    if (!session?.data?.user) {
      return Response.json({ user: null, session: null });
    }
    return Response.json({
      user: session.data.user,
      session: session.data.session,
    });
  } catch (error) {
    return Response.json({ user: null, session: null });
  }
}
```

- [ ] **Step 2: Delete set-session and clear-session routes**

```bash
rm src/app/api/auth/set-session/route.js
rm src/app/api/auth/clear-session/route.js
rmdir src/app/api/auth/set-session
rmdir src/app/api/auth/clear-session
```

- [ ] **Step 3: Commit**

```bash
git add -A src/app/api/auth/
git commit -m "refactor(auth): delete cookie routes, simplify session endpoint"
```

---

## Task 4: Update Client-Side Auth Checks (RouteGuard, GlobalNav, MapPage)

**Files:**
- Modify: `src/app/root.tsx` (RouteGuard)
- Modify: `src/components/GlobalNav.jsx`
- Modify: `src/app/map/page.jsx`

**What changes:**
- Remove `syncAuthSession` fallback — just use `getSession()` from Neon Auth SDK
- For server-side session checks, use `authFetch("/api/auth/session")` instead of `fetch("/api/auth/session")`
- RouteGuard: simpler — check client-side session, show spinner while checking

- [ ] **Step 1: Simplify RouteGuard in root.tsx**

Replace the RouteGuard function (lines 513-571) with:

```tsx
function RouteGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const pathname = location.pathname;
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [prevPathname, setPrevPathname] = useState(pathname);

  const publicRoutes = ["/map", "/auth", "/", "/onboarding"];
  const isPublic = publicRoutes.some((route) => pathname === route || pathname.startsWith("/auth") || pathname.startsWith("/onboarding"));

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (!isPublic) {
      setChecking(true);
      setAuthed(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { getSession } = await import("@/lib/auth-client");
        const session = await getSession();
        if (cancelled) return;
        setAuthed(!!session?.user);
      } catch {
        if (!cancelled) setAuthed(false);
      }
      if (!cancelled) setChecking(false);
    };
    check();
    return () => { cancelled = true; };
  }, [pathname]);

  if (isPublic) return <>{children}</>;

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#050510]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-4" />
      </div>
    );
  }

  if (!authed) {
    const callback = encodeURIComponent(pathname);
    return <Navigate to={`/auth?callbackUrl=${callback}`} replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Simplify GlobalNav.jsx auth check**

Replace the auth check useEffect (around lines 17-35) with:

```jsx
useEffect(() => {
  const checkAuth = async () => {
    try {
      const { getSession } = await import("@/lib/auth-client");
      const session = await getSession();
      setIsAuthenticated(!!session?.user);
      setUser(session?.user || null);
    } catch {
      setIsAuthenticated(false);
      setUser(null);
    }
    setAuthLoading(false);
  };
  checkAuth();
}, []);
```

- [ ] **Step 3: Simplify map/page.jsx auth check**

Replace the auth check useEffect (around lines 148-169) with:

```jsx
useEffect(() => {
  const checkAuth = async () => {
    try {
      const { getSession } = await import("@/lib/auth-client");
      const session = await getSession();
      if (session?.user) {
        setUser(session.user);
      }
    } catch {}
  };
  checkAuth();
}, []);
```

- [ ] **Step 4: Commit**

```bash
git add src/app/root.tsx src/components/GlobalNav.jsx src/app/map/page.jsx
git commit -m "refactor(auth): simplify client auth checks, remove syncAuthSession"
```

---

## Task 5: Update Remaining Client Files

**Files:**
- Modify: `src/utils/useAuth.js`
- Modify: `src/utils/useUser.js`
- Modify: `src/app/settings/page.jsx`
- Modify: `src/app/user/profile/page.jsx`
- Modify: `src/app/vendor/layout.jsx`
- Modify: `src/app/vendor/onboarding/page.jsx`
- Delete: `src/components/AuthGuard.jsx`

- [ ] **Step 1: Update useAuth.js**

Replace the session check in `useAuth.js` (the part that calls `getSession()` and `syncAuthSession`) with just `getSession()`:

```javascript
// In the checkAuth / initial load effect:
const { getSession } = await import('@/lib/auth-client');
const session = await getSession();
```

Remove any `syncAuthSession` references.

- [ ] **Step 2: Update useUser.js**

Replace `import { getSession } from "@/lib/auth-client"` — this should still work since `getSession` is still exported. No changes needed unless it uses `syncAuthSession`.

- [ ] **Step 3: Update settings/page.jsx**

Replace `import { getSession, signOut } from "@/lib/auth-client"` — `getSession` and `signOut` are still exported. No changes needed.

- [ ] **Step 4: Update user/profile/page.jsx**

Same as above — `getSession` and `signOut` are still exported. No changes needed.

- [ ] **Step 5: Update vendor/layout.jsx**

`signOut` is still exported. No changes needed.

- [ ] **Step 6: Update vendor/onboarding/page.jsx**

`getSession` is still exported. No changes needed.

- [ ] **Step 7: Delete AuthGuard.jsx**

```bash
rm src/components/AuthGuard.jsx
```

- [ ] **Step 8: Verify no remaining references to deleted functions**

Run: `grep -r "syncAuthSession\|setSessionCookie\|clearSessionCookie\|AuthGuard" src/`

Expected: No matches (except possibly in comments).

- [ ] **Step 9: Commit**

```bash
git add -A src/
git commit -m "refactor(auth): clean up remaining client files, delete dead AuthGuard"
```

---

## Task 6: Clean Up Vercel Env Vars & Verify

**Files:**
- No code changes

- [ ] **Step 1: Remove NEON_AUTH_COOKIE_SECRET from Vercel**

This env var was used by the deleted `authApiHandler` catch-all. It's no longer needed.

Go to Vercel Dashboard → Settings → Environment Variables → Delete `NEON_AUTH_COOKIE_SECRET`.

- [ ] **Step 2: Verify build succeeds**

Push to main and check Vercel build logs for errors.

- [ ] **Step 3: Test auth flow in incognito**

1. Go to `omni.sparkafrika.online/map`
2. Open console (F12)
3. Sign in via NeonAuth
4. Navigate to `/user/profile` — should load profile (no redirect to `/auth`)
5. Sign out — should work
6. Check that API calls include `Authorization: Bearer <token>` in Network tab

- [ ] **Step 4: Verify API routes work**

In browser console after sign-in:
```javascript
const { authFetch } = await import('@/lib/auth-client');
const res = await authFetch('/api/auth/session');
const data = await res.json();
console.log(data); // Should show { user: {...}, session: {...} }
```

---

## Summary of Changes

| Before | After |
|--------|-------|
| JWT stored in `omni_session` cookie | JWT sent in `Authorization` header |
| `/api/auth/set-session` sets cookie | Deleted |
| `/api/auth/clear-session` clears cookie | Deleted |
| `syncAuthSession()` bridges cookie | Deleted |
| `authFetch()` doesn't exist | Auto-injects `Authorization` header |
| `auth.ts` reads cookie | Reads `Authorization` header |
| RouteGuard uses `syncAuthSession` fallback | Uses `getSession()` directly |
| `AuthGuard.jsx` exists (dead code) | Deleted |
