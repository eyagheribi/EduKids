using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using EduKids.Contracts;
using EduKids.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient();
builder.Services.AddScoped<EspacesApiAuthorization>();
builder.Services.AddScoped<ISpaceAccess, EduKidsApiSpaceAccess>();
builder.Services.Configure<GameSessionOptions>(builder.Configuration.GetSection("GameSessions"));
builder.Services.Configure<RabbitMqProgressPublisherOptions>(builder.Configuration.GetSection("RabbitMq"));
builder.Services.AddSingleton<IGameEngine, MathEngine>();
builder.Services.AddSingleton<IGameEngine, MatchingEngine>();
builder.Services.AddSingleton<IGameEngine, SentenceOrderingEngine>();
builder.Services.AddSingleton<IGameEngine, DictationEngine>();
builder.Services.AddDbContext<ActivitiesDbContext>(options => options.UseSqlite(builder.Configuration.GetConnectionString("Activities") ?? "Data Source=activites.db"));
builder.Services.AddScoped<IGameCatalog, EfGameCatalog>();
var rabbitMqEnabled = builder.Configuration.GetValue<bool>("RabbitMq:Enabled");
if (rabbitMqEnabled)
{
    builder.Services.AddSingleton<RabbitMqProgressPublisher>();
    builder.Services.AddSingleton<IProgressPublisher>(services => services.GetRequiredService<RabbitMqProgressPublisher>());
}
else
{
    builder.Services.AddSingleton<IProgressPublisher, NoopProgressPublisher>();
}
builder.Services.AddSingleton<IParentNotificationPublisher, NoopParentNotificationPublisher>();
builder.Services.AddScoped<GameService>();
builder.Services.AddHostedService<SessionExpirationWorker>();
builder.Services.AddScoped<OutboxDispatchService>();
builder.Services.AddHostedService<OutboxDispatchWorker>();

var authentication = builder.Services.AddEduKidsJwtBearer(builder.Configuration);
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddSingleton<ITestCredentialValidator, DevelopmentTestCredentialValidator>();
    authentication.AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, DevelopmentTestAuthenticationHandler>(
            DevelopmentTestAuthentication.Scheme, _ => { });
}
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("ParentOnly", policy => policy.RequireRole("Parent"));
    options.AddPolicy("ChildOnly", policy => policy.RequireRole("Enfant"));
    options.AddPolicy("ParentOrChild", policy => policy.RequireRole("Parent", "Enfant"));
});

var app = builder.Build();
using (var scope = app.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<ActivitiesDbContext>(); await db.Database.EnsureCreatedAsync(); await ActivitiesSchemaUpgrade.ApplyAsync(db); }
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
if (!app.Environment.IsDevelopment())
    app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.Use(async (context, next) =>
{
    try { await next(); }
    catch (DomainException ex) { context.Response.StatusCode = ex.Status; await context.Response.WriteAsJsonAsync(new ProblemDetails { Status = ex.Status, Title = ex.Message }); }
});

var api = app.MapGroup("/api");
api.RequireAuthorization();
api.MapPost("/spaces/{spaceId:guid}/games", async (Guid spaceId, CreateGameRequest request, ClaimsPrincipal user, GameService service, CancellationToken ct) => Results.Created($"/api/spaces/{spaceId}/games", await service.Create(spaceId, request, user, ct))).RequireAuthorization("ParentOnly");
api.MapGet("/spaces/{spaceId:guid}/games", async (Guid spaceId, string type, ClaimsPrincipal user, GameService service, CancellationToken ct) => await service.List(spaceId, type, user, ct)).RequireAuthorization("ParentOrChild");
api.MapGet("/spaces/{spaceId:guid}/games/{gameId:guid}", async (Guid spaceId, Guid gameId, ClaimsPrincipal user, GameService service, CancellationToken ct) => await service.Get(spaceId, gameId, user, ct)).RequireAuthorization("ParentOrChild");
api.MapPut("/spaces/{spaceId:guid}/games/{gameId:guid}", async (Guid spaceId, Guid gameId, CreateGameRequest request, ClaimsPrincipal user, GameService service, CancellationToken ct) => await service.Update(spaceId, gameId, request, user, ct)).RequireAuthorization("ParentOnly");
api.MapDelete("/spaces/{spaceId:guid}/games/{gameId:guid}", async (Guid spaceId, Guid gameId, ClaimsPrincipal user, GameService service, CancellationToken ct) => { await service.Delete(spaceId, gameId, user, ct); return Results.NoContent(); }).RequireAuthorization("ParentOnly");
api.MapPost("/spaces/{spaceId:guid}/games/{gameId:guid}/sessions", async (Guid spaceId, Guid gameId, ClaimsPrincipal user, GameService service, CancellationToken ct) => Results.Ok(await service.Start(spaceId, gameId, user, ct))).RequireAuthorization("ChildOnly");
api.MapGet("/spaces/{spaceId:guid}/games/{gameId:guid}/availability", async (Guid spaceId, Guid gameId, ClaimsPrincipal user, GameService service, CancellationToken ct) => await service.Availability(spaceId, gameId, user, ct)).RequireAuthorization("ChildOnly");
api.MapGet("/spaces/{spaceId:guid}/sessions/{sessionId:guid}", async (Guid spaceId, Guid sessionId, ClaimsPrincipal user, GameService service, CancellationToken ct) => await service.Session(spaceId, sessionId, user, ct)).RequireAuthorization("ChildOnly");
api.MapPost("/spaces/{spaceId:guid}/sessions/{sessionId:guid}/attempts", async (Guid spaceId, Guid sessionId, SubmitAttemptRequest request, ClaimsPrincipal user, GameService service, CancellationToken ct) => await service.Submit(spaceId, sessionId, request, user, ct)).RequireAuthorization("ChildOnly");
app.Run();

public partial class Program;

public enum GameType { MATH, MATCHING, SENTENCE_ORDERING, DICTATION }
public enum SessionStatus { ACTIVE, SUCCESS, FAILED, UNFINISHED }
public sealed record CreateGameRequest(string Type, JsonElement Content, string? Title = null);
public sealed record SubmitAttemptRequest(string IdempotencyKey, JsonElement Answer);
public sealed record GameDto(Guid Id, Guid SpaceId, string Type, string? Title, JsonElement Content, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public sealed record PlayableGame(Guid GameId, string Type, JsonElement Content);
public sealed record SessionDto(Guid Id, Guid GameId, Guid SpaceId, string Status, int AttemptsUsed, int MaxAttempts, DateTimeOffset? NextAvailableAt, PlayableGame? Game, DateTimeOffset? InactivityDeadlineAt);
public sealed record AttemptDto(Guid Id, int Number, bool Correct, int Score, int MaxScore, DateTimeOffset SubmittedAt, int AttemptsRemaining, string Status, JsonElement? Correction, DateTimeOffset? NextAvailableAt);
public sealed record AvailabilityDto(bool Available, DateTimeOffset? NextAvailableAt);
public sealed record AttemptCompletedEvent(Guid AttemptId, int AttemptNumber, JsonElement SubmittedAnswer, bool Correct, int Score, int MaxScore, DateTimeOffset SubmittedAt);
public sealed record GameSessionCompletedEvent(int SchemaVersion, Guid EventId, Guid SessionId, Guid GameId, Guid SpaceId, string GameType, string? GameTitle, string FinalStatus, int AttemptsUsed, int MaxAttempts, int FinalScore, int FinalMaxScore, DateTimeOffset StartedAt, DateTimeOffset CompletedAt, DateTimeOffset? NextAvailableAt, JsonElement GameContentSnapshot, IReadOnlyList<AttemptCompletedEvent> Attempts);
public sealed record UnfinishedSessionNotificationEvent(Guid EventId, Guid SpaceId, Guid GameId, string? GameTitle, string Status, int AttemptsUsed, int IncorrectAttempts, DateTimeOffset CompletedAt, DateTimeOffset NextAvailableAt);
public sealed record OutboxMessage(Guid EventId, string EventType, string PayloadJson, DateTimeOffset CreatedAt, int Attempts, string? LastError);
public static class GameSessionCompletedEventPayload
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public static GameSessionCompletedEvent Deserialize(string payload)
    {
        using var document = JsonDocument.Parse(payload);
        var root = document.RootElement;
        var schemaVersion = TryGet(root, "SchemaVersion", out var version) && version.TryGetInt32(out var parsedVersion) ? parsedVersion : 0;
        GameSessionCompletedEvent result;
        if (schemaVersion == 1)
        {
            result = JsonSerializer.Deserialize<GameSessionCompletedEvent>(payload, JsonOptions)
                ?? throw new JsonException("Completion event payload is empty.");
        }
        else if (schemaVersion == 0)
        {
            // Upgrade the previous pending outbox shape in place: retain EventId and attempt data,
            // rename the immutable snapshot, and derive both score fields from the final attempt.
            if (!TryGet(root, "GameContentSnapshot", out var content)
                && !TryGet(root, "ExerciseContentSnapshot", out content))
                throw new JsonException("Legacy completion payload has no game content snapshot.");
            if (!TryGet(root, "Attempts", out var attemptsNode) || attemptsNode.ValueKind != JsonValueKind.Array)
                throw new JsonException("Legacy completion payload has no attempt history.");
            var attempts = attemptsNode.Deserialize<AttemptCompletedEvent[]>(JsonOptions) ?? [];
            if (attempts.Length == 0)
                throw new JsonException("Legacy completion payload has no final attempt for score normalization.");
            result = new GameSessionCompletedEvent(
                1,
                RequiredGuid(root, "EventId"),
                RequiredGuid(root, "SessionId"),
                RequiredGuid(root, "GameId"),
                RequiredGuid(root, "SpaceId"),
                RequiredString(root, "GameType"),
                TryGet(root, "GameTitle", out var title) && title.ValueKind != JsonValueKind.Null ? title.GetString() : null,
                RequiredString(root, "FinalStatus"),
                RequiredInt(root, "AttemptsUsed"),
                RequiredInt(root, "MaxAttempts"),
                attempts[^1].Score,
                attempts[^1].MaxScore,
                RequiredDate(root, "StartedAt"),
                RequiredDate(root, "CompletedAt"),
                TryGet(root, "NextAvailableAt", out var availableAt) && availableAt.ValueKind != JsonValueKind.Null ? availableAt.GetDateTimeOffset() : null,
                content.Clone(),
                attempts);
        }
        else
        {
            throw new JsonException($"Unsupported completion event schema version {schemaVersion}.");
        }

        if (result.Attempts.Count == 0)
            throw new JsonException("Completion event has no attempts to validate its final score.");
        if (result.EventId == Guid.Empty || result.SessionId == Guid.Empty || result.GameId == Guid.Empty || result.SpaceId == Guid.Empty)
            throw new JsonException("Completion event is missing a stable identifier.");
        if (result.GameContentSnapshot.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
            throw new JsonException("Completion event has no immutable game content snapshot.");
        var lastAttempt = result.Attempts[^1];
        if (result.AttemptsUsed != result.Attempts.Count || result.FinalScore != lastAttempt.Score || result.FinalMaxScore != lastAttempt.MaxScore)
            throw new JsonException("Completion event score fields do not match the final attempt.");
        return result;
    }

    private static bool TryGet(JsonElement element, string name, out JsonElement value)
    {
        foreach (var property in element.EnumerateObject())
            if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase)) { value = property.Value; return true; }
        value = default;
        return false;
    }

    private static Guid RequiredGuid(JsonElement element, string name) => TryGet(element, name, out var value) && value.TryGetGuid(out var result) ? result : throw new JsonException($"Missing or invalid {name}.");
    private static string RequiredString(JsonElement element, string name) => TryGet(element, name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString()! : throw new JsonException($"Missing or invalid {name}.");
    private static int RequiredInt(JsonElement element, string name) => TryGet(element, name, out var value) && value.TryGetInt32(out var result) ? result : throw new JsonException($"Missing or invalid {name}.");
    private static DateTimeOffset RequiredDate(JsonElement element, string name) => TryGet(element, name, out var value) && value.TryGetDateTimeOffset(out var result) ? result : throw new JsonException($"Missing or invalid {name}.");
}
public static class CompletionOutboxPayloadUpgrader
{
    public static async Task<GameSessionCompletedEvent> ReadForDispatch(ActivitiesDbContext db, OutboxRow row, CancellationToken ct)
    {
        if (row.SentAt is not null) throw new InvalidOperationException("A sent outbox event cannot be dispatched again.");
        var message = GameSessionCompletedEventPayload.Deserialize(row.PayloadJson);
        if (message.EventId != row.EventId) throw new JsonException("Outbox key does not match the completion event identifier.");
        var currentPayload = JsonSerializer.Serialize(message);
        if (!string.Equals(row.PayloadJson, currentPayload, StringComparison.Ordinal))
        {
            var changed = await db.Outbox.Where(x => x.EventId == row.EventId && x.SentAt == null)
                .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.PayloadJson, currentPayload), ct);
            if (changed != 1) throw new InvalidOperationException("Pending completion event changed before its schema upgrade.");
            row.PayloadJson = currentPayload;
        }
        return message;
    }
}
public sealed class GameSessionOptions { public int MaxAttempts { get; set; } = 3; public int InactivityTimeoutMinutes { get; set; } = 5; public int FailureCooldownHours { get; set; } = 24; public int ExpirationPollingIntervalSeconds { get; set; } = 15; }
public sealed record Evaluation(bool Correct, int Score, int MaxScore, object? Correction);
public sealed record PairInput(string Left, string Right);
public sealed record PairView(Guid Id, string Left);
public sealed record MatchingPlayable(PairView[] Left, PairView[] Right, Dictionary<Guid, Guid> CorrectMatches);
public sealed record MatchingAnswer(Dictionary<Guid, Guid> Matches);
public sealed record SentencePlayable(Guid[] Tokens, Dictionary<Guid, string> Words, Guid[] CorrectOrder);
public sealed record SentenceAnswer(Guid[] Tokens);
public sealed record DictationAnswer(string Text);

public interface IGameEngine
{
    GameType Type { get; }
    void Validate(JsonElement content);
    object Generate(JsonElement content);
    Evaluation Evaluate(JsonElement content, JsonElement answer, JsonElement playable = default);
}

public sealed class MathEngine : IGameEngine
{
    public GameType Type => GameType.MATH;
    public void Validate(JsonElement content) { var e = ReadString(content); _ = Parser.Parse(e); }
    public object Generate(JsonElement content) => new { expression = ReadString(content) };
    public Evaluation Evaluate(JsonElement content, JsonElement answer, JsonElement playable = default)
    {
        var expected = Parser.Parse(ReadString(content));
        if (!answer.TryGetProperty("value", out var value) || !value.TryGetDecimal(out var actual)) throw new DomainException("La rÃ©ponse doit contenir un nombre dÃ©cimal nommÃ© 'value'.");
        var correct = Math.Abs(expected - actual) <= 0.000001m;
        return new(correct, correct ? 1 : 0, 1, expected);
    }
    private static string ReadString(JsonElement content) => content.ValueKind == JsonValueKind.String ? content.GetString()! : content.TryGetProperty("expression", out var e) && e.ValueKind == JsonValueKind.String ? e.GetString()! : throw new DomainException("Le contenu MATH doit contenir 'expression'.");
}

public sealed class MatchingEngine : IGameEngine
{
    private static readonly JsonSerializerOptions AnswerJsonOptions = new(JsonSerializerDefaults.Web);
    public GameType Type => GameType.MATCHING;
    public void Validate(JsonElement content) => _ = Pairs(content);
    public object Generate(JsonElement content)
    {
        var pairs = Pairs(content).Select(p => (LeftId: Guid.NewGuid(), RightId: Guid.NewGuid(), p.Left, p.Right)).ToArray();
        return new MatchingPlayable(pairs.Select(x => new PairView(x.LeftId, x.Left)).OrderBy(_ => Random.Shared.Next()).ToArray(), pairs.Select(x => new PairView(x.RightId, x.Right)).OrderBy(_ => Random.Shared.Next()).ToArray(), pairs.ToDictionary(x=>x.LeftId,x=>x.RightId));
    }
    public Evaluation Evaluate(JsonElement content, JsonElement answer, JsonElement playable = default)
    {
        var pairs = Pairs(content); var submitted = answer.Deserialize<MatchingAnswer>(AnswerJsonOptions)?.Matches ?? throw new DomainException("La rÃ©ponse doit contenir les associations 'matches'.");
        if (submitted.Count != pairs.Length) throw new DomainException("Soumettez une association pour chaque paire.");
        if(playable.ValueKind==JsonValueKind.Undefined) throw new DomainException("Ã‰tat jouable manquant.",500);
        var play=playable.Deserialize<MatchingPlayable>()!;
        var score = submitted.Count(x => play.CorrectMatches.TryGetValue(x.Key,out var expected)&&expected==x.Value);
        return new(score == pairs.Length, score, pairs.Length, pairs.Select(p => new { p.Id, p.Left, p.Right }).ToArray());
    }
    private static (Guid Id, string Left, string Right)[] Pairs(JsonElement c)
    {
        if (!c.TryGetProperty("pairs", out var list) || list.ValueKind != JsonValueKind.Array || list.GetArrayLength() < 2) throw new DomainException("Un jeu MATCHING doit contenir au moins deux paires.");
        var rows = new List<(Guid, string, string)>();
        foreach (var item in list.EnumerateArray())
        {
            var left = item.TryGetProperty("left", out var l) ? l.GetString()?.Trim() : null;
            var right = item.TryGetProperty("right", out var r) ? r.GetString()?.Trim() : null;
            var id = item.TryGetProperty("id", out var i) && Guid.TryParse(i.GetString(), out var parsed) ? parsed : Guid.NewGuid();
            if (string.IsNullOrWhiteSpace(left) || string.IsNullOrWhiteSpace(right)) throw new DomainException("Chaque paire doit avoir un mot et une dÃ©finition.");
            rows.Add((id, left, right));
        }
        if (rows.Select(x => x.Item1).Distinct().Count() != rows.Count || rows.Select(x => x.Item2).Distinct(StringComparer.OrdinalIgnoreCase).Count() != rows.Count || rows.Select(x => x.Item3).Distinct(StringComparer.OrdinalIgnoreCase).Count() != rows.Count) throw new DomainException("Les identifiants, mots et dÃ©finitions doivent Ãªtre uniques.");
        return rows.Select(x => (x.Item1, x.Item2, x.Item3)).ToArray();
    }
}

public sealed class SentenceOrderingEngine : IGameEngine
{
    private static readonly JsonSerializerOptions AnswerJsonOptions = new(JsonSerializerDefaults.Web);
    public GameType Type => GameType.SENTENCE_ORDERING;
    public void Validate(JsonElement content) => _ = Tokens(content);
    public object Generate(JsonElement content)
    {
        var source = Tokens(content); var tokens = source.Select(_ => Guid.NewGuid()).ToArray(); var words = source.Select((word, i) => (tokens[i], word)).ToDictionary(x => x.Item1, x => x.word);
        var shuffled = tokens.OrderBy(_ => Random.Shared.Next()).ToArray(); if (shuffled.SequenceEqual(tokens) && shuffled.Length > 1) (shuffled[0], shuffled[1]) = (shuffled[1], shuffled[0]);
        return new SentencePlayable(shuffled, words, tokens);
    }
    public Evaluation Evaluate(JsonElement content, JsonElement answer, JsonElement playable = default)
    {
        var source = Tokens(content); var submitted = answer.Deserialize<SentenceAnswer>(AnswerJsonOptions)?.Tokens ?? throw new DomainException("La rÃ©ponse doit contenir la liste 'tokens'.");
        if(playable.ValueKind==JsonValueKind.Undefined) throw new DomainException("Ã‰tat jouable manquant.",500);
        var play=playable.Deserialize<SentencePlayable>()!;
        var correct = submitted.SequenceEqual(play.CorrectOrder);
        return new(correct, correct ? source.Length : submitted.Length == source.Length ? source.Length - 1 : 0, source.Length, string.Join(" ", source));
    }
    private static string[] Tokens(JsonElement c)
    {
        var text = c.ValueKind == JsonValueKind.String ? c.GetString() : c.TryGetProperty("sentence", out var s) ? s.GetString() : null;
        if (string.IsNullOrWhiteSpace(text)) throw new DomainException("Le contenu SENTENCE_ORDERING doit contenir 'sentence'.");
        // Keep punctuation attached to its word; whitespace separates movable tokens.
        var tokens = Regex.Split(text.Trim(), @"\s+");
        if (tokens.Length < 2) throw new DomainException("La phrase doit contenir au moins deux Ã©lÃ©ments.");
        return tokens;
    }
}

public sealed class DictationEngine : IGameEngine
{
    private static readonly JsonSerializerOptions AnswerJsonOptions = new(JsonSerializerDefaults.Web);
    public GameType Type => GameType.DICTATION;

    public void Validate(JsonElement content)
    {
        var sentence = ReadSentence(content);
        if (sentence.Length > 500) throw new DomainException("Une dictée ne peut pas dépasser 500 caractères.");
        if (sentence.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Length < 2)
            throw new DomainException("La dictée doit contenir au moins deux mots.");
    }

    // The sentence is returned only because browser SpeechSynthesis needs its plain text. The API
    // still keeps evaluation, scoring, attempts, and correction authoritative on the server.
    public object Generate(JsonElement content) => new { sentence = ReadSentence(content) };

    public Evaluation Evaluate(JsonElement content, JsonElement answer, JsonElement playable = default)
    {
        var submitted = answer.Deserialize<DictationAnswer>(AnswerJsonOptions)?.Text;
        if (string.IsNullOrWhiteSpace(submitted)) throw new DomainException("La réponse de dictée ne peut pas être vide.");
        var expected = ReadSentence(content);
        var correct = Normalize(submitted) == Normalize(expected);
        return new(correct, correct ? 1 : 0, 1, expected);
    }

    public static string ReadSentence(JsonElement content)
    {
        var sentence = content.ValueKind == JsonValueKind.String
            ? content.GetString()
            : TryReadStringProperty(content, "sentence");
        if (string.IsNullOrWhiteSpace(sentence)) throw new DomainException("Le contenu DICTATION doit contenir 'sentence'.");
        return sentence.Trim();
    }

    private static string? TryReadStringProperty(JsonElement value, string name)
    {
        if (value.ValueKind != JsonValueKind.Object) return null;
        foreach (var property in value.EnumerateObject())
            if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase) && property.Value.ValueKind == JsonValueKind.String)
                return property.Value.GetString();
        return null;
    }

    private static string Normalize(string value)
    {
        var decomposed = value.Trim().Normalize(NormalizationForm.FormD);
        var withoutMarks = new string(decomposed.Where(character =>
            System.Globalization.CharUnicodeInfo.GetUnicodeCategory(character) != System.Globalization.UnicodeCategory.NonSpacingMark).ToArray());
        return Regex.Replace(withoutMarks, @"[^\p{L}\p{N}]+", " ").Trim().ToLowerInvariant();
    }
}

public interface IClock { DateTimeOffset UtcNow { get; } }
public sealed class SystemClock : IClock { public DateTimeOffset UtcNow => DateTimeOffset.UtcNow; }
public sealed record GameRecord(Guid Id, Guid SpaceId, GameType Type, string? Title, string Content, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public sealed class SessionRecord
{
    public Guid Id { get; init; } = Guid.NewGuid(); public Guid SpaceId { get; init; } public GameRecord Game { get; init; } = null!; public DateTimeOffset CreatedAt { get; init; }
    public SessionStatus Status { get; set; } = SessionStatus.ACTIVE; public DateTimeOffset? CompletedAt { get; set; } public DateTimeOffset? NextAvailableAt { get; set; } public DateTimeOffset? InactivityDeadlineAt { get; set; }
    public string? GameTitleSnapshot { get; set; } public string? GameTypeSnapshot { get; set; } public string? ExerciseContentSnapshot { get; set; }
    public int Version { get; set; } = -1; public string PlayJson { get; set; } = "{}"; public List<AttemptRecord> Attempts { get; } = []; public Dictionary<string, AttemptDto> Idempotency { get; } = new(StringComparer.Ordinal);
    public GameType EffectiveGameType => Enum.TryParse<GameType>(GameTypeSnapshot, true, out var snapshotType) ? snapshotType : Game.Type;
    public string EffectiveExerciseContent => ExerciseContentSnapshot ?? Game.Content;
}
public sealed record AttemptRecord(int Number, string Answer, Evaluation Evaluation, DateTimeOffset At, Guid AttemptId = default);
public interface IGameCatalog
{
    Task<GameRecord?> Find(Guid space, Guid game, CancellationToken ct); Task<List<GameRecord>> List(Guid space, CancellationToken ct); Task Save(GameRecord game, CancellationToken ct); Task Remove(GameRecord game, CancellationToken ct);
    Task<SessionRecord?> GetSession(Guid id, CancellationToken ct); Task<List<SessionRecord>> Sessions(Guid space, Guid game, CancellationToken ct); Task<List<SessionRecord>> ActiveSessionsWithDeadline(CancellationToken ct); Task<bool> SaveSession(SessionRecord session, CancellationToken ct, GameSessionCompletedEvent? completion = null, UnfinishedSessionNotificationEvent? notification = null); Task<bool> TryExpireSession(Guid id, DateTimeOffset expectedDeadline, DateTimeOffset completedAt, DateTimeOffset nextAvailableAt, CancellationToken ct, GameSessionCompletedEvent? completion = null, UnfinishedSessionNotificationEvent? notification = null);
}
public sealed class InMemoryGameCatalog : IGameCatalog
{
    private readonly ConcurrentDictionary<Guid, GameRecord> games = new(); private readonly ConcurrentDictionary<Guid, SessionRecord> sessions = new();
    public Task<GameRecord?> Find(Guid s, Guid g, CancellationToken ct) => Task.FromResult(games.TryGetValue(g, out var x) && x.SpaceId == s ? x : null);
    public Task<List<GameRecord>> List(Guid s, CancellationToken ct) => Task.FromResult(games.Values.Where(x => x.SpaceId == s).ToList());
    public Task Save(GameRecord g, CancellationToken ct) { games[g.Id] = g; return Task.CompletedTask; }
    public Task Remove(GameRecord g, CancellationToken ct) { games.TryRemove(g.Id, out _); return Task.CompletedTask; }
    public Task<SessionRecord?> GetSession(Guid id, CancellationToken ct) => Task.FromResult(sessions.GetValueOrDefault(id));
    public Task<List<SessionRecord>> Sessions(Guid s, Guid g, CancellationToken ct) => Task.FromResult(sessions.Values.Where(x => x.SpaceId == s && x.Game.Id == g).ToList());
    public Task<List<SessionRecord>> ActiveSessionsWithDeadline(CancellationToken ct) => Task.FromResult(sessions.Values.Where(x => x.Status == SessionStatus.ACTIVE && x.InactivityDeadlineAt != null).ToList());
    public Task<bool> SaveSession(SessionRecord s, CancellationToken ct, GameSessionCompletedEvent? completion = null, UnfinishedSessionNotificationEvent? notification = null) { lock(s) { if(s.Version < 0) s.Version=0; else s.Version++; sessions[s.Id] = s; return Task.FromResult(true); } }
    public Task<bool> TryExpireSession(Guid id, DateTimeOffset deadline, DateTimeOffset completedAt, DateTimeOffset nextAvailableAt, CancellationToken ct, GameSessionCompletedEvent? completion = null, UnfinishedSessionNotificationEvent? notification = null)
    {
        if(!sessions.TryGetValue(id,out var s)) return Task.FromResult(false);
        lock(s) { if(s.Status!=SessionStatus.ACTIVE||s.InactivityDeadlineAt!=deadline)return Task.FromResult(false);s.Status=SessionStatus.UNFINISHED;s.CompletedAt=completedAt;s.NextAvailableAt=nextAvailableAt;s.InactivityDeadlineAt=null;s.Version++;return Task.FromResult(true); }
    }
}

public sealed class ActivitiesDbContext(DbContextOptions<ActivitiesDbContext> options) : DbContext(options)
{
    public DbSet<GameRow> Games => Set<GameRow>();
    public DbSet<SessionRow> Sessions => Set<SessionRow>();
    public DbSet<OutboxRow> Outbox => Set<OutboxRow>();
    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<GameRow>().HasKey(x => x.Id);
        model.Entity<GameRow>().HasIndex(x => new { x.SpaceId, x.Type });
        model.Entity<SessionRow>().HasKey(x => x.Id);
        model.Entity<SessionRow>().HasIndex(x => new { x.SpaceId, x.GameId, x.Status });
        model.Entity<SessionRow>().HasIndex(x => new { x.Status, x.InactivityDeadlineAt });
        model.Entity<SessionRow>().HasIndex(x => new { x.SpaceId, x.GameId }).IsUnique().HasFilter("\"Status\" = 'ACTIVE'").HasDatabaseName("IX_Sessions_OneActivePerSpaceGame");
        model.Entity<SessionRow>().Property(x => x.Version).IsConcurrencyToken();
        model.Entity<SessionRow>().HasOne<GameRow>().WithMany().HasForeignKey(x => x.GameId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<OutboxRow>().HasKey(x => x.EventId);
        model.Entity<OutboxRow>().HasIndex(x => new { x.SentAt, x.CreatedAt });
    }
}
public static class ActivitiesSchemaUpgrade
{
    public static async Task ApplyAsync(ActivitiesDbContext db, CancellationToken cancellationToken = default)
    {
        await db.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            await using (var inspect = db.Database.GetDbConnection().CreateCommand())
            {
                inspect.CommandText = "PRAGMA table_info('Sessions')";
                await using var reader = await inspect.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken)) columns.Add(reader.GetString(1));
            }
            if (!columns.Contains(nameof(SessionRow.InactivityDeadlineAt)))
            {
                await using var alter = db.Database.GetDbConnection().CreateCommand();
                alter.CommandText = "ALTER TABLE Sessions ADD COLUMN InactivityDeadlineAt TEXT NULL";
                await alter.ExecuteNonQueryAsync(cancellationToken);
            }
            if (!columns.Contains(nameof(SessionRow.Version)))
            {
                await using var alter = db.Database.GetDbConnection().CreateCommand();
                alter.CommandText = "ALTER TABLE Sessions ADD COLUMN Version INTEGER NOT NULL DEFAULT 0";
                await alter.ExecuteNonQueryAsync(cancellationToken);
            }
            foreach (var (name, sqlType) in new[]
                     {
                         (nameof(SessionRow.GameTitleSnapshot), "TEXT NULL"),
                         (nameof(SessionRow.GameTypeSnapshot), "TEXT NULL"),
                         (nameof(SessionRow.ExerciseContentSnapshot), "TEXT NULL")
                     })
            {
                if (columns.Contains(name)) continue;
                await using var alter = db.Database.GetDbConnection().CreateCommand();
                alter.CommandText = $"ALTER TABLE Sessions ADD COLUMN {name} {sqlType}";
                await alter.ExecuteNonQueryAsync(cancellationToken);
            }
            await using (var backfill = db.Database.GetDbConnection().CreateCommand())
            {
                backfill.CommandText = "UPDATE Sessions SET GameTitleSnapshot=(SELECT Title FROM Games WHERE Games.Id=Sessions.GameId) WHERE GameTitleSnapshot IS NULL; UPDATE Sessions SET GameTypeSnapshot=(SELECT Type FROM Games WHERE Games.Id=Sessions.GameId) WHERE GameTypeSnapshot IS NULL; UPDATE Sessions SET ExerciseContentSnapshot=(SELECT Content FROM Games WHERE Games.Id=Sessions.GameId) WHERE ExerciseContentSnapshot IS NULL";
                await backfill.ExecuteNonQueryAsync(cancellationToken);
            }
            await using var index = db.Database.GetDbConnection().CreateCommand();
            index.CommandText = "CREATE INDEX IF NOT EXISTS IX_Sessions_Status_InactivityDeadlineAt ON Sessions (Status, InactivityDeadlineAt)";
            await index.ExecuteNonQueryAsync(cancellationToken);
            await using var outbox = db.Database.GetDbConnection().CreateCommand();
            outbox.CommandText = "CREATE TABLE IF NOT EXISTS Outbox (EventId TEXT NOT NULL PRIMARY KEY, EventType TEXT NOT NULL, PayloadJson TEXT NOT NULL, CreatedAt TEXT NOT NULL, SentAt TEXT NULL, Attempts INTEGER NOT NULL DEFAULT 0, LastError TEXT NULL)";
            await outbox.ExecuteNonQueryAsync(cancellationToken);
            await using var outboxIndex = db.Database.GetDbConnection().CreateCommand();
            outboxIndex.CommandText = "CREATE INDEX IF NOT EXISTS IX_Outbox_SentAt_CreatedAt ON Outbox (SentAt, CreatedAt)";
            await outboxIndex.ExecuteNonQueryAsync(cancellationToken);
            await using var activeIndex = db.Database.GetDbConnection().CreateCommand();
            activeIndex.CommandText = "CREATE UNIQUE INDEX IF NOT EXISTS IX_Sessions_OneActivePerSpaceGame ON Sessions (SpaceId, GameId) WHERE Status = 'ACTIVE'";
            await activeIndex.ExecuteNonQueryAsync(cancellationToken);
        }
        finally { await db.Database.CloseConnectionAsync(); }
    }
}
public sealed class GameRow { public Guid Id { get; set; } public Guid SpaceId { get; set; } public string Type { get; set; } = ""; public string? Title { get; set; } public string Content { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } public DateTimeOffset UpdatedAt { get; set; } }
public sealed class SessionRow { public Guid Id { get; set; } public Guid SpaceId { get; set; } public Guid GameId { get; set; } public string Status { get; set; } = "ACTIVE"; public DateTimeOffset CreatedAt { get; set; } public DateTimeOffset? CompletedAt { get; set; } public DateTimeOffset? NextAvailableAt { get; set; } public DateTimeOffset? InactivityDeadlineAt { get; set; } public int Version { get; set; } public string? GameTitleSnapshot { get; set; } public string? GameTypeSnapshot { get; set; } public string? ExerciseContentSnapshot { get; set; } public string PlayJson { get; set; } = "{}"; public string AttemptsJson { get; set; } = "[]"; public string IdempotencyJson { get; set; } = "{}"; }
public sealed class OutboxRow { public Guid EventId { get; set; } public string EventType { get; set; } = ""; public string PayloadJson { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } public DateTimeOffset? SentAt { get; set; } public int Attempts { get; set; } public string? LastError { get; set; } }
public sealed class EfGameCatalog(ActivitiesDbContext db) : IGameCatalog
{
    public async Task<GameRecord?> Find(Guid space, Guid game, CancellationToken ct) { var x=await db.Games.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==game&&x.SpaceId==space,ct); return x==null?null:ToRecord(x); }
    public async Task<List<GameRecord>> List(Guid space,CancellationToken ct)=>(await db.Games.AsNoTracking().Where(x=>x.SpaceId==space).ToListAsync(ct)).Select(ToRecord).ToList();
    public async Task Save(GameRecord g,CancellationToken ct) { var x=await db.Games.FindAsync([g.Id],ct); if(x==null){x=new GameRow{Id=g.Id};db.Games.Add(x);} x.SpaceId=g.SpaceId;x.Type=g.Type.ToString();x.Title=g.Title;x.Content=g.Content;x.CreatedAt=g.CreatedAt;x.UpdatedAt=g.UpdatedAt;await db.SaveChangesAsync(ct); }
    public async Task Remove(GameRecord g,CancellationToken ct) { var x=await db.Games.FindAsync([g.Id],ct);if(x!=null){db.Games.Remove(x);await db.SaveChangesAsync(ct);} }
    public async Task<SessionRecord?> GetSession(Guid id,CancellationToken ct) { var x=await db.Sessions.AsNoTracking().SingleOrDefaultAsync(x=>x.Id==id,ct);return x==null?null:await ToSession(x,ct); }
    public async Task<List<SessionRecord>> Sessions(Guid space,Guid game,CancellationToken ct) { var rows=await db.Sessions.AsNoTracking().Where(x=>x.SpaceId==space&&x.GameId==game).ToListAsync(ct);var result=new List<SessionRecord>();foreach(var row in rows)result.Add((await ToSession(row,ct))!);return result; }
    public async Task<List<SessionRecord>> ActiveSessionsWithDeadline(CancellationToken ct) { var rows=await db.Sessions.AsNoTracking().Where(x=>x.Status=="ACTIVE"&&x.InactivityDeadlineAt!=null).ToListAsync(ct);var result=new List<SessionRecord>();foreach(var row in rows)if((await ToSession(row,ct)) is { } session)result.Add(session);return result; }
    public async Task<bool> SaveSession(SessionRecord s,CancellationToken ct,GameSessionCompletedEvent? completion = null,UnfinishedSessionNotificationEvent? notification = null)
    {
        if(s.Version<0)
        {
            var inserted=new SessionRow{Id=s.Id,SpaceId=s.SpaceId,GameId=s.Game.Id,Status=s.Status.ToString(),CreatedAt=s.CreatedAt,CompletedAt=s.CompletedAt,NextAvailableAt=s.NextAvailableAt,InactivityDeadlineAt=s.InactivityDeadlineAt,GameTitleSnapshot=s.GameTitleSnapshot,GameTypeSnapshot=s.GameTypeSnapshot,ExerciseContentSnapshot=s.ExerciseContentSnapshot,PlayJson=s.PlayJson,AttemptsJson=JsonSerializer.Serialize(s.Attempts),IdempotencyJson=JsonSerializer.Serialize(s.Idempotency),Version=0};
            db.Sessions.Add(inserted);
            try { await db.SaveChangesAsync(ct); s.Version=0; return true; }
            catch(DbUpdateException) { db.Entry(inserted).State=EntityState.Detached; return false; }
        }
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var expected=s.Version; var next=expected+1; var attemptsJson=JsonSerializer.Serialize(s.Attempts); var idempotencyJson=JsonSerializer.Serialize(s.Idempotency);
        var changed=await db.Sessions.Where(x=>x.Id==s.Id&&x.Version==expected&&x.Status=="ACTIVE").ExecuteUpdateAsync(setters=>setters
            .SetProperty(x=>x.Status,s.Status.ToString()).SetProperty(x=>x.CompletedAt,s.CompletedAt).SetProperty(x=>x.NextAvailableAt,s.NextAvailableAt)
            .SetProperty(x=>x.InactivityDeadlineAt,s.InactivityDeadlineAt).SetProperty(x=>x.PlayJson,s.PlayJson)
            .SetProperty(x=>x.AttemptsJson,attemptsJson).SetProperty(x=>x.IdempotencyJson,idempotencyJson)
            .SetProperty(x=>x.Version,next),ct);
        if(changed==1 && completion is not null)
        {
            db.Outbox.Add(ToOutbox(completion, s.CompletedAt ?? completion.CompletedAt));
        }
        if(changed==1 && notification is not null) db.Outbox.Add(ToOutbox(notification, s.CompletedAt ?? notification.CompletedAt));
        if(changed==1 && (completion is not null || notification is not null)) await db.SaveChangesAsync(ct);
        if(changed==1) { await transaction.CommitAsync(ct); s.Version=next; }
        else await transaction.RollbackAsync(ct);
        return changed==1;
    }
    public async Task<bool> TryExpireSession(Guid id,DateTimeOffset expectedDeadline,DateTimeOffset completedAt,DateTimeOffset nextAvailableAt,CancellationToken ct,GameSessionCompletedEvent? completion = null,UnfinishedSessionNotificationEvent? notification = null)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var changed=await db.Sessions.Where(x=>x.Id==id&&x.Status=="ACTIVE"&&x.InactivityDeadlineAt==expectedDeadline).ExecuteUpdateAsync(setters=>setters
            .SetProperty(x=>x.Status,SessionStatus.UNFINISHED.ToString()).SetProperty(x=>x.CompletedAt,completedAt).SetProperty(x=>x.NextAvailableAt,nextAvailableAt)
            .SetProperty(x=>x.InactivityDeadlineAt,(DateTimeOffset?)null).SetProperty(x=>x.Version,x=>x.Version+1),ct);
        if(changed==1 && completion is not null) db.Outbox.Add(ToOutbox(completion, completedAt));
        if(changed==1 && notification is not null) db.Outbox.Add(ToOutbox(notification, completedAt));
        if(changed==1 && (completion is not null || notification is not null)) await db.SaveChangesAsync(ct);
        if(changed==1) await transaction.CommitAsync(ct); else await transaction.RollbackAsync(ct);
        return changed==1;
    }
    public async Task<List<OutboxRow>> PendingOutbox(CancellationToken ct) => await db.Outbox.AsNoTracking().Where(x=>x.SentAt==null).OrderBy(x=>x.CreatedAt).Take(50).ToListAsync(ct);
    public async Task MarkOutbox(Guid eventId, bool sent, string? error, CancellationToken ct)
    {
        await db.Outbox.Where(x=>x.EventId==eventId&&x.SentAt==null).ExecuteUpdateAsync(setters=>setters.SetProperty(x=>x.Attempts,x=>x.Attempts+1).SetProperty(x=>x.SentAt,sent?DateTimeOffset.UtcNow:(DateTimeOffset?)null).SetProperty(x=>x.LastError,error),ct);
    }
    private static OutboxRow ToOutbox(GameSessionCompletedEvent e, DateTimeOffset createdAt) => new() { EventId=e.EventId, EventType="GameSessionCompleted", PayloadJson=JsonSerializer.Serialize(e), CreatedAt=createdAt };
    private static OutboxRow ToOutbox(UnfinishedSessionNotificationEvent e, DateTimeOffset createdAt) => new() { EventId=e.EventId, EventType="UnfinishedSessionNotification", PayloadJson=JsonSerializer.Serialize(e), CreatedAt=createdAt };
    private async Task<SessionRecord?> ToSession(SessionRow r,CancellationToken ct) { var g=await db.Games.AsNoTracking().SingleOrDefaultAsync(g=>g.Id==r.GameId,ct);if(g==null)return null;var game=ToRecord(g);var s=new SessionRecord{Id=r.Id,SpaceId=r.SpaceId,Game=game,CreatedAt=r.CreatedAt,Status=Enum.Parse<SessionStatus>(r.Status),CompletedAt=r.CompletedAt,NextAvailableAt=r.NextAvailableAt,InactivityDeadlineAt=r.InactivityDeadlineAt,GameTitleSnapshot=r.GameTitleSnapshot??game.Title,GameTypeSnapshot=r.GameTypeSnapshot??game.Type.ToString(),ExerciseContentSnapshot=r.ExerciseContentSnapshot??game.Content,PlayJson=r.PlayJson,Version=r.Version};s.Attempts.AddRange(JsonSerializer.Deserialize<List<AttemptRecord>>(r.AttemptsJson)??[]);foreach(var kv in JsonSerializer.Deserialize<Dictionary<string,AttemptDto>>(r.IdempotencyJson)??[])s.Idempotency[kv.Key]=kv.Value;return s; }
    private static GameRecord ToRecord(GameRow x)=>new(x.Id,x.SpaceId,Enum.Parse<GameType>(x.Type),x.Title,x.Content,x.CreatedAt,x.UpdatedAt);
}
public interface ISpaceAccess { Task<bool> CanAccess(Guid spaceId, ClaimsPrincipal user, string activityType, CancellationToken ct); }
public sealed class EduKidsApiSpaceAccess(EspacesApiAuthorization spaces) : ISpaceAccess
{
    public Task<bool> CanAccess(Guid spaceId, ClaimsPrincipal user, string activityType, CancellationToken ct) =>
        user.IsInRole("Parent")
            ? spaces.ParentOwnsSpaceWithActivity(spaceId, activityType, user, ct)
            : user.IsInRole("Enfant")
                ? spaces.ChildOwnsSpaceWithActivity(spaceId, activityType, user, ct)
                : Task.FromResult(false);
}
public interface IProgressPublisher { Task<bool> Publish(GameSessionCompletedEvent message, CancellationToken ct); }
// Intentionally reports failure until a real transport is configured, leaving the event pending in the outbox.
public sealed class NoopProgressPublisher : IProgressPublisher { public Task<bool> Publish(GameSessionCompletedEvent message, CancellationToken ct) => Task.FromResult(false); }
public interface IParentNotificationPublisher { Task<bool> Publish(UnfinishedSessionNotificationEvent message, CancellationToken ct); }
public sealed class NoopParentNotificationPublisher : IParentNotificationPublisher { public Task<bool> Publish(UnfinishedSessionNotificationEvent message, CancellationToken ct) => Task.FromResult(false); }

public sealed class GameService(IGameCatalog catalog, IEnumerable<IGameEngine> engines, ISpaceAccess access, IClock clock, IOptions<GameSessionOptions> sessionOptions)
{
    private int MaxAttempts => sessionOptions.Value.MaxAttempts;
    private TimeSpan InactivityTimeout => TimeSpan.FromMinutes(sessionOptions.Value.InactivityTimeoutMinutes);
    private TimeSpan Cooldown => TimeSpan.FromHours(sessionOptions.Value.FailureCooldownHours);
    private IGameEngine Engine(GameType t) => engines.Single(x => x.Type == t);
    private static GameType ParseType(string type) => Enum.TryParse<GameType>(type, true, out var t) ? t : throw new DomainException("Type d'activitÃ© inconnu.");
    private async Task Ensure(Guid space, ClaimsPrincipal user, GameType type, CancellationToken ct) { if (!await access.CanAccess(space, user, type.ToString(), ct)) throw new DomainException("AccÃ¨s Ã  l'espace ou Ã  ce type d'activitÃ© refusÃ©.", 403); }
    public async Task<GameDto> Create(Guid s, CreateGameRequest r, ClaimsPrincipal u, CancellationToken ct) { var t = ParseType(r.Type); await Ensure(s,u,t,ct); Engine(t).Validate(r.Content); var now=clock.UtcNow; var g=new GameRecord(Guid.NewGuid(),s,t,r.Title,NormalizeContent(t,r.Content),now,now); await catalog.Save(g,ct); return Dto(g); }
    public async Task<List<GameDto>> List(Guid s,string type,ClaimsPrincipal u,CancellationToken ct) { var t=ParseType(type); await Ensure(s,u,t,ct); return (await catalog.List(s,ct)).Where(x=>x.Type==t).Select(Dto).ToList(); }
    public async Task<GameDto> Get(Guid s,Guid id,ClaimsPrincipal u,CancellationToken ct) { var g=await Required(s,id,ct); await Ensure(s,u,g.Type,ct); return Dto(g); }
    public async Task<GameDto> Update(Guid s,Guid id,CreateGameRequest r,ClaimsPrincipal u,CancellationToken ct) { var g=await Required(s,id,ct); var t=ParseType(r.Type); await Ensure(s,u,g.Type,ct); await Ensure(s,u,t,ct); Engine(t).Validate(r.Content); var n=g with {Type=t,Title=r.Title,Content=NormalizeContent(t,r.Content),UpdatedAt=clock.UtcNow}; await catalog.Save(n,ct); return Dto(n); }
    public async Task Delete(Guid s,Guid id,ClaimsPrincipal u,CancellationToken ct) { var g=await Required(s,id,ct); await Ensure(s,u,g.Type,ct); if ((await catalog.Sessions(s,id,ct)).Count > 0) throw new DomainException("Ce jeu possède un historique pédagogique et ne peut pas être supprimé.",409); await catalog.Remove(g,ct); }
    public async Task<SessionDto> Start(Guid s,Guid id,ClaimsPrincipal u,CancellationToken ct)
    {
        var g=await Required(s,id,ct); await Ensure(s,u,g.Type,ct); var existing=await catalog.Sessions(s,id,ct);
        for(var i=0;i<existing.Count;i++) if(existing[i].Status==SessionStatus.ACTIVE) existing[i]=await ExpireIfDue(existing[i],ct);
        var active=existing.FirstOrDefault(x=>x.Status==SessionStatus.ACTIVE); if(active!=null) return SessionDtoOf(active,true);
        var blocked=existing.Where(IsReplayBlocked).OrderByDescending(x=>x.NextAvailableAt).FirstOrDefault(); if(blocked!=null) throw new DomainException($"Jeu indisponible jusqu'Ã  {blocked.NextAvailableAt:O}.",409);
        var session=new SessionRecord{SpaceId=s,Game=g,CreatedAt=clock.UtcNow,GameTitleSnapshot=g.Title,GameTypeSnapshot=g.Type.ToString(),ExerciseContentSnapshot=g.Content,PlayJson=JsonSerializer.Serialize(Engine(g.Type).Generate(JsonDocument.Parse(g.Content).RootElement))};
        if(!await catalog.SaveSession(session,ct))
        {
            var concurrent=(await catalog.Sessions(s,id,ct)).FirstOrDefault(x=>x.Status==SessionStatus.ACTIVE);
            if(concurrent!=null) return SessionDtoOf(concurrent,true);
            throw new DomainException("La session a Ã©tÃ© crÃ©Ã©e simultanÃ©ment. RÃ©essayez.",409);
        }
        return SessionDtoOf(session,true);
    }
    public async Task<AvailabilityDto> Availability(Guid s,Guid id,ClaimsPrincipal u,CancellationToken ct) { var g=await Required(s,id,ct); await Ensure(s,u,g.Type,ct); var sessions=await catalog.Sessions(s,id,ct); for(var i=0;i<sessions.Count;i++)if(sessions[i].Status==SessionStatus.ACTIVE)sessions[i]=await ExpireIfDue(sessions[i],ct); var wait=sessions.Where(IsReplayBlocked).OrderByDescending(x=>x.NextAvailableAt).FirstOrDefault(); return new(wait==null,wait?.NextAvailableAt); }
    public async Task<SessionDto> Session(Guid s,Guid id,ClaimsPrincipal u,CancellationToken ct) { var x=await catalog.GetSession(id,ct); if(x==null||x.SpaceId!=s) throw new DomainException("Session introuvable.",404); await Ensure(s,u,x.EffectiveGameType,ct); x=await ExpireIfDue(x,ct); return SessionDtoOf(x,x.Status==SessionStatus.ACTIVE); }
    public async Task<AttemptDto> Submit(Guid s,Guid sid,SubmitAttemptRequest r,ClaimsPrincipal u,CancellationToken ct)
    {
        if(string.IsNullOrWhiteSpace(r.IdempotencyKey)||r.IdempotencyKey.Length>128) throw new DomainException("Un IdempotencyKey valide est requis."); var x=await catalog.GetSession(sid,ct); if(x==null||x.SpaceId!=s) throw new DomainException("Session introuvable.",404); await Ensure(s,u,x.EffectiveGameType,ct); x=await ExpireIfDue(x,ct);
        AttemptDto dto;
        lock(x) { if(x.Idempotency.TryGetValue(r.IdempotencyKey,out var cached)) return cached; if(x.Status!=SessionStatus.ACTIVE) throw new DomainException("Cette session est terminÃ©e.",409); if(x.Attempts.Count>=MaxAttempts) throw new DomainException("Limite de tentatives atteinte.",409);
            var result=Engine(x.EffectiveGameType).Evaluate(JsonDocument.Parse(x.EffectiveExerciseContent).RootElement,r.Answer,JsonDocument.Parse(x.PlayJson).RootElement); var now=clock.UtcNow; var number=x.Attempts.Count+1; var attemptId=Guid.NewGuid(); x.Attempts.Add(new(number,r.Answer.GetRawText(),result,now,attemptId));
            if(result.Correct) { x.Status=SessionStatus.SUCCESS; x.CompletedAt=now; x.NextAvailableAt=null; x.InactivityDeadlineAt=null; }
            else if(number==MaxAttempts) { x.Status=SessionStatus.FAILED; x.CompletedAt=now; x.NextAvailableAt=now+Cooldown; x.InactivityDeadlineAt=null; }
            else { x.InactivityDeadlineAt=now+InactivityTimeout; }
            dto=new AttemptDto(attemptId,number,result.Correct,result.Score,result.MaxScore,now,MaxAttempts-number,x.Status.ToString(),x.Status==SessionStatus.FAILED?JsonSerializer.SerializeToElement(result.Correction):null,x.NextAvailableAt); x.Idempotency[r.IdempotencyKey]=dto;
        }
        var completion = x.Status == SessionStatus.ACTIVE ? null : BuildCompletion(x);
        if(!await catalog.SaveSession(x,ct,completion))
        {
            var current=await catalog.GetSession(x.Id,ct);
            if(current?.Idempotency.TryGetValue(r.IdempotencyKey,out var duplicate)==true) return duplicate;
            throw new DomainException("La session a Ã©tÃ© modifiÃ©e par une autre requÃªte. RÃ©essayez.",409);
        }
        return dto;
    }
    public async Task<int> ExpireDueSessions(CancellationToken ct)
    {
        var sessions=await catalog.ActiveSessionsWithDeadline(ct); var expired=0;
        foreach(var session in sessions) if(session.InactivityDeadlineAt<=clock.UtcNow) { var updated=await ExpireIfDue(session,ct); if(updated.Status==SessionStatus.UNFINISHED) expired++; }
        return expired;
    }
    private async Task<SessionRecord> ExpireIfDue(SessionRecord session,CancellationToken ct)
    {
        if(session.Status!=SessionStatus.ACTIVE||session.InactivityDeadlineAt is not { } deadline||deadline>clock.UtcNow) return session;
        var expired = CopyAsUnfinished(session, deadline, deadline+Cooldown);
        var transitioned=await catalog.TryExpireSession(session.Id,deadline,deadline,deadline+Cooldown,ct,BuildCompletion(expired),BuildNotification(expired));
        var updated=await catalog.GetSession(session.Id,ct) ?? session;
        return updated;
    }
    private static SessionRecord CopyAsUnfinished(SessionRecord source, DateTimeOffset completedAt, DateTimeOffset nextAvailableAt)
    {
        var copy = new SessionRecord { Id=source.Id, SpaceId=source.SpaceId, Game=source.Game, CreatedAt=source.CreatedAt, Status=SessionStatus.UNFINISHED, CompletedAt=completedAt, NextAvailableAt=nextAvailableAt, GameTitleSnapshot=source.GameTitleSnapshot, GameTypeSnapshot=source.GameTypeSnapshot, ExerciseContentSnapshot=source.ExerciseContentSnapshot, PlayJson=source.PlayJson, Version=source.Version };
        copy.Attempts.AddRange(source.Attempts);
        return copy;
    }
    private GameSessionCompletedEvent BuildCompletion(SessionRecord session)
    {
        var attempts = session.Attempts.Select(a => new AttemptCompletedEvent(
            a.AttemptId == Guid.Empty ? DeterministicAttemptId(session.Id, a.Number) : a.AttemptId,
            a.Number,
            JsonDocument.Parse(a.Answer).RootElement.Clone(),
            a.Evaluation.Correct,
            a.Evaluation.Score,
            a.Evaluation.MaxScore,
            a.At)).ToArray();
        var content = JsonDocument.Parse(session.EffectiveExerciseContent).RootElement.Clone();
        var completedAt = session.CompletedAt ?? clock.UtcNow;
        var finalAttempt = attempts.LastOrDefault() ?? throw new InvalidOperationException("A terminal session must have at least one submitted attempt.");
        return new(1, session.Id, session.Id, session.Game.Id, session.SpaceId, session.EffectiveGameType.ToString(), session.GameTitleSnapshot, session.Status.ToString(), attempts.Length, MaxAttempts, finalAttempt.Score, finalAttempt.MaxScore, session.CreatedAt, completedAt, session.NextAvailableAt, content, attempts);
    }
    private static Guid DeterministicAttemptId(Guid sessionId, int number)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes($"{sessionId:N}:{number}"));
        return new Guid(bytes.AsSpan(0,16));
    }
    private static UnfinishedSessionNotificationEvent BuildNotification(SessionRecord session)
    {
        var completedAt = session.CompletedAt ?? throw new InvalidOperationException("Unfinished sessions require a completion timestamp.");
        var nextAvailableAt = session.NextAvailableAt ?? throw new InvalidOperationException("Unfinished sessions require a retry timestamp.");
        return new(DeterministicId($"unfinished-notification:{session.Id:N}"), session.SpaceId, session.Game.Id, session.GameTitleSnapshot, SessionStatus.UNFINISHED.ToString(), session.Attempts.Count, session.Attempts.Count(a => !a.Evaluation.Correct), completedAt, nextAvailableAt);
    }
    private static Guid DeterministicId(string value)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value));
        return new Guid(bytes.AsSpan(0,16));
    }
    private bool IsReplayBlocked(SessionRecord session) =>
        (session.Status is SessionStatus.FAILED or SessionStatus.UNFINISHED)
        && session.NextAvailableAt is { } nextAvailableAt
        && nextAvailableAt > clock.UtcNow;
    private async Task<GameRecord> Required(Guid s,Guid id,CancellationToken ct)=>await catalog.Find(s,id,ct)??throw new DomainException("Jeu introuvable.",404);
private static string NormalizeContent(GameType t,JsonElement c) => t switch
{
    GameType.MATCHING => JsonSerializer.Serialize(new { pairs=c.GetProperty("pairs").EnumerateArray().Select(p=>new { id=Guid.NewGuid(), left=p.GetProperty("left").GetString(), right=p.GetProperty("right").GetString() }) }),
    GameType.DICTATION => JsonSerializer.Serialize(new { sentence = DictationEngine.ReadSentence(c) }),
    _ => c.GetRawText()
};
    private static GameDto Dto(GameRecord g)=>new(g.Id,g.SpaceId,g.Type.ToString(),g.Title,JsonDocument.Parse(g.Content).RootElement.Clone(),g.CreatedAt,g.UpdatedAt);
    private SessionDto SessionDtoOf(SessionRecord x,bool includeGame)
    {
        JsonElement? content=null;
        if(includeGame)
        {
            var raw=JsonDocument.Parse(x.PlayJson).RootElement;
            object safe=x.EffectiveGameType switch
            {
                GameType.MATCHING => new MatchingPlayablePublic(raw.GetProperty("Left").Deserialize<PairView[]>()!,raw.GetProperty("Right").Deserialize<PairView[]>()!),
                GameType.SENTENCE_ORDERING => new SentencePlayablePublic(raw.GetProperty("Tokens").Deserialize<Guid[]>()!,raw.GetProperty("Words").Deserialize<Dictionary<Guid,string>>()!),
                _ => JsonSerializer.Deserialize<JsonElement>(x.PlayJson)
            };
            content=JsonSerializer.SerializeToElement(safe);
        }
        return new(x.Id,x.Game.Id,x.SpaceId,x.Status.ToString(),x.Attempts.Count,MaxAttempts,x.NextAvailableAt,includeGame?new(x.Game.Id,x.EffectiveGameType.ToString(),content!.Value):null,x.InactivityDeadlineAt);
    }
}

public sealed class OutboxDispatchService(
    ActivitiesDbContext db,
    IProgressPublisher progressPublisher,
    IParentNotificationPublisher notificationPublisher,
    ILogger<OutboxDispatchService> logger)
{
    public async Task<int> DispatchPendingOnce(CancellationToken cancellationToken)
    {
        // SQLite cannot translate DateTimeOffset ordering. Sort the pending batch in memory.
        var rows = (await db.Outbox.AsNoTracking().Where(x=>x.SentAt==null).ToListAsync(cancellationToken))
            .OrderBy(x=>x.CreatedAt)
            .Take(50)
            .ToList();
        var delivered = 0;
        foreach (var row in rows)
        {
            var sent = false;
            string? error = null;
            try
            {
                switch (row.EventType)
                {
                    case "GameSessionCompleted":
                    {
                        var message = await CompletionOutboxPayloadUpgrader.ReadForDispatch(db, row, cancellationToken);
                        sent = await progressPublisher.Publish(message, cancellationToken);
                        break;
                    }
                    case "UnfinishedSessionNotification":
                    {
                        var message = JsonSerializer.Deserialize<UnfinishedSessionNotificationEvent>(row.PayloadJson) ?? throw new InvalidOperationException("Outbox payload is empty.");
                        sent = await notificationPublisher.Publish(message, cancellationToken);
                        break;
                    }
                    default: throw new InvalidOperationException($"Unknown outbox event type '{row.EventType}'.");
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception ex)
            {
                error = ex.Message;
                logger.LogError("Failed to publish outbox event {EventId} ({FailureType}).", row.EventId, ex.GetType().Name);
            }

            DateTimeOffset? sentAt = sent ? DateTimeOffset.UtcNow : null;
            await db.Outbox.Where(x=>x.EventId==row.EventId&&x.SentAt==null).ExecuteUpdateAsync(setters=>setters
                .SetProperty(x=>x.Attempts,x=>x.Attempts+1)
                .SetProperty(x=>x.SentAt,sentAt)
                .SetProperty(x=>x.LastError,error),cancellationToken);
            if (sent) delivered++;
        }
        return delivered;
    }
}

public sealed class OutboxDispatchWorker(IServiceScopeFactory scopeFactory, IOptions<GameSessionOptions> options, ILogger<OutboxDispatchWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var seconds = Math.Max(1, options.Value.ExpirationPollingIntervalSeconds);
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(seconds));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<OutboxDispatchService>().DispatchPendingOnce(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Failed to dispatch outbox events."); }
            try { await timer.WaitForNextTickAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}

public sealed class SessionExpirationWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<GameSessionOptions> sessionOptions,
    ILogger<SessionExpirationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var seconds = sessionOptions.Value.ExpirationPollingIntervalSeconds > 0 ? sessionOptions.Value.ExpirationPollingIntervalSeconds : 15;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(seconds));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var service = scope.ServiceProvider.GetRequiredService<GameService>();
                await service.ExpireDueSessions(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Failed to process inactive game sessions."); }
        }
    }
}

public sealed record MatchingPlayablePublic(PairView[] Left,PairView[] Right);
public sealed record SentencePlayablePublic(Guid[] Tokens,Dictionary<Guid,string> Words);

public sealed class DomainException(string message, int status = 400) : Exception(message) { public int Status { get; } = status; }

internal static class Parser
{
    public static decimal Parse(string expression) { if(string.IsNullOrWhiteSpace(expression)||expression.Length>256) throw new DomainException("Expression vide ou trop longue."); var p=new ExpressionParser(expression); var result=p.Sum(); p.Space(); if(!p.End) throw new DomainException($"CaractÃ¨re inattendu Ã  la position {p.Position+1}."); return result; }
    private sealed class ExpressionParser(string text)
    {
        private int i; public int Position=>i; public bool End=>i>=text.Length; public void Space(){while(!End&&char.IsWhiteSpace(text[i]))i++;}
        public decimal Sum(){var v=Product(); while(true){Space(); if(Take('+'))v=checked(v+Product()); else if(Take('-'))v=checked(v-Product()); else return v;}}
        private decimal Product(){var v=Unary(); while(true){Space(); if(Take('*'))v=checked(v*Unary()); else if(Take('/')){var d=Unary();if(d==0)throw new DomainException("La division par zÃ©ro est interdite.");v=checked(v/d);}else return v;}}
        private decimal Unary(){Space(); if(Take('+'))return Unary(); if(Take('-'))return -Unary(); if(Take('(')){var v=Sum();Space();if(!Take(')'))throw new DomainException("ParenthÃ¨se fermante manquante.");return v;} return Number();}
        private decimal Number(){Space();var start=i;var dot=false;while(!End&&(char.IsDigit(text[i])||text[i]=='.')){if(text[i]=='.'){if(dot)break;dot=true;}i++;}if(start==i||!decimal.TryParse(text[start..i],NumberStyles.AllowDecimalPoint,CultureInfo.InvariantCulture,out var n))throw new DomainException($"Nombre attendu Ã  la position {i+1}.");return n;}
        private bool Take(char c){if(!End&&text[i]==c){i++;return true;}return false;}
    }
}
