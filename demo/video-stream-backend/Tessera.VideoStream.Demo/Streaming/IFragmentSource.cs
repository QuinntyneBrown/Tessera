namespace Tessera.VideoStream.Demo.Streaming;

/// <summary>
/// Where a session's media comes from: FFmpeg in the demonstration, a replayed fixture in tests.
/// One enumeration is one run of the source; it completes when the source ends normally.
/// </summary>
public interface IFragmentSource
{
    IAsyncEnumerable<FragmentEvent> ReadAsync(CancellationToken ct);
}
