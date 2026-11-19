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

`GameSessionCompleted` est le contrat de sortie vers Suivi.Api. Il contient un EventId stable (l'identifiant de session), les métadonnées et instantané du jeu, le statut final, le score et chaque tentative avec sa réponse JSON exacte. Chaque transition terminale écrit cet événement dans la table SQLite `Outbox` dans la même transaction que la sauvegarde de la session. Le worker réessaie les événements non acquittés; la publication est au moins une fois, donc le futur consommateur Suivi doit dédupliquer par `EventId`.

L'adaptateur `IProgressPublisher` reste volontairement no-op tant qu'aucun broker/transport n'est configuré. Il retourne « non publié » : les événements restent visibles comme en attente dans `Outbox` et ne sont pas présentés comme livrés à Suivi.Api. Le service ne contacte pas Suivi.Api directement. Une livraison après accusé de réception peut être rejouée en cas de panne entre réception et marquage local; l'idempotence côté consommateur est donc nécessaire.

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

`SUCCESS` permet une nouvelle session immédiatement. `FAILED` et `UNFINISHED` bloquent seulement le même jeu dans le même espace jusqu'à `NextAvailableAt`; la disponibilité revient à l'instant exact de cette date UTC.

Chaque nouvelle session fige le titre, le type et le JSON de contenu au démarrage. Chaque tentative garde son identifiant, le JSON exact de la réponse, l'évaluation, le score et l'heure. Les exercices historiques des sessions créées avant l'ajout des instantanés ne peuvent pas être reconstruits rétroactivement ; l'évolution de schéma enregistre le contenu actuellement disponible lors de la mise à niveau.

## Exécution

Depuis la racine, après avoir défini les variables ci-dessus : `dotnet run --project src/Activites.Api --launch-profile http`. Swagger UI est disponible en développement via `/swagger`. Compiler : `dotnet build src/Activites.Api/Activites.Api.csproj`. Tests : `dotnet test tests/Activites.Api.Tests/Activites.Api.Tests.csproj`.
