using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Tessera.VideoStream.Demo.Catalogue;
using Tessera.VideoStream.Demo.Contracts;
using Tessera.VideoStream.Demo.Sessions;

namespace Tessera.VideoStream.Demo.Hubs;

/// <summary>The hub contract of ADR-0002, at <c>/hubs/video</c>.</summary>
[Authorize]
public sealed class VideoStreamHub(
    StreamCatalogue catalogue,
    StreamSessionRegistry registry,
    TimeProvider time,
    ILogger<VideoStreamHub> logger) : Hub
{
    public StreamDescriptor Describe(string streamId)
    {
        var entry = Resolve(streamId);
        return new StreamDescriptor
        {
            StreamId = streamId,
            Title = entry.Title,
            MimeType = entry.MimeType,
            // A stream nobody is watching yet starts when it is subscribed, so "now" is its start.
            StartedAt = (registry.Find(streamId)?.StartedAt ?? time.GetUtcNow()).UtcDateTime.ToString("O"),
        };
    }

    /// <summary>
    /// Streams the cached or next init segment, then fragments, until the source ends (completion),
    /// fails or evicts this subscriber (HubException), or the client disposes the stream.
    /// </summary>
    public async IAsyncEnumerable<VideoChunk> Subscribe(string streamId, [EnumeratorCancellation] CancellationToken ct)
    {
        var (session, subscriber) = registry.Attach(streamId, Resolve(streamId), Context.ConnectionId);
        try
        {
            await foreach (var chunk in subscriber.ReadAllAsync(ct))
                yield return chunk;
        }
        finally
        {
            session.Detach(subscriber);
        }
    }

    /// <summary>Malformed and absent identifiers fail alike, before any lookup, and are never logged.</summary>
    private StreamCatalogueEntry Resolve(string streamId)
    {
        if (StreamIdValidator.IsValid(streamId) && catalogue.TryGet(streamId, out var entry)) return entry;
        logger.LogInformation("Rejected a stream identifier from connection {ConnectionId}.", Context.ConnectionId);
        throw new HubException("unknown-stream");
    }
}
