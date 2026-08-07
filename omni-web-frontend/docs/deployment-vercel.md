# Deploying omni-frontend to Vercel

## Project configuration

- **Framework Preset:** Next.js (auto-detected)
- **Repository:** `SamLams24/omni-frontend`, branch `main`
- **Root Directory:** `./` (this repository's root -- there is no nested app folder anymore; a previous deployment of the old monorepo broke specifically because Root Directory pointed at a stale nested path, see `docs/migration/omni-folder-removal.md` in the archived `SamLams24/omni` repo)
- **Install Command:** `pnpm install --frozen-lockfile`
- **Build Command:** `pnpm build` (Vercel's default for a detected Next.js project already runs this; no override needed unless Vercel's auto-detection is wrong)

Don't add a custom `vercel.json` unless a real, specific need comes up -- Next.js's own auto-detection on Vercel already handles routing, headers, and output correctly for this app.

## Required environment variables

| Variable | Development | Production |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://<this-project's-vercel-domain>` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api/v1` | `https://<render-backend-domain>/api/v1` |
| `NEXT_PUBLIC_MAP_DEFAULT_LAT` | `6.1319` | same (Lomé, Togo) unless the default map center changes |
| `NEXT_PUBLIC_MAP_DEFAULT_LON` | `1.2228` | same |
| `NEXT_PUBLIC_MAP_DEFAULT_ZOOM` | `13` | same |
| `NEXT_PUBLIC_AUTH0_DOMAIN` / `NEXT_PUBLIC_AUTH0_CLIENT_ID` | unset | unset until a client-side Auth0 entry point exists (see omni-backend's `docs/auth0-setup.md`) |

Set all `NEXT_PUBLIC_*` values in Vercel's Project Settings → Environment Variables, scoped per environment (Development/Preview/Production). None of these are secret -- they're inlined into the client bundle by design -- but `NEXT_PUBLIC_API_URL` still needs a different value per environment (see the Preview section below).

## Preview deployments and CORS

Vercel gives every PR/branch a unique preview URL (`omni-frontend-git-<branch>-<team>.vercel.app`). This app's `credentials: "include"` fetches only work if the backend's `CORS_ORIGINS` includes the exact preview origin, and cookies are only usable across `omni-frontend.vercel.app`-style origins if `COOKIE_SAME_SITE=none` (which additionally requires `COOKIE_SECURE=true`, see `docs/deployment-render.md` in `omni-backend`).

**Decision (documented, not left implicit):** do not add a wildcard `*.vercel.app` to the backend's `CORS_ORIGINS` -- that would let any Vercel project (not just previews of this one) send credentialed requests. Options going forward, to choose once preview testing against the live backend actually becomes a real need:
1. Point every preview at the same shared staging backend URL and add that one fixed origin to `CORS_ORIGINS`, or
2. Add a small, explicit allowlist of the specific preview URLs actually in use, updated manually.

**Production** always uses a strict, single-origin `CORS_ORIGINS` value (the real production frontend domain only).

## Manual steps I still need to do

1. Import `SamLams24/omni-frontend` into Vercel.
2. Set the environment variables in the table above (Production scope first; Preview once the CORS decision above is made).
3. Deploy `omni-backend` to Render first, so `NEXT_PUBLIC_API_URL` has a real value.
4. Trigger the first deploy and confirm the site loads and `/map` fetches real data from the deployed backend.
