using MessagePack;

namespace Tessera.VideoStream.Demo.Contracts;

/// <summary>One <c>Subscribe</c> stream item recorded in ADR-0002.</summary>
[MessagePackObject]
public sealed class VideoChunk
{
    public const byte Init = 0;
    public const byte Media = 1;

    /// <summary>0 for the initialisation segment, 1 for one media fragment.</summary>
    [Key(0)] public required byte Kind { get; init; }

    /// <summary>Increases by 1 per chunk delivered to one subscriber, starting at 0.</summary>
    [Key(1)] public required uint Seq { get; init; }

    [Key(2)] public required byte[] Data { get; init; }
}
