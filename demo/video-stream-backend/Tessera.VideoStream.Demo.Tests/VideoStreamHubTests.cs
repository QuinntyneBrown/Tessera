// Acceptance tests. Traces to L2-085, L2-086, L2-088, L2-092 and L2-093.
using System.Net;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;

namespace Tessera.VideoStream.Demo.Tests;

public class VideoStreamHubTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Negotiate_without_the_token_is_refused_with_401()
    {
        // L2-092 AC1: no token, or a wrong one, gives 401; the demonstration token is accepted.
        await using var factory = new DemoFactory();

        foreach (var token in new[] { null, "wrong-token" })
        {
            var error = await Assert.ThrowsAsync<HttpRequestException>(() => factory.Hub(token).StartAsync(Ct));
            Assert.Equal(HttpStatusCode.Unauthorized, error.StatusCode);
        }
        await using var connection = await factory.ConnectAsync();
        Assert.Equal(HubConnectionState.Connected, connection.State);
    }

    [Fact]
    public async Task A_json_protocol_client_is_refused()
    {
        // L2-088 AC1: MessagePack is the only supported protocol.
        await using var factory = new DemoFactory();
        await using var connection = factory.Hub(json: true);

        await Assert.ThrowsAnyAsync<Exception>(() => connection.StartAsync(Ct));
        Assert.NotEqual(HubConnectionState.Connected, connection.State);
    }

    [Fact]
    public async Task Describe_returns_the_integer_keyed_descriptor_of_a_catalogued_stream()
    {
        // L2-085 AC1, L2-086 AC4, L2-088 AC2: six integer-keyed members, title and mime type
        // from the catalogue entry, startedAt as ISO-8601 UTC.
        await using var factory = new DemoFactory();
        await using var connection = await factory.ConnectAsync();

        var descriptor = await connection.InvokeAsync<object[]>("Describe", "lecture-hall-a", Ct);

        Assert.Equal(6, descriptor.Length);
        Assert.Equal("lecture-hall-a", descriptor[0]);
        Assert.Equal("Lecture hall A", descriptor[1]);
        Assert.Equal("video/mp4; codecs=\"avc1.4d401f,mp4a.40.2\"", descriptor[2]);
        var startedAt = DateTimeOffset.Parse((string)descriptor[3], System.Globalization.CultureInfo.InvariantCulture);
        Assert.Equal(TimeSpan.Zero, startedAt.Offset);
        Assert.EndsWith("Z", (string)descriptor[3]);
        Assert.Equal(0, Convert.ToInt32(descriptor[4]));
        Assert.Equal(0, Convert.ToInt32(descriptor[5]));
    }

    [Fact]
    public async Task Describe_uses_the_codecs_configured_for_the_entry()
    {
        // L2-085 AC1, L2-086 AC4: Codecs from the entry make up the mime type.
        await using var factory = new DemoFactory(new()
        {
            ["Streams:custom:Title"] = "Custom",
            ["Streams:custom:File"] = "lecture-10s.fmp4",
            ["Streams:custom:Codecs"] = "avc1.42e01e",
        });
        await using var connection = await factory.ConnectAsync();

        var descriptor = await connection.InvokeAsync<object[]>("Describe", "custom", Ct);

        Assert.Equal("Custom", descriptor[1]);
        Assert.Equal("video/mp4; codecs=\"avc1.42e01e\"", descriptor[2]);
    }

    [Theory]
    [InlineData("no-such-stream")]
    [InlineData("../x")]
    [InlineData("..")]
    [InlineData("Lecture-Hall-A")]
    [InlineData("<script>alert(1)</script>")]
    [InlineData("")]
    public async Task Describe_and_Subscribe_reject_unknown_or_malformed_identifiers(string streamId)
    {
        // L2-085 AC2 and AC3: one indistinguishable unknown-stream error, and a rejected value is
        // never logged verbatim.
        await using var factory = new DemoFactory();
        await using var connection = await factory.ConnectAsync();

        var describe = await Assert.ThrowsAsync<HubException>(() => connection.InvokeAsync<object[]>("Describe", streamId, Ct));
        Assert.EndsWith("unknown-stream", describe.Message);
        var subscribe = await Assert.ThrowsAsync<HubException>(async () =>
        {
            await foreach (var _ in connection.StreamAsync<object[]>("Subscribe", streamId, Ct)) { }
        });
        Assert.EndsWith("unknown-stream", subscribe.Message);
        if (streamId.Length > 0)
            Assert.DoesNotContain(factory.Logs.Entries, e => e.Message.Contains(streamId));
    }

    [Fact]
    public async Task Startup_fails_naming_an_entry_whose_file_escapes_the_media_root()
    {
        // L2-085 AC4: the configuration error names the entry.
        await using var factory = new DemoFactory(new()
        {
            ["Streams:escape:Title"] = "Escape",
            ["Streams:escape:File"] = "../../../../package.json",
        });

        var error = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        Assert.Contains("Streams:escape", error.ToString());
    }
}
