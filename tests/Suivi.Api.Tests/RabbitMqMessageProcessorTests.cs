using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Suivi.Api.Application;
using Suivi.Api.Domain.Model;
using Suivi.Api.Infrastructure.Messaging;
using Suivi.Api.Infrastructure.Persistence;

namespace Suivi.Api.Tests;

public sealed class RabbitMqMessageProcessorTests : DbTestBase
{
    private readonly GameSessionCompletedMessageProcessor _processor =
        new(NullLogger<GameSessionCompletedMessageProcessor>.Instance);

    [Fact]
    public async Task ValidEventAndIdempotentDuplicate_AreAcknowledgedAfterIngestion()
    {
        await using var db = NewDb();
        var ingestion = new SessionIngestionService(db, NullLogger<SessionIngestionService>.Instance);
        var payload = Serialize(CreateEvent());

        var first = await _processor.ProcessAsync(payload, ingestion, CancellationToken.None);
        var duplicate = await _processor.ProcessAsync(payload, ingestion, CancellationToken.None);

        Assert.Equal(MessageDisposition.Acknowledge, first);
        Assert.Equal(MessageDisposition.Acknowledge, duplicate);
        Assert.Equal(1, await db.CompletedSessions.CountAsync());
        Assert.Equal(1, await db.IngestedEvents.CountAsync());
    }

    [Fact]
    public async Task InvalidContractEvent_IsDeadLettered()
    {
        await using var db = NewDb();
        var ingestion = new SessionIngestionService(db, NullLogger<SessionIngestionService>.Instance);
        var evt = CreateEvent();
        evt.SchemaVersion = 2;

        var disposition = await _processor.ProcessAsync(Serialize(evt), ingestion, CancellationToken.None);

        Assert.Equal(MessageDisposition.DeadLetter, disposition);
        Assert.Equal(0, await db.CompletedSessions.CountAsync());
    }

    [Fact]
    public async Task MalformedJson_IsDeadLetteredWithoutCallingIngestion()
    {
        var ingestion = new StubIngestionService((_, _) => true);

        var disposition = await _processor.ProcessAsync(
            "{not-json"u8.ToArray(),
            ingestion,
            CancellationToken.None);

        Assert.Equal(MessageDisposition.DeadLetter, disposition);
        Assert.Equal(0, ingestion.CallCount);
    }

    [Fact]
    public async Task TransientDatabaseFailure_IsRetried()
    {
        var ingestion = new StubIngestionService((_, _) =>
            throw new DbUpdateException("Temporary database failure."));

        var disposition = await _processor.ProcessAsync(
            Serialize(CreateEvent()),
            ingestion,
            CancellationToken.None);

        Assert.Equal(MessageDisposition.Retry, disposition);
        Assert.Equal(1, ingestion.CallCount);
    }

    private static byte[] Serialize(GameSessionCompletedEvent evt) =>
        JsonSerializer.SerializeToUtf8Bytes(evt, new JsonSerializerOptions(JsonSerializerDefaults.Web));

    private static GameSessionCompletedEvent CreateEvent()
    {
        using var content = JsonDocument.Parse("{\"prompt\":\"2 + 3\"}");
        using var answer = JsonDocument.Parse("{\"value\":5}");
        var now = DateTimeOffset.UtcNow;

        return new GameSessionCompletedEvent
        {
            EventId = Guid.NewGuid(),
            SchemaVersion = 1,
            SessionId = Guid.NewGuid(),
            GameId = Guid.NewGuid(),
            SpaceId = Guid.NewGuid(),
            GameType = "MATH",
            GameTitle = "Addition",
            FinalStatus = "SUCCESS",
            AttemptsUsed = 1,
            MaxAttempts = 3,
            FinalScore = 1,
            FinalMaxScore = 1,
            StartedAt = now.AddMinutes(-1),
            CompletedAt = now,
            GameContentSnapshot = content.RootElement.Clone(),
            Attempts =
            [
                new AttemptEvent
                {
                    AttemptId = Guid.NewGuid(),
                    AttemptNumber = 1,
                    SubmittedAnswer = answer.RootElement.Clone(),
                    Correct = true,
                    Score = 1,
                    MaxScore = 1,
                    SubmittedAt = now
                }
            ]
        };
    }

    private sealed class StubIngestionService(Func<GameSessionCompletedEvent, CancellationToken, bool> ingest)
        : ISessionIngestionService
    {
        public int CallCount { get; private set; }

        public Task<bool> IngestAsync(GameSessionCompletedEvent evt, CancellationToken ct)
        {
            CallCount++;
            return Task.FromResult(ingest(evt, ct));
        }
    }
}
