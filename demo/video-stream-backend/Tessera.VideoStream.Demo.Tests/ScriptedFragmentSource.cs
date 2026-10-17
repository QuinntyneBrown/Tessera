using System.Runtime.CompilerServices;
using System.Threading.Channels;
using Tessera.VideoStream.Demo.Streaming;

namespace Tessera.VideoStream.Demo.Tests;

/// <summary>
/// A fragment source the test drives event by event, using the fixture's real init segment and
/// fragments. Each ReadAsync call is one "process run"; Fail and End finish the current run.
/// </summary>
public sealed class ScriptedFragmentSource : IFragmentSource
{
    private static readonly List<FragmentEvent> FixtureEvents = ReadFixture();
    private Channel<Func<FragmentEvent>> run = NewRun();
    private int nextFragment;

    public int Starts { get; private set; }

    public int Cancellations { get; private set; }

    public static InitSegment Init => (InitSegment)FixtureEvents[0];

    public static Fragment FragmentAt(int index) => (Fragment)FixtureEvents[1 + index % (FixtureEvents.Count - 1)];

    public void EmitInit() => run.Writer.TryWrite(() => Init);

    /// <summary>Emits the next fixture fragments and returns them.</summary>
    public List<Fragment> Emit(int count = 1)
    {
        var fragments = Enumerable.Range(nextFragment, count).Select(FragmentAt).ToList();
        nextFragment += count;
        foreach (var fragment in fragments) run.Writer.TryWrite(() => fragment);
        return fragments;
    }

    /// <summary>Ends the current run normally, as FFmpeg exiting 0 at end of file.</summary>
    public void End() => run.Writer.TryComplete();

    /// <summary>Ends the current run with an exception, as a failed FFmpeg process.</summary>
    public void Fail(Exception error) => run.Writer.TryWrite(() => throw error);

    public async IAsyncEnumerable<FragmentEvent> ReadAsync([EnumeratorCancellation] CancellationToken ct)
    {
        Starts++;
        var reader = run.Reader;
        try
        {
            await foreach (var next in reader.ReadAllAsync(ct))
                yield return next();
        }
        finally
        {
            if (ct.IsCancellationRequested) Cancellations++;
            if (reader == run.Reader) run = NewRun();
        }
    }

    private static Channel<Func<FragmentEvent>> NewRun() => Channel.CreateUnbounded<Func<FragmentEvent>>();

    private static List<FragmentEvent> ReadFixture()
    {
        using var stream = File.OpenRead(Fixture.Path);
        return Mp4FragmentReader.ReadAsync(stream, CancellationToken.None).ToBlockingEnumerable().ToList();
    }
}
