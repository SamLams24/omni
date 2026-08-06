# OMNI — Architecture cible

## Vue d'ensemble

```
omni/
├── omni-web-frontend/     # Next.js 15 (App Router) + TypeScript strict — nouveau
├── omni-backend/          # NestJS + Prisma + PostgreSQL — nouveau
├── apps/
│   ├── web/                # Legacy, conservé comme référence jusqu'à parité
│   └── mobile/              # Inchangé, hors périmètre
├── omni/                    # Copie interne dupliquée obsolète — NON touchée, à traiter séparément
├── docs/
├── package.json              # racine, workspace pnpm
├── pnpm-workspace.yaml
└── .nvmrc
```

`omni-web-frontend` et `omni-backend` sont deux applications pnpm indépendantes dans le workspace, avec leurs propres `package.json`, `tsconfig.json`, tests et scripts de build.

## Frontend — Next.js

- Next.js (App Router), TypeScript strict, `src/` layout.
- Organisation par domaine fonctionnel (`features/`) + composants partagés (`components/ui`, `components/forms`, ...), pas une liste plate de composants.
- Internationalisation dès le début : routes `/fr` et `/en` (`next-intl`), aucun texte en dur dans les composants — tout dans `messages/fr.json` / `messages/en.json`.
- Communication exclusivement via un client API typé vers `omni-backend` — jamais d'accès direct à PostgreSQL.
- Design repris à l'identique de `apps/web` (dark theme, mise en page, palettes) — la migration porte sur la structure/le typage, pas sur l'esthétique.
- Portail `/admin` neuf (aucun équivalent existant à migrer).

## Backend — NestJS

- Monolithe modulaire : une seule application NestJS, une seule base PostgreSQL, modules métier isolés (`modules/<domaine>/{controllers,services,dto}`).
- Prisma comme ORM, schéma dérivé du schéma SQL existant (`apps/web/db/migrations/0001`-`0006`) — mêmes concepts métier (vendors→Business, facilities, KYC, subscriptions, etc.), pas de réinvention arbitraire.
- RBAC réel : `Role`, `Permission`, relations explicites — remplace l'absence totale d'autorisation actuelle.
- API préfixée `/api/v1`, DTO validés (`class-validator`), réponses jamais des objets Prisma bruts.
- PostGIS conservé pour la géolocalisation (recherche par rayon) — Prisma ne supporte pas nativement les types géographiques complexes, donc les requêtes de proximité resteront en SQL brut via `$queryRaw`, documenté explicitement module par module.

## Ce qui ne change pas dans cette mission

- `apps/web` reste déployé/fonctionnel tel quel jusqu'à parité fonctionnelle validée.
- `apps/mobile` n'est pas touché.
- Aucune donnée de production n'est migrée dans cette mission (Lot 1 = fondations uniquement, base de développement locale).
