// Acceptance tests. Traces to L2-087, L2-089, L2-090 and L2-093.
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Time.Testing;
using Tessera.VideoStream.Demo.Contracts;
using Tessera.VideoStream.Demo.Sessions;

namespace Tessera.VideoStream.Demo.Tests;

public sealed class LiveStreamSessionTests : IAsyncDisposable
{
    private readonly FakeTimeProvider time = new();
    private readonly ScriptedFragmentSource source = new();
    private readonly CollectingLoggerProvider logs = new();
    private readonly ILogger logger;
    private readonly LiveStreamSession session;
    private int ended;

    public LiveStreamSessionTests()
    {
        logger = logs.CreateLogger("session");
        session = new LiveStreamSession("lecture-hall-a", source, time, new StreamSessionOptions(), logger, _ => ended++);
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

    [Fact]
    public async Task A_full_channel_drops_the_oldest_fragments_and_leaves_a_seq_gap()
    {
        // L2-090 AC1 and AC4, L2-087 AC4: capacity 30, oldest dropped first, the drop counted and
        // logged with the stream and the count, and the receiver sees the gap in seq.
        var stalled = Attach();
        source.EmitInit();
        await Read(stalled, 1);

        source.Emit(40);
        await Eventually.True(() => stalled.Dropped == 10, "ten fragments are dropped");

        var kept = await Read(stalled, 30);
        Assert.Equal(11u, kept[0].Seq);
        Assert.Equal(40u, kept[^1].Seq);
        var warning = logs.Entries.Last(e => e.Level == LogLevel.Warning).Message;
        Assert.Contains("lecture-hall-a", warning);
        Assert.Contains("connection-1", warning);
        Assert.Contains("10", warning);
    }

    [Fact]
    public async Task One_slow_subscriber_does_not_hold_up_nineteen_others()
    {
        // L2-090 AC3: the broadcaster never waits for a subscriber, so the others get every chunk.
        var slow = Attach();
        var healthy = Enumerable.Range(0, 19).Select(_ => Attach()).ToList();
        var reads = healthy.Select(subscriber => Read(subscriber, 41)).ToList();
        source.EmitInit();

        source.Emit(40);

        foreach (var chunks in await Task.WhenAll(reads))
            Assert.Equal(Enumerable.Range(0, 41).Select(i => (uint)i), chunks.Select(c => c.Seq));
        await Eventually.True(() => slow.Dropped == 11, "the slow subscriber drops its oldest chunks");
    }

    [Fact]
    public async Task The_sweep_evicts_a_subscriber_that_stopped_draining_for_60_seconds()
    {
        // L2-090 AC2: a subscriber with queued chunks unread for 60 s ends with slow-consumer at
        // the next 10 s sweep; one that keeps draining stays, even with nothing new to read.
        var stalled = Attach();
        var draining = Attach();
        source.EmitInit();
        source.Emit();
        await Read(stalled, 1);
        await Read(draining, 2);

        time.Advance(TimeSpan.FromSeconds(50));
        Assert.Equal(2, session.SubscriberCount);
        time.Advance(TimeSpan.FromSeconds(20));

        Assert.Equal(1, session.SubscriberCount);
        var error = await Assert.ThrowsAsync<HubException>(() => Read(stalled, 1));
        Assert.Equal("slow-consumer", error.Message);
        source.Emit();
        Assert.Equal(VideoChunk.Media, (await Read(draining, 1))[0].Kind);
    }

    public async ValueTask DisposeAsync() => await session.StopAsync();

    private StreamSubscriber NewSubscriber() => new($"connection-{++connections}", "lecture-hall-a", time, logger);

    private int connections;

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
