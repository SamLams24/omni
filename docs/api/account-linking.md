# Account linking

## Le risque

Un utilisateur a un compte local `samuel@example.com` (mot de passe). Il se
connecte ensuite via Google avec la même adresse `samuel@example.com`.
Fusionner automatiquement ces deux comptes uniquement parce que l'email
correspond est dangereux : n'importe qui contrôlant une boîte mail peut
potentiellement se faire passer pour le propriétaire du compte local en
créant un compte Google avec la même adresse, si aucune vérification
supplémentaire n'est faite.

## Règle appliquée

`IdentityService.linkOrCreateFromOidc(profile)` (voir `omni-backend/src/modules/auth/`) :

1. Cherche une `Identity` existante par `(provider=AUTH0, providerUserId=profile.sub)`.
   Si trouvée → reconnexion directe, aucune ambiguïté, pas de décision à prendre.
2. Sinon, cherche un `User` existant par `email`.
   - Si aucun `User` avec cet email → crée un nouveau `User` + `Identity` (aucun risque de collision).
   - Si un `User` existe avec cet email **et** que `profile.email_verified === true`
     (le claim `email_verified` vient d'Auth0, qui l'a lui-même vérifié auprès de Google/Facebook)
     **et** que ce `User` n'a **aucune** `Identity` `LOCAL` avec un mot de passe actif compromis connu →
     l'`Identity` `AUTH0` est liée à ce `User` existant.
   - Si un `User` existe avec cet email mais `profile.email_verified !== true` →
     **refus explicite** de liaison automatique. Un nouveau `User` distinct n'est pas créé non plus
     (éviter les doublons silencieux) ; la tentative de connexion échoue avec un code d'erreur dédié
     (`AUTH_LINK_VERIFICATION_REQUIRED`) invitant l'utilisateur à se connecter d'abord avec son mot de
     passe local, puis à lier son compte social depuis les paramètres (flux "lier un compte", hors
     périmètre de cette itération -- non implémenté, seul le refus sécurisé l'est).

Aucune liaison n'est donc jamais faite sur la seule base d'une correspondance de chaîne email quand
l'email n'a pas été vérifié par le fournisseur externe.

## Ce qui n'est pas encore implémenté

Le flux explicite "lier un compte social à mon compte existant" depuis les paramètres utilisateur
(action volontaire, authentifiée, avec confirmation) n'est pas construit dans cette itération -- seul
le refus sécurisé du cas dangereux (étape 2, dernier cas) l'est, pour ne jamais introduire de faille
par omission.
