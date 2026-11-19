using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Suivi.Api.Domain.Model;
using Suivi.Api.Infrastructure.Persistence;

namespace Suivi.Api.Tests;

public class PersistenceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DbContextOptions<SuiviDbContext> _options;

    public PersistenceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        _options = new DbContextOptionsBuilder<SuiviDbContext>()
            .UseSqlite(_connection)
            .Options;

        using var db = new SuiviDbContext(_options);
        db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _connection.Dispose();
    }

    [Fact]
    public async Task CanPersistAndRetrieveCompletedGameSessionWithAttempts()
    {
        var sessionId = Guid.NewGuid();
        var spaceId = Guid.NewGuid();
        var gameId = Guid.NewGuid();

        var session = new CompletedGameSession
        {
            SessionId = sessionId,
            GameId = gameId,
            SpaceId = spaceId,
            GameType = GameType.MATH,
            GameTitle = "Calcul mental 1",
            FinalStatus = SessionFinalStatus.UNFINISHED,
            AttemptsUsed = 2,
            MaxAttempts = 3,
            FinalScore = 0,
            FinalMaxScore = 1,
            StartedAt = DateTimeOffset.UtcNow.AddMinutes(-10),
            CompletedAt = DateTimeOffset.UtcNow,
            NextAvailableAt = DateTimeOffset.UtcNow.AddHours(24),
            GameContentSnapshot = "{\"expression\":\"(4 + 6) * 2\"}",
            Attempts =
            [
                new RecordedAttempt
                {
                    AttemptId = Guid.NewGuid(),
                    SessionId = sessionId,
                    AttemptNumber = 1,
                    SubmittedAnswer = "{\"value\":18}",
                    Correct = false,
                    Score = 0,
                    MaxScore = 1,
                    SubmittedAt = DateTimeOffset.UtcNow.AddMinutes(-8)
                },
                new RecordedAttempt
                {
                    AttemptId = Guid.NewGuid(),
                    SessionId = sessionId,
                    AttemptNumber = 2,
                    SubmittedAnswer = "{\"value\":19}",
                    Correct = false,
                    Score = 0,
                    MaxScore = 1,
                    SubmittedAt = DateTimeOffset.UtcNow.AddMinutes(-5)
                }
            ]
        };

        await using (var db = new SuiviDbContext(_options))
        {
            db.CompletedSessions.Add(session);
            await db.SaveChangesAsync();
        }

        await using (var db = new SuiviDbContext(_options))
        {
            var loaded = await db.CompletedSessions
                .Include(s => s.Attempts)
                .SingleOrDefaultAsync(s => s.SessionId == sessionId);

            Assert.NotNull(loaded);
            Assert.Equal("Calcul mental 1", loaded.GameTitle);
            Assert.Equal(SessionFinalStatus.UNFINISHED, loaded.FinalStatus);
            Assert.Equal(1, loaded.FinalMaxScore);
            Assert.Equal(2, loaded.Attempts.Count);
            Assert.Equal(1, loaded.Attempts[0].AttemptNumber);
            Assert.Equal("{\"value\":18}", loaded.Attempts[0].SubmittedAnswer);
            Assert.Equal(2, loaded.Attempts[1].AttemptNumber);
            Assert.Equal("{\"value\":19}", loaded.Attempts[1].SubmittedAnswer);
        }

    }

    [Fact]
    public async Task EnforcesUniqueAttemptNumberPerSession()
    {
        var sessionId = Guid.NewGuid();
        await using var db = new SuiviDbContext(_options);

        var session = new CompletedGameSession
        {
            SessionId = sessionId,
            GameId = Guid.NewGuid(),
            SpaceId = Guid.NewGuid(),
            GameType = GameType.MATH,
            FinalStatus = SessionFinalStatus.FAILED,
            AttemptsUsed = 1,
            MaxAttempts = 3,
            FinalScore = 0,
            StartedAt = DateTimeOffset.UtcNow.AddMinutes(-5),
            CompletedAt = DateTimeOffset.UtcNow,
            GameContentSnapshot = "{\"expression\":\"1+1\"}",
            Attempts =
            [
                new RecordedAttempt
                {
                    AttemptId = Guid.NewGuid(),
                    SessionId = sessionId,
                    AttemptNumber = 1,
                    SubmittedAnswer = "{\"value\":0}",
                    Correct = false,
                    Score = 0,
                    MaxScore = 1,
                    SubmittedAt = DateTimeOffset.UtcNow
                },
                new RecordedAttempt
                {
                    AttemptId = Guid.NewGuid(),
                    SessionId = sessionId,
                    AttemptNumber = 1, // Duplicate attempt number!
                    SubmittedAnswer = "{\"value\":2}",
                    Correct = false,
                    Score = 0,
                    MaxScore = 1,
                    SubmittedAt = DateTimeOffset.UtcNow
                }
            ]
        };

        db.CompletedSessions.Add(session);
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }
}

public class MigrationTests
{
    [Fact]
    public async Task FinalMaxScoreMigrationPreservesLegacySessions()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<SuiviDbContext>()
            .UseSqlite(connection)
            .Options;
        var sessionId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var spaceId = Guid.NewGuid();

        await using var db = new SuiviDbContext(options);
        var migrator = db.Database.GetService<Microsoft.EntityFrameworkCore.Migrations.IMigrator>();
        await migrator.MigrateAsync("20261119125100_InitialCreate");

        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "CompletedSessions"
            ("SessionId", "GameId", "SpaceId", "GameType", "GameTitle", "FinalStatus",
             "AttemptsUsed", "MaxAttempts", "FinalScore", "StartedAt", "CompletedAt",
             "NextAvailableAt", "GameContentSnapshot")
            VALUES ({sessionId}, {gameId}, {spaceId}, 'MATH', 'Legacy session', 'SUCCESS',
                    1, 3, '0.75', '2025-01-01T10:00:00+00:00', '2025-01-01T10:01:00+00:00',
                    NULL, { "{}" });
            """);

        await db.Database.MigrateAsync();

        var legacy = await db.CompletedSessions.SingleAsync(s => s.SessionId == sessionId);
        Assert.Equal(0.75m, legacy.FinalScore);
        Assert.Null(legacy.FinalMaxScore);
        Assert.Equal("Legacy session", legacy.GameTitle);
    }
}
