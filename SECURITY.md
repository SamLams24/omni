# Security policy

## Current status

Omni is undergoing stabilization. The repository contains MVP code that is not
yet approved for production financial or identity-sensitive operations.

The wallet, deposit, withdrawal, escrow, subscription, and OTP flows must be
treated as experimental until their replacement implementations have passed
security and integration reviews.

## Reporting a vulnerability

Do not disclose credentials or exploitable details in a public issue. Contact
the project maintainers privately and include:

- the affected route or component;
- reproduction steps;
- expected and observed behavior;
- the potential impact;
- a suggested remediation, if available.

## Secret handling

- Store production secrets only in approved deployment or secret-management
  systems.
- Commit only `.env.example` files with non-sensitive placeholders.
- Rotate a credential immediately if it has ever been committed, even if the
  file is later deleted.
- Review Git history and deployment logs after a leak.

## Required production controls

Before public launch, Omni must have:

- server-validated sessions using secure, HTTP-only cookies;
- role and resource-level authorization;
- hashed, expiring, single-use OTP codes with attempt and rate limits;
- CSRF protection where cookie authentication is used;
- validation and consistent error handling for every write API;
- idempotent, provider-verified payment webhooks;
- immutable audit records for sensitive actions;
- automated secret, dependency, and static-analysis checks;
- monitoring, alerting, backups, and a tested recovery procedure.

## Immediate credential-rotation checklist

Historical tracked environment files contained non-placeholder production-like
values. Maintainers must rotate and verify at least:

- Neon/PostgreSQL credentials;
- authentication secrets;
- SMTP username and password;
- any provider key that may have appeared in Git history.
