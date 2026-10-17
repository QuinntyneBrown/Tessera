// Acceptance tests. Traces to L2-091 and L2-094.
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Tessera.VideoStream.Demo.Catalogue;
using Tessera.VideoStream.Demo.Streaming;

namespace Tessera.VideoStream.Demo.Tests;

public class HealthTests
{
    private static readonly string Missing = Path.Combine(Path.GetTempPath(), "no-such-dir", "ffmpeg");

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Without_FFmpeg_health_is_unhealthy_Describe_works_and_Subscribe_fails()
    {
        // L2-091 AC4, L2-094 AC3: a clear startup error naming the path, an unhealthy report,
        // Describe unaffected, Subscribe ending with source-failed.
        await using var factory = new DemoFactory(new() { ["Ffmpeg:Path"] = Missing });

        var response = await factory.CreateClient().GetAsync("/healthz", Ct);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var health = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal("Unhealthy", health.GetProperty("status").GetString());
        Assert.False(health.GetProperty("ffmpeg").GetBoolean());
        Assert.Equal(0, health.GetProperty("activeSessions").GetInt32());
        Assert.Contains(factory.Logs.Entries, e => e.Level == LogLevel.Error && e.Message.Contains(Missing));

        await using var connection = await factory.ConnectAsync();
        Assert.Equal("Lecture hall A", (await connection.InvokeAsync<object[]>("Describe", "lecture-hall-a", Ct))[1]);
        var error = await Assert.ThrowsAsync<HubException>(async () =>
        {
            await foreach (var _ in connection.StreamAsync<object[]>("Subscribe", "lecture-hall-a", Ct)) { }
        });
        Assert.EndsWith("source-failed: ffmpeg not found", error.Message);
    }

    [Fact]
    public async Task Health_reports_the_active_session_count()
    {
        // L2-094 AC3.
        var source = new ScriptedFragmentSource();
        await using var factory = new DemoFactory(new() { ["Ffmpeg:Path"] = Missing },
            s => s.AddSingleton<Func<StreamCatalogueEntry, IFragmentSource>>(_ => source));
        await using var connection = await factory.ConnectAsync();
        _ = connection.StreamAsync<object[]>("Subscribe", "lecture-hall-a", Ct).GetAsyncEnumerator(Ct).MoveNextAsync();
        await Eventually.True(() => source.Starts == 1, "the session starts");
        var response = await factory.CreateClient().GetAsync("/healthz", Ct);

        var health = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(1, health.GetProperty("activeSessions").GetInt32());
    }
}
