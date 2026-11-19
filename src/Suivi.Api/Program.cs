using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Suivi.Api.Application;
using Suivi.Api.Domain.Exceptions;
using Suivi.Api.Infrastructure.Persistence;
using Suivi.Api.Infrastructure.Security;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Suivi.Api", Version = "v1" });
});

builder.Services.AddDbContext<SuiviDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Suivi") ?? "Data Source=suivi.db"));

builder.Services.AddScoped<SessionIngestionService>();
builder.Services.AddScoped<ProgressService>();

// Auth: dev-only test scheme; production must wire Espaces.Api JWT.
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddSingleton<SuiviDevCredentialValidator>();
    builder.Services.AddSingleton<ISuiviSpaceAccess, DevelopmentSuiviSpaceAccess>();
    builder.Services
        .AddAuthentication(opts =>
        {
            opts.DefaultAuthenticateScheme = SuiviDevAuth.Scheme;
            opts.DefaultChallengeScheme = SuiviDevAuth.Scheme;
        })
        .AddScheme<AuthenticationSchemeOptions, SuiviDevAuthHandler>(SuiviDevAuth.Scheme, _ => { });
    builder.Services.AddAuthorization();
}
else
{
    builder.Services.AddSingleton<ISuiviSpaceAccess, DenyAllSuiviSpaceAccess>();
}

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SuiviDbContext>();
    await db.Database.MigrateAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

if (app.Environment.IsDevelopment())
{
    app.UseAuthentication();
    app.UseAuthorization();
}

// ── Global error handling ─────────────────────────────────────────────────────
app.Use(async (ctx, next) =>
{
    try
    {
        await next();
    }
    catch (SuiviDomainException ex)
    {
        ctx.Response.StatusCode = ex.StatusCode;
        await ctx.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = ex.StatusCode,
            Title = ex.Message
        });
    }
    catch (Exception ex)
    {
        ctx.Response.StatusCode = 500;
        await ctx.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = 500,
            Title = "An unexpected error occurred.",
            Detail = app.Environment.IsDevelopment() ? ex.ToString() : null
        });
    }
});

// ── Health ────────────────────────────────────────────────────────────────────
app.MapGet("/health", () => Results.Ok(new { status = "Healthy" }))
    .WithTags("Infrastructure");

// ── Progress API ──────────────────────────────────────────────────────────────
var progress = app.MapGroup("/api/progress");

if (app.Environment.IsDevelopment())
    progress.RequireAuthorization();

// Summary
progress.MapGet("/spaces/{spaceId:guid}/summary",
    async (Guid spaceId, ProgressService svc, ISuiviSpaceAccess access,
           System.Security.Claims.ClaimsPrincipal user, CancellationToken ct) =>
    {
        if (!await access.CanAccess(spaceId, user, ct))
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        return Results.Ok(await svc.GetSummaryAsync(spaceId, ct));
    });

// History with filtering
progress.MapGet("/spaces/{spaceId:guid}/history",
    async (Guid spaceId,
           string? gameType, string? finalStatus,
           DateTimeOffset? from, DateTimeOffset? to,
           string? sortOrder,
           ProgressService svc, ISuiviSpaceAccess access,
           System.Security.Claims.ClaimsPrincipal user, CancellationToken ct,
           int page = 1, int pageSize = 20) =>
    {
        if (!await access.CanAccess(spaceId, user, ct))
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        var req = new HistoryRequest(spaceId, gameType, finalStatus, from, to, sortOrder, page, pageSize);
        return Results.Ok(await svc.GetHistoryAsync(req, ct));
    });

// Game history
progress.MapGet("/spaces/{spaceId:guid}/games/{gameId:guid}/history",
    async (Guid spaceId, Guid gameId,
           ProgressService svc, ISuiviSpaceAccess access,
           System.Security.Claims.ClaimsPrincipal user, CancellationToken ct) =>
    {
        if (!await access.CanAccess(spaceId, user, ct))
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        return Results.Ok(await svc.GetGameHistoryAsync(spaceId, gameId, ct));
    });

// Session detail
progress.MapGet("/spaces/{spaceId:guid}/sessions/{sessionId:guid}",
    async (Guid spaceId, Guid sessionId,
           ProgressService svc, ISuiviSpaceAccess access,
           System.Security.Claims.ClaimsPrincipal user, CancellationToken ct) =>
    {
        if (!await access.CanAccess(spaceId, user, ct))
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        var result = await svc.GetSessionDetailAsync(spaceId, sessionId, ct);
        return result is null ? Results.NotFound() : Results.Ok(result);
    });

// Statistics by game type
progress.MapGet("/spaces/{spaceId:guid}/statistics/by-type",
    async (Guid spaceId,
           ProgressService svc, ISuiviSpaceAccess access,
           System.Security.Claims.ClaimsPrincipal user, CancellationToken ct) =>
    {
        if (!await access.CanAccess(spaceId, user, ct))
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        return Results.Ok(await svc.GetStatsByTypeAsync(spaceId, ct));
    });

// ── Dev-only event injection endpoint ────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.MapPost("/api/dev/events/game-session-completed",
        async (GameSessionCompletedEvent evt, SessionIngestionService ingestion,
               ISuiviSpaceAccess access, System.Security.Claims.ClaimsPrincipal user, CancellationToken ct) =>
        {
            if (!await access.CanAccess(evt.SpaceId, user, ct))
                return Results.StatusCode(StatusCodes.Status403Forbidden);

            var created = await ingestion.IngestAsync(evt, ct);
            return created
                ? Results.Created($"/api/progress/spaces/{evt.SpaceId}/sessions/{evt.SessionId}", new { evt.EventId, evt.SessionId })
                : Results.Ok(new { message = "Event already processed (idempotent).", evt.EventId, evt.SessionId });
        })
        .RequireAuthorization()
        .WithTags("Dev")
        .WithSummary("[DEV ONLY] Inject a GameSessionCompleted event for Postman testing.");
}

app.Run();

public partial class Program;
