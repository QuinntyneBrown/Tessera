using System.Runtime.CompilerServices;
using Tessera.VideoStream.Demo.Streaming;

namespace Tessera.VideoStream.Demo.Tests;

/// <summary>Replays the committed fixture through the real reader, in place of an FFmpeg process.</summary>
public sealed class FixtureFragmentSource : IFragmentSource
{
    public async IAsyncEnumerable<FragmentEvent> ReadAsync([EnumeratorCancellation] CancellationToken ct)
    {
        await using var stream = File.OpenRead(Fixture.Path);
        await foreach (var fragmentEvent in Mp4FragmentReader.ReadAsync(stream, ct))
            yield return fragmentEvent;
    }
}
