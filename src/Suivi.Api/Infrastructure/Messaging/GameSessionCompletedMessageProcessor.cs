using System.Data.Common;
using System.Net.Sockets;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Suivi.Api.Application;
using Suivi.Api.Domain.Exceptions;

namespace Suivi.Api.Infrastructure.Messaging;

public enum MessageDisposition
{
    Acknowledge,
    Retry,
    DeadLetter
}

public sealed class GameSessionCompletedMessageProcessor(
    ILogger<GameSessionCompletedMessageProcessor> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<MessageDisposition> ProcessAsync(
        ReadOnlyMemory<byte> body,
        ISessionIngestionService ingestion,
        CancellationToken ct)
    {
        GameSessionCompletedEvent message;
        try
        {
            message = JsonSerializer.Deserialize<GameSessionCompletedEvent>(body.Span, JsonOptions)
                ?? throw new JsonException("The event payload was null.");
        }
        catch (JsonException)
        {
            logger.LogWarning("Dead-lettering a message with invalid GameSessionCompleted JSON.");
            return MessageDisposition.DeadLetter;
        }

        try
        {
            await ingestion.IngestAsync(message, ct);
            return MessageDisposition.Acknowledge;
        }
        catch (SuiviDomainException ex)
        {
            logger.LogWarning(
                "Dead-lettering a permanently rejected GameSessionCompleted event ({ExceptionType}).",
                ex.GetType().Name);
            return MessageDisposition.DeadLetter;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex) when (IsTransient(ex))
        {
            logger.LogWarning(
                "Requeueing GameSessionCompleted after a transient ingestion failure ({ExceptionType}).",
                ex.GetType().Name);
            return MessageDisposition.Retry;
        }
        catch (Exception ex)
        {
            logger.LogError(
                "Dead-lettering GameSessionCompleted after an unexpected ingestion failure ({ExceptionType}).",
                ex.GetType().Name);
            return MessageDisposition.DeadLetter;
        }
    }

    private static bool IsTransient(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is DbException or DbUpdateException or TimeoutException or IOException or SocketException)
                return true;
        }

        return false;
    }
}
