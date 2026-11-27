using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Suivi.Api.Application;
using Suivi.Api.Domain.Exceptions;
using Suivi.Api.Infrastructure.Messaging;
using Suivi.Api.Infrastructure.Persistence;
using Suivi.Api.Infrastructure.Security;
using EduKids.Security;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Suivi.Api", Version = "v1" });
});

builder.Services.AddDbContext<SuiviDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Suivi") ?? "Data Source=suivi.db"));
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient();
builder.Services.AddScoped<EspacesApiAuthorization>();
builder.Services.AddScoped<ISuiviSpaceAccess, EduKidsSuiviSpaceAccess>();

builder.Services.AddScoped<SessionIngestionService>();
builder.Services.AddScoped<ISessionIngestionService>(services =>
    services.GetRequiredService<SessionIngestionService>());
builder.Services.AddScoped<ProgressService>();

builder.Services
    .AddOptions<RabbitMqOptions>()
    .Bind(builder.Configuration.GetSection(RabbitMqOptions.SectionName))
    .Validate(options =>
        !string.IsNullOrWhiteSpace(options.HostName)
        && options.Port is > 0 and <= 65535
        && !string.IsNullOrWhiteSpace(options.Username)
        && !string.IsNullOrWhiteSpace(options.Password)
        && options.PrefetchCount > 0
        && options.MaxDeliveryAttempts > 0
        && options.InitialReconnectDelaySeconds > 0
        && options.MaxReconnectDelaySeconds >= options.InitialReconnectDelaySeconds,
        "RabbitMq settings must specify valid connection credentials, prefetch, delivery, and retry limits.")
    .ValidateOnStart();
builder.Services.AddSingleton<GameSessionCompletedMessageProcessor>();
builder.Services.AddHostedService<GameSessionCompletedConsumer>();

var authentication = builder.Services.AddEduKidsJwtBearer(builder.Configuration);
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddSingleton<SuiviDevCredentialValidator>();
    authentication.AddScheme<AuthenticationSchemeOptions, SuiviDevAuthHandler>(SuiviDevAuth.Scheme, _ => { });
}
builder.Services.AddAuthorization(options => options.AddPolicy("ParentOnly", policy => policy.RequireRole("Parent")));

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

if (!app.Environment.IsDevelopment())
    app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

// â”€â”€ Global error handling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.MapGet("/health", () => Results.Ok(new { status = "Healthy" }))
    .WithTags("Infrastructure");

// â”€â”€ Progress API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
var progress = app.MapGroup("/api/progress");

progress.RequireAuthorization("ParentOnly");

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

// â”€â”€ Dev-only event injection endpoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        .RequireAuthorization("ParentOnly")
        .WithTags("Dev")
        .WithSummary("[DEV ONLY] Inject a GameSessionCompleted event for Postman testing.");
}

app.Run();

public partial class Program;

public sealed class EduKidsSuiviSpaceAccess(EspacesApiAuthorization spaces) : ISuiviSpaceAccess
{
    public Task<bool> CanAccess(Guid spaceId, System.Security.Claims.ClaimsPrincipal user, CancellationToken ct) =>
        spaces.ParentOwnsSpace(spaceId, user, ct);
}
