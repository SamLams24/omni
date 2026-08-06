# OMNI — Plan de migration progressive

Migration par lots, jamais big-bang. Après chaque lot : tests, typecheck, build, commit, mise à jour de `feature-matrix.md`. `apps/web` reste déployé et intact jusqu'à parité fonctionnelle validée.

## Lot 1 — Fondation *(cette mission)*

- Workspace pnpm racine (`package.json`, `pnpm-workspace.yaml`, `.nvmrc`, config partagée).
- `omni-web-frontend` : Next.js App Router, TypeScript strict, Tailwind, **internationalisation dès le début** (`/fr`, `/en`, `next-intl`, aucun texte en dur), squelette de structure par domaine (`features/`, `components/`, `lib/api/`), client API typé pointant vers `omni-backend`.
- `omni-backend` : NestJS, TypeScript strict, Prisma configuré pour PostgreSQL local, module `health`, configuration centralisée validée par Zod/`class-validator` au démarrage, Swagger activé en dev.
- Schéma Prisma initial dérivé des migrations SQL existantes (`apps/web/db/migrations/0001`-`0006`) : mêmes entités, mêmes contraintes métier, sans logique applicative branchée dessus.
- Documentation locale (`docs/setup/*`) : Postgres local, `.env`, génération Prisma, migrations, seed, démarrage des deux apps.
- **Aucune fonctionnalité métier migrée** dans ce lot — uniquement la fondation technique.

## Lot 2 — Authentification et sécurité

- Backend : module `users`, `auth` (register/login/refresh/logout, argon2id, JWT + refresh token rotation, cookies HttpOnly), `roles`, `permissions`, guards (`JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`).
- Frontend : pages `(auth)/login`, `(auth)/register`, gestion de session côté client, layout `/admin` protégé (structure uniquement, pas encore de contenu métier).
- Reprend la priorité cookie/Bearer déjà validée côté legacy, mais avec un vrai schéma RBAC (absent aujourd'hui).

## Lot 3 — Entreprises

- Backend : modules `businesses`, `categories`, `products`.
- Frontend : pages publiques entreprises/services, dashboard vendeur.
- Portage de la logique de statut (`vendor-verification.ts` → service NestJS équivalent, testé identiquement).

## Lot 4 — Carte et OSM

- Backend : module `map`/`osm`, port direct de `osm-overpass.js` + `normalize.js` (déjà propres et testés), requêtes PostGIS en `$queryRaw` documentées.
- Frontend : carte Leaflet/MapLibre en composant client dynamique (`use client`), fusion visuelle Omni/OSM sans dédoublonnage automatique (règle déjà actée : pas de rapprochement approximatif par nom).

## Lot 5 — KYC et abonnements

- Backend : modules `kyc` (workflow réel, actuellement inexistant), `subscriptions` (branché sur la table jusqu'ici inutilisée), calcul dynamique de certification (jamais persisté, comme dans le legacy).
- Frontend : formulaire KYC réel (remplace le simulateur `KycForm.jsx`), pages abonnement.

## Lot 6 — Paiements FedaPay

- Backend : module `payments`, port de la logique serveur existante (webhook HMAC, idempotence, création de transaction serveur) vers Prisma.
- Lien nouveau à construire : paiement d'abonnement premium (absent du legacy).

## Lot 7 — Modules complémentaires

- Avis, favoris, notifications, livraison (module `deliveries`, substantiel — 16 routes existantes à porter), recherche avancée.

## Lot 8 — Portail admin (contenu métier)

- Une fois Lots 2-7 posés : tableau de bord, gestion utilisateurs/entreprises/KYC/abonnements/paiements, audit log, réglages — construit neuf, aucun équivalent à migrer.

## Décommissionnement (hors périmètre de toute mission actuelle)

- Suppression de `apps/web` : uniquement après parité fonctionnelle validée lot par lot.
- Nettoyage du dossier interne dupliqué `omni/` à la racine : signalé comme dette critique dans l'audit, nécessite d'abord la correction de la configuration Vercel (Root Directory pointant actuellement dessus par erreur) — à traiter dans une mission dédiée, pas dans ce plan de migration produit.
