using Microsoft.EntityFrameworkCore;
using System.Text.Json;

public class SessionExpirationConcurrencyTests
{
    private static readonly Guid SpaceId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public async Task ConcurrentExpirationChecksTransitionOnlyOnce()
    {
        using var database = new IsolatedDatabase();
        var (game, session) = await database.CreateActiveSession();
        var deadline = DateTimeOffset.UtcNow.AddMinutes(-1);
        session.InactivityDeadlineAt = deadline;
        var attemptId = Guid.NewGuid();
        var submittedAnswer = JsonDocument.Parse("{\"value\":0}").RootElement.Clone();
        var attemptAt = deadline.AddMinutes(-5);
        session.Attempts.Add(new AttemptRecord(1, "{\"value\":0}", new Evaluation(false, 0, 1, null), attemptAt, attemptId));
        using (var db = database.CreateContext())
            Assert.True(await new EfGameCatalog(db).SaveSession(session, default));

        using var firstContext = database.CreateContext();
        using var secondContext = database.CreateContext();
        var first = new EfGameCatalog(firstContext);
        var second = new EfGameCatalog(secondContext);
        var completion = deadline;
        var next = deadline.AddHours(24);
        var exercise = JsonDocument.Parse("{\"expression\":\"1+1\"}").RootElement.Clone();
        var attempts = new[] { new AttemptCompletedEvent(attemptId, 1, submittedAnswer, false, 0, 1, attemptAt) };
        var completionEvent = new GameSessionCompletedEvent(1, session.Id, session.Id, game.Id, SpaceId, "MATH", game.Title, "UNFINISHED", 1, 3, 0, 1, session.CreatedAt, completion, next, exercise, attempts);
        var notificationEvent = new UnfinishedSessionNotificationEvent(Guid.NewGuid(), SpaceId, game.Id, game.Title, "UNFINISHED", 0, 0, completion, next);

        var results = await Task.WhenAll(
            first.TryExpireSession(session.Id, deadline, completion, next, default, completionEvent, notificationEvent),
            second.TryExpireSession(session.Id, deadline, completion, next, default, completionEvent, notificationEvent));

        Assert.Single(results.Where(x => x));
        using var verifyContext = database.CreateContext();
        var expired = await new EfGameCatalog(verifyContext).GetSession(session.Id, default);
        Assert.Equal(SessionStatus.UNFINISHED, expired!.Status);
        Assert.Equal(completion, expired.CompletedAt);
        Assert.Equal(next, expired.NextAvailableAt);
        Assert.Equal(1, await verifyContext.Outbox.CountAsync(x => x.EventType == "GameSessionCompleted"));
        Assert.Equal(1, await verifyContext.Outbox.CountAsync(x => x.EventType == "UnfinishedSessionNotification"));
    }

    [Fact]
    public async Task ConcurrentAttemptUpdatesUseOptimisticDatabaseVersion()
    {
        using var database = new IsolatedDatabase();
        var (_, session) = await database.CreateActiveSession();
        using var setupContext = database.CreateContext();
        Assert.True(await new EfGameCatalog(setupContext).SaveSession(session, default));

        using var firstContext = database.CreateContext();
        using var secondContext = database.CreateContext();
        var firstCatalog = new EfGameCatalog(firstContext);
        var secondCatalog = new EfGameCatalog(secondContext);
        var first = (await firstCatalog.GetSession(session.Id, default))!;
        var second = (await secondCatalog.GetSession(session.Id, default))!;
        first.Attempts.Add(new AttemptRecord(1, "{\"value\":1}", new Evaluation(false, 0, 1, null), DateTimeOffset.UtcNow));
        second.Attempts.Add(new AttemptRecord(1, "{\"value\":2}", new Evaluation(false, 0, 1, null), DateTimeOffset.UtcNow));

        var saved = await Task.WhenAll(firstCatalog.SaveSession(first, default), secondCatalog.SaveSession(second, default));

        Assert.Single(saved.Where(x => x));
        using var verifyContext = database.CreateContext();
        var stored = (await new EfGameCatalog(verifyContext).GetSession(session.Id, default))!;
        Assert.Single(stored.Attempts);
        Assert.Equal(1, stored.Version);
    }

    private sealed class IsolatedDatabase : IDisposable
    {
        private readonly string path = Path.Combine(Path.GetTempPath(), $"edukids-activites-{Guid.NewGuid():N}.db");
        private readonly DbContextOptions<ActivitiesDbContext> options;

        public IsolatedDatabase()
        {
            options = new DbContextOptionsBuilder<ActivitiesDbContext>().UseSqlite($"Data Source={path};Pooling=False").Options;
            using var db = CreateContext();
            db.Database.EnsureCreated();
            ActivitiesSchemaUpgrade.ApplyAsync(db).GetAwaiter().GetResult();
        }

        public ActivitiesDbContext CreateContext() => new(options);

        public async Task<(GameRecord Game, SessionRecord Session)> CreateActiveSession()
        {
            var now = DateTimeOffset.UtcNow;
            var game = new GameRecord(Guid.NewGuid(), SpaceId, GameType.MATH, "test", "{\"expression\":\"1+1\"}", now, now);
            var session = new SessionRecord { Id = Guid.NewGuid(), SpaceId = SpaceId, Game = game, CreatedAt = now, PlayJson = "{}" };
            using var db = CreateContext();
            var catalog = new EfGameCatalog(db);
            await catalog.Save(game, default);
            return (game, session);
        }

        public void Dispose()
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }
}
