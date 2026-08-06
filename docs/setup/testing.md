# Tests

## omni-backend (Jest)

```bash
pnpm --filter omni-backend test        # unitaires
pnpm --filter omni-backend test:cov    # avec couverture
pnpm --filter omni-backend test:e2e    # end-to-end (nécessite une base de test configurée)
```

Couverture actuelle (Lot 1) : validation de configuration (`src/config/env.validation.spec.ts`) et service de santé (`src/modules/health/health.service.spec.ts`). Chaque nouveau module métier (Lots 2+) doit ajouter ses propres tests de service, guard et DTO au moment où il est construit — voir `docs/architecture/migration-plan.md`.

## omni-web-frontend (Vitest)

```bash
pnpm --filter omni-web-frontend test
```

Couverture actuelle (Lot 1) : configuration i18n (`src/i18n/routing.test.ts`), validation d'environnement client (`src/lib/env/client.test.ts`), erreurs API (`src/lib/api/api-error.test.ts`).

Tests de composants (React Testing Library) et E2E (Playwright) : l'outillage n'est pas encore installé/configuré — prévu au fil des lots suivants, quand il y aura de vraies pages/parcours à tester (voir `docs/architecture/migration-plan.md`). Ajouter un harnais Playwright vide pour une app qui n'a qu'une page d'accueil de fondation n'apporterait rien.

## Vérification complète

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
