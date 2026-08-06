# Compte administrateur de développement

`prisma/seed.ts` crée un compte administrateur **uniquement destiné au développement local** :

```
Email : admin@omni.dev
Mot de passe : ChangeMe123!
```

Ce compte a le rôle `SUPER_ADMIN` avec toutes les permissions définies dans le seed. Un compte vendeur de démonstration est également créé (`vendor@omni.dev`, même mot de passe), propriétaire de trois entreprises démo illustrant les trois statuts de vérification (voir `docs/architecture/current-state-audit.md` et le futur `docs/api/permissions.md` une fois l'authentification implémentée en Lot 2).

## Ne jamais réutiliser ces identifiants

- Ne jamais créer ce compte (ou un mot de passe similaire) dans un environnement de staging ou de production.
- Le seed ne doit être exécuté que sur `omni_dev`/`omni_test`, jamais sur une base de production.
- Ces identifiants sont volontairement documentés en clair ici car ils ne donnent accès qu'à une base de données locale, jetable, sans données réelles.

## Statut actuel

L'authentification (Lot 2 du plan de migration) n'est pas encore implémentée dans `omni-backend` — ce compte existe dans la base mais aucune route `/api/v1/auth/login` ne permet encore de s'y connecter. Ce document sera complété une fois le module d'authentification livré.
