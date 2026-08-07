# Audit ciblé — fonctionnalités prioritaires (auth, FedaPay, carte, seller, buyer, admin, delivery)

Complète `docs/architecture/current-state-audit.md` avec le détail nécessaire aux lots prioritaires de cette mission.

## Auth (legacy `apps/web`)

`apps/web/src/lib/auth.ts` : résolution de token avec priorité cookie `omni_session` puis fallback `Authorization: Bearer` (corrigé lors d'une mission précédente — bug `token is not defined`). Pas de RBAC, pas de rotation de refresh token, pas de CSRF, pas de provider OIDC/social. C'est ce que le nouveau `omni-backend` doit remplacer entièrement, pas migrer tel quel — l'architecture cible (session OMNI + Identity + Auth0 en IdP uniquement) n'a pas d'équivalent legacy à porter, elle est nouvelle.

## FedaPay (legacy `apps/web`)

`apps/web/src/lib/fedapay.js`, `fedapay-webhook.js`, `wallet-deposits.js` — flux réel, testé (29 tests), sécurisé : push Mobile Money Moov Togo en priorité, fallback vers une page de paiement hébergée FedaPay si le push échoue ; webhook avec vérification de signature HMAC et idempotence (`ON CONFLICT` sur `provider_event_id`). Ce flux concerne uniquement le portefeuille (dépôt wallet) — **aucun lien avec un abonnement premium** dans le legacy (l'UI d'upgrade est explicitement désactivée). Le prix n'est jamais fourni par le client : `createFedaPayTransaction` reçoit un montant déjà validé côté serveur.

## Carte / OSM (legacy `apps/web`)

`apps/web/src/app/map/page.jsx` (MapLibre GL, pas de limite arbitraire de marqueurs), `apps/web/src/lib/osm-overpass.js` (requêtes Overpass avec bbox, cache mémoire 5 min, timeout 20s, tags curés : shop/amenity-allowlist/office/craft/healthcare/tourism-allowlist), `apps/web/src/app/api/discovery/osm/normalize.js` (normalisation `osm:<type>:<id>`, jamais de prix/note/produits fabriqués). Cette logique est déjà propre et testée — directement portable vers un module NestJS `map`/`osm`, pas à réécrire de zéro.

## Seller (vendeur) — `apps/web/src/app/vendor/**`

Fonctionnalités réelles à migrer : onboarding (création vendeur + facility par défaut + produits initiaux, un seul vendeur par utilisateur), dashboard (facilities, toggle en ligne/hors ligne, demandes groupées via panier, produits), gestion produits (CRUD, plafond 5 sur tier gratuit), demandes de disponibilité (`/api/availability/*`, système parallèle aux paniers groupés), messages (`ChatModal` partagé), paramètres (édition profil, gestion facilities, suppression vendeur).

Composants réutilisables : `SubscriptionBadge`, `VerificationBadge`, `FacilityCard`, `FavoriteButton`, `ChatModal`. **Incohérence de thème notée** : les pages vendeur utilisent `#08080f`/`#0e0e18` alors que les pages acheteur utilisent `neutral-950`/`neutral-900` — à normaliser sur une seule palette sombre dans le nouveau frontend plutôt que reproduire les deux.

## Buyer (acheteur)

`dashboard/page.jsx` (tableau de bord acheteur réel : commandes actives, favoris, liens rapides), `user/profile/page.jsx` (lecture seule, pas d'édition), favoris (`FavoriteButton.jsx` + `/api/favorites`, fonctionnalité complète et simple à porter), recherche/filtres dans `map/page.jsx` (barre de recherche avec suggestions, tri, chips de catégorie), historique de commandes `cart/history/page.jsx` (polling 15s, statuts, actions marquer-reçu/annuler). Le paiement escrow est explicitement désactivé côté légataire ("Escrow (désactivé)" affiché en dur) — ne pas le faire apparaître comme actif dans la nouvelle UI.

## Admin

**Confirmé, triple vérification (grep, glob, recherche de rôle) : aucun portail admin, aucune route, aucun composant, aucun rôle admin/staff/moderator n'existe où que ce soit dans `apps/web`.** Le seul concept de "rôle" présent est un sélecteur de persona `buyer`/`vendor`/`delivery` (navigation uniquement, pas d'autorisation). Le portail admin de la nouvelle architecture est donc **entièrement neuf**, rien à migrer.

## Delivery — `apps/web/src/app/delivery/**`

Le cœur métier (accept/match/toggle/profile/trajets) est réel et non trivial : appariement PostGIS + haversine, détection de conflits, plafonds tier gratuit (3/jour). **Mais deux sous-fonctionnalités sont explicitement désactivées côté serveur legacy lui-même** : le suivi temps réel (`tracking/[id]/route.js` retourne toujours `503 DELIVERY_TRACKING_UNAVAILABLE`) et le paiement escrow (`confirm/route.js` retourne `503 ESCROW_DISABLED` pour tout moyen non-cash). Cette mission ne migre pas le workflow livreur — seule la coquille visuelle (barre latérale, navigation) est reprise, avec un message "en cours de développement" explicite, cohérent avec ce que le legacy admet déjà pour tracking/escrow.

Composants propres et réutilisables visuellement : `delivery/layout.jsx` (barre latérale dédiée, n'utilise pas la nav globale), `DeliveryMatchCard.jsx`, `VehicleSelector.jsx`. Composants orphelins/morts à ignorer : `ConflictBadge.jsx`, `EscrowStatus.jsx`, `PlannedTripForm.jsx`, `DeliveryLiveMap.jsx` (aucun n'est importé ailleurs dans le code actif).

## Conclusion pour le séquencement

Les lots les plus directement exécutables sans dépendance externe (pas de credentials Auth0/FedaPay requis) sont, dans l'ordre : **schéma Prisma → auth locale (register/login/refresh/logout/RBAC) → infrastructure d'erreurs**. Le reste (carte, seller, buyer, KYC, abonnement, FedaPay, admin) nécessite soit cette fondation d'auth, soit des credentials externes non disponibles dans cet environnement — voir le rapport final pour l'état exact, lot par lot.
