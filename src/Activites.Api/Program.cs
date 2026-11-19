using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddSingleton<IGameEngine, MathEngine>();
builder.Services.AddSingleton<IGameEngine, MatchingEngine>();
builder.Services.AddSingleton<IGameEngine, SentenceOrderingEngine>();
builder.Services.AddDbContext<ActivitiesDbContext>(options => options.UseSqlite(builder.Configuration.GetConnectionString("Activities") ?? "Data Source=activites.db"));
builder.Services.AddScoped<IGameCatalog, EfGameCatalog>();
builder.Services.AddSingleton<IProgressPublisher, NoopProgressPublisher>();
builder.Services.AddScoped<GameService>();

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddSingleton<ITestCredentialValidator, DevelopmentTestCredentialValidator>();
    builder.Services.AddSingleton<ISpaceAccess, DevelopmentSpaceAccess>();
    builder.Services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = DevelopmentTestAuthentication.Scheme;
            options.DefaultChallengeScheme = DevelopmentTestAuthentication.Scheme;
        })
        .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, DevelopmentTestAuthenticationHandler>(
            DevelopmentTestAuthentication.Scheme, _ => { });
    builder.Services.AddAuthorization();
}
else
{
    // Production must replace this with the Espaces.Api-backed access integration.
    builder.Services.AddSingleton<ISpaceAccess, DenyAllSpaceAccess>();
}

var app = builder.Build();
using (var scope = app.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<ActivitiesDbContext>(); await db.Database.EnsureCreatedAsync(); }
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.UseHttpsRedirection();
if (app.Environment.IsDevelopment())
{
    app.UseAuthentication();
    app.UseAuthorization();
}
app.Use(async (context, next) =>
{
    try { await next(); }
    catch (DomainException ex) { context.Response.StatusCode = ex.Status; await context.Response.WriteAsJsonAsync(new ProblemDetails { Status = ex.Status, Title = ex.Message }); }
});

var api = app.MapGroup("/api");
if (app.Environment.IsDevelopment()) api.RequireAuthorization();
api.MapPost("/spaces/{spaceId:guid}/games", async (Guid spaceId, CreateGameRequest request, ClaimsPrincipal user, GameService service, CancellationToken ct) => Results.Created($"/api/spaces/{spaceId}/games", await service.Create(spaceId, request, user, ct)));
api.MapGet("/spaces/{spaceId:guid}/games", async (Guid spaceId, string type, ClaimsPrincipal user, GameService service, CancellationToken ct) => await service.List(spaceId, type, user, ct));
api.MapGet("/spaces/{spaceId:guid}/games/{gameId:guid}", async (Guid spaceId, Guid gameId, ClaimsPrincipal user, GameService service, CancellationToken ct) => await service.Get(spaceId, gameId, user, ct));
api.MapPut("/spaces/{spaceId:guid}/games/{gameId:guid}", async (Guid spaceId, Guid gameId, CreateGameRequest request, ClaimsPrincipal user, GameService service, CancellationToken ct) => await service.Update(spaceId, gameId, request, user, ct));
api.MapDelete("/spaces/{spaceId:guid}/games/{gameId:guid}", async (Guid spaceId, Guid gameId, ClaimsPrincipal user, GameService service, CancellationToken ct) => { await service.Delete(spaceId, gameId, user, ct); return Results.NoContent(); });
api.MapPost("/spaces/{spaceId:guid}/games/{gameId:guid}/sessions", async (Guid spaceId, Guid gameId, ClaimsPrincipal user, GameService service, CancellationToken ct) => Results.Ok(await service.Start(spaceId, gameId, user, ct)));
api.MapGet("/spaces/{spaceId:guid}/games/{gameId:guid}/availability", async (Guid spaceId, Guid gameId, ClaimsPrincipal user, GameService service, CancellationToken ct) => await service.Availability(spaceId, gameId, user, ct));
api.MapGet("/spaces/{spaceId:guid}/sessions/{sessionId:guid}", async (Guid spaceId, Guid sessionId, ClaimsPrincipal user, GameService service, CancellationToken ct) => await service.Session(spaceId, sessionId, user, ct));
api.MapPost("/spaces/{spaceId:guid}/sessions/{sessionId:guid}/attempts", async (Guid spaceId, Guid sessionId, SubmitAttemptRequest request, ClaimsPrincipal user, GameService service, CancellationToken ct) => await service.Submit(spaceId, sessionId, request, user, ct));
app.Run();

public partial class Program;

public enum GameType { MATH, MATCHING, SENTENCE_ORDERING }
public enum SessionStatus { ACTIVE, SUCCESS, FAILED }
public sealed record CreateGameRequest(string Type, JsonElement Content, string? Title = null);
public sealed record SubmitAttemptRequest(string IdempotencyKey, JsonElement Answer);
public sealed record GameDto(Guid Id, Guid SpaceId, string Type, string? Title, JsonElement Content, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public sealed record PlayableGame(Guid GameId, string Type, JsonElement Content);
public sealed record SessionDto(Guid Id, Guid GameId, Guid SpaceId, string Status, int AttemptsUsed, int MaxAttempts, DateTimeOffset? NextAvailableAt, PlayableGame? Game);
public sealed record AttemptDto(Guid Id, int Number, bool Correct, int Score, int MaxScore, DateTimeOffset SubmittedAt, int AttemptsRemaining, string Status, JsonElement? Correction, DateTimeOffset? NextAvailableAt);
public sealed record AvailabilityDto(bool Available, DateTimeOffset? NextAvailableAt);
public sealed record Evaluation(bool Correct, int Score, int MaxScore, object? Correction);
public sealed record PairInput(string Left, string Right);
public sealed record PairView(Guid Id, string Left);
public sealed record MatchingPlayable(PairView[] Left, PairView[] Right, Dictionary<Guid, Guid> CorrectMatches);
public sealed record MatchingAnswer(Dictionary<Guid, Guid> Matches);
public sealed record SentencePlayable(Guid[] Tokens, Dictionary<Guid, string> Words, Guid[] CorrectOrder);
public sealed record SentenceAnswer(Guid[] Tokens);

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
        if (!answer.TryGetProperty("value", out var value) || !value.TryGetDecimal(out var actual)) throw new DomainException("La réponse doit contenir un nombre décimal nommé 'value'.");
        var correct = Math.Abs(expected - actual) <= 0.000001m;
        return new(correct, correct ? 1 : 0, 1, expected);
    }
    private static string ReadString(JsonElement content) => content.ValueKind == JsonValueKind.String ? content.GetString()! : content.TryGetProperty("expression", out var e) && e.ValueKind == JsonValueKind.String ? e.GetString()! : throw new DomainException("Le contenu MATH doit contenir 'expression'.");
}

public sealed class MatchingEngine : IGameEngine
{
    public GameType Type => GameType.MATCHING;
    public void Validate(JsonElement content) => _ = Pairs(content);
    public object Generate(JsonElement content)
    {
        var pairs = Pairs(content).Select(p => (LeftId: Guid.NewGuid(), RightId: Guid.NewGuid(), p.Left, p.Right)).ToArray();
        return new MatchingPlayable(pairs.Select(x => new PairView(x.LeftId, x.Left)).OrderBy(_ => Random.Shared.Next()).ToArray(), pairs.Select(x => new PairView(x.RightId, x.Right)).OrderBy(_ => Random.Shared.Next()).ToArray(), pairs.ToDictionary(x=>x.LeftId,x=>x.RightId));
    }
    public Evaluation Evaluate(JsonElement content, JsonElement answer, JsonElement playable = default)
    {
        var pairs = Pairs(content); var submitted = answer.Deserialize<MatchingAnswer>()?.Matches ?? throw new DomainException("La réponse doit contenir les associations 'matches'.");
        if (submitted.Count != pairs.Length) throw new DomainException("Soumettez une association pour chaque paire.");
        if(playable.ValueKind==JsonValueKind.Undefined) throw new DomainException("État jouable manquant.",500);
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
            if (string.IsNullOrWhiteSpace(left) || string.IsNullOrWhiteSpace(right)) throw new DomainException("Chaque paire doit avoir un mot et une définition.");
            rows.Add((id, left, right));
        }
        if (rows.Select(x => x.Item1).Distinct().Count() != rows.Count || rows.Select(x => x.Item2).Distinct(StringComparer.OrdinalIgnoreCase).Count() != rows.Count || rows.Select(x => x.Item3).Distinct(StringComparer.OrdinalIgnoreCase).Count() != rows.Count) throw new DomainException("Les identifiants, mots et définitions doivent être uniques.");
        return rows.Select(x => (x.Item1, x.Item2, x.Item3)).ToArray();
    }
}

public sealed class SentenceOrderingEngine : IGameEngine
{
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
        var source = Tokens(content); var submitted = answer.Deserialize<SentenceAnswer>()?.Tokens ?? throw new DomainException("La réponse doit contenir la liste 'tokens'.");
        if(playable.ValueKind==JsonValueKind.Undefined) throw new DomainException("État jouable manquant.",500);
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
        if (tokens.Length < 2) throw new DomainException("La phrase doit contenir au moins deux éléments.");
        return tokens;
    }
}

public interface IClock { DateTimeOffset UtcNow { get; } }
public sealed class SystemClock : IClock { public DateTimeOffset UtcNow => DateTimeOffset.UtcNow; }
public sealed record GameRecord(Guid Id, Guid SpaceId, GameType Type, string? Title, string Content, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public sealed class SessionRecord
{
    public Guid Id { get; init; } = Guid.NewGuid(); public Guid SpaceId { get; init; } public GameRecord Game { get; init; } = null!; public DateTimeOffset CreatedAt { get; init; }
    public SessionStatus Status { get; set; } = SessionStatus.ACTIVE; public DateTimeOffset? CompletedAt { get; set; } public DateTimeOffset? NextAvailableAt { get; set; }
    public string PlayJson { get; set; } = "{}"; public List<AttemptRecord> Attempts { get; } = []; public Dictionary<string, AttemptDto> Idempotency { get; } = new(StringComparer.Ordinal);
}
public sealed record AttemptRecord(int Number, string Answer, Evaluation Evaluation, DateTimeOffset At);
public interface IGameCatalog
{
    Task<GameRecord?> Find(Guid space, Guid game, CancellationToken ct); Task<List<GameRecord>> List(Guid space, CancellationToken ct); Task Save(GameRecord game, CancellationToken ct); Task Remove(GameRecord game, CancellationToken ct);
    Task<SessionRecord?> GetSession(Guid id, CancellationToken ct); Task<List<SessionRecord>> Sessions(Guid space, Guid game, CancellationToken ct); Task SaveSession(SessionRecord session, CancellationToken ct);
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
    public Task SaveSession(SessionRecord s, CancellationToken ct) { sessions[s.Id] = s; return Task.CompletedTask; }
}

public sealed class ActivitiesDbContext(DbContextOptions<ActivitiesDbContext> options) : DbContext(options)
{
    public DbSet<GameRow> Games => Set<GameRow>();
    public DbSet<SessionRow> Sessions => Set<SessionRow>();
    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<GameRow>().HasKey(x => x.Id);
        model.Entity<GameRow>().HasIndex(x => new { x.SpaceId, x.Type });
        model.Entity<SessionRow>().HasKey(x => x.Id);
        model.Entity<SessionRow>().HasIndex(x => new { x.SpaceId, x.GameId, x.Status });
        model.Entity<SessionRow>().HasOne<GameRow>().WithMany().HasForeignKey(x => x.GameId).OnDelete(DeleteBehavior.Restrict);
    }
}
public sealed class GameRow { public Guid Id { get; set; } public Guid SpaceId { get; set; } public string Type { get; set; } = ""; public string? Title { get; set; } public string Content { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } public DateTimeOffset UpdatedAt { get; set; } }
public sealed class SessionRow { public Guid Id { get; set; } public Guid SpaceId { get; set; } public Guid GameId { get; set; } public string Status { get; set; } = "ACTIVE"; public DateTimeOffset CreatedAt { get; set; } public DateTimeOffset? CompletedAt { get; set; } public DateTimeOffset? NextAvailableAt { get; set; } public string PlayJson { get; set; } = "{}"; public string AttemptsJson { get; set; } = "[]"; public string IdempotencyJson { get; set; } = "{}"; }
public sealed class EfGameCatalog(ActivitiesDbContext db) : IGameCatalog
{
    public async Task<GameRecord?> Find(Guid space, Guid game, CancellationToken ct) { var x=await db.Games.SingleOrDefaultAsync(x=>x.Id==game&&x.SpaceId==space,ct); return x==null?null:ToRecord(x); }
    public async Task<List<GameRecord>> List(Guid space,CancellationToken ct)=>(await db.Games.Where(x=>x.SpaceId==space).ToListAsync(ct)).Select(ToRecord).ToList();
    public async Task Save(GameRecord g,CancellationToken ct) { var x=await db.Games.FindAsync([g.Id],ct); if(x==null){x=new GameRow{Id=g.Id};db.Games.Add(x);} x.SpaceId=g.SpaceId;x.Type=g.Type.ToString();x.Title=g.Title;x.Content=g.Content;x.CreatedAt=g.CreatedAt;x.UpdatedAt=g.UpdatedAt;await db.SaveChangesAsync(ct); }
    public async Task Remove(GameRecord g,CancellationToken ct) { var x=await db.Games.FindAsync([g.Id],ct);if(x!=null){db.Games.Remove(x);await db.SaveChangesAsync(ct);} }
    public async Task<SessionRecord?> GetSession(Guid id,CancellationToken ct) { var x=await db.Sessions.SingleOrDefaultAsync(x=>x.Id==id,ct);return x==null?null:await ToSession(x,ct); }
    public async Task<List<SessionRecord>> Sessions(Guid space,Guid game,CancellationToken ct) { var rows=await db.Sessions.Where(x=>x.SpaceId==space&&x.GameId==game).ToListAsync(ct);var result=new List<SessionRecord>();foreach(var row in rows)result.Add((await ToSession(row,ct))!);return result; }
    public async Task SaveSession(SessionRecord s,CancellationToken ct) { var x=await db.Sessions.FindAsync([s.Id],ct);if(x==null){x=new SessionRow{Id=s.Id};db.Sessions.Add(x);}x.SpaceId=s.SpaceId;x.GameId=s.Game.Id;x.Status=s.Status.ToString();x.CreatedAt=s.CreatedAt;x.CompletedAt=s.CompletedAt;x.NextAvailableAt=s.NextAvailableAt;x.PlayJson=s.PlayJson;x.AttemptsJson=JsonSerializer.Serialize(s.Attempts);x.IdempotencyJson=JsonSerializer.Serialize(s.Idempotency);await db.SaveChangesAsync(ct); }
    private async Task<SessionRecord?> ToSession(SessionRow r,CancellationToken ct) { var g=await db.Games.SingleOrDefaultAsync(g=>g.Id==r.GameId,ct);if(g==null)return null;var s=new SessionRecord{Id=r.Id,SpaceId=r.SpaceId,Game=ToRecord(g),CreatedAt=r.CreatedAt,Status=Enum.Parse<SessionStatus>(r.Status),CompletedAt=r.CompletedAt,NextAvailableAt=r.NextAvailableAt,PlayJson=r.PlayJson};s.Attempts.AddRange(JsonSerializer.Deserialize<List<AttemptRecord>>(r.AttemptsJson)??[]);foreach(var kv in JsonSerializer.Deserialize<Dictionary<string,AttemptDto>>(r.IdempotencyJson)??[])s.Idempotency[kv.Key]=kv.Value;return s; }
    private static GameRecord ToRecord(GameRow x)=>new(x.Id,x.SpaceId,Enum.Parse<GameType>(x.Type),x.Title,x.Content,x.CreatedAt,x.UpdatedAt);
}
public interface ISpaceAccess { Task<bool> CanAccess(Guid spaceId, ClaimsPrincipal user, string activityType, CancellationToken ct); }
public interface IProgressPublisher { Task Publish(object message, CancellationToken ct); }
public sealed class NoopProgressPublisher : IProgressPublisher { public Task Publish(object message, CancellationToken ct) => Task.CompletedTask; }

public sealed class GameService(IGameCatalog catalog, IEnumerable<IGameEngine> engines, ISpaceAccess access, IClock clock, IProgressPublisher publisher)
{
    private const int MaxAttempts = 3; private static readonly TimeSpan Cooldown = TimeSpan.FromHours(24);
    private IGameEngine Engine(GameType t) => engines.Single(x => x.Type == t);
    private static GameType ParseType(string type) => Enum.TryParse<GameType>(type, true, out var t) ? t : throw new DomainException("Type d'activité inconnu.");
    private async Task Ensure(Guid space, ClaimsPrincipal user, GameType type, CancellationToken ct) { if (!await access.CanAccess(space, user, type.ToString(), ct)) throw new DomainException("Accès à l'espace ou à ce type d'activité refusé.", 403); }
    public async Task<GameDto> Create(Guid s, CreateGameRequest r, ClaimsPrincipal u, CancellationToken ct) { var t = ParseType(r.Type); await Ensure(s,u,t,ct); Engine(t).Validate(r.Content); var now=clock.UtcNow; var g=new GameRecord(Guid.NewGuid(),s,t,r.Title,NormalizeContent(t,r.Content),now,now); await catalog.Save(g,ct); return Dto(g); }
    public async Task<List<GameDto>> List(Guid s,string type,ClaimsPrincipal u,CancellationToken ct) { var t=ParseType(type); await Ensure(s,u,t,ct); return (await catalog.List(s,ct)).Where(x=>x.Type==t).Select(Dto).ToList(); }
    public async Task<GameDto> Get(Guid s,Guid id,ClaimsPrincipal u,CancellationToken ct) { var g=await Required(s,id,ct); await Ensure(s,u,g.Type,ct); return Dto(g); }
    public async Task<GameDto> Update(Guid s,Guid id,CreateGameRequest r,ClaimsPrincipal u,CancellationToken ct) { var g=await Required(s,id,ct); var t=ParseType(r.Type); await Ensure(s,u,g.Type,ct); await Ensure(s,u,t,ct); Engine(t).Validate(r.Content); var n=g with {Type=t,Title=r.Title,Content=NormalizeContent(t,r.Content),UpdatedAt=clock.UtcNow}; await catalog.Save(n,ct); return Dto(n); }
    public async Task Delete(Guid s,Guid id,ClaimsPrincipal u,CancellationToken ct) { var g=await Required(s,id,ct); await Ensure(s,u,g.Type,ct); if ((await catalog.Sessions(s,id,ct)).Any(x=>x.Status==SessionStatus.ACTIVE)) throw new DomainException("Le jeu possède une session active.",409); await catalog.Remove(g,ct); }
    public async Task<SessionDto> Start(Guid s,Guid id,ClaimsPrincipal u,CancellationToken ct)
    {
        var g=await Required(s,id,ct); await Ensure(s,u,g.Type,ct); var existing=await catalog.Sessions(s,id,ct); var active=existing.FirstOrDefault(x=>x.Status==SessionStatus.ACTIVE); if(active!=null) return SessionDtoOf(active,true);
        var blocked=existing.Where(x=>x.Status==SessionStatus.FAILED&&x.NextAvailableAt>clock.UtcNow).OrderByDescending(x=>x.NextAvailableAt).FirstOrDefault(); if(blocked!=null) throw new DomainException($"Jeu indisponible jusqu'à {blocked.NextAvailableAt:O}.",409);
        var session=new SessionRecord{SpaceId=s,Game=g,CreatedAt=clock.UtcNow,PlayJson=JsonSerializer.Serialize(Engine(g.Type).Generate(JsonDocument.Parse(g.Content).RootElement))}; await catalog.SaveSession(session,ct); return SessionDtoOf(session,true);
    }
    public async Task<AvailabilityDto> Availability(Guid s,Guid id,ClaimsPrincipal u,CancellationToken ct) { var g=await Required(s,id,ct); await Ensure(s,u,g.Type,ct); var wait=(await catalog.Sessions(s,id,ct)).Where(x=>x.Status==SessionStatus.FAILED&&x.NextAvailableAt>clock.UtcNow).OrderByDescending(x=>x.NextAvailableAt).FirstOrDefault(); return new(wait==null,wait?.NextAvailableAt); }
    public async Task<SessionDto> Session(Guid s,Guid id,ClaimsPrincipal u,CancellationToken ct) { var x=await catalog.GetSession(id,ct); if(x==null||x.SpaceId!=s) throw new DomainException("Session introuvable.",404); await Ensure(s,u,x.Game.Type,ct); return SessionDtoOf(x,x.Status==SessionStatus.ACTIVE); }
    public async Task<AttemptDto> Submit(Guid s,Guid sid,SubmitAttemptRequest r,ClaimsPrincipal u,CancellationToken ct)
    {
        if(string.IsNullOrWhiteSpace(r.IdempotencyKey)||r.IdempotencyKey.Length>128) throw new DomainException("Un IdempotencyKey valide est requis."); var x=await catalog.GetSession(sid,ct); if(x==null||x.SpaceId!=s) throw new DomainException("Session introuvable.",404); await Ensure(s,u,x.Game.Type,ct);
        AttemptDto dto; object eventMessage;
        lock(x) { if(x.Idempotency.TryGetValue(r.IdempotencyKey,out var cached)) return cached; if(x.Status!=SessionStatus.ACTIVE) throw new DomainException("Cette session est terminée.",409); if(x.Attempts.Count>=MaxAttempts) throw new DomainException("Limite de tentatives atteinte.",409);
            var result=Engine(x.Game.Type).Evaluate(JsonDocument.Parse(x.Game.Content).RootElement,r.Answer,JsonDocument.Parse(x.PlayJson).RootElement); var now=clock.UtcNow; var number=x.Attempts.Count+1; x.Attempts.Add(new(number,r.Answer.GetRawText(),result,now));
            if(result.Correct) { x.Status=SessionStatus.SUCCESS; x.CompletedAt=now; } else if(number==MaxAttempts) { x.Status=SessionStatus.FAILED; x.CompletedAt=now; x.NextAvailableAt=now+Cooldown; }
            dto=new AttemptDto(Guid.NewGuid(),number,result.Correct,result.Score,result.MaxScore,now,MaxAttempts-number,x.Status.ToString(),x.Status==SessionStatus.FAILED?JsonSerializer.SerializeToElement(result.Correction):null,x.NextAvailableAt); x.Idempotency[r.IdempotencyKey]=dto;
            eventMessage=new { sessionId=x.Id,spaceId=s,gameId=x.Game.Id,attempt=number,answer=r.Answer,result=result.Correct,score=result.Score,status=x.Status.ToString(),occurredAt=now }; }
        await catalog.SaveSession(x,ct); await publisher.Publish(eventMessage,ct); return dto;
    }
    private async Task<GameRecord> Required(Guid s,Guid id,CancellationToken ct)=>await catalog.Find(s,id,ct)??throw new DomainException("Jeu introuvable.",404);
    private static string NormalizeContent(GameType t,JsonElement c) => t==GameType.MATCHING ? JsonSerializer.Serialize(new { pairs=c.GetProperty("pairs").EnumerateArray().Select(p=>new { id=Guid.NewGuid(), left=p.GetProperty("left").GetString(), right=p.GetProperty("right").GetString() }) }) : c.GetRawText();
    private static GameDto Dto(GameRecord g)=>new(g.Id,g.SpaceId,g.Type.ToString(),g.Title,JsonDocument.Parse(g.Content).RootElement.Clone(),g.CreatedAt,g.UpdatedAt);
    private SessionDto SessionDtoOf(SessionRecord x,bool includeGame)
    {
        JsonElement? content=null;
        if(includeGame)
        {
            var raw=JsonDocument.Parse(x.PlayJson).RootElement;
            object safe=x.Game.Type switch
            {
                GameType.MATCHING => new MatchingPlayablePublic(raw.GetProperty("Left").Deserialize<PairView[]>()!,raw.GetProperty("Right").Deserialize<PairView[]>()!),
                GameType.SENTENCE_ORDERING => new SentencePlayablePublic(raw.GetProperty("Tokens").Deserialize<Guid[]>()!,raw.GetProperty("Words").Deserialize<Dictionary<Guid,string>>()!),
                _ => JsonSerializer.Deserialize<JsonElement>(x.PlayJson)
            };
            content=JsonSerializer.SerializeToElement(safe);
        }
        return new(x.Id,x.Game.Id,x.SpaceId,x.Status.ToString(),x.Attempts.Count,MaxAttempts,x.NextAvailableAt,includeGame?new(x.Game.Id,x.Game.Type.ToString(),content!.Value):null);
    }
}
public sealed record MatchingPlayablePublic(PairView[] Left,PairView[] Right);
public sealed record SentencePlayablePublic(Guid[] Tokens,Dictionary<Guid,string> Words);

public sealed class DomainException(string message, int status = 400) : Exception(message) { public int Status { get; } = status; }

internal static class Parser
{
    public static decimal Parse(string expression) { if(string.IsNullOrWhiteSpace(expression)||expression.Length>256) throw new DomainException("Expression vide ou trop longue."); var p=new ExpressionParser(expression); var result=p.Sum(); p.Space(); if(!p.End) throw new DomainException($"Caractère inattendu à la position {p.Position+1}."); return result; }
    private sealed class ExpressionParser(string text)
    {
        private int i; public int Position=>i; public bool End=>i>=text.Length; public void Space(){while(!End&&char.IsWhiteSpace(text[i]))i++;}
        public decimal Sum(){var v=Product(); while(true){Space(); if(Take('+'))v=checked(v+Product()); else if(Take('-'))v=checked(v-Product()); else return v;}}
        private decimal Product(){var v=Unary(); while(true){Space(); if(Take('*'))v=checked(v*Unary()); else if(Take('/')){var d=Unary();if(d==0)throw new DomainException("La division par zéro est interdite.");v=checked(v/d);}else return v;}}
        private decimal Unary(){Space(); if(Take('+'))return Unary(); if(Take('-'))return -Unary(); if(Take('(')){var v=Sum();Space();if(!Take(')'))throw new DomainException("Parenthèse fermante manquante.");return v;} return Number();}
        private decimal Number(){Space();var start=i;var dot=false;while(!End&&(char.IsDigit(text[i])||text[i]=='.')){if(text[i]=='.'){if(dot)break;dot=true;}i++;}if(start==i||!decimal.TryParse(text[start..i],NumberStyles.AllowDecimalPoint,CultureInfo.InvariantCulture,out var n))throw new DomainException($"Nombre attendu à la position {i+1}.");return n;}
        private bool Take(char c){if(!End&&text[i]==c){i++;return true;}return false;}
    }
}
