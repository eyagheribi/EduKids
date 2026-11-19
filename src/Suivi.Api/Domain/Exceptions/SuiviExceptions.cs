namespace Suivi.Api.Domain.Exceptions;

public class SuiviDomainException : Exception
{
    public int StatusCode { get; }

    public SuiviDomainException(string message, int statusCode = 400) : base(message)
    {
        StatusCode = statusCode;
    }
}

public class EventConflictException : SuiviDomainException
{
    public Guid SessionId { get; }
    public Guid EventId { get; }

    public EventConflictException(Guid sessionId, Guid eventId, string message)
        : base(message, 409)
    {
        SessionId = sessionId;
        EventId = eventId;
    }
}

public class InvalidEventPayloadException : SuiviDomainException
{
    public InvalidEventPayloadException(string message) : base(message, 400)
    {
    }
}
