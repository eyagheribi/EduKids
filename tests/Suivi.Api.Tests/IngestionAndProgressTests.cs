using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Suivi.Api.Application;
using Suivi.Api.Domain.Exceptions;
using Suivi.Api.Domain.Model;
using Suivi.Api.Infrastructure.Persistence;
using System.Text.Json;

namespace Suivi.Api.Tests;

/// <summary>
/// Shared in-memory SQLite database factory for isolated test databases.
/// Each test class gets its own connection so there's no cross-test pollution.
/// </summary>
public abstract class DbTestBase : IDisposable
{
    private readonly SqliteConnection _connection;
    protected readonly DbContextOptions<SuiviDbContext> Options;

    protected DbTestBase()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        Options = new DbContextOptionsBuilder<SuiviDbContext>()
            .UseSqlite(_connection)
            .Options;

        using var db = new SuiviDbContext(Options);
        db.Database.EnsureCreated();
    }

    protected SuiviDbContext NewDb() => new(Options);

    protected SessionIngestionService NewIngestionService(SuiviDbContext db)
        => new(db, NullLogger<SessionIngestionService>.Instance);

    public void Dispose() => _connection.Dispose();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers / Fixtures
// ═══════════════════════════════════════════════════════════════════════════════

file static class Fixtures
{
    public static readonly Guid SpaceA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    public static readonly Guid SpaceB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    public static GameSessionCompletedEvent SuccessEvent(
        Guid? eventId = null, Guid? sessionId = null, Guid? spaceId = null) =>
        new()
        {
            EventId = eventId ?? Guid.NewGuid(),
            SchemaVersion = 1,
            SessionId = sessionId ?? Guid.NewGuid(),
            GameId = Guid.NewGuid(),
            SpaceId = spaceId ?? SpaceA,
            GameType = "MATH",
            GameTitle = "Calcul mental 1",
            FinalStatus = "SUCCESS",
            AttemptsUsed = 1,
            MaxAttempts = 3,
            FinalScore = 1,
            StartedAt = DateTimeOffset.UtcNow.AddMinutes(-5),
            CompletedAt = DateTimeOffset.UtcNow,
            NextAvailableAt = null,
            GameContentSnapshot = JsonDocument.Parse("{\"expression\":\"1+1\"}").RootElement,
            Attempts =
            [
                new AttemptEvent
                {
                    AttemptId = Guid.NewGuid(),
                    AttemptNumber = 1,
                    SubmittedAnswer = JsonDocument.Parse("{\"value\":2}").RootElement,
                    Correct = true,
                    Score = 1,
                    MaxScore = 1,
                    SubmittedAt = DateTimeOffset.UtcNow.AddMinutes(-1)
                }
            ]
        };

    public static GameSessionCompletedEvent FailedEvent(
        Guid? eventId = null, Guid? sessionId = null, Guid? spaceId = null) =>
        new()
        {
            EventId = eventId ?? Guid.NewGuid(),
            SchemaVersion = 1,
            SessionId = sessionId ?? Guid.NewGuid(),
            GameId = Guid.NewGuid(),
            SpaceId = spaceId ?? SpaceA,
            GameType = "MATH",
            GameTitle = "Calcul mental 2",
            FinalStatus = "FAILED",
            AttemptsUsed = 3,
            MaxAttempts = 3,
            FinalScore = 0,
            StartedAt = DateTimeOffset.UtcNow.AddMinutes(-20),
            CompletedAt = DateTimeOffset.UtcNow,
            NextAvailableAt = DateTimeOffset.UtcNow.AddHours(24),
            GameContentSnapshot = JsonDocument.Parse("{\"expression\":\"3*7\"}").RootElement,
            Attempts = Enumerable.Range(1, 3).Select(i => new AttemptEvent
            {
                AttemptId = Guid.NewGuid(),
                AttemptNumber = i,
                SubmittedAnswer = JsonDocument.Parse($"{{\"value\":{i * 10}}}").RootElement,
                Correct = false,
                Score = 0,
                MaxScore = 1,
                SubmittedAt = DateTimeOffset.UtcNow.AddMinutes(-20 + i * 5)
            }).ToList()
        };

    public static GameSessionCompletedEvent UnfinishedEvent(
        Guid? eventId = null, Guid? sessionId = null, Guid? spaceId = null) =>
        new()
        {
            EventId = eventId ?? Guid.NewGuid(),
            SchemaVersion = 1,
            SessionId = sessionId ?? Guid.NewGuid(),
            GameId = Guid.NewGuid(),
            SpaceId = spaceId ?? SpaceA,
            GameType = "MATH",
            GameTitle = "Calcul mental 1",
            FinalStatus = "UNFINISHED",
            AttemptsUsed = 2,
            MaxAttempts = 3,
            FinalScore = 0,
            StartedAt = DateTimeOffset.UtcNow.AddMinutes(-18),
            CompletedAt = DateTimeOffset.UtcNow,
            NextAvailableAt = DateTimeOffset.UtcNow.AddHours(24),
            GameContentSnapshot = JsonDocument.Parse("{\"expression\":\"(4 + 6) * 2\"}").RootElement,
            Attempts =
            [
                new AttemptEvent
                {
                    AttemptId = Guid.NewGuid(),
                    AttemptNumber = 1,
                    SubmittedAnswer = JsonDocument.Parse("{\"value\":18}").RootElement,
                    Correct = false,
                    Score = 0,
                    MaxScore = 1,
                    SubmittedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
                },
                new AttemptEvent
                {
                    AttemptId = Guid.NewGuid(),
                    AttemptNumber = 2,
                    SubmittedAnswer = JsonDocument.Parse("{\"value\":19}").RootElement,
                    Correct = false,
                    Score = 0,
                    MaxScore = 1,
                    SubmittedAt = DateTimeOffset.UtcNow.AddMinutes(-5)
                }
            ]
        };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1–3: Terminal status ingestion
// ═══════════════════════════════════════════════════════════════════════════════

public class IngestionStatusTests : DbTestBase
{
    [Fact]
    public async Task Ingest_SuccessEvent_StoresCorrectStatus()
    {
        await using var db = NewDb();
        await NewIngestionService(db).IngestAsync(Fixtures.SuccessEvent(), default);

        var session = await db.CompletedSessions.FirstAsync();
        Assert.Equal(SessionFinalStatus.SUCCESS, session.FinalStatus);
        Assert.Equal(1, session.AttemptsUsed);
        Assert.Null(session.NextAvailableAt);
    }

    [Fact]
    public async Task Ingest_FailedEvent_StoresCorrectStatusAndCooldown()
    {
        await using var db = NewDb();
        await NewIngestionService(db).IngestAsync(Fixtures.FailedEvent(), default);

        var session = await db.CompletedSessions.FirstAsync();
        Assert.Equal(SessionFinalStatus.FAILED, session.FinalStatus);
        Assert.Equal(3, session.AttemptsUsed);
        Assert.NotNull(session.NextAvailableAt);
    }

    [Fact]
    public async Task Ingest_UnfinishedEvent_StoresCorrectStatus()
    {
        await using var db = NewDb();
        await NewIngestionService(db).IngestAsync(Fixtures.UnfinishedEvent(), default);

        var session = await db.CompletedSessions.FirstAsync();
        Assert.Equal(SessionFinalStatus.UNFINISHED, session.FinalStatus);
        Assert.Equal(2, session.AttemptsUsed);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4–6: Attempt and content preservation
// ═══════════════════════════════════════════════════════════════════════════════

public class AttemptPreservationTests : DbTestBase
{
    [Fact]
    public async Task Ingest_PreservesEveryAttempt()
    {
        await using var db = NewDb();
        var evt = Fixtures.FailedEvent();
        await NewIngestionService(db).IngestAsync(evt, default);

        var attempts = await db.RecordedAttempts
            .Where(a => a.SessionId == evt.SessionId)
            .OrderBy(a => a.AttemptNumber)
            .ToListAsync();

        Assert.Equal(3, attempts.Count);
        Assert.Equal(1, attempts[0].AttemptNumber);
        Assert.Equal(2, attempts[1].AttemptNumber);
        Assert.Equal(3, attempts[2].AttemptNumber);
    }

    [Fact]
    public async Task Ingest_PreservesExactSubmittedAnswers()
    {
        await using var db = NewDb();
        var evt = Fixtures.UnfinishedEvent();
        await NewIngestionService(db).IngestAsync(evt, default);

        var attempts = await db.RecordedAttempts
            .Where(a => a.SessionId == evt.SessionId)
            .OrderBy(a => a.AttemptNumber)
            .ToListAsync();

        Assert.Equal("{\"value\":18}", attempts[0].SubmittedAnswer);
        Assert.Equal("{\"value\":19}", attempts[1].SubmittedAnswer);
    }

    [Fact]
    public async Task Ingest_PreservesOriginalGameContentSnapshot()
    {
        await using var db = NewDb();
        var evt = Fixtures.UnfinishedEvent();
        await NewIngestionService(db).IngestAsync(evt, default);

        var session = await db.CompletedSessions.FirstAsync(s => s.SessionId == evt.SessionId);
        Assert.Contains("4 + 6", session.GameContentSnapshot);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7–9: Idempotency and conflict detection
// ═══════════════════════════════════════════════════════════════════════════════

public class IdempotencyTests : DbTestBase
{
    [Fact]
    public async Task DuplicateEventId_IsRejectedIdempotently()
    {
        await using var db = NewDb();
        var evt = Fixtures.SuccessEvent();
        var svc = NewIngestionService(db);

        var first = await svc.IngestAsync(evt, default);
        var second = await svc.IngestAsync(evt, default); // same EventId

        Assert.True(first);
        Assert.False(second);

        var count = await db.CompletedSessions.CountAsync();
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task DuplicateEventId_WithDifferentPayload_ThrowsConflict()
    {
        await using var db = NewDb();
        var evt = Fixtures.SuccessEvent();
        var svc = NewIngestionService(db);
        await svc.IngestAsync(evt, default);

        evt.FinalScore = 0;
        var exception = await Assert.ThrowsAsync<EventConflictException>(() => svc.IngestAsync(evt, default));

        Assert.Equal(evt.EventId, exception.EventId);
        Assert.Equal(409, exception.StatusCode);
    }

    [Fact]
    public async Task DuplicateSessionId_SameStatus_DeduplicatesGracefully()
    {
        await using var db = NewDb();
        var sessionId = Guid.NewGuid();
        var svc = NewIngestionService(db);

        var first = Fixtures.SuccessEvent(sessionId: sessionId);
        var second = Fixtures.SuccessEvent(eventId: Guid.NewGuid(), sessionId: sessionId);

        var r1 = await svc.IngestAsync(first, default);
        var r2 = await svc.IngestAsync(second, default);

        Assert.True(r1);
        Assert.False(r2);
        Assert.Equal(1, await db.CompletedSessions.CountAsync());
    }

    [Fact]
    public async Task DifferentEventId_SameSessionId_ConflictingStatus_ThrowsConflict()
    {
        await using var db = NewDb();
        var sessionId = Guid.NewGuid();
        var svc = NewIngestionService(db);

        await svc.IngestAsync(Fixtures.SuccessEvent(sessionId: sessionId), default);

        var conflicting = Fixtures.FailedEvent(eventId: Guid.NewGuid(), sessionId: sessionId);
        await Assert.ThrowsAsync<EventConflictException>(() => svc.IngestAsync(conflicting, default));
    }

    [Fact]
    public async Task ConcurrentDuplicateEvents_OnlyOneIsStored()
    {
        await using var db1 = NewDb();
        await using var db2 = NewDb();
        var sessionId = Guid.NewGuid();
        var eventId = Guid.NewGuid();

        var evt1 = Fixtures.SuccessEvent(eventId: eventId, sessionId: sessionId);
        var evt2 = evt1;

        var svc1 = NewIngestionService(db1);
        var svc2 = NewIngestionService(db2);

        var tasks = new[] { svc1.IngestAsync(evt1, default), svc2.IngestAsync(evt2, default) };
        var results = await Task.WhenAll(tasks);

        await using var verify = NewDb();
        var count = await verify.CompletedSessions.CountAsync(s => s.SessionId == sessionId);
        Assert.Equal(1, count);
        Assert.Single(results, result => result);
        Assert.Single(results, result => !result);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10–12: Statistics
// ═══════════════════════════════════════════════════════════════════════════════

public class StatisticsTests : DbTestBase
{
    [Fact]
    public async Task SuccessRate_IsCalculatedCorrectly()
    {
        await using var db = NewDb();
        var svc = NewIngestionService(db);
        await svc.IngestAsync(Fixtures.SuccessEvent(), default);
        await svc.IngestAsync(Fixtures.SuccessEvent(), default);
        await svc.IngestAsync(Fixtures.SuccessEvent(), default);
        await svc.IngestAsync(Fixtures.FailedEvent(), default);
        // 3 success, 1 failed → 75%

        var progress = new ProgressService(db);
        var summary = await progress.GetSummaryAsync(Fixtures.SpaceA, default);

        Assert.Equal(4, summary.TotalSessions);
        Assert.Equal(3, summary.SuccessfulSessions);
        Assert.Equal(1, summary.FailedSessions);
        Assert.Equal(0, summary.UnfinishedSessions);
        Assert.Equal(75, summary.SuccessRate);
    }

    [Fact]
    public async Task UnfinishedSessions_AreNotCountedAsFailed()
    {
        await using var db = NewDb();
        var svc = NewIngestionService(db);
        await svc.IngestAsync(Fixtures.UnfinishedEvent(), default);
        await svc.IngestAsync(Fixtures.FailedEvent(), default);

        var progress = new ProgressService(db);
        var summary = await progress.GetSummaryAsync(Fixtures.SpaceA, default);

        Assert.Equal(0, summary.SuccessfulSessions);
        Assert.Equal(1, summary.FailedSessions);
        Assert.Equal(1, summary.UnfinishedSessions);
    }

    [Fact]
    public async Task NormalizedScore_HandlesMultipleMaxScoreScales()
    {
        // MATH has maxAttempts=3 (1 point each attempt max → score 1 out of 3)
        // MATCHING hypothetical: maxAttempts=3, score=2
        // We test that normalized avg uses score/maxAttempts
        await using var db = NewDb();
        var svc = NewIngestionService(db);

        var success = Fixtures.SuccessEvent();
        success.FinalScore = 1;
        success.MaxAttempts = 3;
        await svc.IngestAsync(success, default);

        var failed = Fixtures.FailedEvent();
        failed.FinalScore = 0;
        failed.MaxAttempts = 3;
        await svc.IngestAsync(failed, default);

        var progress = new ProgressService(db);
        var summary = await progress.GetSummaryAsync(Fixtures.SpaceA, default);
        // (1/3 + 0/3) / 2 = 1/6 ≈ 0.1667
        Assert.True(summary.AverageNormalizedScore > 0);
        Assert.True(summary.AverageNormalizedScore < 1);
    }

    [Fact]
    public async Task EmptyDataset_ReturnsSafeZeroValues()
    {
        await using var db = NewDb();
        var progress = new ProgressService(db);
        var summary = await progress.GetSummaryAsync(Guid.NewGuid(), default);

        Assert.Equal(0, summary.TotalSessions);
        Assert.Equal(0, summary.SuccessRate);
        Assert.Equal(0, summary.AverageNormalizedScore);
        Assert.Equal(0, summary.AverageAttemptsPerSession);
    }

    [Fact]
    public async Task StatisticsByType_GroupsStatusesAndRatesCorrectly()
    {
        await using var db = NewDb();
        var ingestion = NewIngestionService(db);
        var matchingSuccess = Fixtures.SuccessEvent();
        matchingSuccess.GameType = "MATCHING";
        var matchingFailure = Fixtures.FailedEvent();
        matchingFailure.GameType = "MATCHING";
        await ingestion.IngestAsync(Fixtures.SuccessEvent(), default);
        await ingestion.IngestAsync(Fixtures.UnfinishedEvent(), default);
        await ingestion.IngestAsync(matchingSuccess, default);
        await ingestion.IngestAsync(matchingFailure, default);

        var result = await new ProgressService(db).GetStatsByTypeAsync(Fixtures.SpaceA, default);

        var math = Assert.Single(result, stats => stats.GameType == "MATH");
        Assert.Equal(2, math.TotalSessions);
        Assert.Equal(1, math.SuccessfulSessions);
        Assert.Equal(0, math.FailedSessions);
        Assert.Equal(1, math.UnfinishedSessions);
        Assert.Equal(50, math.SuccessRate);

        var matching = Assert.Single(result, stats => stats.GameType == "MATCHING");
        Assert.Equal(2, matching.TotalSessions);
        Assert.Equal(1, matching.SuccessfulSessions);
        Assert.Equal(1, matching.FailedSessions);
        Assert.Equal(0, matching.UnfinishedSessions);
        Assert.Equal(50, matching.SuccessRate);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 13–14: History filtering and pagination
// ═══════════════════════════════════════════════════════════════════════════════

public class HistoryFilteringTests : DbTestBase
{
    [Fact]
    public async Task History_FiltersByFinalStatus()
    {
        await using var db = NewDb();
        var svc = NewIngestionService(db);
        await svc.IngestAsync(Fixtures.SuccessEvent(), default);
        await svc.IngestAsync(Fixtures.FailedEvent(), default);
        await svc.IngestAsync(Fixtures.UnfinishedEvent(), default);

        var progress = new ProgressService(db);
        var req = new HistoryRequest(Fixtures.SpaceA, null, "SUCCESS", null, null, null, 1, 20);
        var result = await progress.GetHistoryAsync(req, default);

        Assert.Equal(1, result.TotalCount);
        Assert.All(result.Items, item => Assert.Equal("SUCCESS", item.FinalStatus));
    }

    [Fact]
    public async Task History_FiltersByGameType()
    {
        await using var db = NewDb();
        var svc = NewIngestionService(db);

        var matchingEvt = Fixtures.SuccessEvent();
        matchingEvt.GameType = "MATCHING";
        await svc.IngestAsync(matchingEvt, default);
        await svc.IngestAsync(Fixtures.SuccessEvent(), default); // MATH

        var progress = new ProgressService(db);
        var req = new HistoryRequest(Fixtures.SpaceA, "MATCHING", null, null, null, null, 1, 20);
        var result = await progress.GetHistoryAsync(req, default);

        Assert.Equal(1, result.TotalCount);
        Assert.All(result.Items, item => Assert.Equal("MATCHING", item.GameType));
    }

    [Fact]
    public async Task History_Pagination_ReturnsCorrectPage()
    {
        await using var db = NewDb();
        var svc = NewIngestionService(db);
        for (var i = 0; i < 5; i++)
            await svc.IngestAsync(Fixtures.SuccessEvent(), default);

        var progress = new ProgressService(db);
        var req = new HistoryRequest(Fixtures.SpaceA, null, null, null, null, null, 2, 2);
        var result = await progress.GetHistoryAsync(req, default);

        Assert.Equal(5, result.TotalCount);
        Assert.Equal(3, result.TotalPages);
        Assert.Equal(2, result.Items.Count);
        Assert.Equal(2, result.Page);
    }

    [Fact]
    public async Task History_FiltersByDateRangeOnSqlite()
    {
        await using var db = NewDb();
        var svc = NewIngestionService(db);
        var before = Fixtures.SuccessEvent();
        before.CompletedAt = DateTimeOffset.Parse("2025-01-02T08:00:00Z");
        var inRange = Fixtures.SuccessEvent();
        inRange.CompletedAt = DateTimeOffset.Parse("2025-01-02T08:30:00Z");
        var after = Fixtures.SuccessEvent();
        after.CompletedAt = DateTimeOffset.Parse("2025-01-02T09:00:00Z");
        await svc.IngestAsync(before, default);
        await svc.IngestAsync(inRange, default);
        await svc.IngestAsync(after, default);

        var progress = new ProgressService(db);
        var req = new HistoryRequest(
            Fixtures.SpaceA, null, null,
            DateTimeOffset.Parse("2025-01-02T08:15:00+00:00"),
            DateTimeOffset.Parse("2025-01-02T08:45:00+00:00"),
            null, 1, 20);
        var result = await progress.GetHistoryAsync(req, default);

        Assert.Single(result.Items);
        Assert.Equal(inRange.SessionId, result.Items[0].SessionId);
    }

    [Fact]
    public async Task GameHistory_IsOrderedByCompletionTimeDescendingOnSqlite()
    {
        await using var db = NewDb();
        var svc = NewIngestionService(db);
        var gameId = Guid.NewGuid();
        var older = Fixtures.SuccessEvent();
        older.GameId = gameId;
        older.CompletedAt = DateTimeOffset.Parse("2025-01-02T08:00:00Z");
        var newer = Fixtures.SuccessEvent();
        newer.GameId = gameId;
        newer.CompletedAt = DateTimeOffset.Parse("2025-01-02T09:00:00Z");
        await svc.IngestAsync(older, default);
        await svc.IngestAsync(newer, default);

        var result = await new ProgressService(db).GetGameHistoryAsync(Fixtures.SpaceA, gameId, default);

        Assert.Equal(2, result.Count);
        Assert.Equal(newer.SessionId, result[0].SessionId);
        Assert.Equal(older.SessionId, result[1].SessionId);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 15: Space isolation
// ═══════════════════════════════════════════════════════════════════════════════

public class SpaceIsolationTests : DbTestBase
{
    [Fact]
    public async Task ProgressData_IsIsolatedBetweenSpaces()
    {
        await using var db = NewDb();
        var svc = NewIngestionService(db);

        await svc.IngestAsync(Fixtures.SuccessEvent(spaceId: Fixtures.SpaceA), default);
        await svc.IngestAsync(Fixtures.FailedEvent(spaceId: Fixtures.SpaceB), default);

        var progress = new ProgressService(db);
        var summaryA = await progress.GetSummaryAsync(Fixtures.SpaceA, default);
        var summaryB = await progress.GetSummaryAsync(Fixtures.SpaceB, default);

        Assert.Equal(1, summaryA.TotalSessions);
        Assert.Equal(1, summaryA.SuccessfulSessions);
        Assert.Equal(0, summaryA.FailedSessions);

        Assert.Equal(1, summaryB.TotalSessions);
        Assert.Equal(0, summaryB.SuccessfulSessions);
        Assert.Equal(1, summaryB.FailedSessions);
    }

    [Fact]
    public async Task SessionDetail_IsNotAccessibleByWrongSpace()
    {
        await using var db = NewDb();
        var evt = Fixtures.SuccessEvent(spaceId: Fixtures.SpaceA);
        await NewIngestionService(db).IngestAsync(evt, default);

        var progress = new ProgressService(db);
        var result = await progress.GetSessionDetailAsync(Fixtures.SpaceB, evt.SessionId, default);

        Assert.Null(result); // SpaceB cannot access SpaceA's session
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 16–17: Authorization
// ═══════════════════════════════════════════════════════════════════════════════

public class AuthorizationTests
{
    private static IConfiguration MakeConfig(bool enabled = true, string? spaceId = null) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Development:TestAuth:Enabled"] = enabled.ToString(),
            ["Development:TestAuth:Credential"] = "local-postman-secret",
            ["Development:TestAuth:AllowedSpaceId"] = spaceId ?? "dddddddd-dddd-dddd-dddd-dddddddddddd"
        }).Build();

    [Fact]
    public async Task DenyAll_IsDefaultForUnauthenticatedPrincipal()
    {
        var access = new Suivi.Api.Infrastructure.Security.DenyAllSuiviSpaceAccess();
        var allowed = await access.CanAccess(Guid.NewGuid(), new System.Security.Claims.ClaimsPrincipal(), default);
        Assert.False(allowed);
    }

    [Fact]
    public async Task DevelopmentAccess_AllowsConfiguredSpace()
    {
        var allowedSpace = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        var config = MakeConfig(spaceId: allowedSpace.ToString());
        var access = new Suivi.Api.Infrastructure.Security.DevelopmentSuiviSpaceAccess(config);

        var claims = new[]
        {
            new System.Security.Claims.Claim(Suivi.Api.Infrastructure.Security.SuiviDevAuth.SpaceIdClaim, allowedSpace.ToString()),
            new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.NameIdentifier, "test-user")
        };
        var identity = new System.Security.Claims.ClaimsIdentity(claims, Suivi.Api.Infrastructure.Security.SuiviDevAuth.Scheme);
        var principal = new System.Security.Claims.ClaimsPrincipal(identity);

        Assert.True(await access.CanAccess(allowedSpace, principal, default));
    }

    [Fact]
    public async Task DevelopmentAccess_DeniesOtherSpaces()
    {
        var config = MakeConfig();
        var access = new Suivi.Api.Infrastructure.Security.DevelopmentSuiviSpaceAccess(config);
        var otherSpace = Guid.NewGuid();

        var allowed = await access.CanAccess(otherSpace, new System.Security.Claims.ClaimsPrincipal(), default);
        Assert.False(allowed);
    }

    [Fact]
    public void DevCredential_ValidatesCorrectly()
    {
        var validator = new Suivi.Api.Infrastructure.Security.SuiviDevCredentialValidator(MakeConfig());
        Assert.True(validator.IsValid("local-postman-secret"));
        Assert.False(validator.IsValid("wrong"));
        Assert.False(validator.IsValid(null));
    }

    [Fact]
    public void DevCredential_IsDisabledWhenFlagIsFalse()
    {
        var validator = new Suivi.Api.Infrastructure.Security.SuiviDevCredentialValidator(MakeConfig(enabled: false));
        Assert.False(validator.IsValid("local-postman-secret"));
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 19: Invalid event payloads
// ═══════════════════════════════════════════════════════════════════════════════

public class PayloadValidationTests : DbTestBase
{
    [Fact]
    public async Task MissingEventId_ThrowsInvalidPayload()
    {
        await using var db = NewDb();
        var evt = Fixtures.SuccessEvent();
        evt.EventId = Guid.Empty;
        await Assert.ThrowsAsync<InvalidEventPayloadException>(() =>
            NewIngestionService(db).IngestAsync(evt, default));
    }

    [Fact]
    public async Task UnknownGameType_ThrowsInvalidPayload()
    {
        await using var db = NewDb();
        var evt = Fixtures.SuccessEvent();
        evt.GameType = "UNKNOWN_TYPE";
        await Assert.ThrowsAsync<InvalidEventPayloadException>(() =>
            NewIngestionService(db).IngestAsync(evt, default));
    }

    [Fact]
    public async Task UnknownFinalStatus_ThrowsInvalidPayload()
    {
        await using var db = NewDb();
        var evt = Fixtures.SuccessEvent();
        evt.FinalStatus = "ABANDONED";
        await Assert.ThrowsAsync<InvalidEventPayloadException>(() =>
            NewIngestionService(db).IngestAsync(evt, default));
    }

    [Fact]
    public async Task WrongSchemaVersion_ThrowsInvalidPayload()
    {
        await using var db = NewDb();
        var evt = Fixtures.SuccessEvent();
        evt.SchemaVersion = 99;
        await Assert.ThrowsAsync<InvalidEventPayloadException>(() =>
            NewIngestionService(db).IngestAsync(evt, default));
    }

    [Fact]
    public async Task MissingGameContentSnapshot_ThrowsInvalidPayload()
    {
        await using var db = NewDb();
        var evt = Fixtures.SuccessEvent();
        evt.GameContentSnapshot = default;

        await Assert.ThrowsAsync<InvalidEventPayloadException>(() =>
            NewIngestionService(db).IngestAsync(evt, default));
    }

    [Fact]
    public async Task MissingSubmittedAnswer_ThrowsInvalidPayload()
    {
        await using var db = NewDb();
        var evt = Fixtures.SuccessEvent();
        evt.Attempts[0].SubmittedAnswer = default;

        await Assert.ThrowsAsync<InvalidEventPayloadException>(() =>
            NewIngestionService(db).IngestAsync(evt, default));
    }

    [Fact]
    public async Task DuplicateAttemptNumber_ThrowsInvalidPayload()
    {
        await using var db = NewDb();
        var evt = Fixtures.SuccessEvent();
        evt.AttemptsUsed = 2;
        evt.Attempts.Add(new AttemptEvent
        {
            AttemptId = Guid.NewGuid(),
            AttemptNumber = evt.Attempts[0].AttemptNumber,
            SubmittedAnswer = JsonDocument.Parse("{\"value\":2}").RootElement,
            SubmittedAt = evt.CompletedAt
        });

        await Assert.ThrowsAsync<InvalidEventPayloadException>(() =>
            NewIngestionService(db).IngestAsync(evt, default));
    }
}
