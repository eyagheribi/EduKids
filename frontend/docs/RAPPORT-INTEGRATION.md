# Rapport d’intégration — frontend EduKids ↔ microservices

Ce rapport recense l’état réel des microservices tel qu’observé dans le code **et vérifié en
exécutant les services** (Comptes.Api, Espaces.Api et Activites.Api lancés localement, appels HTTP
réels), les incohérences entre services et les modifications backend nécessaires pour connecter
entièrement le frontend. Aucune modification n’a été apportée au backend.

## 1. Synthèse

| Service | Rôle | Authentification réelle | Intégration frontend |
|---|---|---|---|
| **Comptes.Api** (`:5220`) | Comptes parents (ASP.NET Identity) | JWT HS256 émis (`sub`, `role=Parent`, 2 h) | **Connecté** : inscription, connexion, session |
| **Espaces.Api** (`:5092`) | Espaces enfants, codes d’accès, espace de l’enfant | JWT validés (même clé que Comptes) ; JWT enfant émis (`role=Enfant`, `espaceId`, 4 h) | **Connecté** : liste, création, détail, modification, suppression, accès par code, `mon-espace`, personnage |
| **Activites.Api** (`:5156`) | Jeux, sessions, tentatives, moteurs | **N’accepte pas les JWT EduKids** : en-tête de test Postman uniquement en Development, `DenyAllSpaceAccess` en Production | **Démonstration** (adaptateur local fidèle aux règles) ; client HTTP réel prêt (`ActivitesHttpGateway`) |
| **Suivi.Api** (`:5102`) | Historique et statistiques parent | Même limitation (en-tête de test, un seul espace autorisé) | **Démonstration** alimentée par les parties jouées en démo ; client HTTP réel prêt (`SuiviHttpGateway`) |
| **Notifications.Api** | — | — | **Non disponible** : modèle de projet (`/weatherforecast`) |

Le passage en mode réel se fait dans `frontend/src/environments/environment.ts`
(`integrations.games` / `integrations.progress` : `'demo'` → `'api'`), sans autre modification du
frontend.

## 2. Incohérences et modifications backend nécessaires (par priorité)

### 2.1 Bloquant — authentification d’Activites.Api et de Suivi.Api
- **Constat** : un `Authorization: Bearer <jwt parent ou enfant>` reçoit `401` (vérifié). Seul le
  schéma `EduKidsDevelopmentTest` / `SuiviDevelopmentTest` (en-tête secret, un unique `spaceId` codé
  en dur dans `appsettings.Development.json`) est accepté ; en Production tout est refusé.
- **À faire** :
  1. ajouter `AddJwtBearer` avec la même configuration que Comptes/Espaces (`MapInboundClaims=false`,
     `NameClaimType="sub"`, `RoleClaimType="role"`, clé lue depuis la configuration sécurisée) ;
  2. implémenter `ISpaceAccess` / `ISuiviSpaceAccess` :
     - **enfant** : `espaceId` du jeton == `spaceId` de la route, et type d’activité activé ;
     - **parent** : l’espace appartient au parent (`EspaceEnfant.ParentId == sub`) — via un appel
       service-à-service à Espaces.Api (ex. `GET /espaces/{id}` en relayant le jeton) ou une
       projection locale alimentée par événements ;
  3. restreindre par rôle : création/modification/suppression des jeux = `Parent` ; sessions et
     tentatives = `Enfant` (aujourd’hui tout utilisateur authentifié pourrait tout faire) ; Suivi =
     `Parent`.
- Le frontend envoie déjà le bon jeton selon l’audience (`HttpContext` `AUTH_AUDIENCE`).

### 2.2 Bloquant — catégories incohérentes entre Espaces.Api et Activites.Api
| Espaces.Api (`TypesValides`) | Activites.Api (`GameType`) | Problème |
|---|---|---|
| `Maths` | `MATH` | noms différents |
| `Association` | `MATCHING` | noms différents |
| `Dictee` | — | **aucun moteur de dictée** |
| — | `SENTENCE_ORDERING` | **impossible à activer** dans un espace |

- **À faire** : définir un référentiel commun dans `EduKids.Contracts` (ex. enum `TypeActivite`
  partagé), ajouter l’ordonnancement de mots à `TypesValides`, et soit implémenter un moteur de dictée,
  soit retirer `Dictee` tant qu’il n’existe pas. Le contrôle `ISpaceAccess` d’Activites.Api a besoin
  de cette correspondance.
- **Frontend aujourd’hui** : correspondance centralisée dans `core/models/categories.ts` ;
  l’ordonnancement de mots n’est proposé qu’en démonstration (signalé) ; la dictée est une
  démonstration statique clairement identifiée.

### 2.3 Majeur — suppression d’un jeu déjà joué → `500`
- **Constat (vérifié)** : `DELETE /api/spaces/{id}/games/{gameId}` sur un jeu ayant au moins une
  session terminée répond `500 Internal Server Error` (clé étrangère `Sessions → Games` en
  `DeleteBehavior.Restrict`).
- **À faire** : décider de la règle métier (archivage logique du jeu en conservant l’historique, ou
  refus explicite `409` avec message). Le frontend affiche un message explicite dans les deux cas ;
  l’adaptateur de démonstration renvoie `409`.

### 2.4 Majeur — réponses des enfants illisibles dans le suivi
- **Constat** : `GameSessionCompleted.Attempts[].SubmittedAnswer` contient, pour `MATCHING` et
  `SENTENCE_ORDERING`, des identifiants de jetons générés pour chaque session (`PlayJson`), absents
  de l’événement. Suivi ne peut donc pas restituer les mots choisis par l’enfant. Pour `MATH`, le
  résultat attendu n’est pas transmis non plus.
- **À faire** : inclure dans l’événement l’instantané jouable (jeton → libellé) ou une version
  « lisible » de la réponse, ainsi que la correction attendue ; les exposer dans `SessionDetailDto`.
- **Frontend aujourd’hui** : affiche le nombre d’associations / de mots envoyés, le score par
  tentative, la solution issue de l’instantané de contenu, et les données brutes.

### 2.5 Majeur — CORS absent sur tous les services
- Aucun service n’active CORS. En développement, le serveur Angular relaie `/gateway/<service>`
  (`frontend/proxy.conf.json`). En production il faut une passerelle (reverse proxy / API gateway)
  exposant ces préfixes, ou une politique CORS explicite.

### 2.6 Comptes.Api
- Pas d’endpoint de profil : `/auth/me` renvoie seulement `id` et `role`, la connexion renvoie
  seulement le jeton → le nom du parent n’est affichable que s’il s’est inscrit sur cet appareil
  (cache local), sinon l’e-mail. **À ajouter** : `GET /auth/me` avec `nom`, `prenom`, `email`.
- Pas de réinitialisation de mot de passe (le lien « Mot de passe oublié ? » de la maquette affiche
  une information « non disponible »), pas de jeton de rafraîchissement (session de 2 h).
- Messages d’erreur Identity en anglais (traduits côté frontend).
- La clé JWT est versionnée dans `appsettings.json` (Comptes et Espaces) : à déplacer dans un
  gestionnaire de secrets / variables d’environnement.

### 2.7 Espaces.Api
- `GET /espaces` ne renvoie ni `avatar` ni `personnagePrefere` et sérialise les activités en chaîne
  CSV (`typesActivites`) → le frontend charge le détail de chaque espace (N+1 requêtes).
- `POST /espaces` n’accepte pas d’avatar (le frontend le propose après la création via `PUT`).
- La suppression d’un espace ne publie pas `EspaceEnfantSupprime` (contrat défini dans
  `EduKids.Contracts` mais inutilisé) : jeux et historique restent orphelins dans Activites/Suivi.
- Pas de régénération du code d’accès (en cas de fuite), pas de rafraîchissement du jeton enfant
  (4 h).
- Les projets Comptes/Espaces/Notifications ciblent `net9.0` alors qu’Activites/Suivi ciblent
  `net8.0` (lancés ici avec `DOTNET_ROLL_FORWARD=Major` faute de runtime 9).

### 2.8 Activites.Api
- `GET /games` exige `type` : pas de liste globale → une requête par catégorie pour compter les jeux.
- Disponibilité par jeu uniquement (`/availability`) → une requête par jeu dans la liste enfant.
- Les objets imbriqués (`game.content`, `correction`) sont sérialisés en **PascalCase** alors que les
  DTO sont en camelCase ; `PairView` est réutilisé pour la colonne de droite avec la propriété
  `Left`. Le frontend normalise les deux casses (`toPlayable`, `toCorrection`).
- Les règles (3 essais, 5 min, 24 h) ne sont exposées que partiellement (`maxAttempts`) ; exposer
  aussi le délai d’inactivité et la durée de pause éviterait de les dupliquer côté client.
- Aucune route d’historique pour l’enfant.
- `src/Activites.Api/activites.db` (+ `-shm`, `-wal`) est versionné dans le dépôt.

### 2.9 Suivi.Api
- Pas de série temporelle : l’« évolution du taux de réussite » est calculée côté frontend à partir
  des 100 dernières sessions (limite `pageSize`).
- Pas de vue agrégée par parent : le tableau de bord appelle `summary`/`history` pour chaque enfant.

### 2.10 Notifications.Api
- Projet modèle (`/weatherforecast`) : aucune notification. `UnfinishedSessionNotification` est
  écrit dans l’outbox d’Activites mais publié par un adaptateur no-op ; `ActiviteTerminee` et
  `BocalPlein` (contrats) ne sont produits par personne. La cloche du frontend affiche
  « Notifications indisponibles ».

## 3. Vérifications de contrats effectuées

Services lancés localement (bases SQLite dans un dossier temporaire, jamais celles du dépôt) :
- Comptes : inscription (mot de passe faible → 3 erreurs Identity ; doublon → « already taken »),
  connexion (401 sans corps / jeton), `/auth/me`.
- Espaces : création (400 texte brut pour un type invalide, `ValidationProblemDetails` pour un champ
  manquant), liste (`typesActivites` CSV), détail, `PUT` avatar, accès par code (401
  « Code invalide. », jeton enfant avec `espaceId`), `mon-espace`, `PUT personnage`, jeton enfant
  refusé sur les routes parent (403).
- Activites (avec l’en-tête de test, depuis `curl` uniquement) : jeu `MATCHING` (contenu normalisé
  avec `id`), jouable PascalCase, jouable `SENTENCE_ORDERING` (`Tokens`/`Words`), 3 tentatives MATH →
  `FAILED`, `correction: 4`, `nextAvailableAt` +24 h, redémarrage `409`, disponibilité `false`,
  suppression d’un jeu joué → **500**, expression invalide → `400` « Nombre attendu à la position 4. »,
  JWT → **401**.

## 4. Ce qui reste à intégrer côté frontend une fois le backend corrigé
1. Passer `integrations.games` et `integrations.progress` à `'api'`.
2. Retirer le statut `demo-only` de l’ordonnancement dans `categories.ts` quand Espaces l’acceptera.
3. Brancher la cloche sur Notifications.Api quand une API existera.
4. Afficher les réponses lisibles et la correction MATH dès que Suivi les exposera.
