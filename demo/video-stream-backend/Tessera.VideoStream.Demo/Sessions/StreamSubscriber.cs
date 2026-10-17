using System.Runtime.CompilerServices;
using System.Threading.Channels;
using Tessera.VideoStream.Demo.Contracts;

namespace Tessera.VideoStream.Demo.Sessions;

/// <summary>One hub connection receiving one stream, through a bounded channel that never blocks the session.</summary>
public sealed class StreamSubscriber(string connectionId, string streamId, TimeProvider time, ILogger logger)
{
    public const int Capacity = 30;

    private readonly Channel<VideoChunk> channel = Channel.CreateBounded<VideoChunk>(
        new BoundedChannelOptions(Capacity) { FullMode = BoundedChannelFullMode.DropOldest, SingleWriter = true });

    private uint nextSeq;

    public string ConnectionId => connectionId;

    /// <summary>When the hub last took a chunk from this subscriber, or when it attached.</summary>
    public DateTimeOffset LastReadUtc { get; private set; } = time.GetUtcNow();

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
