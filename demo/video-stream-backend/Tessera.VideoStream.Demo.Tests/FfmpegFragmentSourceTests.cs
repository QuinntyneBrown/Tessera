// Acceptance tests. Traces to L2-086, L2-091 and L2-093.
using System.IO.Pipelines;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Tessera.VideoStream.Demo.Catalogue;
using Tessera.VideoStream.Demo.Streaming;

namespace Tessera.VideoStream.Demo.Tests;

public class FfmpegFragmentSourceTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void FFmpeg_is_launched_with_an_argument_list_for_fragmented_mp4_on_stdout(bool loop)
    {
        // L2-086 AC1: one element per argument, never a shell string; -stream_loop only when looping.
        var entry = new StreamCatalogueEntry { ResolvedPath = "/media/lecture 1.mp4", Loop = loop };

        var arguments = FfmpegProcess.Arguments(entry);

        string[] expected =
        [
            "-hide_banner", "-loglevel", "warning", "-re",
            .. loop ? new[] { "-stream_loop", "-1" } : [],
            "-i", "/media/lecture 1.mp4",
            "-map", "0:v:0", "-map", "0:a:0?",
            "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-profile:v", "main",
            "-pix_fmt", "yuv420p", "-r", "30", "-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
            "-c:a", "aac", "-ar", "48000", "-b:a", "96k",
            "-f", "mp4", "-movflags", "frag_keyframe+empty_moov+default_base_moof", "-frag_duration", "1000000",
            "pipe:1",
        ];
        Assert.Equal(expected, arguments);
    }

    [Fact]
    public async Task A_process_that_fails_is_reported_by_exit_code_with_its_stderr_in_the_server_log_only()
    {
        // L2-091 AC3: stderr is drained and logged at debug, the last lines go to the server log on
        // failure, and the failure reason carries none of it. The dotnet host stands in for a
        // failing FFmpeg: it rejects the arguments on stderr and exits 1.
        var logs = new CollectingLoggerProvider();
        var source = new FfmpegFragmentSource(Entry(), DotnetHost, TimeProvider.System, logs.CreateLogger("ffmpeg"));

        var error = await Assert.ThrowsAsync<SourceFailedException>(() => Drain(source));

        Assert.Equal("ffmpeg exited 1", error.Message);
        Assert.True(error.Retryable);
        Assert.Contains(logs.Entries, e => e.Level == LogLevel.Debug && e.Message.Contains("Could not execute"));
        Assert.Contains(logs.Entries, e => e.Level == LogLevel.Error && e.Message.Contains("Could not execute"));
    }

    [Fact]
    public async Task A_missing_executable_fails_without_a_restart()
    {
        // L2-091 AC4: not found is not retryable.
        var missing = Path.Combine(Path.GetTempPath(), "no-such-dir", "ffmpeg");
        var source = new FfmpegFragmentSource(Entry(), missing, TimeProvider.System, NullLogger.Instance);

        var error = await Assert.ThrowsAsync<SourceFailedException>(() => Drain(source));

        Assert.Equal("ffmpeg not found", error.Message);
        Assert.False(error.Retryable);
    }

    [Fact]
    public async Task Fifteen_seconds_without_stdout_bytes_is_treated_as_hung()
    {
        // L2-091 AC5: the watchdog fires after 15 s of silence and not while bytes keep arriving.
        var time = new FakeTimeProvider();
        var pipe = new Pipe();
        var hung = 0;
        await using var watchdog = new StdoutWatchdog(pipe.Reader.AsStream(), time, () => hung++);
        var reading = Task.Run(async () =>
        {
            var buffer = new byte[16];
            while (await watchdog.ReadAsync(buffer, Ct) > 0) { }
        }, Ct);

        for (var i = 0; i < 4; i++)
        {
            await pipe.Writer.WriteAsync(new byte[] { 1 }, Ct);
            await Eventually.True(() => watchdog.BytesRead == i + 1, "the byte is read");
            time.Advance(TimeSpan.FromSeconds(10));
        }
        Assert.Equal(0, hung);

        time.Advance(TimeSpan.FromSeconds(5));
        Assert.Equal(1, hung);
        time.Advance(TimeSpan.FromSeconds(30));
        Assert.Equal(1, hung);
        await pipe.Writer.CompleteAsync();
        await reading;
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task The_real_pipeline_turns_the_fixture_into_an_init_segment_and_fragments()
    {
        // L2-093 AC5: opt-in; skipped when FFmpeg is not on the path.
        if (!await FfmpegHealthCheck.ProbeAsync("ffmpeg", Ct)) Assert.Skip("ffmpeg not found on PATH");
        var source = new FfmpegFragmentSource(Entry(), "ffmpeg", TimeProvider.System, NullLogger.Instance);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(Ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(30));

        var events = new List<FragmentEvent>();
        await foreach (var fragmentEvent in source.ReadAsync(timeout.Token))
        {
            events.Add(fragmentEvent);
            if (fragmentEvent is Fragment) break;
        }

        Assert.IsType<InitSegment>(events[0]);
        Assert.IsType<Fragment>(events[^1]);
        Assert.Equal(2, events.Count);
    }

    private static string DotnetHost => Environment.GetEnvironmentVariable("DOTNET_HOST_PATH") ?? "dotnet";

    private static StreamCatalogueEntry Entry() => new() { Title = "Fixture", ResolvedPath = Fixture.Path };

    private static async Task Drain(IFragmentSource source)
    {
        await foreach (var _ in source.ReadAsync(Ct)) { }
    }
}
