using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

public class CompletionEventContractTests
{
    private static readonly Guid SpaceId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public async Task MatchingUnfinishedEventUsesLastScoreAndPairCountMaximum()
    {
        using var database = new IsolatedDatabase();
        using var db = database.CreateContext();
        var clock = new MutableClock(new DateTimeOffset(2026, 11, 19, 14, 0, 0, TimeSpan.Zero));
        var catalog = new EfGameCatalog(db);
        var game = await SaveGame(catalog, clock.UtcNow, GameType.MATCHING, "Couleurs", "{\"pairs\":[{\"left\":\"Red\",\"right\":\"Rouge\"},{\"left\":\"Blue\",\"right\":\"Bleu\"},{\"left\":\"Green\",\"right\":\"Vert\"}]}");
        var service = CreateService(catalog, clock);
        var session = await service.Start(SpaceId, game.Id, Parent(), default);
        var stored = (await catalog.GetSession(session.Id, default))!;
        var playable = JsonDocument.Parse(stored.PlayJson).RootElement.Deserialize<MatchingPlayable>()!;
        var ids = playable.CorrectMatches.Keys.ToArray();
        var submitted = new Dictionary<Guid, Guid>
        {
            [ids[0]] = playable.CorrectMatches[ids[1]],
            [ids[1]] = playable.CorrectMatches[ids[0]],
            [ids[2]] = playable.CorrectMatches[ids[2]]
        };
        await service.Submit(SpaceId, session.Id, new SubmitAttemptRequest("matching-partial", JsonSerializer.SerializeToElement(new { matches = submitted })), Parent(), default);
        clock.UtcNow = clock.UtcNow.AddMinutes(5);
        await service.ExpireDueSessions(default);

        var message = await ReadCompletion(db, session.Id);
        Assert.Equal("UNFINISHED", message.FinalStatus);
        Assert.Equal(1, message.FinalScore);
        Assert.Equal(3, message.FinalMaxScore);
        Assert.Equal(message.Attempts[^1].Score, message.FinalScore);
        Assert.Equal(message.Attempts[^1].MaxScore, message.FinalMaxScore);
        Assert.Equal(3, message.GameContentSnapshot.GetProperty("pairs").GetArrayLength());
    }

    [Fact]
    public async Task SentenceOrderingUsesEngineMaximumForLastAttempt()
    {
        using var database = new IsolatedDatabase();
        using var db = database.CreateContext();
        var clock = new MutableClock(new DateTimeOffset(2026, 11, 19, 14, 0, 0, TimeSpan.Zero));
        var catalog = new EfGameCatalog(db);
        var game = await SaveGame(catalog, clock.UtcNow, GameType.SENTENCE_ORDERING, "La phrase", "{\"sentence\":\"Je suis une fille\"}");
        var service = CreateService(catalog, clock);
        var session = await service.Start(SpaceId, game.Id, Parent(), default);
        var stored = (await catalog.GetSession(session.Id, default))!;
        var playable = JsonDocument.Parse(stored.PlayJson).RootElement.Deserialize<SentencePlayable>()!;
        var submitted = playable.CorrectOrder.Reverse().ToArray();
        await service.Submit(SpaceId, session.Id, new SubmitAttemptRequest("sentence-partial", JsonSerializer.SerializeToElement(new { tokens = submitted })), Parent(), default);
        clock.UtcNow = clock.UtcNow.AddMinutes(5);
        await service.ExpireDueSessions(default);

        var message = await ReadCompletion(db, session.Id);
        Assert.Equal("UNFINISHED", message.FinalStatus);
        Assert.Equal(3, message.FinalScore);
        Assert.Equal(4, message.FinalMaxScore);
        Assert.Equal(message.Attempts[^1].Score, message.FinalScore);
        Assert.Equal(message.Attempts[^1].MaxScore, message.FinalMaxScore);
        Assert.Equal("Je suis une fille", message.GameContentSnapshot.GetProperty("sentence").GetString());
    }

    [Fact]
    public async Task PendingLegacyCompletionIsUpgradedAndRetainedBeforeDispatch()
    {
        using var database = new IsolatedDatabase();
        using var db = database.CreateContext();
        var eventId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var startedAt = new DateTimeOffset(2026, 11, 19, 14, 0, 0, TimeSpan.Zero);
        var attempt1 = new AttemptCompletedEvent(Guid.NewGuid(), 1, Json("{\"matches\":{}}"), false, 2, 3, startedAt.AddMinutes(1));
        var attempt2 = new AttemptCompletedEvent(Guid.NewGuid(), 2, Json("{\"matches\":{}}"), false, 1, 3, startedAt.AddMinutes(2));
        var oldPayload = JsonSerializer.Serialize(new
        {
            EventId = eventId,
            SessionId = sessionId,
            GameId = gameId,
            SpaceId = SpaceId,
            GameType = "MATCHING",
            GameTitle = "Couleurs",
            FinalStatus = "UNFINISHED",
            AttemptsUsed = 2,
            MaxAttempts = 3,
            FinalScore = 0,
            StartedAt = startedAt,
            CompletedAt = startedAt.AddMinutes(7),
            NextAvailableAt = startedAt.AddHours(24).AddMinutes(7),
            ExerciseContentSnapshot = new { pairs = new[] { new { left = "Red", right = "Rouge" }, new { left = "Blue", right = "Bleu" }, new { left = "Green", right = "Vert" } } },
            Attempts = new[] { attempt1, attempt2 }
        });
        var row = new OutboxRow { EventId = eventId, EventType = "GameSessionCompleted", PayloadJson = oldPayload, CreatedAt = startedAt };
        db.Outbox.Add(row);
        await db.SaveChangesAsync();

        var pending = await db.Outbox.AsNoTracking().SingleAsync(x => x.EventId == eventId);
        var upgraded = await CompletionOutboxPayloadUpgrader.ReadForDispatch(db, pending, default);

        Assert.Equal(eventId, upgraded.EventId);
        Assert.Equal(sessionId, upgraded.SessionId);
        Assert.Equal(1, upgraded.SchemaVersion);
        Assert.Equal(1, upgraded.FinalScore);
        Assert.Equal(3, upgraded.FinalMaxScore);
        Assert.Equal(attempt2.AttemptId, upgraded.Attempts[^1].AttemptId);
        Assert.Equal(3, upgraded.GameContentSnapshot.GetProperty("pairs").GetArrayLength());

        var saved = await db.Outbox.AsNoTracking().SingleAsync(x => x.EventId == eventId);
        Assert.Null(saved.SentAt);
        Assert.Equal(0, saved.Attempts);
        Assert.NotEqual(oldPayload, saved.PayloadJson);
        using var normalizedJson = JsonDocument.Parse(saved.PayloadJson);
        Assert.Equal(1, normalizedJson.RootElement.GetProperty("SchemaVersion").GetInt32());
        Assert.True(normalizedJson.RootElement.TryGetProperty("GameContentSnapshot", out _));
        Assert.False(normalizedJson.RootElement.TryGetProperty("ExerciseContentSnapshot", out _));
    }

    private static async Task<GameSessionCompletedEvent> ReadCompletion(ActivitiesDbContext db, Guid sessionId)
    {
        var row = await db.Outbox.AsNoTracking().SingleAsync(x => x.EventId == sessionId && x.EventType == "GameSessionCompleted");
        return GameSessionCompletedEventPayload.Deserialize(row.PayloadJson);
    }

    private static async Task<GameRecord> SaveGame(IGameCatalog catalog, DateTimeOffset now, GameType type, string title, string content)
    {
        var game = new GameRecord(Guid.NewGuid(), SpaceId, type, title, content, now, now);
        await catalog.Save(game, default);
        return game;
    }

    private static GameService CreateService(IGameCatalog catalog, IClock clock) => new(
        catalog,
        [new MathEngine(), new MatchingEngine(), new SentenceOrderingEngine()],
        new TestAccess(),
        clock,
        Options.Create(new GameSessionOptions()));

    private static JsonElement Json(string json) => JsonDocument.Parse(json).RootElement.Clone();
    private static ClaimsPrincipal Parent() => new(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "parent")], "test"));
    private sealed class MutableClock(DateTimeOffset now) : IClock { public DateTimeOffset UtcNow { get; set; } = now; }
    private sealed class TestAccess : ISpaceAccess { public Task<bool> CanAccess(Guid spaceId, ClaimsPrincipal user, string type, CancellationToken ct) => Task.FromResult(true); }

    private sealed class IsolatedDatabase : IDisposable
    {
        private readonly string path = Path.Combine(Path.GetTempPath(), $"edukids-contract-{Guid.NewGuid():N}.db");
        private readonly DbContextOptions<ActivitiesDbContext> options;
        public IsolatedDatabase()
        {
            options = new DbContextOptionsBuilder<ActivitiesDbContext>().UseSqlite($"Data Source={path};Pooling=False").Options;
            using var db = CreateContext();
            db.Database.EnsureCreated();
            ActivitiesSchemaUpgrade.ApplyAsync(db).GetAwaiter().GetResult();
        }
        public ActivitiesDbContext CreateContext() => new(options);
        public void Dispose() { if (File.Exists(path)) File.Delete(path); }
    }
}
