# Authentification — omni-backend

> **Statut : non implémenté.** Ce document décrit la conception cible (Lot 2 du plan de migration, `docs/architecture/migration-plan.md`), pas un comportement actuel. Le schéma Prisma (`User`, `RefreshToken`) et la validation des secrets JWT (`src/config/env.validation.ts`) existent déjà en Lot 1 ; les routes et guards restent à construire.

## Conception cible

- Mot de passe hashé avec Argon2id (`argon2` déjà en dépendance).
- Token d'accès JWT courte durée (`JWT_ACCESS_EXPIRES_IN`, 15 min par défaut) + refresh token longue durée (`JWT_REFRESH_EXPIRES_IN`, 30 jours par défaut), avec rotation à chaque utilisation.
- Refresh tokens stockés hashés en base (`RefreshToken.tokenHash`), jamais en clair — révocables individuellement (`revokedAt`) ou globalement par utilisateur (`logout-all`).
- Cookies `HttpOnly`, `Secure` en production (`COOKIE_SECURE`), `SameSite` configurable (`COOKIE_SAME_SITE`).
- Priorité cookie de session, avec un éventuel fallback `Authorization: Bearer` pour les clients non-navigateur — reprend le principe déjà validé et testé côté `apps/web` (`apps/web/src/lib/auth.ts`), pas une redécouverte.

## Routes prévues

```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/logout-all
GET  /api/v1/auth/me
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

## Sécurité

- Jamais de token dans `localStorage` côté frontend.
- Limitation des tentatives de connexion (le `ThrottlerModule` global est déjà configuré en Lot 1 — un throttler dédié plus strict sur `/auth/login` sera ajouté avec le module).
- Aucun secret ni token journalisé (voir `HttpExceptionFilter`, qui ne renvoie jamais de stack trace au client).
