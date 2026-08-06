# Variables d'environnement — omni-backend

Fichier source : `omni-backend/.env.example`. Copiez-le en `omni-backend/.env` (ignoré par git) et remplissez les valeurs réelles.

Toutes les variables sont validées au démarrage par `src/config/env.validation.ts` (Zod) — l'application **refuse de démarrer** si une variable obligatoire est absente ou invalide. Les erreurs de validation sont listées explicitement dans les logs de démarrage.

| Variable | Obligatoire | Défaut | Description |
|---|---|---|---|
| `NODE_ENV` | Non | `development` | `development` \| `test` \| `production` |
| `PORT` | Non | `4000` | Port d'écoute HTTP |
| `API_PREFIX` | Non | `api` | Préfixe de toutes les routes |
| `API_VERSION` | Non | `v1` | Version de l'API, combinée à `API_PREFIX` (`/api/v1`) |
| `DATABASE_URL` | **Oui** | — | Chaîne de connexion PostgreSQL (Prisma) |
| `FRONTEND_URL` | **Oui** | — | URL du frontend, utilisée pour les liens sortants (emails, etc. — futurs lots) |
| `CORS_ORIGINS` | **Oui** | — | Liste d'origines autorisées, séparées par des virgules |
| `JWT_ACCESS_SECRET` | **Oui** | — | Secret du token d'accès (≥16 caractères), aléatoire et long en production |
| `JWT_REFRESH_SECRET` | **Oui** | — | Secret du refresh token, distinct du précédent |
| `JWT_ACCESS_EXPIRES_IN` | Non | `15m` | Durée de vie du token d'accès |
| `JWT_REFRESH_EXPIRES_IN` | Non | `30d` | Durée de vie du refresh token |
| `COOKIE_SECURE` | Non | `false` | `true` en production (HTTPS obligatoire) |
| `COOKIE_SAME_SITE` | Non | `lax` | `lax` \| `strict` \| `none` |
| `COOKIE_DOMAIN` | Non | — | Domaine du cookie de session |
| `FEDAPAY_ENVIRONMENT` | Non | `sandbox` | `sandbox` \| `live` |
| `FEDAPAY_SECRET_KEY` | Non* | — | Clé secrète FedaPay (serveur uniquement, jamais exposée au client) |
| `FEDAPAY_PUBLIC_KEY` | Non* | — | Clé publique FedaPay |
| `FEDAPAY_WEBHOOK_SECRET` | Non* | — | Secret de vérification de signature webhook |
| `OVERPASS_API_URL` | Non | `https://overpass-api.de/api/interpreter` | Endpoint Overpass pour les données OSM |
| `OSM_CACHE_TTL_SECONDS` | Non | `300` | Durée de cache des réponses Overpass |
| `LOG_LEVEL` | Non | `debug` | `debug` \| `info` \| `warn` \| `error` |
| `SWAGGER_ENABLED` | Non | `true` | Active `/docs` (à désactiver en production si non souhaité) |

\* Non requis pour démarrer l'application en Lot 1 (le module paiements n'est pas encore implémenté), mais deviendra obligatoire fonctionnellement dès le Lot 6.

## Notes

- `COOKIE_SECURE`/`SWAGGER_ENABLED` acceptent uniquement les chaînes `"true"`/`"false"` (et quelques alias comme `1`/`0`, `yes`/`no`) — voir le commentaire dans `env.validation.ts` expliquant pourquoi `z.coerce.boolean()` a été délibérément évité (il traite la chaîne `"false"` comme vraie).
- Ne jamais commiter `omni-backend/.env`. Seul `.env.example` (sans valeurs réelles) est versionné.
