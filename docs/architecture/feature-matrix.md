# OMNI — Matrice fonctionnelle

Basée sur le code réellement présent dans `apps/web` (voir `current-state-audit.md`). "À migrer" = fonctionnalité existante à reproduire ; "À construire" = fonctionnalité absente à créer.

| Module | Existant (apps/web) | À conserver | À migrer frontend | À migrer/construire backend | Priorité | Statut |
|---|---|---|---|---|---|---|
| Authentification (login/session) | Oui | Oui | Oui | Oui (réécrit : JWT+refresh, RBAC) | Haute | Non démarré (Lot 2) |
| Rôles / permissions (RBAC) | Non | — | À construire | À construire | Haute | Non démarré (Lot 2) |
| Portail admin | Non | — | À construire | À construire | Haute | Non démarré (Lot 2/8) |
| Entreprises (vendors/facilities) | Oui | Oui | Oui | Oui | Haute | Non démarré (Lot 3) |
| Catégories | Oui (texte libre) | Oui | Oui | Oui (à normaliser en table/enum) | Moyenne | Non démarré (Lot 3) |
| Produits | Oui | Oui | Oui | Oui | Haute | Non démarré (Lot 3) |
| Carte / géolocalisation | Oui | Oui | Oui | Oui (raw SQL PostGIS via Prisma) | Haute | Non démarré (Lot 4) |
| OpenStreetMap / Overpass | Oui (récent) | Oui | Oui | Oui (logique déjà propre, portable) | Haute | Non démarré (Lot 4) |
| Statuts d'entreprise (non vérifiée/vérifiée/certifiée) | Oui (logique centralisée) | Oui | Oui | Oui (fonction pure portable) | Haute | Non démarré (Lot 3/5) |
| KYC | Non (formulaire 100% simulé) | Non | À reconstruire | À construire | Haute | Non démarré (Lot 5) |
| Abonnements | Table inutilisée, UI désactivée | Non | À reconstruire | À construire | Haute | Non démarré (Lot 5) |
| Paiements FedaPay (wallet) | Oui, testé (29 tests) | Oui | Oui | Oui (réécrit avec Prisma) | Haute | Non démarré (Lot 6) |
| Paiement d'abonnement premium | Non | — | À construire | À construire | Moyenne | Non démarré (Lot 6) |
| Avis (reviews) | Oui | Oui | Oui | Oui | Basse | Non démarré (Lot 7) |
| Favoris | Oui | Oui | Oui | Oui | Basse | Non démarré (Lot 7) |
| Notifications | Oui (in-app) | Oui | Oui | Oui | Basse | Non démarré (Lot 7) |
| Chat / messages | Oui | Oui | Oui | Oui | Basse | Non démarré (Lot 7) |
| Livraison (delivery) | Oui, substantiel (16 routes) | Oui | Oui | Oui | Moyenne | Non démarré (Lot 7) |
| Panier / commandes (cart) | Oui | Oui | Oui | Oui | Moyenne | Non démarré (Lot 3/7) |
| Escrow | Oui | Oui | Oui | Oui | Basse | Non démarré (Lot 7) |
| Recherche texte | Oui (ILIKE PostGIS) | Oui | Oui | Oui | Moyenne | Non démarré (Lot 4) |
| Internationalisation (fr/en) | Non (texte en dur) | Non | À construire dès Lot 1 | N/A | Haute (demande explicite) | **Fondation posée** — `/fr` et `/en` fonctionnels, aucun texte en dur, vérifié en runtime |

## Légende Statut

- **Non démarré** : rien créé dans `omni-web-frontend`/`omni-backend` pour ce module.
- **Fondation posée** : structure/config créée, pas de logique métier.
- **Partiel** : logique métier présente mais tests/parité incomplets.
- **Parité atteinte** : équivalent fonctionnel validé par tests, comparable à `apps/web`.

À la fin de cette mission (Lot 1 uniquement), tous les modules métier restent **Non démarré** — seule la fondation technique (workspace, Next.js, NestJS, Prisma, i18n, docs) est livrée. Voir `migration-plan.md` pour le séquencement des lots suivants.
