namespace Suivi.Api.Domain.Model;

public class CompletedGameSession
{
    public Guid SessionId { get; set; }
    public Guid GameId { get; set; }
    public Guid SpaceId { get; set; }
    public GameType GameType { get; set; }
    public string? GameTitle { get; set; }
    public SessionFinalStatus FinalStatus { get; set; }
    public int AttemptsUsed { get; set; }
    public int MaxAttempts { get; set; }
    public decimal FinalScore { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset CompletedAt { get; set; }
    public DateTimeOffset? NextAvailableAt { get; set; }
    public string GameContentSnapshot { get; set; } = "{}";

    public List<RecordedAttempt> Attempts { get; set; } = [];
}
