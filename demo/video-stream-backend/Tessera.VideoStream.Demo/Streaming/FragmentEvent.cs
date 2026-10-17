namespace Tessera.VideoStream.Demo.Streaming;

/// <summary>One unit of parsed fragmented-MP4 output.</summary>
public abstract record FragmentEvent(ReadOnlyMemory<byte> Bytes);

/// <summary>The <c>ftyp</c> and <c>moov</c> boxes a decoder needs before any fragment.</summary>
public sealed record InitSegment(ReadOnlyMemory<byte> Bytes) : FragmentEvent(Bytes);

/// <summary>One <c>moof</c> box and its <c>mdat</c> box, starting on a keyframe.</summary>
public sealed record Fragment(ReadOnlyMemory<byte> Bytes) : FragmentEvent(Bytes);
