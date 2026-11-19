using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using Suivi.Api.Application;

namespace Suivi.Api.Infrastructure.Messaging;

public sealed class GameSessionCompletedConsumer(
    IServiceScopeFactory scopeFactory,
    GameSessionCompletedMessageProcessor processor,
    IOptions<RabbitMqOptions> options,
    ILogger<GameSessionCompletedConsumer> logger)
    : BackgroundService
{
    public const string ExchangeName = "edukids.game-events";
    public const string RoutingKey = "game.session.completed.v1";
    public const string QueueName = "edukids.suivi.game-session-completed.v1";
    public const string DeadLetterExchangeName = "edukids.suivi.dead-letter";
    public const string DeadLetterRoutingKey = "game.session.completed.v1.dead-letter";
    public const string DeadLetterQueueName = "edukids.suivi.game-session-completed.v1.dlq";

    private readonly RabbitMqOptions _options = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation(
            "Starting RabbitMQ consumer for {HostName}:{Port} as {Username}; password configured: {PasswordConfigured}.",
            _options.HostName,
            _options.Port,
            _options.Username,
            !string.IsNullOrEmpty(_options.Password));

        var reconnectDelay = TimeSpan.FromSeconds(_options.InitialReconnectDelaySeconds);
        var maxReconnectDelay = TimeSpan.FromSeconds(_options.MaxReconnectDelaySeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ConsumeUntilConnectionClosesAsync(stoppingToken);
                reconnectDelay = TimeSpan.FromSeconds(_options.InitialReconnectDelaySeconds);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "RabbitMQ consumer connection failed ({ExceptionType}); retrying in {ReconnectDelaySeconds} seconds.",
                    ex.GetType().Name,
                    reconnectDelay.TotalSeconds);
            }

            if (stoppingToken.IsCancellationRequested)
                break;

            try
            {
                await Task.Delay(reconnectDelay, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }

            reconnectDelay = TimeSpan.FromSeconds(
                Math.Min(reconnectDelay.TotalSeconds * 2, maxReconnectDelay.TotalSeconds));
        }
    }

    private async Task ConsumeUntilConnectionClosesAsync(CancellationToken ct)
    {
        var factory = new ConnectionFactory
        {
            HostName = _options.HostName,
            Port = _options.Port,
            UserName = _options.Username,
            Password = _options.Password,
            AutomaticRecoveryEnabled = false,
            ConsumerDispatchConcurrency = 1,
            RequestedHeartbeat = TimeSpan.FromSeconds(30)
        };

        await using var connection = await factory.CreateConnectionAsync("Suivi.Api.GameSessionCompleted", ct);
        var shutdown = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.ConnectionShutdownAsync += (_, _) =>
        {
            shutdown.TrySetResult();
            return Task.CompletedTask;
        };

        await using var channel = await connection.CreateChannelAsync(cancellationToken: ct);
        channel.ChannelShutdownAsync += (_, _) =>
        {
            shutdown.TrySetResult();
            return Task.CompletedTask;
        };

        await DeclareTopologyAsync(channel, ct);
        await channel.BasicQosAsync(
            prefetchSize: 0,
            prefetchCount: _options.PrefetchCount,
            global: false,
            cancellationToken: ct);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += (_, delivery) => HandleDeliveryAsync(channel, delivery, ct);
        await channel.BasicConsumeAsync(
            queue: QueueName,
            autoAck: false,
            consumer: consumer,
            cancellationToken: ct);

        logger.LogInformation("RabbitMQ GameSessionCompleted consumer is ready on queue {QueueName}.", QueueName);

        await Task.WhenAny(shutdown.Task, Task.Delay(Timeout.InfiniteTimeSpan, ct));
        ct.ThrowIfCancellationRequested();
        logger.LogWarning("RabbitMQ connection closed; the consumer will reconnect.");
    }

    private async Task DeclareTopologyAsync(IChannel channel, CancellationToken ct)
    {
        await channel.ExchangeDeclareAsync(
            exchange: ExchangeName,
            type: ExchangeType.Topic,
            durable: true,
            autoDelete: false,
            arguments: null,
            cancellationToken: ct);
        await channel.ExchangeDeclareAsync(
            exchange: DeadLetterExchangeName,
            type: ExchangeType.Direct,
            durable: true,
            autoDelete: false,
            arguments: null,
            cancellationToken: ct);

        await channel.QueueDeclareAsync(
            queue: DeadLetterQueueName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: new Dictionary<string, object?> { ["x-queue-type"] = "quorum" },
            cancellationToken: ct);
        await channel.QueueBindAsync(
            queue: DeadLetterQueueName,
            exchange: DeadLetterExchangeName,
            routingKey: DeadLetterRoutingKey,
            arguments: null,
            cancellationToken: ct);

        var queueArguments = new Dictionary<string, object?>
        {
            ["x-queue-type"] = "quorum",
            ["x-delivery-limit"] = _options.MaxDeliveryAttempts,
            ["x-dead-letter-exchange"] = DeadLetterExchangeName,
            ["x-dead-letter-routing-key"] = DeadLetterRoutingKey,
            ["x-dead-letter-strategy"] = "at-least-once",
            ["x-overflow"] = "reject-publish"
        };

        await channel.QueueDeclareAsync(
            queue: QueueName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: queueArguments,
            cancellationToken: ct);
        await channel.QueueBindAsync(
            queue: QueueName,
            exchange: ExchangeName,
            routingKey: RoutingKey,
            arguments: null,
            cancellationToken: ct);
    }

    private async Task HandleDeliveryAsync(
        IChannel channel,
        BasicDeliverEventArgs delivery,
        CancellationToken ct)
    {
        MessageDisposition disposition;
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var ingestion = scope.ServiceProvider.GetRequiredService<ISessionIngestionService>();
            disposition = await processor.ProcessAsync(delivery.Body, ingestion, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            return;
        }
        catch (Exception ex)
        {
            logger.LogError(
                "RabbitMQ delivery processing infrastructure failed ({ExceptionType}); requeueing.",
                ex.GetType().Name);
            disposition = MessageDisposition.Retry;
        }

        try
        {
            switch (disposition)
            {
                case MessageDisposition.Acknowledge:
                    await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false, cancellationToken: ct);
                    break;
                case MessageDisposition.Retry:
                    await channel.BasicNackAsync(
                        delivery.DeliveryTag, multiple: false, requeue: true, cancellationToken: ct);
                    break;
                case MessageDisposition.DeadLetter:
                    await channel.BasicNackAsync(
                        delivery.DeliveryTag, multiple: false, requeue: false, cancellationToken: ct);
                    break;
                default:
                    throw new InvalidOperationException($"Unknown disposition {disposition}.");
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            logger.LogError(
                "RabbitMQ acknowledgement failed ({ExceptionType}); closing the channel so unacknowledged messages can be redelivered.",
                ex.GetType().Name);
            try
            {
                await channel.CloseAsync(CancellationToken.None);
            }
            catch (Exception closeException)
            {
                logger.LogWarning(
                    "RabbitMQ channel close after acknowledgement failure also failed ({ExceptionType}).",
                    closeException.GetType().Name);
            }
        }
    }
}
