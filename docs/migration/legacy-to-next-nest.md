# Migrer un composant de `apps/web` vers `omni-web-frontend` / `omni-backend`

Guide pratique pour les prochains lots (voir `docs/architecture/migration-plan.md` pour le séquencement complet).

## Composant frontend (page/composant JSX → TSX)

1. Repérer la page/le composant équivalent dans `apps/web/src/app/**` ou `apps/web/src/components/**`.
2. Créer l'équivalent sous `omni-web-frontend/src/app/[locale]/...` (page) ou `omni-web-frontend/src/features/<domaine>/` (composant), en TypeScript strict avec des props explicites.
3. Extraire toute logique métier vers `features/<domaine>/` (hooks, fonctions pures) — un composant de page ne doit contenir que de l'orchestration UI.
4. Remplacer les appels `fetch` directs par `serverApiRequest`/`browserApiRequest` (`src/lib/api/`), jamais un accès direct à une base de données.
5. Remplacer tout texte en dur par des clés dans `messages/fr.json` et `messages/en.json`, utilisées via `useTranslations`/`getTranslations`.
6. Conserver le rendu visuel existant (classes Tailwind, structure) — la migration porte sur la structure/le typage, pas sur l'esthétique (voir la contrainte explicite de la mission).
7. Ajouter un test (Vitest + Testing Library une fois configuré pour le domaine concerné).
8. Vérifier le responsive et l'accessibilité de base (labels, contrastes, focus).

## Route serveur (`apps/web/src/app/api/**/route.js` → module NestJS)

1. Repérer la route legacy et sa logique métier (souvent dans un fichier `*-service.js` séparé, comme `discovery-service.js`).
2. Créer/étendre le module NestJS correspondant sous `omni-backend/src/modules/<domaine>/` : `controller` (HTTP uniquement), `service` (logique métier), `dto/` (validation `class-validator`).
3. Porter les requêtes SQL brutes vers Prisma (`this.prisma.<model>.findMany(...)`) quand c'est un CRUD simple ; conserver `$queryRaw` uniquement pour ce que Prisma ne sait pas exprimer nativement (proximité PostGIS — voir `docs/setup/postgresql.md`).
4. Ne jamais retourner un objet Prisma brut — mapper vers un DTO de réponse explicite qui exclut les champs sensibles (`passwordHash`, `tokenHash`, etc.).
5. Porter les tests existants (`apps/web/test/*.test.js`, Vitest) vers des tests Jest équivalents (`*.spec.ts`), en conservant les cas de test déjà identifiés comme importants (idempotence webhook, priorité cookie/Bearer, etc.).

## Ce qu'on ne recopie pas tel quel

- Toute logique métier directement dans un composant React ou un contrôleur NestJS.
- Le code mort déjà identifié dans l'audit (`apps/web/src/components/MapComponent.jsx`).
- Les accès directs à PostgreSQL depuis le frontend (n'existaient déjà pas côté legacy — `apps/web`'s frontend passe toujours par ses propres routes serveur).
