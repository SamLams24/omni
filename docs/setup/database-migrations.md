# Migrations de base de données — omni-backend

`omni-backend` utilise Prisma Migrate, complètement indépendant du système de migrations SQL numérotées d'`apps/web` (`apps/web/db/migrations/0001`-`0006`, gérées par `apps/web/scripts/migrate.mjs`). Les deux coexistent sans interférence : bases de données distinctes, outils distincts.

## Commandes

```bash
pnpm --filter omni-backend prisma:generate   # régénère le client Prisma après une modification du schéma
pnpm --filter omni-backend prisma:migrate    # crée + applique une migration en développement
pnpm --filter omni-backend prisma:seed       # peuple la base avec des données de développement
```

`prisma:migrate` (= `prisma migrate dev`) compare `prisma/schema.prisma` à l'état réel de la base, génère un fichier SQL de migration dans `prisma/migrations/`, l'applique, puis régénère le client automatiquement.

## Schéma actuel (Lot 1)

`prisma/schema.prisma` couvre : authentification/RBAC (`User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `RefreshToken`), entreprises (`Business`, `BusinessOwner`, `Category`, `Product`, `Service`), KYC (`KycRequest`), abonnements (`Subscription`, `SubscriptionPlan`), portefeuille FedaPay (`Wallet`, `WalletTransaction`, `WalletDepositIntent`, `FedapayWebhookEvent`), avis/favoris/notifications (`Review`, `Favorite`, `Notification`), et audit (`AuditLog`).

**Volontairement absents en Lot 1** (voir `docs/architecture/migration-plan.md`, Lot 7) : panier, livraison, escrow, chat, journal de proximité — ces modules ne sont pas encore portés, donc leurs tables ne sont pas créées prématurément.

Le champ `Business.location` est `Unsupported("geography(Point,4326)")` — voir `docs/setup/postgresql.md` pour la note PostGIS.

## Correspondance avec le schéma legacy

Voir `docs/architecture/current-state-audit.md` pour le détail complet. En bref : `Business` ↔ `vendors`, `kycStatus`/`source`/`osmType`/`osmId` ↔ les colonnes ajoutées par `apps/web`'s migration `0006_vendor_verification.sql`, `Wallet*`/`FedapayWebhookEvent` ↔ `wallet_deposit_intents`/`fedapay_webhook_events` (migrations `0004`/`0005`).

## Base de test

```env
DATABASE_URL=postgresql://postgres:CHANGE_ME@localhost:5432/omni_test?schema=public
```

Ne jamais exécuter les tests d'intégration/E2E contre la base `omni_dev` ou une base de production.
