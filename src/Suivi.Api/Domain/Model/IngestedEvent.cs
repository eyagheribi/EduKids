namespace Suivi.Api.Domain.Model;

public class IngestedEvent
{
    public Guid EventId { get; set; }
    public Guid SessionId { get; set; }
    public int SchemaVersion { get; set; }
    public DateTimeOffset IngestedAt { get; set; }
    public string PayloadHash { get; set; } = string.Empty;
    public SessionFinalStatus FinalStatus { get; set; }
}
