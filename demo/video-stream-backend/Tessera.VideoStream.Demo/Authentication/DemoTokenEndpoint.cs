namespace Tessera.VideoStream.Demo.Authentication;

/// <summary>
/// <c>GET /demo/token</c> hands the demonstration token to the dev app so it carries no secret in
/// source. A real host does not expose an endpoint like this.
/// </summary>
public static class DemoTokenEndpoint
{
    public static void MapDemoToken(this IEndpointRouteBuilder app) =>
        app.MapGet("/demo/token", (IConfiguration configuration) => new { token = configuration["Demo:AccessToken"] });
}
