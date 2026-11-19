# Activites.Api

Service .NET 8 pour gérer les jeux éducatifs, leur contenu, les sessions et les tentatives. La base SQLite locale est créée au démarrage (`activites.db`, `ConnectionStrings:Activities`). `EnsureCreated` convient au démarrage du prototype ; pour déployer des évolutions de schéma, remplacer ce mécanisme par des migrations EF Core versionnées.

## État des intégrations

Le dépôt ne contient pas encore de contrat HTTP d'`Espaces.Api`. `ISpaceAccess` reste le point d'intégration pour relier l'utilisateur authentifié à l'espace enfant et à ses types d'activités autorisés.

### Accès de test local (Development uniquement)

Le schéma `EduKidsDevelopmentTest` est ajouté uniquement lorsque `ASPNETCORE_ENVIRONMENT=Development`. Il lit le credential de l'en-tête `X-EduKids-Test-Credential`. La configuration est explicitement désactivée par défaut dans `appsettings.Development.json`. Le principal de test ne peut accéder qu'à l'espace configuré et aux types listés ci-dessous. Le lancement HTTP local est lié à `localhost` dans `Properties/launchSettings.json`.

Dans PowerShell, depuis la racine du dépôt, active le mode test avec un credential uniquement local :

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:Development__TestAuth__Enabled = 'true'
$env:Development__TestAuth__Credential = 'local-only-postman-secret-change-me'
dotnet run --project src/Activites.Api --launch-profile http
```

La configuration de développement autorise seulement l'espace `11111111-1111-1111-1111-111111111111` et `MATH`, `MATCHING`, `SENTENCE_ORDERING`. Dans Postman, ajoute à chaque requête :

```http
X-EduKids-Test-Credential: local-only-postman-secret-change-me
```

Les requêtes sans credential ou avec un credential incorrect reçoivent `401 Unauthorized`. Un autre espace ou type reçoit `403 Forbidden`. Ne définis pas ces variables dans les profils Production, ne réutilise pas ce credential et ne lie pas le serveur à une adresse réseau accessible depuis l'extérieur.

En Production, le schéma de test n'est pas enregistré. L'implémentation `DenyAllSpaceAccess` refuse l'accès jusqu'à son remplacement par l'adaptateur d'authentification et d'autorisation connecté à `Espaces.Api`.

`IProgressPublisher` est le point d'intégration pour Suivi.Api. L'implémentation actuelle est un no-op car aucun contrat ni broker n'existe. Pour une livraison fiable, implémenter un outbox transactionnel en base et un consommateur idempotent dans Suivi.Api avant d'activer la publication.

## Routes

- `POST /api/spaces/{spaceId}/games` — créer (`type`, `content`, `title`)
- `GET /api/spaces/{spaceId}/games?type=MATH` — lister
- `GET|PUT|DELETE /api/spaces/{spaceId}/games/{gameId}` — lire, modifier, supprimer
- `POST /api/spaces/{spaceId}/games/{gameId}/sessions` — démarrer/reprendre
- `GET /api/spaces/{spaceId}/games/{gameId}/availability` — disponibilité
- `GET /api/spaces/{spaceId}/sessions/{sessionId}` — état
- `POST /api/spaces/{spaceId}/sessions/{sessionId}/attempts` — soumettre `{ "idempotencyKey":"uuid", "answer": { ... } }`

Contenus parent : MATH `{ "expression":"12 / 3 + 5 * (2 - 1)" }`; MATCHING `{ "pairs":[{"left":"Red","right":"Rouge"},{"left":"Blue","right":"Bleu"}] }`; SENTENCE_ORDERING `{ "sentence":"Je suis une fille" }`. Réponses : MATH `{ "value":9 }`; MATCHING `{ "matches":{ "<left-id>":"<right-id>" } }`; SENTENCE_ORDERING `{ "tokens":["<token-guid>", ...] }`.

La génération de jeu est retournée dans la réponse de démarrage. Réponses attendues ne sont retournées qu'après un échec final. Math utilise `decimal`, invariant culture, évaluations de gauche à droite pour opérateurs de même priorité et tolérance `0.000001`.

## Exécution

Depuis la racine, après avoir défini les variables ci-dessus : `dotnet run --project src/Activites.Api --launch-profile http`. Swagger UI est disponible en développement via `/swagger`. Compiler : `dotnet build src/Activites.Api/Activites.Api.csproj`. Tests : `dotnet test tests/Activites.Api.Tests/Activites.Api.Tests.csproj`.
