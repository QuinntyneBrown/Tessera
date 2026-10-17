using System.Collections.Concurrent;
using Microsoft.Extensions.Options;
using Tessera.VideoStream.Demo.Catalogue;
using Tessera.VideoStream.Demo.Streaming;

namespace Tessera.VideoStream.Demo.Sessions;

/// <summary>At most one live session per stream identifier, all stopped within 5 s on shutdown.</summary>
public sealed class StreamSessionRegistry(
    Func<StreamCatalogueEntry, IFragmentSource> sources,
    TimeProvider time,
    IOptions<StreamSessionOptions> options,
    ILogger<LiveStreamSession> logger) : IHostedService
{
    private static readonly TimeSpan ShutdownLimit = TimeSpan.FromSeconds(5);

    private readonly ConcurrentDictionary<string, LiveStreamSession> sessions = new();

    public int ActiveSessions => sessions.Count;

    public LiveStreamSession? Find(string streamId) => sessions.GetValueOrDefault(streamId);

    /// <summary>Attaches a new subscriber to the stream's session, creating the session if none is running.</summary>
    public (LiveStreamSession Session, StreamSubscriber Subscriber) Attach(
        string streamId, StreamCatalogueEntry entry, string connectionId)
    {
        var subscriber = new StreamSubscriber(connectionId, streamId, time, logger);
        while (true)
        {
            var session = sessions.GetOrAdd(streamId, id => new LiveStreamSession(id, sources(entry), time,
                options.Value, logger, ended => sessions.TryRemove(new(ended.StreamId, ended))));
            if (session.TryAttach(subscriber)) return (session, subscriber);
            // It stopped between lookup and attach; replace it.
            sessions.TryRemove(new(streamId, session));
        }
    }

    public Task StartAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        try
        {
            await Task.WhenAll(sessions.Values.Select(s => s.StopAsync())).WaitAsync(ShutdownLimit, cancellationToken);
        }
        catch (TimeoutException)
        {
            logger.LogError("Stream sessions did not stop within {Limit}.", ShutdownLimit);
        }
    }
}
