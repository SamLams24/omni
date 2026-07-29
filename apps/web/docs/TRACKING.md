# 🎯 Omni — Tracking de Progression

> **Légende :** ✅ Fait | ⚠️ Partiel | 🔄 En cours | ❌ Pas fait | 🗑️ Supprimé | 🎭 Mock (à laisser simulé) | 🔵 Réel (doit marcher vraiment)

---

## PHASE 0 : Pre-flight

| # | Tâche | Type | Status |
|---|-------|------|--------|
| 0.1 | Vérifier `npm run dev` | 🔵 Réel | ✅ |
| 0.2 | Exécuter `pnpm db:migrate` | 🔵 Réel | ✅ |
| 0.3 | Vérifier `npm run typecheck` | 🔵 Réel | ✅ |

---

## PHASE 1 : Facilities — multi-activité par vendeur

### 1.1 Table SQL

| # | Tâche | Type | Status |
|---|-------|------|--------|
| 1.1.1 | Table `facilities` | 🔵 Réel | ✅ |
| 1.1.2 | Indexes (location, vendor, online, category) | 🔵 Réel | ✅ |

### 1.2 Migration vendors → facilities

| # | Tâche | Type | Status |
|---|-------|------|--------|
| 1.2.1 | Migrer données vendors → facilities | 🔵 Réel | ✅ |

### 1.3 Ajouter `facility_id` aux tables

| # | Tâche | Type | Status |
|---|-------|------|--------|
| 1.3.1 | `products.facility_id` | 🔵 Réel | ✅ |
| 1.3.2 | `availability_requests.facility_id` | 🔵 Réel | ✅ |
| 1.3.3 | `messages.facility_id` | 🔵 Réel | ✅ |

### 1.4 Routes API

| # | Route | Méthode | Type | Status |
|---|-------|---------|------|--------|
| 1.4.1 | `/api/facilities/nearby` | POST | 🔵 Réel | ✅ |
| 1.4.2 | `/api/facilities/search` | POST | 🔵 Réel | ✅ |
| 1.4.3 | `/api/facilities/[id]` | GET | 🔵 Réel | ✅ |
| 1.4.4 | `/api/facilities/create` | POST | 🔵 Réel | ✅ |
| 1.4.5 | `/api/facilities/[id]` | PUT | 🔵 Réel | ✅ |
| 1.4.6 | `/api/facilities/[id]` | DELETE | 🔵 Réel | ✅ |
| 1.4.7 | `/api/facilities/toggle-status` | POST | 🔵 Réel | ✅ |
| 1.4.8 | `/api/vendors/[id]/facilities` | GET | 🔵 Réel | ✅ |

### 1.5 Routes modifiées

| # | Route | Changement | Status |
|---|-------|-----------|--------|
| 1.5.1 | `GET /api/vendors/[id]` | Retourne vendor + facilities + produits | ✅ |
| 1.5.2 | `GET /api/vendors/my-vendor` | Retourne vendor + facilities | ✅ |
| 1.5.3 | `POST /api/vendors/create` | Crée vendor + facility + subscription | ✅ |
| 1.5.4 | `GET /api/vendors/requests` | Joint facility, groupé | ✅ |
| 1.5.5 | `GET /api/vendors/conversations` | Inclut facility_id | ✅ |

### 1.6 Frontend

| # | Fichier | Changement | Status |
|---|---------|-----------|--------|
| 1.6.1 | `src/app/map/page.jsx` | Appelle facilities/nearby, marqueurs facilities, bottom sheet | ✅ |
| 1.6.2 | `src/components/FacilityCard.jsx` | Nouveau composant carte facility | ✅ |
| 1.6.3 | `src/app/vendor/dashboard/page.jsx` | Liste facilities, toggles, stats | ✅ |
| 1.6.4 | `src/app/vendor/onboarding/page.jsx` | Infos vendor → création 1ère facility → produits | ✅ |
| 1.6.5 | `src/app/vendor/settings/page.jsx` | Gestion CRUD facilities + edit inline | ✅ |
| 1.6.6 | `src/app/vendor/products/page.jsx` | Produits liés à une facility | ✅ |

---

## PHASE 2 : Panier / Cart

### 2.1 Table SQL

| # | Tâche | Type | Status |
|---|-------|------|--------|
| 2.1.1 | Table `carts` | 🔵 Réel | ✅ |
| 2.1.2 | Indexes (buyer, facility, status) | 🔵 Réel | ✅ |

### 2.2 localStorage

| # | Tâche | Status |
|---|-------|--------|
| 2.2.1 | `localStorage.omni_cart` (panier non envoyé) | ✅ |

### 2.3 Routes API

| # | Route | Méthode | Type | Status |
|---|-------|---------|------|--------|
| 2.3.1 | `/api/cart/send` | POST | 🔵 Réel | ✅ |
| 2.3.2 | `/api/cart/history` | GET | 🔵 Réel | ✅ |
| 2.3.3 | `/api/cart/respond` | POST | 🔵 Réel | ✅ |

### 2.4 Frontend

| # | Fichier | Status |
|---|---------|--------|
| 2.4.1 | `src/components/CartPanel.jsx` | ✅ |
| 2.4.2 | `src/components/CartBadge.jsx` | ✅ |
| 2.4.3 | `src/app/map/page.jsx` (ajout panier, icône, badge) | ✅ |
| 2.4.4 | `src/app/vendor/requests/page.jsx` (groupé par cart) | ✅ |

---

## PHASE 3 : Post-confirmation

### 3.1 Routes API

| # | Route | Méthode | Type | Status |
|---|-------|---------|------|--------|
| 3.1.1 | `/api/cart/mark-delivered` | POST | 🔵 Réel | ✅ |
| 3.1.2 | `/api/cart/mark-received` | POST | 🔵 Réel | ✅ |

### 3.2 Frontend

| # | Fichier | Status |
|---|---------|--------|
| 3.2.1 | `src/app/vendor/requests/page.jsx` (bouton "Marquer remis") | ✅ |
| 3.2.2 | CartHistory (dashboard acheteur, itinéraire, récupéré) | ✅ |

---

## PHASE 4 : Rating & Avis

### 4.1 Table SQL

| # | Tâche | Status |
|---|-------|--------|
| 4.1.1 | Table `reviews` + indexes | ✅ |

### 4.2 Routes API

| # | Route | Méthode | Type | Status |
|---|-------|---------|------|--------|
| 4.2.1 | `/api/reviews` | POST | 🔵 Réel | ✅ |
| 4.2.2 | `/api/facilities/[id]/reviews` | GET | 🔵 Réel | ✅ |
| 4.2.3 | `/api/reviews/[id]` | PUT | 🔵 Réel | ✅ |

### 4.3 Frontend

| # | Fichier | Status |
|---|---------|--------|
| 4.3.1 | `src/components/ReviewForm.jsx` | ✅ |
| 4.3.2 | `src/components/ReviewStars.jsx` | ✅ |
| 4.3.3 | `src/components/ReviewList.jsx` | ✅ |
| 4.3.4 | `src/app/map/page.jsx` (étoiles + count avis) | ✅ |
| 4.3.5 | `src/app/vendor/dashboard/page.jsx` (note moyenne) | ✅ |

---

## PHASE 5 : Tri & Recherche

| # | Fichier | Changement | Status |
|---|---------|-----------|--------|
| 5.1 | `src/app/api/facilities/nearby/route.js` | avg_price, review_count | ✅ |
| 5.2 | `src/app/map/page.jsx` | Tri unifié (proximité, prix, note, best_value) | ✅ |

---

## PHASE 6 : Delivery — crowd-sourcing complet

### 6.1 Tables SQL

| # | Table | Status |
|---|-------|--------|
| 6.1.1 | `delivery_profiles` (is_active, active_mode, active_radius_km, deviation_km, daily_delivery_count, kyc, current_location) | ✅ |
| 6.1.2 | `delivery_vehicles` (transport_type, max_weight, is_active, contrainte 1 actif) | ✅ |
| 6.1.3 | `delivery_planned_trips` (origin, destination, departure_time, is_active) | ✅ |
| 6.1.4 | `delivery_requests` (cart, status, pickup/dropoff, delivery_fee) | ✅ |
| 6.1.5 | `proximity_log` (user, entity, distance) | ✅ |
| 6.1.6 | Indexes (profile, location, vehicles, trips, requests, proximity) | ✅ |

### 6.2 Routes API

| # | Route | Méthode | Planifié | Status |
|---|-------|---------|----------|--------|
| 6.2.1 | `/api/delivery/profile/create` | POST | 🎭 Mock KYC | ✅ (profile + véhicules + KYC mock dans onboarding) |
| 6.2.2 | `/api/delivery/profile` | GET | 🔵 Réel | ✅ |
| 6.2.3 | `/api/delivery/profile` | PUT | 🔵 Réel | ✅ (name, phone, active_mode, active_radius_km, deviation_km) |
| 6.2.4 | `/api/delivery/toggle` | POST | 🔵 Réel | ✅ (active/inactive + vérifie limite free 3/jour + reset daily) |
| 6.2.5 | `/api/delivery/vehicles/add` | POST | 🔵 Réel | ✅ |
| 6.2.6 | `/api/delivery/vehicles/[id]` | DELETE | 🔵 Réel | ✅ |
| 6.2.7 | `/api/delivery/vehicles/switch` | POST | 🔵 Réel | ✅ (dédié, ne crée pas de nouveau type) |
| 6.2.8 | `/api/delivery/planned-trip` | POST | 🔵 Réel | ✅ |
| 6.2.9 | `/api/delivery/planned-trip/[id]` | DELETE | 🔵 Réel | ✅ |
| 6.2.10 | `/api/delivery/matches` | GET | 🎭 Mock | ✅ (implémentée réelle) |
| 6.2.11 | `/api/delivery/available` | GET | 🎭 Mock | ✅ (3 mock requests dans rayon) |
| 6.2.12 | `/api/delivery/accept` | POST | 🔵 Réel | ✅ (accepter + conflit directionnel + limite 3/jour) |
| 6.2.13 | `/api/delivery/status` | POST | 🔵 Réel | ✅ |
| 6.2.14 | `/api/delivery/history` | GET | 🔵 Réel | ✅ |
| 6.2.15 | `/api/delivery/location/[userId]` | GET | 🎭 Mock | ✅ |
| 6.2.16 | `/api/proximity/nearby` | GET | 🎭 Mock | ✅ |
| 6.2.17 | `/api/delivery/confirm` | POST | 🔵 Réel | ✅ (confirme livraison + paie livreur + complète cart cash) |
| 6.2.18 | `/api/delivery/my-active` | GET | 🔵 Réel | ✅ (livraisons acceptées en cours du livreur) |

### 6.3 Pages delivery

| # | Fichier | Status |
|---|---------|--------|
| 6.3.1 | `src/app/delivery/layout.jsx` | ✅ Sidebar (dashboard/historique/paramètres/carte) |
| 6.3.2 | `src/app/delivery/onboarding/page.jsx` | ✅ 4 étapes : infos → véhicule → KYC mock → rayon/déviation |
| 6.3.3 | `src/app/delivery/dashboard/page.jsx` | ✅ Toggle actif/inactif, mode switch rayon/trajet, available rayon, limite 3/jour affichée |
| 6.3.4 | `src/app/delivery/history/page.jsx` | ✅ Livraisons terminées/annulées |

### 6.4 Composants delivery

| # | Fichier | Status |
|---|---------|--------|
| 6.4.1 | `src/components/DeliveryDashboard.jsx` | ✅ (extrait, page délègue le rendu) |
| 6.4.2 | `src/components/PlannedTripForm.jsx` | ✅ |
| 6.4.3 | `src/components/DeliveryMatchCard.jsx` | ✅ (extrait + utilisé dans DeliveryDashboard) |
| 6.4.4 | `src/components/ConflictBadge.jsx` | ✅ |
| 6.4.5 | `src/components/DeliveryLiveMap.jsx` | ✅ |
| 6.4.6 | `src/components/VehicleSelector.jsx` | ✅ (extrait + intégré dans dashboard) |
| 6.4.7 | `src/components/ProximityPanel.jsx` | ✅ |
| 6.4.8 | `src/components/KycForm.jsx` | ✅ (extrait + intégré dans onboarding) |

### 6.5 Intégration delivery → acheteur

| # | Fichier | Status |
|---|---------|--------|
| 6.5.1 | `src/app/map/page.jsx` (proposer livraison dans flux cart) | ✅ (dans CartPanel) |
| 6.5.2 | `src/components/CartHistory.jsx` (suivi delivery + mini-carte) | ✅ (affiché dans cart history) |

### 6.6 Logique métier

| # | Règle | Status |
|---|-------|--------|
| 6.6.1 | Limite free : max 3/jour dans accept | ✅ Vérifié dans accept + toggle |
| 6.6.2 | Détection conflit (angle > 90°) | ✅ Vecteurs pickup→dropoff, angle > 90° → refusé |
| 6.6.3 | Matching A→B (distance pickup→A + B→dropoff) | ✅ (match existe dans /match) |
| 6.6.4 | Reset daily_delivery_count dans toggle + accept | ✅ Reset si nouvelle date dans toggle + accept |

---

## PHASE 7 : Wallet + Escrow + Abonnements + Cash

### 7.1 Tables SQL

| # | Table | Status |
|---|-------|--------|
| 7.1.1 | `wallets` (balance, currency) | ✅ |
| 7.1.2 | `transactions` (type, amount, reference, status) | ✅ |
| 7.1.3 | `escrow_holds` (cart, buyer, vendor, delivery, amount, fees, status) | ✅ |
| 7.1.4 | `subscriptions` (subscriber, plan, status, dates) | ✅ |
| 7.1.5 | Indexes (wallet, tx, escrow, subscription) | ✅ |

### 7.2 Routes API

| # | Route | Méthode | Planifié | Status |
|---|-------|---------|----------|--------|
| 7.2.1 | `/api/wallet` (balance) | GET | 🔵 Réel | ✅ |
| 7.2.2 | `/api/wallet/deposit` | POST | 🎭 Mock | ✅ (Mobile Money + Crypto, crée transaction) |
| 7.2.3 | `/api/wallet/withdraw` | POST | 🎭 Mock | ✅ (Vérifie solde, Mobile Money + Crypto) |
| 7.2.4 | `/api/wallet/transactions` | GET | 🔵 Réel | ✅ |
| 7.2.5 | `/api/escrow/[cartId]` | GET | 🔵 Réel | ✅ |
| 7.2.6 | `/api/escrow/dispute` | POST | 🔵 Réel | ✅ |
| 7.2.7 | `/api/subscription` (status) | GET | 🔵 Réel | ✅ |
| 7.2.8 | `/api/subscription/subscribe` | POST | 🎭 Mock | ✅ |
| 7.2.9 | `/api/subscription/cancel` | POST | 🎭 Mock | ✅ |

### 7.3 Flux Escrow

| # | Étape | Status |
|---|-------|--------|
| 7.3.1 | Créer escrow_hold à l'envoi du cart (payment_method = escrow) | ✅ |
| 7.3.2 | Balance acheteur - montant (mock) | ✅ (déduit avec transaction créée dans respond) |
| 7.3.3 | Livreur confirme → delivery_confirmed → fee versée livreur | ✅ (route POST /delivery/confirm + paiement wallet livreur + transaction) |
| 7.3.4 | Acheteur confirme → released → vendeur payé | ✅ (dans mark-received) |
| 7.3.5 | Litige → disputed → fonds bloqués | ✅ |

### 7.4 Flux Cash

| # | Étape | Status |
|---|-------|--------|
| 7.4.1 | Cash = pas d'escrow, pas de wallet check | ✅ |
| 7.4.2 | Livreur reçoit cash, cart complété | ✅ (confirm delivery cash → cart.completed + notification acheteur) |

### 7.5 Limites free vs abonné

| # | Limite | Status |
|---|-------|--------|
| 7.5.1 | Vendeur free : 1 facility max | ✅ |
| 7.5.2 | Vendeur free : 5 produits max | ✅ |
| 7.5.3 | Vendeur free : cash only (pas escrow) | ✅ |
| 7.5.4 | Vendeur abonné : illimité + escrow 1% | ✅ |
| 7.5.5 | Livreur free : rayon only, 3/jour, pas temps réel | ✅ |
| 7.5.6 | Livreur abonné : illimité, trajet, temps réel | ✅ |

### 7.6 Frontend

| # | Fichier | Status |
|---|---------|--------|
| 7.6.1 | `src/app/wallet/page.jsx` | ✅ Solde, dépôt (Mobile Money/Crypto), retrait (Mobile Money/Crypto), historique transactions |
| 7.6.2 | `src/components/WalletCard.jsx` | ✅ |
| 7.6.3 | `src/components/EscrowStatus.jsx` | ✅ |
| 7.6.4 | `src/components/DepositModal.jsx` | ✅ (extrait + intégré dans wallet page) |
| 7.6.5 | `src/app/vendor/dashboard/page.jsx` (SubscriptionBadge + limites) | ✅ (limites OK + badge intégré) |
| 7.6.6 | `src/app/delivery/dashboard/page.jsx` (SubscriptionBadge + limites) | ✅ (limite 3/jour + badge) |
| 7.6.7 | `src/components/SubscriptionBadge.jsx` | ✅ |

---

## RÉSUMÉ

### Par statut

| Status | Nb items |
|--------|----------|
| ✅ Fait | ~110 |
| ⚠️ Partiel | 0 |
| 🔄 En cours | 0 |
| ❌ Pas fait | 0 |

### Prochaines priorités suggérées

1. Aucune — tout est fait ✅

---

*Dernière mise à jour : 19 mai 2026*
