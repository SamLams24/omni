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

## Note PostGIS (actuellement non installé)

Contrairement au plan initial (`Unsupported("geography(Point,4326)")`), le champ `Business.latitude`/`Business.longitude` est un simple `Decimal` — voir `docs/architecture/ADR-005-no-postgis-local.md`. En pratique sur cette machine, `CREATE EXTENSION postgis;` échoue car les fichiers de l'extension ne sont pas installés avec PostgreSQL 17 (pas juste désactivés) :

```
Could not open extension control file ".../share/extension/postgis.control"
```

Pour installer PostGIS sur Windows : utilisez **Stack Builder** (fourni avec l'installeur PostgreSQL officiel, menu Démarrer → "Application Stack Builder"), sélectionnez votre instance PostgreSQL, puis "Spatial Extensions" → PostGIS. Nécessite des droits administrateur. Une fois installé :

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Prisma Migrate ne gère pas la création d'extensions — cette commande doit être exécutée manuellement avant toute migration qui en dépendrait.
