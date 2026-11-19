using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Suivi.Api.Domain.Model;
using Suivi.Api.Infrastructure.Persistence;

namespace Suivi.Api.Application;

// ─────────────────────────────────────────────────────────────────────────────
// DTOs for parent dashboard
// ─────────────────────────────────────────────────────────────────────────────

public sealed record SpaceSummaryDto(
    Guid SpaceId,
    int TotalSessions,
    int SuccessfulSessions,
    int FailedSessions,
    int UnfinishedSessions,
    /// <summary>
    /// successRate = (successfulSessions / totalSessions) * 100
    /// Returns 0 when totalSessions is 0 (no division-by-zero).
    /// </summary>
    decimal SuccessRate,
    decimal AverageAttemptsPerSession,
    /// <summary>
    /// averageNormalizedScore = average of (session.FinalScore / session.FinalMaxScore)
    /// Sessions without a positive final maximum score are excluded.
    /// </summary>
    decimal AverageNormalizedScore);

public sealed record SessionSummaryDto(
    Guid SessionId,
    Guid GameId,
    string? GameTitle,
    string GameType,
    string FinalStatus,
    int AttemptsUsed,
    int MaxAttempts,
    decimal FinalScore,
    decimal? FinalMaxScore,
    DateTimeOffset StartedAt,
    DateTimeOffset CompletedAt,
    DateTimeOffset? NextAvailableAt);

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);

public sealed record AttemptDto(
    Guid AttemptId,
    int AttemptNumber,
    string SubmittedAnswer,
    bool Correct,
    decimal Score,
    decimal MaxScore,
    DateTimeOffset SubmittedAt);

public sealed record SessionDetailDto(
    Guid SessionId,
    Guid GameId,
    Guid SpaceId,
    string? GameTitle,
    string GameType,
    string FinalStatus,
    int AttemptsUsed,
    int MaxAttempts,
    decimal FinalScore,
    decimal? FinalMaxScore,
    DateTimeOffset StartedAt,
    DateTimeOffset CompletedAt,
    DateTimeOffset? NextAvailableAt,
    string GameContentSnapshot,
    IReadOnlyList<AttemptDto> Attempts);

public sealed record GameTypeStatsDto(
    string GameType,
    int TotalSessions,
    int SuccessfulSessions,
    int FailedSessions,
    int UnfinishedSessions,
    decimal SuccessRate,
    decimal AverageNormalizedScore);

public sealed record HistoryRequest(
    Guid SpaceId,
    string? GameType,
    string? FinalStatus,
    DateTimeOffset? From,
    DateTimeOffset? To,
    string? SortOrder,
    int Page = 1,
    int PageSize = 20);

// ─────────────────────────────────────────────────────────────────────────────
// Progress Service
// ─────────────────────────────────────────────────────────────────────────────

public sealed class ProgressService(SuiviDbContext db)
{
    private const int MaxPageSize = 100;

    // ── Summary ───────────────────────────────────────────────────────────────

    public async Task<SpaceSummaryDto> GetSummaryAsync(Guid spaceId, CancellationToken ct)
    {
        var sessions = await db.CompletedSessions
            .Where(s => s.SpaceId == spaceId)
            .ToListAsync(ct);

        return BuildSummary(spaceId, sessions);
    }

    // ── History (paginated, filtered) ─────────────────────────────────────────

    public async Task<PagedResult<SessionSummaryDto>> GetHistoryAsync(HistoryRequest req, CancellationToken ct)
    {
        var pageSize = Math.Clamp(req.PageSize, 1, MaxPageSize);
        var page = Math.Max(1, req.Page);

        IQueryable<CompletedGameSession> query = db.CompletedSessions
            .Where(s => s.SpaceId == req.SpaceId);

        if (!string.IsNullOrWhiteSpace(req.GameType) &&
            Enum.TryParse<GameType>(req.GameType, true, out var gt))
            query = query.Where(s => s.GameType == gt);

        if (!string.IsNullOrWhiteSpace(req.FinalStatus) &&
            Enum.TryParse<SessionFinalStatus>(req.FinalStatus, true, out var fs))
            query = query.Where(s => s.FinalStatus == fs);

        // SQLite EF8 cannot translate DateTimeOffset comparisons or ordering.
        // Keep space/type/status filtering in SQL and apply the date window in memory.
        var candidates = await query.AsNoTracking().ToListAsync(ct);
        var from = req.From?.ToUniversalTime();
        var to = req.To?.ToUniversalTime();
        var allFiltered = candidates
            .Where(s => !from.HasValue || s.CompletedAt >= from.Value)
            .Where(s => !to.HasValue || s.CompletedAt <= to.Value)
            .ToList();
        var total = allFiltered.Count;

        var sortedItems = req.SortOrder?.ToLower() == "asc"
            ? allFiltered.OrderBy(s => s.CompletedAt.UtcTicks).ThenBy(s => s.SessionId).ToList()
            : allFiltered.OrderByDescending(s => s.CompletedAt.UtcTicks).ThenBy(s => s.SessionId).ToList();

        var offset = (long)(page - 1) * pageSize;
        var items = offset >= sortedItems.Count
            ? []
            : sortedItems.Skip((int)offset).Take(pageSize).ToList();
        return new PagedResult<SessionSummaryDto>(
            items.Select(ToSummaryDto).ToList(),
            page,
            pageSize,
            total,
            (int)Math.Ceiling(total / (double)pageSize));
    }

    // ── Game history ──────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<SessionSummaryDto>> GetGameHistoryAsync(
        Guid spaceId, Guid gameId, CancellationToken ct)
    {
        var sessions = await db.CompletedSessions
            .Where(s => s.SpaceId == spaceId && s.GameId == gameId)
            .AsNoTracking()
            .ToListAsync(ct);

        return sessions
            .OrderByDescending(s => s.CompletedAt.UtcTicks)
            .ThenBy(s => s.SessionId)
            .Select(ToSummaryDto)
            .ToList();
    }

    // ── Session detail ────────────────────────────────────────────────────────

    public async Task<SessionDetailDto?> GetSessionDetailAsync(
        Guid spaceId, Guid sessionId, CancellationToken ct)
    {
        var session = await db.CompletedSessions
            .Include(s => s.Attempts.OrderBy(a => a.AttemptNumber))
            .FirstOrDefaultAsync(s => s.SpaceId == spaceId && s.SessionId == sessionId, ct);

        if (session is null)
            return null;

        return new SessionDetailDto(
            session.SessionId,
            session.GameId,
            session.SpaceId,
            session.GameTitle,
            session.GameType.ToString(),
            session.FinalStatus.ToString(),
            session.AttemptsUsed,
            session.MaxAttempts,
            session.FinalScore,
            session.FinalMaxScore,
            session.StartedAt,
            session.CompletedAt,
            session.NextAvailableAt,
            session.GameContentSnapshot,
            session.Attempts.Select(a => new AttemptDto(
                a.AttemptId,
                a.AttemptNumber,
                a.SubmittedAnswer,
                a.Correct,
                a.Score,
                a.MaxScore,
                a.SubmittedAt)).ToList());
    }

    // ── Statistics by game type ───────────────────────────────────────────────

    public async Task<IReadOnlyList<GameTypeStatsDto>> GetStatsByTypeAsync(
        Guid spaceId, CancellationToken ct)
    {
        var sessions = await db.CompletedSessions
            .Where(s => s.SpaceId == spaceId)
            .ToListAsync(ct);

        return sessions
            .GroupBy(s => s.GameType)
            .Select(g =>
            {
                var list = g.ToList();
                var total = list.Count;
                var successful = list.Count(s => s.FinalStatus == SessionFinalStatus.SUCCESS);
                var failed = list.Count(s => s.FinalStatus == SessionFinalStatus.FAILED);
                var unfinished = list.Count(s => s.FinalStatus == SessionFinalStatus.UNFINISHED);
                var successRate = total == 0 ? 0 : Math.Round((decimal)successful / total * 100, 2);
                var avgNormScore = NormalizedAverageScore(list);
                return new GameTypeStatsDto(
                    g.Key.ToString(), total, successful, failed, unfinished, successRate, avgNormScore);
            })
            .OrderBy(d => d.GameType)
            .ToList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static SpaceSummaryDto BuildSummary(Guid spaceId, List<CompletedGameSession> sessions)
    {
        var total = sessions.Count;
        var successful = sessions.Count(s => s.FinalStatus == SessionFinalStatus.SUCCESS);
        var failed = sessions.Count(s => s.FinalStatus == SessionFinalStatus.FAILED);
        var unfinished = sessions.Count(s => s.FinalStatus == SessionFinalStatus.UNFINISHED);

        // successRate = successfulSessions / totalSessions * 100 (0 when no sessions)
        var successRate = total == 0
            ? 0
            : Math.Round((decimal)successful / total * 100, 2);

        // averageAttempts = sum(attemptsUsed) / totalSessions (0 when no sessions)
        var avgAttempts = total == 0
            ? 0
            : Math.Round((decimal)sessions.Sum(s => s.AttemptsUsed) / total, 2);

        var avgNormScore = NormalizedAverageScore(sessions);

        return new SpaceSummaryDto(
            spaceId, total, successful, failed, unfinished,
            successRate, avgAttempts, avgNormScore);
    }

    /// <summary>
    /// Normalized score = session.FinalScore / session.FinalMaxScore.
    /// Sessions with missing, zero, or invalid maxima are excluded; returns 0 when none are scoreable.
    /// </summary>
    private static decimal NormalizedAverageScore(List<CompletedGameSession> sessions)
    {
        var scoreable = sessions
            .Select(s => (Session: s, FinalMaxScore: s.FinalMaxScore.GetValueOrDefault()))
            .Where(s => s.FinalMaxScore > 0 &&
                        s.Session.FinalScore >= 0 &&
                        s.Session.FinalScore <= s.FinalMaxScore)
            .ToList();
        if (scoreable.Count == 0) return 0;
        return Math.Round(
            scoreable.Average(s => s.Session.FinalScore / s.FinalMaxScore),
            4);
    }

    private static SessionSummaryDto ToSummaryDto(CompletedGameSession s) =>
        new(s.SessionId, s.GameId, s.GameTitle,
            s.GameType.ToString(), s.FinalStatus.ToString(),
            s.AttemptsUsed, s.MaxAttempts, s.FinalScore, s.FinalMaxScore,
            s.StartedAt, s.CompletedAt, s.NextAvailableAt);
}
