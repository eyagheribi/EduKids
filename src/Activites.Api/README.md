# Activites.Api

Service .NET 8 pour gérer les jeux éducatifs, leur contenu, les sessions et les tentatives. La base SQLite locale est créée au démarrage (`activites.db`, `ConnectionStrings:Activities`). Le démarrage applique aussi des changements de schéma SQLite additifs nécessaires aux deadlines et au contrôle de concurrence. Ce n'est pas un mécanisme général de migrations : les évolutions de schéma ultérieures doivent passer par des migrations EF Core versionnées.

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

`GameSessionCompleted` est le contrat de sortie vers Suivi.Api, versionné avec `SchemaVersion: 1`. Il contient un EventId stable (l'identifiant de session), les métadonnées et l'instantané immuable `GameContentSnapshot`, le statut final, les scores du dernier essai et chaque tentative avec sa réponse JSON exacte. Chaque transition terminale écrit cet événement dans la table SQLite `Outbox` dans la même transaction que la sauvegarde de la session. Le worker réessaie les événements non acquittés; la publication est au moins une fois, donc le futur consommateur Suivi doit dédupliquer par `EventId`.

L'adaptateur `IProgressPublisher` reste volontairement no-op tant qu'aucun broker/transport n'est configuré. Il retourne « non publié » : les événements restent visibles comme en attente dans `Outbox` et ne sont pas présentés comme livrés à Suivi.Api. Le service ne contacte pas Suivi.Api directement. Une livraison après accusé de réception peut être rejouée en cas de panne entre réception et marquage local; l'idempotence côté consommateur est donc nécessaire.

### Contrat d'historique parent (à intégrer dans Suivi.Api)

`Suivi.Api` est propriétaire de l'historique pédagogique et des routes consommées par le tableau de bord parent. `Activites.Api` ne fournit pas de route d'historique parent et n'expose pas sa base SQLite pour cette consultation. Le consommateur Suivi devra enregistrer les événements de façon idempotente avec `EventId` comme clé de déduplication, puis fournir les consultations protégées par l'autorisation réelle du parent vers l'espace enfant.

Le message `GameSessionCompletedEvent` (champs sérialisés actuellement avec leurs noms C#) a cette forme :

```json
{
  "SchemaVersion": 1,
  "EventId": "<session-guid>",
  "SessionId": "<session-guid>",
  "GameId": "<game-guid>",
  "SpaceId": "<child-space-guid>",
  "GameType": "MATH",
  "GameTitle": "Calcul mental 1",
  "FinalStatus": "UNFINISHED",
  "AttemptsUsed": 2,
  "MaxAttempts": 3,
  "FinalScore": 0,
  "FinalMaxScore": 1,
  "StartedAt": "2026-11-19T14:00:00Z",
  "CompletedAt": "2026-11-19T14:08:00Z",
  "NextAvailableAt": "2026-11-20T14:08:00Z",
  "GameContentSnapshot": { "expression": "11 + 111" },
  "Attempts": [
    {
      "AttemptId": "<attempt-guid>",
      "AttemptNumber": 1,
      "SubmittedAnswer": { "value": 18 },
      "Correct": false,
      "Score": 0,
      "MaxScore": 1,
      "SubmittedAt": "2026-11-19T14:02:00Z"
    },
    {
      "AttemptId": "<attempt-guid-2>",
      "AttemptNumber": 2,
      "SubmittedAnswer": { "value": 20 },
      "Correct": false,
      "Score": 0,
      "MaxScore": 1,
      "SubmittedAt": "2026-11-19T14:03:00Z"
    }
  ]
}
```

`SubmittedAnswer` reste un JSON structuré selon le type : MATH utilise `{ "value": 18 }`, MATCHING utilise les associations `{ "matches": { "<left-token-guid>": "<right-token-guid>" } }`, et SENTENCE_ORDERING conserve la séquence `{ "tokens": ["<token-guid>", ...] }`. `GameContentSnapshot` donne le contenu de l'exercice au début de cette session, même si le jeu est modifié ensuite. `FinalScore` et `FinalMaxScore` sont copiés du dernier enregistrement de tentative; le maximum n'est jamais déduit de `MaxAttempts`. Il vaut 1 pour MATH, le nombre de paires pour MATCHING, et le maximum effectivement renvoyé par le moteur SENTENCE_ORDERING. Pour UNFINISHED, ils décrivent la dernière réponse soumise. `NextAvailableAt` est nul après SUCCESS et contient la date UTC de reprise après FAILED ou UNFINISHED. Aucun nom d'enfant ni autre donnée personnelle n'est transmis; `SpaceId` permet à Suivi de résoudre l'appartenance avec sa propre intégration autorisée.

Les messages `GameSessionCompleted` déjà en attente et dépourvus de `SchemaVersion` sont reconnus comme l'ancien format. Avant publication, le worker remplace `ExerciseContentSnapshot` par `GameContentSnapshot`, conserve EventId et l'historique de tentatives, recalcule les deux scores depuis la dernière tentative et écrit le JSON version 1 dans la même ligne d'outbox. Il ne marque pas le message comme envoyé pendant cette conversion. Si le contenu ou les tentatives nécessaires manquent, le worker conserve le message en attente et enregistre l'erreur au lieu d'émettre des valeurs inventées.

Suivi pourra exposer, après mise en place de son stockage et de son autorisation, une liste paginée de sessions par espace/jeu et les détails d'une session : statut final, timestamps, disponibilité, snapshot du jeu et tentatives ordonnées avec identifiant, réponse, évaluation et score. Ces routes restent à concevoir et protéger dans Suivi.Api; l'événement autonome évite à Suivi d'interroger la base d'Activites.Api.

### Contrat de notification de session inachevée (à intégrer dans Notifications.Api)

Lors de la seule transition `ACTIVE → UNFINISHED`, la même transaction écrit aussi un message `UnfinishedSessionNotification` dans `Outbox`. Son `EventId` est stable et distinct de l'événement de progression. Le message contient `EventId`, `SpaceId`, `GameId`, `GameTitle`, `Status` (`UNFINISHED`), `AttemptsUsed`, `IncorrectAttempts`, `CompletedAt` et `NextAvailableAt`. Il ne contient ni nom d'enfant, ni coordonnées du parent, ni autre donnée personnelle; Notifications.Api devra utiliser son intégration autorisée pour résoudre le destinataire à partir de l'espace.

Il n'y a aucun message pour chaque tentative incorrecte, ni pour une session `SUCCESS` ou `FAILED`. L'écriture conditionnelle de transition et la clé primaire unique `Outbox.EventId` empêchent de créer une nouvelle notification logique lors de balayages répétés. Le futur consommateur doit néanmoins dédupliquer par `EventId`, car un transport au moins une fois peut rejouer un message après réception.

`IParentNotificationPublisher` est l'adaptateur du transport vers Notifications.Api. Son implémentation actuelle est no-op et indique que le message n'a pas été livré : le message reste en attente dans `Outbox`. Aucune notification n'est envoyée par ce dépôt et Notifications.Api reste inchangée.

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

Les règles de session sont configurées par `GameSessions` dans `appsettings.json`: trois tentatives, cinq minutes d'inactivité à partir de la première réponse incorrecte, vingt-quatre heures de cooldown après `FAILED` ou `UNFINISHED`, et un balayage périodique toutes les quinze secondes. Chaque réponse incorrecte avant la dernière redémarre le délai. Les sessions ouvertes sans réponse n'ont pas de deadline. Les routes de reprise et de soumission vérifient elles aussi la deadline et effectuent la transition immédiatement si nécessaire.

### Exemple Postman : expiration MATH

Crée un environnement Postman avec `baseUrl=http://localhost:5156`, `spaceId=11111111-1111-1111-1111-111111111111` et `testCredential` égal au credential configuré dans le terminal Development. Pour chaque requête, ajoute `X-EduKids-Test-Credential: {{testCredential}}`; ajoute aussi `Content-Type: application/json` aux requêtes avec un corps.

1. Créer un jeu : `POST {{baseUrl}}/api/spaces/{{spaceId}}/games`, avec `{ "type": "MATH", "title": "Calcul mental 1", "content": { "expression": "2 + 2" } }`. Stocke `id` de la réponse en variable `gameId`.
2. Démarrer : `POST {{baseUrl}}/api/spaces/{{spaceId}}/games/{{gameId}}/sessions`, sans corps. Stocke `id` de la réponse en variable `sessionId`; elle a `status: "ACTIVE"` et `inactivityDeadlineAt: null`.
3. Envoyer une réponse incorrecte : `POST {{baseUrl}}/api/spaces/{{spaceId}}/sessions/{{sessionId}}/attempts`, avec `{ "idempotencyKey": "postman-math-try-1", "answer": { "value": 3 } }`. La réponse indique `correct: false`, `status: "ACTIVE"` et un `inactivityDeadlineAt` cinq minutes après `submittedAt`.
4. Après cette deadline, lire la session : `GET {{baseUrl}}/api/spaces/{{spaceId}}/sessions/{{sessionId}}`. Elle est `UNFINISHED` et sa `nextAvailableAt` est 24 heures après `completedAt`. Une nouvelle requête d'essai pour cette session répond `409 Conflict`.

Pour raccourcir le délai lors d'une démonstration locale, définis `GameSessions__InactivityTimeoutMinutes=1` avant `dotnet run`; cette option reste une configuration locale, et ne change pas la règle par défaut de cinq minutes. Les tests automatisés utilisent une horloge injectée et n'attendent pas réellement.

`SUCCESS` permet une nouvelle session immédiatement. `FAILED` et `UNFINISHED` bloquent seulement le même jeu dans le même espace jusqu'à `NextAvailableAt`; la disponibilité revient à l'instant exact de cette date UTC.

Chaque nouvelle session fige le titre, le type et le JSON de contenu au démarrage. Chaque tentative garde son identifiant, le JSON exact de la réponse, l'évaluation, le score et l'heure. Les exercices historiques des sessions créées avant l'ajout des instantanés ne peuvent pas être reconstruits rétroactivement ; l'évolution de schéma enregistre le contenu actuellement disponible lors de la mise à niveau.

## Exécution

Depuis la racine, après avoir défini les variables ci-dessus : `dotnet run --project src/Activites.Api --launch-profile http`. Swagger UI est disponible en développement via `/swagger`. Compiler : `dotnet build src/Activites.Api/Activites.Api.csproj`. Tests : `dotnet test tests/Activites.Api.Tests/Activites.Api.Tests.csproj`.
