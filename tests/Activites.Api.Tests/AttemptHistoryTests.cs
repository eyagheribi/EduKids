using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

public class AttemptHistoryTests
{
    private static readonly Guid SpaceId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public async Task MathAttemptKeepsSubmittedJsonAndOriginalExerciseAfterGameEdit()
    {
        using var database = new IsolatedDatabase();
        var now = new DateTimeOffset(2026, 11, 19, 14, 0, 0, TimeSpan.Zero);
        var clock = new FixedClock(now);
        using var context = database.CreateContext();
        var catalog = new EfGameCatalog(context);
        var game = await CreateGame(catalog, now, "Calcul mental 1", GameType.MATH, "{\"expression\":\"11 + 111\"}");
        var service = CreateService(catalog, clock);
        var session = await service.Start(SpaceId, game.Id, Parent(), default);

        await service.Update(SpaceId, game.Id, new CreateGameRequest("MATH", Json("{\"expression\":\"5 * 8\"}"), "Nouveau calcul"), Parent(), default);
        var answer = Json("{\"value\":122}");
        var result = await service.Submit(SpaceId, session.Id, new SubmitAttemptRequest("math-history-1", answer), Parent(), default);

        Assert.True(result.Correct);
        var stored = (await catalog.GetSession(session.Id, default))!;
        Assert.Equal("Calcul mental 1", stored.GameTitleSnapshot);
        Assert.Equal("MATH", stored.GameTypeSnapshot);
        Assert.Equal("{\"expression\":\"11 + 111\"}", stored.ExerciseContentSnapshot);
        var attempt = Assert.Single(stored.Attempts);
        Assert.NotEqual(Guid.Empty, attempt.AttemptId);
        Assert.Equal(1, attempt.Number);
        Assert.Equal("{\"value\":122}", attempt.Answer);
        Assert.True(attempt.Evaluation.Correct);
        Assert.Equal(1, attempt.Evaluation.Score);
        Assert.Equal(1, attempt.Evaluation.MaxScore);
    }

    [Fact]
    public async Task MatchingAttemptPreservesFullSubmittedAssociations()
    {
        using var database = new IsolatedDatabase();
        var now = new DateTimeOffset(2026, 11, 19, 14, 0, 0, TimeSpan.Zero);
        using var context = database.CreateContext();
        var catalog = new EfGameCatalog(context);
        var content = "{\"pairs\":[{\"id\":\"00000000-0000-0000-0000-000000000001\",\"left\":\"Red\",\"right\":\"Rouge\"},{\"id\":\"00000000-0000-0000-0000-000000000002\",\"left\":\"Yellow\",\"right\":\"Jaune\"},{\"id\":\"00000000-0000-0000-0000-000000000003\",\"left\":\"Blue\",\"right\":\"Bleu\"}]}";
        var game = await CreateGame(catalog, now, "Couleurs", GameType.MATCHING, content);
        var service = CreateService(catalog, new FixedClock(now));
        var session = await service.Start(SpaceId, game.Id, Parent(), default);
        var stored = (await catalog.GetSession(session.Id, default))!;
        using var playableDoc = JsonDocument.Parse(stored.PlayJson);
        var playable = playableDoc.RootElement.Deserialize<MatchingPlayable>()!;
        var mappings = playable.CorrectMatches.ToArray();
        var answerMappings = new Dictionary<Guid, Guid>
        {
            [mappings[0].Key] = mappings[0].Value,
            [mappings[1].Key] = mappings[2].Value,
            [mappings[2].Key] = mappings[1].Value
        };
        var answer = JsonSerializer.SerializeToElement(new { matches = answerMappings });

        var result = await service.Submit(SpaceId, session.Id, new SubmitAttemptRequest("matching-history-1", answer), Parent(), default);

        Assert.False(result.Correct);
        Assert.Equal(1, result.Score);
        var attempt = Assert.Single((await catalog.GetSession(session.Id, default))!.Attempts);
        Assert.Equal(JsonSerializer.Serialize(answer), attempt.Answer);
        Assert.Equal(1, attempt.Evaluation.Score);
        Assert.Equal(3, attempt.Evaluation.MaxScore);
    }

    [Fact]
    public async Task SentenceAttemptPreservesSubmittedTokenSequence()
    {
        using var database = new IsolatedDatabase();
        var now = new DateTimeOffset(2026, 11, 19, 14, 0, 0, TimeSpan.Zero);
        using var context = database.CreateContext();
        var catalog = new EfGameCatalog(context);
        var game = await CreateGame(catalog, now, "Phrase", GameType.SENTENCE_ORDERING, "{\"sentence\":\"Je suis une fille\"}");
        var service = CreateService(catalog, new FixedClock(now));
        var session = await service.Start(SpaceId, game.Id, Parent(), default);
        var stored = (await catalog.GetSession(session.Id, default))!;
        using var playableDoc = JsonDocument.Parse(stored.PlayJson);
        var playable = playableDoc.RootElement.Deserialize<SentencePlayable>()!;
        var submittedTokens = playable.CorrectOrder.Reverse().ToArray();
        var answer = JsonSerializer.SerializeToElement(new { tokens = submittedTokens });

        var result = await service.Submit(SpaceId, session.Id, new SubmitAttemptRequest("sentence-history-1", answer), Parent(), default);

        Assert.False(result.Correct);
        var attempt = Assert.Single((await catalog.GetSession(session.Id, default))!.Attempts);
        Assert.Equal(JsonSerializer.Serialize(answer), attempt.Answer);
        using var savedAnswer = JsonDocument.Parse(attempt.Answer);
        var savedTokens = savedAnswer.RootElement.GetProperty("tokens").EnumerateArray().Select(x => x.GetGuid()).ToArray();
        Assert.Equal(submittedTokens, savedTokens);
    }

    private static GameService CreateService(IGameCatalog catalog, IClock clock) => new(
        catalog,
        [new MathEngine(), new MatchingEngine(), new SentenceOrderingEngine()],
        new TestSpaceAccess(),
        clock,
        Options.Create(new GameSessionOptions()));

    private static async Task<GameRecord> CreateGame(IGameCatalog catalog, DateTimeOffset now, string title, GameType type, string content)
    {
        var game = new GameRecord(Guid.NewGuid(), SpaceId, type, title, content, now, now);
        await catalog.Save(game, default);
        return game;
    }

    private static JsonElement Json(string json) => JsonDocument.Parse(json).RootElement.Clone();
    private static ClaimsPrincipal Parent() => new(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "parent")], "test"));

    private sealed class FixedClock(DateTimeOffset now) : IClock { public DateTimeOffset UtcNow => now; }
    private sealed class TestSpaceAccess : ISpaceAccess
    {
        public Task<bool> CanAccess(Guid spaceId, ClaimsPrincipal user, string activityType, CancellationToken ct) => Task.FromResult(spaceId == SpaceId && user.Identity?.IsAuthenticated == true);
    }

    private sealed class IsolatedDatabase : IDisposable
    {
        private readonly string path = Path.Combine(Path.GetTempPath(), $"edukids-history-{Guid.NewGuid():N}.db");
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

public class LegacySessionSnapshotMigrationTests
{
    [Fact]
    public async Task ExistingSessionRowsReceiveSnapshotColumnsWithoutLosingSession()
    {
        var path = Path.Combine(Path.GetTempPath(), $"edukids-legacy-{Guid.NewGuid():N}.db");
        var options = new DbContextOptionsBuilder<ActivitiesDbContext>().UseSqlite($"Data Source={path};Pooling=False").Options;
        var gameId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var spaceId = Guid.NewGuid();
        try
        {
            using (var legacy = new ActivitiesDbContext(options))
            {
                await legacy.Database.OpenConnectionAsync();
                await legacy.Database.ExecuteSqlRawAsync("CREATE TABLE Games (Id TEXT NOT NULL PRIMARY KEY, SpaceId TEXT NOT NULL, Type TEXT NOT NULL, Title TEXT NULL, Content TEXT NOT NULL, CreatedAt TEXT NOT NULL, UpdatedAt TEXT NOT NULL)");
                await legacy.Database.ExecuteSqlRawAsync("CREATE TABLE Sessions (Id TEXT NOT NULL PRIMARY KEY, SpaceId TEXT NOT NULL, GameId TEXT NOT NULL, Status TEXT NOT NULL, CreatedAt TEXT NOT NULL, CompletedAt TEXT NULL, NextAvailableAt TEXT NULL, PlayJson TEXT NOT NULL, AttemptsJson TEXT NOT NULL, IdempotencyJson TEXT NOT NULL, FOREIGN KEY(GameId) REFERENCES Games(Id) ON DELETE RESTRICT)");
                var gameType = "MATH";
                var title = "Legacy calculation";
                var content = "{\"expression\":\"11+111\"}";
                var status = "ACTIVE";
                var timestamp = new DateTimeOffset(2026, 11, 19, 14, 0, 0, TimeSpan.Zero);
                var emptyJsonObject = "{}";
                var emptyJsonArray = "[]";
                await legacy.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO Games VALUES ({gameId}, {spaceId}, {gameType}, {title}, {content}, {timestamp}, {timestamp})");
                await legacy.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO Sessions VALUES ({sessionId}, {spaceId}, {gameId}, {status}, {timestamp}, NULL, NULL, {emptyJsonObject}, {emptyJsonArray}, {emptyJsonObject})");
                await legacy.Database.CloseConnectionAsync();
            }

            using var upgraded = new ActivitiesDbContext(options);
            await ActivitiesSchemaUpgrade.ApplyAsync(upgraded);
            var loaded = await new EfGameCatalog(upgraded).GetSession(sessionId, default);

            Assert.NotNull(loaded);
            Assert.Equal("Legacy calculation", loaded.GameTitleSnapshot);
            Assert.Equal("MATH", loaded.GameTypeSnapshot);
            Assert.Equal("{\"expression\":\"11+111\"}", loaded.ExerciseContentSnapshot);
            Assert.Equal(SessionStatus.ACTIVE, loaded.Status);
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }
}
