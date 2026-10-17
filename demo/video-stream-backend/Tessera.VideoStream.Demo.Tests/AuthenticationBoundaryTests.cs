// Acceptance tests. Traces to L2-092.
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Tessera.VideoStream.Demo.Tests;

public class AuthenticationBoundaryTests
{
    private const string DevApp = "http://localhost:4200";
    private const string Elsewhere = "https://elsewhere.example";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_token_endpoint_serves_the_demonstration_token_to_an_allowed_origin()
    {
        // L2-092 AC3 and AC4: the dev app's origin gets the token with credentials allowed.
        await using var factory = new DemoFactory();
        var request = new HttpRequestMessage(HttpMethod.Get, "/demo/token") { Headers = { { "Origin", DevApp } } };

        var response = await factory.CreateClient().SendAsync(request, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(DevApp, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.Equal("true", response.Headers.GetValues("Access-Control-Allow-Credentials").Single());
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>(Ct);
        Assert.Equal(DemoFactory.Token, body!["token"]);
    }

    [Theory]
    [InlineData("/demo/token")]
    [InlineData("/hubs/video/negotiate?negotiateVersion=1")]
    public async Task An_unlisted_origin_is_refused_cross_origin_access(string path)
    {
        // L2-092 AC3: no Access-Control-Allow-Origin for an origin outside Cors:AllowedOrigins.
        await using var factory = new DemoFactory();
        var preflight = new HttpRequestMessage(HttpMethod.Options, path)
        {
            Headers =
            {
                { "Origin", Elsewhere },
                { "Access-Control-Request-Method", "POST" },
                { "Access-Control-Request-Headers", "authorization" },
            },
        };

        var response = await factory.CreateClient().SendAsync(preflight, Ct);

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task Allowed_origins_come_from_configuration()
    {
        // L2-092 AC3: Cors:AllowedOrigins replaces the default.
        await using var factory = new DemoFactory(new() { ["Cors:AllowedOrigins:0"] = Elsewhere });
        var request = new HttpRequestMessage(HttpMethod.Get, "/demo/token") { Headers = { { "Origin", Elsewhere } } };

        var response = await factory.CreateClient().SendAsync(request, Ct);

        Assert.Equal(Elsewhere, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }

    [Fact]
    public async Task The_query_token_negotiates_on_the_hub_path_and_is_never_logged()
    {
        // L2-092 AC2: the WebSocket transport's access_token parameter is accepted at the hub and
        // the query string is excluded from request logging.
        await using var factory = new DemoFactory();

        var response = await factory.CreateClient().PostAsync(
            $"/hubs/video/negotiate?negotiateVersion=1&access_token={DemoFactory.Token}", null, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(factory.Logs.Entries, e => e.Message.Contains("/hubs/video/negotiate"));
        Assert.DoesNotContain(factory.Logs.Entries, e => e.Message.Contains(DemoFactory.Token));
    }

    [Theory]
    [InlineData("/hubs/video/negotiate", true)]
    [InlineData("/demo/token", false)]
    [InlineData("/hubs/videos", false)]
    public async Task The_query_token_authenticates_on_the_hub_path_only(string path, bool authenticated)
    {
        // L2-092 AC2: anywhere else the query parameter is ignored.
        await using var factory = new DemoFactory();
        using var scope = factory.Services.CreateScope();
        var context = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
        context.Request.Path = path;
        context.Request.QueryString = new QueryString($"?access_token={DemoFactory.Token}");

        var result = await context.AuthenticateAsync("DemoToken");

        Assert.Equal(authenticated, result.Succeeded);
    }
}
