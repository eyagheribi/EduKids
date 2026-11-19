using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Suivi.Api.Domain.Exceptions;
using Suivi.Api.Domain.Model;
using Suivi.Api.Infrastructure.Persistence;

namespace Suivi.Api.Application;

// --- Shared event contract (schema v1) ---
// Fields match GameSessionCompleted exactly. Do not rename without
// coordinating with Activites.Api (Codex).

public sealed class GameSessionCompletedEvent
{
    public Guid EventId { get; set; }
    public int SchemaVersion { get; set; } = 1;
    public Guid SessionId { get; set; }
    public Guid GameId { get; set; }
    public Guid SpaceId { get; set; }
    public string GameType { get; set; } = string.Empty;
    public string? GameTitle { get; set; }
    public string FinalStatus { get; set; } = string.Empty;
    public int AttemptsUsed { get; set; }
    public int MaxAttempts { get; set; }
    public decimal FinalScore { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset CompletedAt { get; set; }
    public DateTimeOffset? NextAvailableAt { get; set; }
    public JsonElement GameContentSnapshot { get; set; }
    public List<AttemptEvent> Attempts { get; set; } = [];
}

public sealed class AttemptEvent
{
    public Guid AttemptId { get; set; }
    public int AttemptNumber { get; set; }
    public JsonElement SubmittedAnswer { get; set; }
    public bool Correct { get; set; }
    public decimal Score { get; set; }
    public decimal MaxScore { get; set; }
    public DateTimeOffset SubmittedAt { get; set; }
}

// --- Service ---

public sealed class SessionIngestionService(SuiviDbContext db, ILogger<SessionIngestionService> logger)
{
    public async Task<bool> IngestAsync(GameSessionCompletedEvent evt, CancellationToken ct)
    {
        ValidatePayload(evt);

        var payloadHash = ComputeHash(evt);

        // Idempotency: same EventId → already processed
        var existingEvent = await db.IngestedEvents.FindAsync([evt.EventId], ct);
        if (existingEvent != null)
        {
            if (!string.Equals(existingEvent.PayloadHash, payloadHash, StringComparison.Ordinal))
            {
                throw new EventConflictException(
                    evt.SessionId,
                    evt.EventId,
                    $"Event {evt.EventId} was already processed with a different payload.");
            }

            logger.LogInformation("Event {EventId} already ingested, skipping (idempotency).", evt.EventId);
            return false;
        }

        // Conflict detection: same SessionId with different FinalStatus
        var conflictingEvent = await db.IngestedEvents
            .FirstOrDefaultAsync(e => e.SessionId == evt.SessionId, ct);
        if (conflictingEvent != null)
        {
            var newStatus = ParseFinalStatus(evt.FinalStatus);
            if (conflictingEvent.FinalStatus != newStatus)
            {
                throw new EventConflictException(
                    evt.SessionId,
                    evt.EventId,
                    $"Session {evt.SessionId} was already recorded with status {conflictingEvent.FinalStatus} " +
                    $"but incoming event {evt.EventId} reports {newStatus}. Manual investigation required.");
            }

            // Same SessionId, same FinalStatus but different EventId → deduplicate by SessionId
            logger.LogWarning(
                "Session {SessionId} already exists (prior EventId={PriorEventId}). Deduplicating by SessionId.",
                evt.SessionId, conflictingEvent.EventId);
            return false;
        }

        // Parse
        var gameType = ParseGameType(evt.GameType);
        var finalStatus = ParseFinalStatus(evt.FinalStatus);

        var session = new CompletedGameSession
        {
            SessionId = evt.SessionId,
            GameId = evt.GameId,
            SpaceId = evt.SpaceId,
            GameType = gameType,
            GameTitle = evt.GameTitle,
            FinalStatus = finalStatus,
            AttemptsUsed = evt.AttemptsUsed,
            MaxAttempts = evt.MaxAttempts,
            FinalScore = evt.FinalScore,
            StartedAt = evt.StartedAt.ToUniversalTime(),
            CompletedAt = evt.CompletedAt.ToUniversalTime(),
            NextAvailableAt = evt.NextAvailableAt?.ToUniversalTime(),
            GameContentSnapshot = evt.GameContentSnapshot.GetRawText(),
            Attempts = evt.Attempts.Select(a => new RecordedAttempt
            {
                AttemptId = a.AttemptId,
                SessionId = evt.SessionId,
                AttemptNumber = a.AttemptNumber,
                SubmittedAnswer = a.SubmittedAnswer.GetRawText(),
                Correct = a.Correct,
                Score = a.Score,
                MaxScore = a.MaxScore,
                SubmittedAt = a.SubmittedAt.ToUniversalTime()
            }).ToList()
        };

        var ingested = new IngestedEvent
        {
            EventId = evt.EventId,
            SessionId = evt.SessionId,
            SchemaVersion = evt.SchemaVersion,
            IngestedAt = DateTimeOffset.UtcNow,
            PayloadHash = payloadHash,
            FinalStatus = finalStatus
        };

        await using var txn = await db.Database.BeginTransactionAsync(ct);
        try
        {
            db.CompletedSessions.Add(session);
            db.IngestedEvents.Add(ingested);
            await db.SaveChangesAsync(ct);
            await txn.CommitAsync(ct);
        }
        catch
        {
            await txn.RollbackAsync(ct);
            throw;
        }

        logger.LogInformation(
            "Ingested GameSessionCompleted event {EventId}: session {SessionId} status={FinalStatus}.",
            evt.EventId, evt.SessionId, finalStatus);

        return true;
    }

    private static void ValidatePayload(GameSessionCompletedEvent evt)
    {
        if (evt.EventId == Guid.Empty)
            throw new InvalidEventPayloadException("eventId is required.");
        if (evt.SessionId == Guid.Empty)
            throw new InvalidEventPayloadException("sessionId is required.");
        if (evt.GameId == Guid.Empty)
            throw new InvalidEventPayloadException("gameId is required.");
        if (evt.SpaceId == Guid.Empty)
            throw new InvalidEventPayloadException("spaceId is required.");
        if (string.IsNullOrWhiteSpace(evt.GameType))
            throw new InvalidEventPayloadException("gameType is required.");
        if (string.IsNullOrWhiteSpace(evt.FinalStatus))
            throw new InvalidEventPayloadException("finalStatus is required.");
        if (evt.SchemaVersion != 1)
            throw new InvalidEventPayloadException($"Unsupported schemaVersion {evt.SchemaVersion}. Expected 1.");
        if (evt.MaxAttempts <= 0)
            throw new InvalidEventPayloadException("maxAttempts must be greater than zero.");
        if (evt.AttemptsUsed < 0 || evt.AttemptsUsed > evt.MaxAttempts)
            throw new InvalidEventPayloadException("attemptsUsed must be between zero and maxAttempts.");
        if (evt.Attempts is null)
            throw new InvalidEventPayloadException("attempts is required.");
        if (evt.AttemptsUsed != evt.Attempts.Count)
            throw new InvalidEventPayloadException("attemptsUsed must match the number of attempts.");
        if (evt.GameContentSnapshot.ValueKind == JsonValueKind.Undefined)
            throw new InvalidEventPayloadException("gameContentSnapshot is required.");

        var attemptIds = new HashSet<Guid>();
        var attemptNumbers = new HashSet<int>();
        foreach (var attempt in evt.Attempts)
        {
            if (attempt is null)
                throw new InvalidEventPayloadException("attempts cannot contain null entries.");
            if (attempt.AttemptId == Guid.Empty || !attemptIds.Add(attempt.AttemptId))
                throw new InvalidEventPayloadException("Each attempt must have a unique, non-empty attemptId.");
            if (attempt.AttemptNumber <= 0 || !attemptNumbers.Add(attempt.AttemptNumber))
                throw new InvalidEventPayloadException("Each attempt must have a unique, positive attemptNumber.");
            if (attempt.SubmittedAnswer.ValueKind == JsonValueKind.Undefined)
                throw new InvalidEventPayloadException("submittedAnswer is required for every attempt.");
        }

        ParseGameType(evt.GameType);
        ParseFinalStatus(evt.FinalStatus);
    }

    private static GameType ParseGameType(string value)
    {
        if (!Enum.TryParse<GameType>(value, ignoreCase: true, out var result))
            throw new InvalidEventPayloadException($"Unknown gameType '{value}'.");
        return result;
    }

    private static SessionFinalStatus ParseFinalStatus(string value)
    {
        if (!Enum.TryParse<SessionFinalStatus>(value, ignoreCase: true, out var result))
            throw new InvalidEventPayloadException($"Unknown finalStatus '{value}'. Expected SUCCESS, FAILED, or UNFINISHED.");
        return result;
    }

    private static string ComputeHash(GameSessionCompletedEvent evt)
    {
        var raw = JsonSerializer.Serialize(evt);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));
    }
}
