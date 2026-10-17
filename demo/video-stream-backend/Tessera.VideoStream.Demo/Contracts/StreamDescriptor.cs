using MessagePack;

namespace Tessera.VideoStream.Demo.Contracts;

/// <summary>The <c>Describe</c> result recorded in ADR-0002.</summary>
[MessagePackObject]
public sealed class StreamDescriptor
{
    [Key(0)] public required string StreamId { get; init; }

    [Key(1)] public required string Title { get; init; }

    [Key(2)] public required string MimeType { get; init; }

    /// <summary>ISO-8601 UTC.</summary>
    [Key(3)] public required string StartedAt { get; init; }

    [Key(4)] public int Width { get; init; }

    [Key(5)] public int Height { get; init; }
}
