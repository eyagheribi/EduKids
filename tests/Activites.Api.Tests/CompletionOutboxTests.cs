using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

public class CompletionOutboxTests
{
    private static readonly Guid SpaceId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Theory]
    [InlineData("SUCCESS", 1)]
    [InlineData("FAILED", 3)]
    [InlineData("UNFINISHED", 2)]
    public async Task TerminalSessionWritesOneDetailedCompletionToOutbox(string expectedStatus, int attemptCount)
    {
        var file = Path.Combine(Path.GetTempPath(), $"edukids-outbox-{Guid.NewGuid():N}.db");
        var options = new DbContextOptionsBuilder<ActivitiesDbContext>().UseSqlite($"Data Source={file};Pooling=False").Options;
        try
        {
            using var setup = new ActivitiesDbContext(options);
            await setup.Database.EnsureCreatedAsync();
            await ActivitiesSchemaUpgrade.ApplyAsync(setup);
            var clock = new MutableClock(new DateTimeOffset(2026, 11, 19, 14, 0, 0, TimeSpan.Zero));
            var catalog = new EfGameCatalog(setup);
            var game = new GameRecord(Guid.NewGuid(), SpaceId, GameType.MATH, "Calcul mental 1", "{\"expression\":\"11 + 111\"}", clock.UtcNow, clock.UtcNow);
            await catalog.Save(game, default);
            var service = new GameService(catalog, [new MathEngine(), new MatchingEngine(), new SentenceOrderingEngine()], new TestAccess(), clock, Options.Create(new GameSessionOptions()));
            var session = await service.Start(SpaceId, game.Id, Parent(), default);

            for (var i = 0; i < attemptCount; i++)
            {
                if (expectedStatus == "SUCCESS")
                    await service.Submit(SpaceId, session.Id, new SubmitAttemptRequest("key-" + i, Json("{\"value\":122}")), Parent(), default);
                else
                {
                    await service.Submit(SpaceId, session.Id, new SubmitAttemptRequest("key-" + i, Json("{\"value\":0}")), Parent(), default);
                    if (expectedStatus == "UNFINISHED" && i == attemptCount - 1)
                    {
                        clock.UtcNow = clock.UtcNow.AddMinutes(5);
                        await service.ExpireDueSessions(default);
                    }
                    else clock.UtcNow = clock.UtcNow.AddMinutes(1);
                }
            }

            var rows = await setup.Outbox.AsNoTracking().ToListAsync();
            var row = Assert.Single(rows);
            Assert.Equal(session.Id, row.EventId);
            Assert.Equal("GameSessionCompleted", row.EventType);
            Assert.Null(row.SentAt); // The no-op publisher correctly leaves the message pending.
            var message = JsonSerializer.Deserialize<GameSessionCompletedEvent>(row.PayloadJson)!;
            Assert.Equal(expectedStatus, message.FinalStatus);
            Assert.Equal(session.Id, message.SessionId);
            Assert.Equal("Calcul mental 1", message.GameTitle);
            Assert.Equal("11 + 111", message.ExerciseContentSnapshot.GetProperty("expression").GetString());
            Assert.Equal(attemptCount, message.AttemptsUsed);
            Assert.Equal(attemptCount, message.Attempts.Count);
            Assert.Equal(Enumerable.Range(1, attemptCount), message.Attempts.Select(x => x.AttemptNumber));
            Assert.All(message.Attempts, attempt => Assert.Equal(expectedStatus == "SUCCESS" ? 122 : 0, attempt.SubmittedAnswer.GetProperty("value").GetInt32()));
            if (expectedStatus == "UNFINISHED")
            {
                await service.ExpireDueSessions(default);
                Assert.Single(await setup.Outbox.AsNoTracking().ToListAsync());
            }
        }
        finally { if (File.Exists(file)) File.Delete(file); }
    }

    private static JsonElement Json(string value) => JsonDocument.Parse(value).RootElement.Clone();
    private static ClaimsPrincipal Parent() => new(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "parent")], "test"));
    private sealed class MutableClock(DateTimeOffset now) : IClock { public DateTimeOffset UtcNow { get; set; } = now; }
    private sealed class TestAccess : ISpaceAccess { public Task<bool> CanAccess(Guid spaceId, ClaimsPrincipal user, string type, CancellationToken ct) => Task.FromResult(true); }
}
