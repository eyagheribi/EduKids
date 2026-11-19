namespace Suivi.Api.Domain.Model;

public class RecordedAttempt
{
    public Guid AttemptId { get; set; }
    public Guid SessionId { get; set; }
    public int AttemptNumber { get; set; }
    public string SubmittedAnswer { get; set; } = "{}";
    public bool Correct { get; set; }
    public decimal Score { get; set; }
    public decimal MaxScore { get; set; }
    public DateTimeOffset SubmittedAt { get; set; }

    public CompletedGameSession Session { get; set; } = null!;
}
