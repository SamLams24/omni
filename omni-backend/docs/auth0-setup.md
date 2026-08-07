# Auth0 tenant configuration

Auth0 is used **only as an OIDC identity provider** for Google/Facebook social login -- it never owns an OMNI session. `IdentityService.linkOrCreateFromOidc` (real, unit-tested) is what actually links a verified Auth0 identity to an OMNI `User` and issues OMNI's own JWT/session; `OidcController`'s `/auth/oidc/start` and `/auth/oidc/callback` routes are currently a deliberate stub returning `503 AUTH0_NOT_CONFIGURED` because no real Auth0 tenant exists yet in any environment this code has run in.

## What needs to be created manually (not automated by this repo)

1. An Auth0 tenant (or an application inside an existing one).
2. A "Regular Web Application" for `omni-backend` (the OIDC callback is handled server-side).
3. Google and Facebook social connections enabled on that application.
4. The following Application URIs, one entry per environment that needs to work:

   | Setting | Local | Vercel Preview | Production |
   |---|---|---|---|
   | Allowed Callback URLs | `http://localhost:4000/api/v1/auth/oidc/callback` | `https://<render-preview-domain>/api/v1/auth/oidc/callback` | `https://<render-production-domain>/api/v1/auth/oidc/callback` |
   | Allowed Logout URLs | `http://localhost:3000` | the Vercel preview URL | the production frontend URL |
   | Allowed Web Origins | `http://localhost:3000` | the Vercel preview URL | the production frontend URL |
   | Allowed Origins (CORS) | `http://localhost:3000` | the Vercel preview URL | the production frontend URL |

5. Copy from the Auth0 application's settings page into the backend's environment variables (`docs/deployment-render.md`):
   - `AUTH0_DOMAIN` (e.g. `your-tenant.us.auth0.com`)
   - `AUTH0_CLIENT_ID`
   - `AUTH0_CLIENT_SECRET`
   - `AUTH0_CALLBACK_URL` (must exactly match one of the Allowed Callback URLs above)
   - `AUTH0_AUDIENCE` (only if using an Auth0 API identifier; leave unset otherwise)

## What this repo does NOT do

- It does not call the Auth0 Management API to create the tenant/application/connections for you -- that's a one-time manual setup in the Auth0 dashboard.
- It does not implement the actual `openid-client`/passport-auth0 token exchange yet (`OidcController` is a stub). Wiring that up is future work once real credentials exist to test against -- see the code comments in `omni-backend/src/modules/auth/oidc.controller.ts`.

## Manual steps I still need to do

1. Create the Auth0 tenant/application and enable Google + Facebook connections.
2. Fill in the Allowed URLs table above for every environment (localhost now; Render preview/production once those domains exist).
3. Set the five `AUTH0_*` environment variables on Render.
4. Implement the real OIDC token exchange in `OidcController` once the above is done and testable.
