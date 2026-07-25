# Contributing to Omni

## Working directory

The web product source of truth is `apps/web`. Do not implement product changes
inside `omni/apps/web` or `omni/apps/nextjs`.

## Branches and pull requests

1. Start from an up-to-date `main`.
2. Use a short-lived branch:
   - `feat/<description>`
   - `fix/<description>`
   - `chore/<description>`
3. Keep each pull request focused on one concern.
4. Describe the user impact, technical impact, validation performed, and any
   migration or environment-variable changes.
5. Require review before merging.

Direct commits to `main` should be disabled with branch protection.

## Code expectations

- Keep identity and authorization decisions on the server.
- Never trust `x-user-id` or another client-provided identity header.
- Never commit credentials, database URLs, API keys, or production `.env`
  files.
- New API inputs must be validated.
- New business rules need tests.
- Avoid adding new logic to already oversized route or page files; extract
  domain services, hooks, and focused components.
- Prefer TypeScript for new production code.

## Definition of done

A change is complete when:

- its acceptance criteria are satisfied;
- relevant unit, integration, or end-to-end tests pass;
- authorization and error cases are covered;
- documentation and `.env.example` are updated when necessary;
- no secret or generated build artifact is committed;
- the production build succeeds in a clean environment.

## Sensitive modules

Authentication, wallets, escrow, payments, subscriptions, KYC, and delivery
settlements require an explicit security review. Mock implementations must be
clearly disabled outside development and tests.
