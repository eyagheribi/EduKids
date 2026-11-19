using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

public class RabbitMqPublisherTests
{
    private static readonly DateTimeOffset Timestamp = new(2026, 11, 19, 14, 0, 0, TimeSpan.Zero);

    [Fact]
    public void MessageIsPersistentUtf8JsonWithEventMetadataAndFullContract()
    {
        var message = CompletionEvent();

        var body = RabbitMqProgressPublisher.SerializeMessage(message);
        var properties = RabbitMqProgressPublisher.CreateProperties(message);

        Assert.Equal("application/json", properties.ContentType);
        Assert.Equal("utf-8", properties.ContentEncoding);
        Assert.True(properties.Persistent);
        Assert.Equal("GameSessionCompleted", properties.Type);
        Assert.Equal(message.EventId.ToString("D"), properties.MessageId);
        Assert.Equal("GameSessionCompleted", properties.Headers!["eventType"]);
        Assert.Equal(1, properties.Headers["schemaVersion"]);
        Assert.Equal(message.EventId.ToString("D"), properties.Headers["eventId"]);

        using var json = JsonDocument.Parse(body);
        var root = json.RootElement;
        Assert.Equal(1, root.GetProperty("SchemaVersion").GetInt32());
        Assert.Equal("11 + 111", root.GetProperty("GameContentSnapshot").GetProperty("expression").GetString());
        Assert.False(root.TryGetProperty("ExerciseContentSnapshot", out _));
        Assert.Equal(0, root.GetProperty("FinalScore").GetInt32());
        Assert.Equal(1, root.GetProperty("FinalMaxScore").GetInt32());
        Assert.Equal(2, root.GetProperty("Attempts").GetArrayLength());
    }

    [Fact]
    public async Task UnavailableRabbitMqThrowsSoOutboxCanRetry()
    {
        await using var publisher = new RabbitMqProgressPublisher(Options.Create(new RabbitMqProgressPublisherOptions
        {
            Enabled = true,
            HostName = "127.0.0.1",
            Port = 1,
            UserName = "test",
            Password = "test",
            ConnectionTimeoutSeconds = 1,
            PublisherConfirmTimeoutSeconds = 1
        }));

        var firstFailure = await Record.ExceptionAsync(() => publisher.Publish(CompletionEvent(), default));
        var retryFailure = await Record.ExceptionAsync(() => publisher.Publish(CompletionEvent(), default));

        Assert.NotNull(firstFailure);
        Assert.NotNull(retryFailure);
    }

    [Fact]
    public async Task OutboxFailureLeavesEventPendingAndConfirmedRetryMarksItSent()
    {
        using var database = new IsolatedDatabase();
        using var db = database.CreateContext();
        var expected = CompletionEvent();
        db.Outbox.Add(new OutboxRow
        {
            EventId = expected.EventId,
            EventType = "GameSessionCompleted",
            PayloadJson = JsonSerializer.Serialize(expected),
            CreatedAt = Timestamp
        });
        await db.SaveChangesAsync();

        var publisher = new SequencePublisher(
            _ => Task.FromException<bool>(new IOException("broker offline")),
            _ => Task.FromResult(true));
        var dispatcher = new OutboxDispatchService(db, publisher, new NoopParentNotificationPublisher(), NullLogger<OutboxDispatchService>.Instance);

        Assert.Equal(0, await dispatcher.DispatchPendingOnce(default));
        var pendingAfterFailure = await db.Outbox.AsNoTracking().SingleAsync();
        Assert.Null(pendingAfterFailure.SentAt);
        Assert.Equal(1, pendingAfterFailure.Attempts);
        Assert.Contains("broker offline", pendingAfterFailure.LastError);

        Assert.Equal(1, await dispatcher.DispatchPendingOnce(default));
        var delivered = await db.Outbox.AsNoTracking().SingleAsync();
        Assert.NotNull(delivered.SentAt);
        Assert.Equal(2, delivered.Attempts);
        Assert.Null(delivered.LastError);
        Assert.Equal(2, publisher.Messages.Count);
        Assert.All(publisher.Messages, message => Assert.Equal(expected.EventId, message.EventId));
        Assert.Equal(expected.Attempts.Count, publisher.Messages[^1].Attempts.Count);
        Assert.Equal("11 + 111", publisher.Messages[^1].GameContentSnapshot.GetProperty("expression").GetString());
        Assert.Equal(expected.FinalScore, publisher.Messages[^1].FinalScore);
        Assert.Equal(expected.FinalMaxScore, publisher.Messages[^1].FinalMaxScore);
    }

    private static GameSessionCompletedEvent CompletionEvent()
    {
        var sessionId = Guid.NewGuid();
        var attempt1Id = Guid.NewGuid();
        var attempt2Id = Guid.NewGuid();
        return new GameSessionCompletedEvent(
            1,
            sessionId,
            sessionId,
            Guid.NewGuid(),
            Guid.Parse("11111111-1111-1111-1111-111111111111"),
            "MATH",
            "Calcul mental 1",
            "UNFINISHED",
            2,
            3,
            0,
            1,
            Timestamp.AddMinutes(-8),
            Timestamp,
            Timestamp.AddHours(24),
            Json("{\"expression\":\"11 + 111\"}"),
            [
                new AttemptCompletedEvent(attempt1Id, 1, Json("{\"value\":18}"), false, 0, 1, Timestamp.AddMinutes(-6)),
                new AttemptCompletedEvent(attempt2Id, 2, Json("{\"value\":20}"), false, 0, 1, Timestamp.AddMinutes(-5))
            ]);
    }

    private static JsonElement Json(string value) => JsonDocument.Parse(value).RootElement.Clone();

    private sealed class SequencePublisher(params Func<GameSessionCompletedEvent, Task<bool>>[] responses) : IProgressPublisher
    {
        private readonly Queue<Func<GameSessionCompletedEvent, Task<bool>>> responses = new(responses);
        public List<GameSessionCompletedEvent> Messages { get; } = [];
        public Task<bool> Publish(GameSessionCompletedEvent message, CancellationToken ct)
        {
            Messages.Add(message);
            return responses.Dequeue()(message);
        }
    }

    private sealed class IsolatedDatabase : IDisposable
    {
        private readonly string path = Path.Combine(Path.GetTempPath(), $"edukids-rabbitmq-outbox-{Guid.NewGuid():N}.db");
        private readonly DbContextOptions<ActivitiesDbContext> options;
        public IsolatedDatabase()
        {
            options = new DbContextOptionsBuilder<ActivitiesDbContext>().UseSqlite($"Data Source={path};Pooling=False").Options;
            using var db = CreateContext();
            db.Database.EnsureCreated();
            ActivitiesSchemaUpgrade.ApplyAsync(db).GetAwaiter().GetResult();
        }
        public ActivitiesDbContext CreateContext() => new(options);
        public void Dispose() { if (File.Exists(path)) File.Delete(path); }
    }
}
