using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Tessera.VideoStream.Demo.Catalogue;
using Tessera.VideoStream.Demo.Contracts;

namespace Tessera.VideoStream.Demo.Hubs;

/// <summary>The hub contract of ADR-0002, at <c>/hubs/video</c>.</summary>
[Authorize]
public sealed class VideoStreamHub(StreamCatalogue catalogue, TimeProvider time, ILogger<VideoStreamHub> logger) : Hub
{
    public StreamDescriptor Describe(string streamId)
    {
        var entry = Resolve(streamId);
        return new StreamDescriptor
        {
            StreamId = streamId,
            Title = entry.Title,
            MimeType = entry.MimeType,
            StartedAt = time.GetUtcNow().UtcDateTime.ToString("O"),
        };
    }

    public async IAsyncEnumerable<VideoChunk> Subscribe(string streamId, [EnumeratorCancellation] CancellationToken ct)
    {
        Resolve(streamId);
        await Task.CompletedTask;
        yield break;
    }

    /// <summary>Malformed and absent identifiers fail alike, before any lookup, and are never logged.</summary>
    private StreamCatalogueEntry Resolve(string streamId)
    {
        if (StreamIdValidator.IsValid(streamId) && catalogue.TryGet(streamId, out var entry)) return entry;
        logger.LogInformation("Rejected a stream identifier from connection {ConnectionId}.", Context.ConnectionId);
        throw new HubException("unknown-stream");
    }
}
