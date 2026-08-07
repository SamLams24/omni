# Removal of the stale `omni/` folder

## What it was

A nested `omni/` directory at the repository root (distinct from `apps/`),
containing `omni/apps/web` (react-router 7 + Vite + Hono, an earlier
snapshot of the same stack as the real `apps/web`), `omni/apps/nextjs`
(an abandoned separate Next.js prototype), and `omni/apps/mobile` (an
earlier snapshot of the real `apps/mobile`). 414 tracked files, ~13MB.

## Why it was investigated

This is the literal root cause of a real production incident found during
an earlier mission: a Vercel deployment was configured with Root
Directory `omni/apps/web` instead of the fork's real `apps/web`, so
production was building a stale, out-of-date snapshot of the app — see
the Vercel build logs analyzed at the time, which referenced this exact
path and failed on a missing `axios` import from a file (`simple-auth.js`)
that no longer exists in the real `apps/web`.

## Evidence of obsolescence (checked before removal, not assumed)

- **Git history is fully disjoint from the active app.** The last commit
  touching anything under `omni/` is `2026-07-25`'s "chore: establish
  repository foundation" -- a single historical import. Every commit
  since (`apps/web` has dozens through `2026-08-06`, including this
  mission's own work) never touches `omni/` again.
- **Not part of the pnpm workspace.** `pnpm-workspace.yaml` only lists
  `omni-web-frontend` and `omni-backend`; `omni/` was never a workspace
  package for either the legacy app or the new architecture.
- **Not referenced anywhere in the currently active code.** Searched
  `apps/`, `omni-backend/src`, `omni-web-frontend/src`, and the root
  `package.json`/`pnpm-workspace.yaml` for any import, path, or config
  pointing at `omni/` or `omni/apps/*` -- zero matches.
- **Superseded, not complementary.** `omni/apps/web` is an older snapshot
  of the exact same react-router/Vite/Hono stack as `apps/web` (e.g.
  `react-router@7.6.0` vs the real app's `7.18.2`, `hono@4.12.19` vs
  `4.13.0`) -- not a different product, just a stale fork point nothing
  has built on since. `omni/apps/nextjs` is a separate, never-continued
  prototype with no callers anywhere.

## Action taken

Removed in this dedicated commit (`chore: remove stale omni/ duplicate
folder`), not bundled with any feature work, so it can be reviewed and
reverted independently of everything else in this mission if needed. Git
history still has every file if anything here turns out to be needed
later.
