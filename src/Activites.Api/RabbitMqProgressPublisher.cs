using System.Text.Json;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

public sealed class RabbitMqProgressPublisherOptions
{
    public bool Enabled { get; set; }
    public string HostName { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string? UserName { get; set; }
    public string? Password { get; set; }
    public int ConnectionTimeoutSeconds { get; set; } = 5;
    public int PublisherConfirmTimeoutSeconds { get; set; } = 10;
}

public sealed class RabbitMqProgressPublisher : IProgressPublisher, IAsyncDisposable
{
    public const string ExchangeName = "edukids.game-events";
    public const string RoutingKey = "game.session.completed.v1";
    public const string QueueName = "edukids.suivi.game-session-completed.v1";
    public const string EventType = "GameSessionCompleted";

    private static readonly CreateChannelOptions ConfirmedChannelOptions = new(
        publisherConfirmationsEnabled: true,
        publisherConfirmationTrackingEnabled: true);

    private readonly RabbitMqProgressPublisherOptions options;
    private readonly SemaphoreSlim publishLock = new(1, 1);
    private IConnection? connection;
    private IChannel? channel;
    private bool disposed;

    public RabbitMqProgressPublisher(IOptions<RabbitMqProgressPublisherOptions> options)
    {
        this.options = options.Value;
        if (string.IsNullOrWhiteSpace(this.options.HostName)) throw new InvalidOperationException("RabbitMq:HostName is required when RabbitMQ publishing is enabled.");
        if (this.options.Port is < 1 or > 65535) throw new InvalidOperationException("RabbitMq:Port must be between 1 and 65535.");
        if (string.IsNullOrWhiteSpace(this.options.UserName) || string.IsNullOrWhiteSpace(this.options.Password))
            throw new InvalidOperationException("RabbitMq:UserName and RabbitMq:Password must be configured when RabbitMQ publishing is enabled.");
    }

    public async Task<bool> Publish(GameSessionCompletedEvent message, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(message);
        if (message.SchemaVersion != 1) throw new InvalidOperationException($"Unsupported completion event schema version {message.SchemaVersion}.");
        if (message.EventId == Guid.Empty) throw new InvalidOperationException("A completion event must have a stable EventId.");

        await publishLock.WaitAsync(cancellationToken);
        try
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            var activeChannel = await GetReadyChannelAsync(cancellationToken);
            var body = SerializeMessage(message);
            var properties = CreateProperties(message);

            try
            {
                // BasicPublishAsync completes only after the publisher confirmation when tracking is enabled.
                await activeChannel.BasicPublishAsync(
                    exchange: ExchangeName,
                    routingKey: RoutingKey,
                    mandatory: true,
                    basicProperties: properties,
                    body: body,
                    cancellationToken: cancellationToken)
                    .AsTask()
                    .WaitAsync(TimeSpan.FromSeconds(Math.Max(1, options.PublisherConfirmTimeoutSeconds)), cancellationToken);
                return true;
            }
            catch
            {
                // A failed or timed-out confirm is ambiguous: tear down this channel/connection and let
                // the transactional outbox retry with the same EventId (consumers must deduplicate it).
                await ResetConnectionAsync();
                throw;
            }
        }
        finally
        {
            publishLock.Release();
        }
    }

    public static byte[] SerializeMessage(GameSessionCompletedEvent message) => JsonSerializer.SerializeToUtf8Bytes(message);

    public static BasicProperties CreateProperties(GameSessionCompletedEvent message) => new()
    {
        Persistent = true,
        ContentType = "application/json",
        ContentEncoding = "utf-8",
        Type = EventType,
        MessageId = message.EventId.ToString("D"),
        Headers = new Dictionary<string, object?>
        {
            ["eventType"] = EventType,
            ["schemaVersion"] = message.SchemaVersion,
            ["eventId"] = message.EventId.ToString("D")
        }
    };

    private async Task<IChannel> GetReadyChannelAsync(CancellationToken cancellationToken)
    {
        if (connection is { IsOpen: true } && channel is { IsOpen: true }) return channel;

        await ResetConnectionAsync();
        var factory = new ConnectionFactory
        {
            HostName = options.HostName,
            Port = options.Port,
            UserName = options.UserName!,
            Password = options.Password!,
            AutomaticRecoveryEnabled = true,
            TopologyRecoveryEnabled = true,
            NetworkRecoveryInterval = TimeSpan.FromSeconds(5),
            RequestedConnectionTimeout = TimeSpan.FromSeconds(Math.Max(1, options.ConnectionTimeoutSeconds))
        };

        connection = await factory.CreateConnectionAsync(cancellationToken);
        try
        {
            channel = await connection.CreateChannelAsync(ConfirmedChannelOptions, cancellationToken);
            await channel.ExchangeDeclareAsync(ExchangeName, ExchangeType.Topic, durable: true, autoDelete: false, cancellationToken: cancellationToken);
            await channel.QueueDeclareAsync(QueueName, durable: true, exclusive: false, autoDelete: false, cancellationToken: cancellationToken);
            await channel.QueueBindAsync(QueueName, ExchangeName, RoutingKey, cancellationToken: cancellationToken);
            return channel;
        }
        catch
        {
            await ResetConnectionAsync();
            throw;
        }
    }

    private async Task ResetConnectionAsync()
    {
        var oldChannel = channel;
        channel = null;
        if (oldChannel is not null)
        {
            try { await oldChannel.DisposeAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(2)); }
            catch { /* Best-effort disposal after a failed connection/channel. The outbox retains the event. */ }
        }

        var oldConnection = connection;
        connection = null;
        if (oldConnection is not null)
        {
            try { await oldConnection.DisposeAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(2)); }
            catch { /* Best-effort disposal after a failed connection/channel. The outbox retains the event. */ }
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (disposed) return;
        await publishLock.WaitAsync();
        try
        {
            if (disposed) return;
            disposed = true;
            await ResetConnectionAsync();
        }
        finally
        {
            publishLock.Release();
        }
    }
}
