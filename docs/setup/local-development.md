# Développement local — omni-web-frontend + omni-backend

Ce guide couvre uniquement les deux nouvelles applications (`omni-web-frontend`, `omni-backend`). Pour l'ancienne application (`apps/web`, toujours en production pendant la migration), voir sa propre documentation existante.

## Prérequis

- Node.js `>=22 <23` (voir `.nvmrc` à la racine)
- pnpm `>=10` (`corepack enable` recommandé)
- PostgreSQL installé localement (voir `docs/setup/postgresql.md`) — Docker n'est pas requis

## 1. Installer les dépendances

Depuis la racine du dépôt (workspace pnpm unique, un seul lockfile) :

```bash
pnpm install
```

## 2. Créer les bases de données locales

```bash
createdb omni_dev
createdb omni_test
```

Voir `docs/setup/postgresql.md` pour les détails d'installation/configuration de PostgreSQL.

## 3. Configurer les variables d'environnement

```bash
cp omni-backend/.env.example omni-backend/.env
cp omni-web-frontend/.env.example omni-web-frontend/.env.local
```

Éditez `omni-backend/.env` : au minimum, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (valeurs aléatoires longues, jamais celles de l'exemple). Voir `docs/setup/backend-environment.md` et `docs/setup/frontend-environment.md` pour le détail de chaque variable.

## 4. Préparer la base de données

```bash
pnpm --filter omni-backend prisma:generate
pnpm --filter omni-backend prisma:migrate
pnpm --filter omni-backend prisma:seed
```

Voir `docs/setup/database-migrations.md` pour le détail, et `docs/setup/admin-account.md` pour les identifiants du compte admin de développement créé par le seed.

## 5. Démarrer les applications

```bash
pnpm dev
```

Ou individuellement :

```bash
pnpm dev:api   # omni-backend sur http://localhost:4000
pnpm dev:web   # omni-web-frontend sur http://localhost:3000
```

## 6. Accès utiles

- Frontend : http://localhost:3000 (redirige vers `/fr` par défaut, `/en` disponible)
- API : http://localhost:4000/api/v1
- Swagger : http://localhost:4000/docs (si `SWAGGER_ENABLED=true`)
- Santé de l'API : http://localhost:4000/api/v1/health

## 7. Lancer les tests

Voir `docs/setup/testing.md`.

```bash
pnpm test
pnpm typecheck
pnpm lint
```

## Note : `argon2` remplacé par `@node-rs/argon2`

Le paquet `argon2` (binding natif classique) plante systématiquement (violation d'accès / segfault) sur cette machine de développement, même après réinstallation complète — un problème d'environnement, pas de cache corrompu. Remplacé par `@node-rs/argon2` (napi-rs), qui utilise également Argon2id par défaut et fonctionne correctement ici. Si `@node-rs/argon2` pose problème sur une autre machine, `argon2-browser` (WASM, sans binding natif) est la solution de repli la plus fiable.

## État de la migration

Cette fondation (Lot 1) ne contient **aucune fonctionnalité métier** — pas d'authentification fonctionnelle, pas d'entreprises, pas de KYC réel exposé via l'API. Voir `docs/architecture/migration-plan.md` pour le séquencement des lots suivants et `docs/architecture/feature-matrix.md` pour l'état exact de chaque module.
