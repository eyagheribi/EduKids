# EduKids — état de l’intégration

Ce document décrit le code actuel. Les vérifications HTTP de production ne sont pas déduites des builds ou des tests unitaires.

## Services et sécurité

| Service | État | Accès |
|---|---|---|
| Comptes.Api | Inscription, connexion et émission de JWT parent | JWT partagé, HS256, expiration requise |
| Espaces.Api | Espaces enfants, codes, profil enfant et catégories | Parent propriétaire pour les espaces; enfant pour son propre profil |
| Activites.Api | Jeux, sessions, tentatives, moteurs Maths/Association/Ordonnancement/Dictée | Bearer JWT, rôle Parent/Enfant et contrôle d’accès par espace/catégorie via Espaces.Api |
| Suivi.Api | Résumés, historique, détails et résultats | Bearer JWT et rôle Parent; contrôle de propriété par Espaces.Api |
| Notifications.Api | Projet de base; aucune API de notification utilisable | À intégrer |

Activites.Api et Suivi.Api utilisent le composant partagé `EduKids.Security`. Il lit `Jwt:Key` depuis la configuration et refuse une clé absente ou de moins de 32 octets. Fournir la même valeur au processus via `Jwt__Key` ou une source de secrets locale; ne pas ajouter de secret au dépôt. La validation impose signature HS256, expiration et signature valide. Les contrôles d’autorisation vérifient ensuite le rôle et l’accès à l’espace auprès d’Espaces.Api.

Les réponses ne passent pas par un contrôle HTTP bout à bout dans cette session. Les clés de signature déjà présentes dans les configurations historiques ne sont pas exposées ici; prévoir leur migration vers un gestionnaire de secrets avant tout déploiement.

## Catégories de jeux

`EduKids.Contracts.ActivityTypes` centralise la correspondance entre catégories d’espace et moteurs : Maths → `MATH`, Association → `MATCHING`, Ordonnancement → `SENTENCE_ORDERING`, Dictée → `DICTATION`. Le moteur de dictée vérifie la réponse côté serveur. Le texte attendu doit toutefois parvenir au navigateur pour la synthèse vocale; il n’est pas transmis comme champ de correction avant la fin.

La suppression d’un jeu ayant une session renvoie maintenant `409` afin de préserver l’historique au lieu de provoquer une erreur de clé étrangère. Les événements de progression restent transmis via l’outbox/RabbitMQ existante.

## Frontend

- Les routes publiques et les formulaires parent/enfant sont disponibles.
- Les espaces, catégories, jeux et le lecteur enfant disposent de vues navigables. Les adaptateurs Jeux et Suivi sont sélectionnés dans `src/environments/environment.ts`; ils restent en mode démonstration par défaut afin que l’application soit parcourable sans services disponibles.
- Le mode démonstration parent est explicitement séparé du compte réel et présente des espaces exemples locaux. Le mode enfant de démonstration fournit des jeux locaux. Les écritures effectuées dans ces modes ne sont pas des données de compte.
- Les écrans de suivi détaillé, notifications et certaines préférences restent des surfaces de démonstration; ils ne prétendent pas enregistrer des données réelles.
- En développement, Angular relaie `/gateway/<service>` via `proxy.conf.json`. L’API doit être démarrée séparément pour les parcours réels.

## Vérifications exécutées

- `npm run build` : réussi.
- Tests Angular : 50 réussis sur 50.
- `dotnet build EduKids.sln --no-restore` : réussi, 0 avertissement, 0 erreur.
- Activites.Api.Tests : 53 réussis sur 53.
- Suivi.Api.Tests : 51 réussis sur 51.
- Frontend servi sur `http://localhost:4200` et page d’accueil ouverte dans Edge.

Ces résultats valident la compilation et les suites de tests existantes. Ils ne remplacent pas encore un scénario HTTP intégré avec bases de données isolées et tous les services lancés.
