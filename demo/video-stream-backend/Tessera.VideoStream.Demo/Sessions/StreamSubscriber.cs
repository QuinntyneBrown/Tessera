using System.Runtime.CompilerServices;
using System.Threading.Channels;
using Tessera.VideoStream.Demo.Contracts;

namespace Tessera.VideoStream.Demo.Sessions;

/// <summary>One hub connection receiving one stream, through a bounded channel that never blocks the session.</summary>
public sealed class StreamSubscriber
{
    public const int Capacity = 30;

    private readonly Channel<VideoChunk> channel;
    private readonly TimeProvider time;
    private uint nextSeq;

    public StreamSubscriber(string connectionId, string streamId, TimeProvider time, ILogger logger)
    {
        ConnectionId = connectionId;
        this.time = time;
        LastReadUtc = time.GetUtcNow();
        // Drops are logged with the stream, the connection and the count; never with media bytes.
        channel = Channel.CreateBounded<VideoChunk>(
            new BoundedChannelOptions(Capacity) { FullMode = BoundedChannelFullMode.DropOldest, SingleWriter = true },
            _ => logger.LogWarning("Stream {StreamId} dropped a chunk for connection {ConnectionId}; {Dropped} dropped so far.",
                streamId, connectionId, ++Dropped));
    }

    public string ConnectionId { get; }

    /// <summary>When the hub last took a chunk from this subscriber, or when it attached.</summary>
    public DateTimeOffset LastReadUtc { get; private set; }

    /// <summary>Chunks discarded because this subscriber's channel was full.</summary>
    public long Dropped { get; private set; }

    internal bool HasInit { get; private set; }

    /// <summary>Discards any media for the previous init segment, then queues the new one.</summary>
    internal void SendInit(byte[] data)
    {
        while (channel.Reader.TryRead(out _)) { }
        HasInit = true;
        Write(VideoChunk.Init, data);
    }

    /// <summary>Queues a fragment once this subscriber has its init segment.</summary>
    internal void SendMedia(byte[] data)
    {
        if (HasInit) Write(VideoChunk.Media, data);
    }

    /// <summary>True when chunks are queued that the hub has not taken for longer than <paramref name="limit"/>.</summary>
    internal bool IsStalled(TimeSpan limit) => channel.Reader.Count > 0 && time.GetUtcNow() - LastReadUtc > limit;

    /// <summary>Discards what is queued and ends the hub stream with the exception the client receives.</summary>
    internal void Fail(Exception error)
    {
        while (channel.Reader.TryRead(out _)) { }
        Complete(error);
    }

    /// <summary>Ends the hub stream: normally, or with the exception the client receives.</summary>
    internal void Complete(Exception? error = null) => channel.Writer.TryComplete(error);

    public async IAsyncEnumerable<VideoChunk> ReadAllAsync([EnumeratorCancellation] CancellationToken ct)
    {
        await foreach (var chunk in channel.Reader.ReadAllAsync(ct))
        {
            LastReadUtc = time.GetUtcNow();
            yield return chunk;
        }
    }

    private void Write(byte kind, byte[] data) =>
        channel.Writer.TryWrite(new VideoChunk { Kind = kind, Seq = nextSeq++, Data = data });
}
