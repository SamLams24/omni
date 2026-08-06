# Variables d'environnement — omni-web-frontend

Fichier source : `omni-web-frontend/.env.example`. Copiez-le en `omni-web-frontend/.env.local` (ignoré par git).

Toutes les variables sont préfixées `NEXT_PUBLIC_*` — ce frontend n'a aucun secret côté serveur en Lot 1 (aucun appel direct à une base de données ni à un service tiers avec clé privée ; tout passe par `omni-backend`). Elles sont validées par Zod dans `src/lib/env/client.ts` (`loadClientEnv()`), qui lève une erreur explicite si une variable est absente ou mal typée.

| Variable | Obligatoire | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Oui | URL publique de ce frontend |
| `NEXT_PUBLIC_API_URL` | Oui | URL de base de l'API `omni-backend` (incluant `/api/v1`) |
| `NEXT_PUBLIC_MAP_DEFAULT_LAT` | Oui | Latitude par défaut de la carte (nombre) |
| `NEXT_PUBLIC_MAP_DEFAULT_LON` | Oui | Longitude par défaut de la carte (nombre) |
| `NEXT_PUBLIC_MAP_DEFAULT_ZOOM` | Oui | Niveau de zoom initial (nombre) |

## Client API

`src/lib/api/server-client.ts` (Server Components, transmet les cookies entrants) et `src/lib/api/browser-client.ts` (Client Components, `credentials: "include"`) sont les deux seuls points d'entrée pour appeler `omni-backend` — ne jamais appeler `fetch` directement vers l'API ailleurs dans le code applicatif.

## Internationalisation

Aucune variable d'environnement dédiée : les locales supportées (`fr` par défaut, `en`) sont définies dans `src/i18n/routing.ts`. Tous les textes affichés viennent de `messages/fr.json` / `messages/en.json` — aucun texte en dur dans les composants.
