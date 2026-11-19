namespace Suivi.Api.Infrastructure.Messaging;

public sealed class RabbitMqOptions
{
    public const string SectionName = "RabbitMq";

    public string HostName { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string Username { get; set; } = "edukids";
    public string Password { get; set; } = string.Empty;
    public ushort PrefetchCount { get; set; } = 10;
    public int MaxDeliveryAttempts { get; set; } = 5;
    public int InitialReconnectDelaySeconds { get; set; } = 1;
    public int MaxReconnectDelaySeconds { get; set; } = 30;
}
