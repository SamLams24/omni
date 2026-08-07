# ADR-003: Identity provider model (Auth0 as broker, not per-social-provider rows)

- Status: accepted
- Date: 2026-08-07

## Context

OMNI needs local email/password auth plus Google and Facebook login. The
brief suggested weighing whether `Identity.provider` should distinguish
`GOOGLE`/`FACEBOOK` directly, or record `AUTH0` generically with the actual
social connection as metadata.

Auth0 is being used strictly as an OIDC broker/IdP (see
`docs/api/authentication.md`): `omni-backend` never talks to Google's or
Facebook's OAuth endpoints directly. It only ever receives a validated OIDC
identity token *from Auth0*, whose `sub` claim already encodes the
originating connection (e.g. `google-oauth2|108...`, `facebook|101...`).

## Decision

`Identity.provider` is `IdentityProvider` with two values: `LOCAL` and
`AUTH0`. There is no `GOOGLE`/`FACEBOOK` enum value. The specific social
connection Auth0 brokered (`google-oauth2`, `facebook`, and later `apple`
with zero schema change) is stored in `Identity.providerMetadata` (JSON),
e.g. `{"connection": "google-oauth2"}`.

Rationale: creating `GOOGLE`/`FACEBOOK` enum members would imply
`omni-backend` has a direct relationship with those providers, which it
never does -- every request in that flow terminates at Auth0. Modeling the
provider as `AUTH0` reflects the real trust boundary: the backend verifies
one JWKS-signed token issuer (Auth0's), not N different provider
signatures. Adding a new social connection (Apple, LinkedIn, ...) later is
a zero-migration Auth0 dashboard change, not a schema change.

## Consequences

- `Identity` uniqueness is `@@unique([provider, providerUserId])` where
  `providerUserId` is Auth0's `sub` claim in full (already
  connection-qualified, e.g. `google-oauth2|108...`) -- this alone already
  prevents cross-connection collisions without needing a separate enum.
- Any UI that wants to show "signed in with Google" reads
  `providerMetadata.connection`, not `provider`.
- If OMNI ever integrates a provider *without* going through Auth0 (direct
  OAuth), that would be a new enum value at that time -- not before.

## Account linking

See `docs/api/account-linking.md` for the linking-safety rules referenced
by this model (an `AUTH0` identity is never silently merged into an
existing `LOCAL` user by email match alone).
