using System.Collections.Concurrent;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Tessera.VideoStream.Demo.Tests;

/// <summary>Hosts the demonstration backend in memory with optional configuration and services.</summary>
public sealed class DemoFactory(
    Dictionary<string, string?>? settings = null,
    Action<IServiceCollection>? services = null) : WebApplicationFactory<Program>
{
    public const string Token = "tessera-demo";

    public CollectingLoggerProvider Logs { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration(config => config.AddInMemoryCollection(settings ?? []));
        builder.ConfigureLogging(logging => logging.AddProvider(Logs).SetMinimumLevel(LogLevel.Debug));
        if (services is not null) builder.ConfigureTestServices(services);
    }

    /// <summary>Builds a hub connection over the in-memory server; MessagePack unless told otherwise.</summary>
    public HubConnection Hub(string? token = Token, bool json = false)
    {
        var builder = new HubConnectionBuilder().WithUrl(new Uri(Server.BaseAddress, "/hubs/video"), options =>
        {
            options.HttpMessageHandlerFactory = _ => Server.CreateHandler();
            options.Transports = HttpTransportType.LongPolling;
            if (token is not null) options.AccessTokenProvider = () => Task.FromResult<string?>(token);
        });
        if (json) builder.AddJsonProtocol();
        else builder.AddMessagePackProtocol();
        return builder.Build();
    }

    public async Task<HubConnection> ConnectAsync()
    {
        var connection = Hub();
        await connection.StartAsync(TestContext.Current.CancellationToken);
        return connection;
    }
}

/// <summary>Keeps every formatted log message so tests can check what was and was not logged.</summary>
public sealed class CollectingLoggerProvider : ILoggerProvider
{
    private readonly ConcurrentQueue<(LogLevel Level, string Category, string Message)> entries = new();

    public IReadOnlyList<(LogLevel Level, string Category, string Message)> Entries => entries.ToArray();

    public ILogger CreateLogger(string categoryName) => new Logger(this, categoryName);

    public void Dispose() { }

    private sealed class Logger(CollectingLoggerProvider provider, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) =>
            provider.entries.Enqueue((logLevel, category, formatter(state, exception) + exception));
    }
}
