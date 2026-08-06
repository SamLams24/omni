# OMNI — Audit de l'existant (`apps/web`)

Date : 2026-08-06. Périmètre : `apps/web` (source de vérité active). `apps/mobile` non audité (hors périmètre de cette mission). Le dossier `omni/` à la racine du dépôt (copie interne dupliquée, ~414 fichiers, obsolète — voir "Risques critiques") est explicitement exclu de cet audit : ce n'est pas du code à migrer.

## Stack technique actuelle

- React Router 7 (framework full-stack, pas Next.js) + Vite 6 + React 18
- Styling : Tailwind CSS + Chakra UI + `@lshay/ui` (trois systèmes UI qui se chevauchent — voir risques)
- Serveur : routes fichier (`src/app/api/**/route.js`) exécutées via Hono (`react-router-hono-server`), déployé sur Vercel
- Base de données : Neon PostgreSQL/PostGIS, driver `@neondatabase/serverless`, accès SQL brut (pas d'ORM), migrations SQL numérotées gérées par un runner maison (`scripts/migrate.mjs`)
- Auth : Neon Auth (JWT), cookie `omni_session` + fallback `Authorization: Bearer`, pas de RBAC
- Paiement : FedaPay (SDK serveur `fedapay@1.2.5` + client `fedapay-reactjs@1.1.2`)
- Carte : MapLibre GL (chargé via CDN), tuiles CartoDB/OSM ; overlay OpenStreetMap via Overpass API (ajouté récemment)
- Tests : Vitest (unitaires/intégration, 39 fichiers / ~330 tests) + Playwright (e2e, 1 spec)

## Inventaire fonctionnel réel

### Authentification (`src/lib/auth.ts`, `auth-client.js`, `auth-helpers.ts`)
Fonctionnel. Cookie `omni_session` prioritaire, fallback `Authorization: Bearer`. Pas de rôles, pas de RBAC, pas de refresh token rotation, pas de vérification d'email, pas de reset de mot de passe implémenté côté serveur (routes `send-otp`/`verify-otp` explicitement supprimées, vérifié par test `auth-surface.test.js`).

### Entreprises / commerces (`vendors`, `facilities` tables)
Fonctionnel. CRUD vendeur (`api/vendors/*`), facilities multiples par vendeur (fixe/mobile), produits liés. Statut de vérification (non_verifiee/verifiee/certifiee) tout juste ajouté (migration `0006`), dérivé dynamiquement, jamais persisté — logique centralisée dans `src/lib/vendor-verification.ts`.

### Carte / géolocalisation / OpenStreetMap (`src/app/map/page.jsx`, `src/lib/osm-overpass.js`)
Fonctionnel. Recherche PostGIS (`ST_DWithin`) pour les vendeurs Omni + requêtes Overpass API pour les commerces OSM environnants (ajout récent, pas de fusion/déduplication automatique par design — approximation par nom jugée dangereuse). `src/components/MapComponent.jsx` (Leaflet) est du code mort, non importé nulle part, dépendance `leaflet` absente du `package.json` — à ne PAS migrer tel quel.

### KYC
**N'existe pas.** `KycForm.jsx` est un formulaire 100% simulé côté client (`setTimeout` de 1s, aucun appel réseau, aucune persistance). Aucune table, aucune route serveur. La colonne `vendors.kyc_status` (migration 0006) existe mais rien ne l'alimente en dehors de la valeur par défaut `'none'`.

### Abonnements (`subscriptions` table)
Table présente depuis `0001_baseline.sql` mais **totalement inutilisée** avant cette mission (zéro requête dans le code). L'UI d'upgrade premium est explicitement désactivée ("Les offres Premium sont en cours de finalisation"). La colonne `subscriptions.status` (migration 0006) existe mais rien ne l'alimente.

### Paiements FedaPay
Fonctionnel et testé (29 tests). Dépôts wallet Mobile Money (push-first Moov Togo + fallback hosted checkout), webhook idempotent avec vérification de signature HMAC. Ne concerne que le portefeuille utilisateur — **aucun lien avec les abonnements/certification** (pas de paiement d'abonnement premium implémenté).

### Administration
**N'existe pas.** Aucune route `/admin`, aucun contrôle par rôle, aucun tableau de bord staff.

### Utilisateurs / rôles / permissions
Pas de RBAC. Seuls des champs plats sur `users` : `delivery_tier`, `vendor_tier` (`free`/`premium`, statiques, non liés à un vrai paiement d'abonnement).

### Produits, catégories
Fonctionnel. `products` liés à `vendors`/`facilities`, catégories en texte libre (pas d'enum/table dédiée).

### Livraison (`src/app/delivery/*`, `src/domains/delivery/*`)
Fonctionnel et substantiel : profils livreurs, véhicules, trajets planifiés, matching, suivi, escrow. Complexité notable, nombreuses routes (`api/delivery/*` : 16 routes).

### Avis, favoris, notifications, chat
Fonctionnels, simples : `reviews` (1 par utilisateur/facility), `favorites`, `notifications` (in-app), `chat` (messages liés à une demande de disponibilité).

### Recherche / filtres
Recherche texte PostGIS (`ILIKE` sur nom/catégorie/description/produits), pas de moteur de recherche dédié (pas d'Elasticsearch/Algolia).

## Structure des routes serveur (`src/app/api/`)

~70 routes fichier. Domaines : `auth` (5), `vendors` (10), `facilities` (5), `delivery` (16), `wallet` (5), `cart` (5), `discovery` (2 + `osm`), `escrow` (3), `subscriptions`/`subscription` (3, largement désactivées), `reviews`, `favorites`, `notifications`, `chat`, `webhooks/fedapay`, `user`, `availability`.

## Schéma de base de données

19 tables (`0001_baseline.sql`), migrations `0002`-`0006` additives. Tables principales : `users`, `vendors`, `facilities`, `products`, `carts`, `availability_requests`, `messages`, `favorites`, `notifications`, `reviews`, `delivery_profiles`, `delivery_vehicles`, `delivery_planned_trips`, `delivery_requests`, `wallets`, `transactions`, `escrow_holds`, `subscriptions`, `proximity_log`. PostGIS (`geography(Point,4326)`) pour toute géolocalisation. Aucun ORM — SQL brut via template strings taggées (`sql\`...\``), déjà correctement paramétré (pas d'injection SQL identifiée dans le code audité).

## Code réutilisable (design + logique métier à préserver)

- Toutes les pages `src/app/**/page.jsx` : design abouti, cohérent, dark theme, mobile-first — à reproduire visuellement, pas à redessiner.
- `src/lib/vendor-verification.ts` : logique de statut déjà propre, centralisée, testée — directement portable en NestJS.
- `src/lib/osm-overpass.js` + `src/app/api/discovery/osm/normalize.js` : logique Overpass déjà correcte et testée (bbox, cache, timeout, tags) — portable telle quelle.
- `src/app/api/discovery/discovery-service.js` : requêtes PostGIS bien structurées — base solide pour le futur module `map`/`businesses` Prisma (nécessitera une réécriture des requêtes brutes en Prisma + raw SQL pour PostGIS).
- `src/lib/fedapay.js`, `src/lib/fedapay-webhook.js`, `src/lib/wallet-deposits.js` : intégration FedaPay correcte, testée, sécurisée (idempotence, vérification de signature) — logique métier portable, doit être ré-implémentée avec NestJS + Prisma côté persistance.

## Code obsolète / à ne pas migrer

- `src/components/MapComponent.jsx` : mort, dépendance manquante.
- `src/lib/simple-auth.js` (s'il existe encore dans certaines branches) : explicitement supprimé du flux actif, un test garantit son absence.
- Le dossier `omni/` à la racine du dépôt : copie complète obsolète de l'app entière — voir risques critiques.

## Risques critiques identifiés

1. **Dossier dupliqué `omni/` à la racine du dépôt.** Contient une ancienne copie complète de `apps/web` (~414 fichiers), non maintenue depuis des mois. Un déploiement Vercel a été découvert pointant par erreur vers `omni/apps/web` (Root Directory mal configuré), servant du code obsolète en production sans que personne ne s'en aperçoive. **Recommandation : ne pas y toucher dans cette mission (hors périmètre), mais le signaler explicitement comme dette critique — un nettoyage/suppression devra être planifié séparément une fois la configuration Vercel corrigée.**
2. **Dépendances de sécurité obsolètes.** `axios` épinglé à `1.19.0` (très ancien) — un override pnpm force la version transitive de `fedapay`'s axios vers une version auditée, mais la dépendance directe reste ancienne.
3. **`stripe` en dépendance** sans usage identifié dans le code exploré — probablement vestigial, à confirmer avant suppression.
4. **Trois systèmes UI en parallèle** (Tailwind, Chakra UI, `@lshay/ui`) — dette de cohérence, pas un risque de sécurité mais un frein à la maintenabilité que le nouveau frontend doit éviter de reproduire.
5. **Pas de RBAC.** Toute notion d'autorisation est absente ; le futur portail admin doit être construit entièrement neuf, backend comme source de vérité.
6. **KYC et abonnements non implémentés.** La logique de statut d'entreprise existe et est testée, mais aucun des deux workflows amont (KYC réel, paiement d'abonnement) n'existe — à construire de zéro, pas à migrer.

## Tests existants

39 fichiers Vitest (~330 tests), couvrant : auth, FedaPay (29 tests dédiés), discovery/geo, découverte OSM, statut de vérification vendeur, cart, chat, delivery, sécurité (absence de `x-user-id`, pas de localStorage pour l'identité). 1 spec Playwright (`e2e/map-location.spec.ts`). Bonne discipline de test pour un projet de cette taille — à égaler côté NestJS/Next.js, pas à copier tel quel (framework différent).
