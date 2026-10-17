// Acceptance tests. Traces to L2-087, L2-088, L2-089 and L2-093.
using System.Diagnostics;
using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Tessera.VideoStream.Demo.Catalogue;
using Tessera.VideoStream.Demo.Sessions;
using Tessera.VideoStream.Demo.Streaming;

namespace Tessera.VideoStream.Demo.Tests;

public class HubStreamingTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static DemoFactory WithSource(IFragmentSource source) =>
        new(services: s => s.AddSingleton<Func<StreamCatalogueEntry, IFragmentSource>>(_ => source));

    [Fact]
    public async Task Subscribe_streams_the_init_segment_then_fragments_and_completes_at_the_end()
    {
        // L2-088 AC3, L2-087 AC2, L2-093 AC4: integer-keyed kind, seq and data; kind 0 first, seq
        // increasing by 1, and completion when the finite source ends.
        await using var factory = WithSource(new FixtureFragmentSource());
        await using var connection = await factory.ConnectAsync();

        var chunks = new List<object[]>();
        await foreach (var chunk in connection.StreamAsync<object[]>("Subscribe", "lab-camera-short", Ct))
            chunks.Add(chunk);

        Assert.All(chunks, c => Assert.Equal(3, c.Length));
        Assert.Equal(0, Convert.ToInt32(chunks[0][0]));
        Assert.All(chunks.Skip(1), c => Assert.Equal(1, Convert.ToInt32(c[0])));
        Assert.Equal(Enumerable.Range(0, chunks.Count), chunks.Select(c => Convert.ToInt32(c[1])));
        Assert.Equal(ScriptedFragmentSource.Init.Bytes.ToArray(), (byte[])chunks[0][2]);
        Assert.InRange(chunks.Count, 10, 12);
    }

    [Fact]
    public async Task A_source_failure_reaches_the_client_as_a_hub_exception()
    {
        // L2-088 AC3: a failed source ends the stream with the HubException text only.
        var source = new ScriptedFragmentSource();
        await using var factory = WithSource(source);
        await using var connection = await factory.ConnectAsync();
        var stream = connection.StreamAsync<object[]>("Subscribe", "lecture-hall-a", Ct).GetAsyncEnumerator(Ct);
        var first = stream.MoveNextAsync().AsTask();
        await Eventually.True(() => source.Starts == 1, "the source starts");

        source.Fail(new SourceFailedException("ffmpeg not found", retryable: false));

        var error = await Assert.ThrowsAsync<HubException>(() => first);
        Assert.EndsWith("source-failed: ffmpeg not found", error.Message);
    }

    [Fact]
    public async Task A_disposed_stream_leaves_the_session_within_one_second()
    {
        // L2-088 AC5: cancelling the client stream removes the subscriber within 1 s.
        var source = new ScriptedFragmentSource();
        await using var factory = WithSource(source);
        await using var connection = await factory.ConnectAsync();
        var registry = factory.Services.GetRequiredService<StreamSessionRegistry>();
        using var subscription = CancellationTokenSource.CreateLinkedTokenSource(Ct);
        var stream = connection.StreamAsync<object[]>("Subscribe", "lecture-hall-a", subscription.Token).GetAsyncEnumerator(Ct);
        source.EmitInit();
        Assert.True(await stream.MoveNextAsync());
        Assert.Equal(1, registry.Find("lecture-hall-a")!.SubscriberCount);

        var clock = Stopwatch.StartNew();
        await subscription.CancelAsync();

        await Eventually.True(() => registry.Find("lecture-hall-a")!.SubscriberCount == 0, "the subscriber is removed");
        Assert.True(clock.Elapsed < TimeSpan.FromSeconds(1), $"Removal took {clock.Elapsed}.");
    }

    [Fact]
    public async Task Describe_reports_when_the_running_session_started()
    {
        // L2-088 AC2: startedAt is the active session's start, so every viewer sees the same.
        var source = new ScriptedFragmentSource();
        await using var factory = WithSource(source);
        await using var connection = await factory.ConnectAsync();
        _ = connection.StreamAsync<object[]>("Subscribe", "lecture-hall-a", Ct).GetAsyncEnumerator(Ct).MoveNextAsync();
        await Eventually.True(() => source.Starts == 1, "the session starts");
        var session = factory.Services.GetRequiredService<StreamSessionRegistry>().Find("lecture-hall-a")!;
        await Task.Delay(20, Ct);

        var descriptor = await connection.InvokeAsync<object[]>("Describe", "lecture-hall-a", Ct);

        Assert.Equal(session.StartedAt.UtcDateTime.ToString("O"), descriptor[3]);
    }

    [Fact]
    public async Task A_one_megabyte_chunk_is_delivered_and_the_stream_buffer_holds_10()
    {
        // L2-088 AC4.
        await using var factory = WithSource(new LargeFragmentSource());
        await using var connection = await factory.ConnectAsync();

        var chunks = new List<object[]>();
        await foreach (var chunk in connection.StreamAsync<object[]>("Subscribe", "lab-camera-short", Ct))
            chunks.Add(chunk);

        Assert.Equal(1024 * 1024, ((byte[])chunks[1][2]).Length);
        var hub = factory.Services.GetRequiredService<IOptions<HubOptions>>().Value;
        Assert.Equal(10, hub.StreamBufferCapacity);
        Assert.True(hub.MaximumReceiveMessageSize >= 1024 * 1024);
    }

    [Fact]
    public async Task Shutdown_stops_every_source_within_5_seconds()
    {
        // L2-089 AC5: every FFmpeg process (here, the stand-in source) is stopped on shutdown.
        var source = new ScriptedFragmentSource();
        var factory = WithSource(source);
        var connection = await factory.ConnectAsync();
        var stream = connection.StreamAsync<object[]>("Subscribe", "lecture-hall-a", Ct).GetAsyncEnumerator(Ct);
        source.EmitInit();
        Assert.True(await stream.MoveNextAsync());

        var clock = Stopwatch.StartNew();
        await factory.DisposeAsync();

        Assert.Equal(1, source.Cancellations);
        Assert.True(clock.Elapsed < TimeSpan.FromSeconds(5), $"Shutdown took {clock.Elapsed}.");
        await connection.DisposeAsync();
    }

    private sealed class LargeFragmentSource : IFragmentSource
    {
        public async IAsyncEnumerable<FragmentEvent> ReadAsync([EnumeratorCancellation] CancellationToken ct)
        {
            await Task.Yield();
            yield return ScriptedFragmentSource.Init;
            yield return new Fragment(new byte[1024 * 1024]);
        }
    }
}
