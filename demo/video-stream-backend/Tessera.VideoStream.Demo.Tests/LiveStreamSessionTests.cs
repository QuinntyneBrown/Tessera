// Acceptance tests. Traces to L2-087, L2-089 and L2-093.
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Tessera.VideoStream.Demo.Contracts;
using Tessera.VideoStream.Demo.Sessions;

namespace Tessera.VideoStream.Demo.Tests;

public sealed class LiveStreamSessionTests : IAsyncDisposable
{
    private readonly FakeTimeProvider time = new();
    private readonly ScriptedFragmentSource source = new();
    private readonly LiveStreamSession session;
    private int ended;

    public LiveStreamSessionTests()
    {
        session = new LiveStreamSession("lecture-hall-a", source, time, new StreamSessionOptions(),
            NullLogger.Instance, _ => ended++);
    }

    [Fact]
    public async Task The_source_starts_on_the_first_subscriber_and_is_shared()
    {
        // L2-089 AC1: no process before the first subscriber; Starting until the init is parsed.
        Assert.Equal(0, source.Starts);

        var first = Attach();
        await Eventually.True(() => source.Starts == 1, "the source starts");
        Assert.Equal(SessionState.Starting, session.State);

        source.EmitInit();
        await Eventually.True(() => session.State == SessionState.Live, "the session is live");
        Attach();
        await Task.Delay(50, TestContext.Current.CancellationToken);
        Assert.Equal(1, source.Starts);
        Assert.Equal(2, session.SubscriberCount);
        Assert.NotNull(first);
    }

    [Fact]
    public async Task An_early_subscriber_receives_the_init_segment_before_any_media()
    {
        // L2-087 AC2 and AC4: init first, then media, seq increasing by 1 from 0.
        var subscriber = Attach();
        source.EmitInit();
        var media = source.Emit(2);

        var chunks = await Read(subscriber, 3);

        Assert.Equal([VideoChunk.Init, VideoChunk.Media, VideoChunk.Media], chunks.Select(c => c.Kind));
        Assert.Equal([0u, 1u, 2u], chunks.Select(c => c.Seq));
        Assert.Equal(ScriptedFragmentSource.Init.Bytes.ToArray(), chunks[0].Data);
        Assert.Equal(media[1].Bytes.ToArray(), chunks[2].Data);
    }

    [Fact]
    public async Task A_late_subscriber_receives_the_cached_init_then_media_from_the_next_fragment()
    {
        // L2-087 AC1: kind 0 seq 0 with the cached bytes, and no earlier fragment is replayed.
        var early = Attach();
        source.EmitInit();
        source.Emit(3);
        await Read(early, 4);

        var late = Attach();
        var next = source.Emit();
        var chunks = await Read(late, 2);

        Assert.Equal(VideoChunk.Init, chunks[0].Kind);
        Assert.Equal(0u, chunks[0].Seq);
        Assert.Equal(ScriptedFragmentSource.Init.Bytes.ToArray(), chunks[0].Data);
        Assert.Equal(VideoChunk.Media, chunks[1].Kind);
        Assert.Equal(1u, chunks[1].Seq);
        Assert.Equal(next[0].Bytes.ToArray(), chunks[1].Data);
    }

    [Fact]
    public async Task The_session_stops_after_the_grace_period_and_is_reused_within_it()
    {
        // L2-089 AC2 and AC3: 10 s after the last subscriber leaves, the source is cancelled and the
        // init cache cleared; a subscriber arriving sooner reuses the running source.
        var first = Attach();
        source.EmitInit();
        await Eventually.True(() => session.State == SessionState.Live, "the session is live");

        session.Detach(first);
        time.Advance(TimeSpan.FromSeconds(9));
        var returning = Attach();
        time.Advance(TimeSpan.FromSeconds(5));
        Assert.Equal(SessionState.Live, session.State);
        Assert.Equal(VideoChunk.Init, (await Read(returning, 1))[0].Kind);

        session.Detach(returning);
        time.Advance(TimeSpan.FromSeconds(10));
        await Eventually.True(() => source.Cancellations == 1, "the source is cancelled");
        Assert.Equal(SessionState.Stopped, session.State);
        Assert.Null(session.CurrentInit);
        Assert.Equal(1, source.Starts);
        Assert.Equal(1, ended);
        Assert.False(session.TryAttach(NewSubscriber()));
    }

    [Fact]
    public async Task The_end_of_a_finite_source_completes_every_subscriber()
    {
        // L2-089 AC4: FFmpeg exiting 0 at end of file completes each stream and ends the session.
        var subscribers = new[] { Attach(), Attach() };
        source.EmitInit();
        source.Emit(2);
        source.End();

        foreach (var subscriber in subscribers)
            Assert.Equal(3, (await Read(subscriber, int.MaxValue)).Count);
        await Eventually.True(() => ended == 1, "the session ends");
        Assert.Equal(SessionState.Stopped, session.State);
    }

    public async ValueTask DisposeAsync() => await session.StopAsync();

    private StreamSubscriber NewSubscriber() => new("connection", "lecture-hall-a", time, NullLogger.Instance);

    private StreamSubscriber Attach()
    {
        var subscriber = NewSubscriber();
        Assert.True(session.TryAttach(subscriber));
        return subscriber;
    }

    /// <summary>Reads up to <paramref name="count"/> chunks, or all of them until the stream completes.</summary>
    private static async Task<List<VideoChunk>> Read(StreamSubscriber subscriber, int count)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(5));
        var chunks = new List<VideoChunk>();
        await foreach (var chunk in subscriber.ReadAllAsync(timeout.Token))
        {
            chunks.Add(chunk);
            if (chunks.Count == count) break;
        }
        return chunks;
    }
}
