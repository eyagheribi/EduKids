# Suivi.Api completion event contract

Suivi.Api consumes the schema-v1 `GameSessionCompleted` JSON payload. Property names are case-insensitive during HTTP JSON binding; producers should use the canonical names below. `SchemaVersion` and `FinalMaxScore` are required for new events.

```json
{
  "EventId": "guid",
  "SchemaVersion": 1,
  "SessionId": "guid",
  "GameId": "guid",
  "SpaceId": "guid",
  "GameType": "MATH",
  "GameTitle": "Calcul mental",
  "FinalStatus": "SUCCESS",
  "AttemptsUsed": 1,
  "MaxAttempts": 3,
  "FinalScore": 1,
  "FinalMaxScore": 1,
  "StartedAt": "2026-11-19T14:00:00Z",
  "CompletedAt": "2026-11-19T14:01:00Z",
  "NextAvailableAt": null,
  "GameContentSnapshot": { "expression": "1 + 1" },
  "Attempts": [
    {
      "AttemptId": "guid",
      "AttemptNumber": 1,
      "SubmittedAnswer": { "value": 2 },
      "Correct": true,
      "Score": 1,
      "MaxScore": 1,
      "SubmittedAt": "2026-11-19T14:01:00Z"
    }
  ]
}
```

`FinalScore` is the score achieved on the last submitted attempt; `FinalMaxScore` is the maximum possible score for that attempt. Normalized scores are `FinalScore / FinalMaxScore`, never divided by `MaxAttempts`. Negative or out-of-range scores are rejected. A zero maximum is accepted only with a zero score and is omitted from normalized-score averages to avoid division by zero.

The database migration adds nullable `FinalMaxScore` storage so existing sessions remain intact and accurately indicate that their maximum score is unknown. Historical values are not backfilled from `MaxAttempts` or otherwise reinterpreted. New events must include `FinalMaxScore`.

The event ID is the idempotency key. A repeat with the same event ID and payload is ignored; reuse of that ID with a different payload is a conflict. For historical events ingested before `FinalMaxScore` was introduced, an exact replay matching the previously stored payload hash remains idempotent. Such an event is not accepted as a new session.
