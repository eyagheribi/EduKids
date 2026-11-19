using System.Security.Claims;
using System.Text.Json;
using Microsoft.Extensions.Options;

public class SessionExpirationTests
{
    private static readonly Guid SpaceId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private static JsonElement Json(string value) => JsonDocument.Parse(value).RootElement.Clone();

    private static async Task<(GameService Service, FakeClock Clock, InMemoryGameCatalog Catalog, Guid GameId)> CreateService()
    {
        var catalog = new InMemoryGameCatalog();
        var clock = new FakeClock(new DateTimeOffset(2026, 11, 19, 14, 0, 0, TimeSpan.Zero));
        var gameId = Guid.NewGuid();
        await catalog.Save(new GameRecord(gameId, SpaceId, GameType.MATH, "Calcul", "{\"expression\":\"2+2\"}", clock.UtcNow, clock.UtcNow), default);
        var service = new GameService(catalog, [new MathEngine(), new MatchingEngine(), new SentenceOrderingEngine()], new AllowSpaceAccess(), clock, new NoopProgressPublisher(), Options.Create(new GameSessionOptions()));
        return (service, clock, catalog, gameId);
    }

    private static ClaimsPrincipal Parent() => new(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "parent")], "test"));

    private static Task<AttemptDto> Wrong(GameService service, Guid sessionId, int attempt) =>
        service.Submit(SpaceId, sessionId, new SubmitAttemptRequest($"attempt-{attempt}", Json("{\"value\":3}")), Parent(), default);

    [Fact]
    public async Task OpeningGameDoesNotStartInactivityTimer()
    {
        var (service, _, _, gameId) = await CreateService();
        var session = await service.Start(SpaceId, gameId, Parent(), default);
        Assert.Equal("ACTIVE", session.Status);
        Assert.Null(session.InactivityDeadlineAt);
    }

    [Fact]
    public async Task FirstIncorrectAnswerStartsFiveMinuteTimer()
    {
        var (service, clock, _, gameId) = await CreateService();
        var session = await service.Start(SpaceId, gameId, Parent(), default);
        var answer = await Wrong(service, session.Id, 1);
        var state = await service.Session(SpaceId, session.Id, Parent(), default);
        Assert.False(answer.Correct);
        Assert.Equal("ACTIVE", answer.Status);
        Assert.Equal(clock.UtcNow.AddMinutes(5), state.InactivityDeadlineAt);
    }

    [Fact]
    public async Task IncorrectAnswerResetsTheDeadline()
    {
        var (service, clock, _, gameId) = await CreateService();
        var session = await service.Start(SpaceId, gameId, Parent(), default);
        await Wrong(service, session.Id, 1);
        clock.Advance(TimeSpan.FromMinutes(3));
        await Wrong(service, session.Id, 2);
        var state = await service.Session(SpaceId, session.Id, Parent(), default);
        Assert.Equal(clock.UtcNow.AddMinutes(5), state.InactivityDeadlineAt);
        Assert.Equal(2, state.AttemptsUsed);
    }

    [Fact]
    public async Task CorrectAnswerCompletesSessionWithoutCooldown()
    {
        var (service, _, _, gameId) = await CreateService();
        var session = await service.Start(SpaceId, gameId, Parent(), default);
        await Wrong(service, session.Id, 1);
        var result = await service.Submit(SpaceId, session.Id, new SubmitAttemptRequest("attempt-2", Json("{\"value\":4}")), Parent(), default);
        Assert.Equal("SUCCESS", result.Status);
        Assert.Null(result.NextAvailableAt);
        var replay = await service.Start(SpaceId, gameId, Parent(), default);
        Assert.NotEqual(session.Id, replay.Id);
    }

    [Fact]
    public async Task ThirdIncorrectAnswerCompletesAsFailed()
    {
        var (service, clock, _, gameId) = await CreateService();
        var session = await service.Start(SpaceId, gameId, Parent(), default);
        await Wrong(service, session.Id, 1);
        await Wrong(service, session.Id, 2);
        var result = await Wrong(service, session.Id, 3);
        Assert.Equal("FAILED", result.Status);
        Assert.Equal(clock.UtcNow.AddHours(24), result.NextAvailableAt);
    }

    [Fact]
    public async Task SessionExpiresAtDeadlineAsUnfinishedAndRejectsLateAnswer()
    {
        var (service, clock, _, gameId) = await CreateService();
        var session = await service.Start(SpaceId, gameId, Parent(), default);
        await Wrong(service, session.Id, 1);
        clock.Advance(TimeSpan.FromMinutes(5));
        var expired = await service.Session(SpaceId, session.Id, Parent(), default);
        Assert.Equal("UNFINISHED", expired.Status);
        Assert.Equal(clock.UtcNow, expired.InactivityDeadlineAt is null ? expired.NextAvailableAt?.AddHours(-24) : null);
        await Assert.ThrowsAsync<DomainException>(() => Wrong(service, session.Id, 2));
    }

    [Fact]
    public async Task LateSubmissionExpiresSessionEvenBeforeBackgroundSweep()
    {
        var (service, clock, catalog, gameId) = await CreateService();
        var session = await service.Start(SpaceId, gameId, Parent(), default);
        await Wrong(service, session.Id, 1);
        clock.Advance(TimeSpan.FromMinutes(5));

        await Assert.ThrowsAsync<DomainException>(() => Wrong(service, session.Id, 2));
        Assert.Equal(SessionStatus.UNFINISHED, (await catalog.GetSession(session.Id, default))!.Status);
    }

    [Fact]
    public async Task ExpirationSweepIsIdempotent()
    {
        var (service, clock, catalog, gameId) = await CreateService();
        var session = await service.Start(SpaceId, gameId, Parent(), default);
        await Wrong(service, session.Id, 1);
        clock.Advance(TimeSpan.FromMinutes(5));

        Assert.Equal(1, await service.ExpireDueSessions(default));
        Assert.Equal(0, await service.ExpireDueSessions(default));
        Assert.Equal(SessionStatus.UNFINISHED, (await catalog.GetSession(session.Id, default))!.Status);
    }

    [Fact]
    public async Task UnfinishedCooldownExpiresAtExactUtcDeadline()
    {
        var (service, clock, _, gameId) = await CreateService();
        var session = await service.Start(SpaceId, gameId, Parent(), default);
        await Wrong(service, session.Id, 1);
        clock.Advance(TimeSpan.FromMinutes(5));

        var unavailable = await service.Availability(SpaceId, gameId, Parent(), default);
        Assert.False(unavailable.Available);
        Assert.Equal(clock.UtcNow.AddHours(24), unavailable.NextAvailableAt);
        await Assert.ThrowsAsync<DomainException>(() => service.Start(SpaceId, gameId, Parent(), default));

        clock.Advance(TimeSpan.FromHours(24) - TimeSpan.FromMilliseconds(1));
        await Assert.ThrowsAsync<DomainException>(() => service.Start(SpaceId, gameId, Parent(), default));
        clock.Advance(TimeSpan.FromMilliseconds(1));
        Assert.True((await service.Start(SpaceId, gameId, Parent(), default)).Game is not null);
    }

    [Fact]
    public async Task UnfinishedCooldownDoesNotBlockOtherGamesInSameSpace()
    {
        var (service, clock, catalog, firstGameId) = await CreateService();
        var first = await service.Start(SpaceId, firstGameId, Parent(), default);
        await Wrong(service, first.Id, 1);
        clock.Advance(TimeSpan.FromMinutes(5));
        await service.Session(SpaceId, first.Id, Parent(), default);

        var secondGameId = Guid.NewGuid();
        await catalog.Save(new GameRecord(secondGameId, SpaceId, GameType.MATH, "Autre jeu", "{\"expression\":\"3+3\"}", clock.UtcNow, clock.UtcNow), default);
        var second = await service.Start(SpaceId, secondGameId, Parent(), default);
        Assert.Equal("ACTIVE", second.Status);
    }

    [Fact]
    public async Task UnfinishedCooldownDoesNotBlockAnotherChildSpace()
    {
        var (service, clock, catalog, gameId) = await CreateService();
        var first = await service.Start(SpaceId, gameId, Parent(), default);
        await Wrong(service, first.Id, 1);
        clock.Advance(TimeSpan.FromMinutes(5));
        await service.Session(SpaceId, first.Id, Parent(), default);

        var otherSpace = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var otherGameId = Guid.NewGuid();
        await catalog.Save(new GameRecord(otherGameId, otherSpace, GameType.MATH, "Espace Al", "{\"expression\":\"8+1\"}", clock.UtcNow, clock.UtcNow), default);
        var other = await service.Start(otherSpace, otherGameId, Parent(), default);
        Assert.Equal("ACTIVE", other.Status);
    }

    [Fact]
    public async Task FailedCooldownExpiresAtExactUtcDeadline()
    {
        var (service, clock, _, gameId) = await CreateService();
        var session = await service.Start(SpaceId, gameId, Parent(), default);
        await Wrong(service, session.Id, 1);
        await Wrong(service, session.Id, 2);
        var failed = await Wrong(service, session.Id, 3);
        Assert.Equal("FAILED", failed.Status);
        await Assert.ThrowsAsync<DomainException>(() => service.Start(SpaceId, gameId, Parent(), default));
        clock.Advance(TimeSpan.FromHours(24) - TimeSpan.FromMilliseconds(1));
        await Assert.ThrowsAsync<DomainException>(() => service.Start(SpaceId, gameId, Parent(), default));
        clock.Advance(TimeSpan.FromMilliseconds(1));
        Assert.Equal("ACTIVE", (await service.Start(SpaceId, gameId, Parent(), default)).Status);
    }

    private sealed class FakeClock(DateTimeOffset now) : IClock
    {
        public DateTimeOffset UtcNow { get; private set; } = now;
        public void Advance(TimeSpan duration) => UtcNow += duration;
    }

    private sealed class AllowSpaceAccess : ISpaceAccess
    {
        public Task<bool> CanAccess(Guid spaceId, ClaimsPrincipal user, string activityType, CancellationToken ct) => Task.FromResult(spaceId != Guid.Empty && user.Identity?.IsAuthenticated == true);
    }
}
