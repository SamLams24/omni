# Rôles et permissions — omni-backend

> **Statut : schéma en place, guards non implémentés.** Les tables `Role`, `Permission`, `UserRole`, `RolePermission` existent (Lot 1, `prisma/schema.prisma`) et sont peuplées par `prisma/seed.ts`. Les guards NestJS (`RolesGuard`, `PermissionsGuard`) restent à construire en Lot 2.

## Modèle

RBAC classique : un utilisateur a un ou plusieurs rôles (`UserRole`), un rôle a un ou plusieurs permissions (`RolePermission`). Aucune autorisation ne doit jamais reposer sur un simple champ `isAdmin` — c'est explicitement ce que ce modèle remplace (l'ancienne app, `apps/web`, n'a aucun concept de rôle du tout).

## Rôles seedés (développement)

- `SUPER_ADMIN` — toutes les permissions
- `USER` — aucune permission élevée (utilisateur standard)

## Permissions seedées

```
users.read        users.create      users.update      users.delete
businesses.read    businesses.verify businesses.certify
kyc.read           kyc.approve       kyc.reject
subscriptions.read subscriptions.manage
payments.read       payments.refund
admin.access
```

## Principe de vérification

Le backend est **toujours** la source de vérité — le frontend peut masquer une action non autorisée dans l'interface, mais ce n'est qu'un confort d'affichage, jamais un contrôle de sécurité. Chaque route sensible devra vérifier explicitement le rôle/la permission via un guard, jamais seulement en supposant que le frontend ne montre pas le bouton correspondant.
