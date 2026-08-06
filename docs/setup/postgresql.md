# PostgreSQL local

`omni-backend` attend une instance PostgreSQL locale standard (pas de conteneur requis). Un fichier `docker-compose.yml` facultatif peut être ajouté ultérieurement pour les personnes qui préfèrent Docker, mais la procédure ci-dessous ne le nécessite pas.

## Installation

- **Windows** : installeur officiel https://www.postgresql.org/download/windows/, ou via un gestionnaire de paquets. pgAdmin est installé avec le paquet standard.
- **macOS** : `brew install postgresql@16`
- **Linux (Debian/Ubuntu)** : `sudo apt install postgresql postgresql-contrib`

Version recommandée : PostgreSQL 15+ (PostGIS n'est pas requis pour le schéma Prisma actuel — voir la note ci-dessous).

## Créer les bases

```bash
createdb omni_dev
createdb omni_test
```

Ou via `psql` :

```sql
CREATE DATABASE omni_dev;
CREATE DATABASE omni_test;
```

## Connexion

`DATABASE_URL` dans `omni-backend/.env` :

```env
DATABASE_URL=postgresql://postgres:CHANGE_ME@localhost:5432/omni_dev?schema=public
```

Remplacez `CHANGE_ME` par le mot de passe réellement configuré pour l'utilisateur `postgres` local. Ne committez jamais ce fichier `.env` (déjà exclu par `.gitignore`).

## Note PostGIS

Le champ `Business.location` du schéma Prisma est déclaré `Unsupported("geography(Point,4326)")` — Prisma n'a pas de type géographique natif. Les requêtes de proximité (recherche par rayon) passent par `$queryRaw` (`ST_DWithin`, `ST_Distance`), exactement comme le fait `apps/web/src/app/api/discovery/discovery-service.js` aujourd'hui.

Si vous testez des requêtes géospatiales localement, activez l'extension PostGIS dans `omni_dev` :

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Prisma Migrate ne gère pas la création d'extensions — voir `docs/setup/database-migrations.md`.
