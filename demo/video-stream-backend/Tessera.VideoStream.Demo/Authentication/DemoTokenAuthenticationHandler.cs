using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Tessera.VideoStream.Demo.Authentication;

/// <summary>
/// Accepts the one configured <c>Demo:AccessToken</c> as a bearer token. A real host replaces this
/// scheme with its identity provider's; the hub does not change.
/// </summary>
public sealed class DemoTokenAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IConfiguration configuration) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string Scheme = "DemoToken";
    public const string HubPath = "/hubs/video";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var token = BearerToken();
        if (token is null) return Task.FromResult(AuthenticateResult.NoResult());
        var expected = Encoding.UTF8.GetBytes(configuration["Demo:AccessToken"] ?? "");
        if (expected.Length == 0 || !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(token), expected))
            return Task.FromResult(AuthenticateResult.Fail("Invalid access token."));
        var identity = new ClaimsIdentity([new Claim(ClaimTypes.Name, "demo")], Scheme);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme)));
    }

    /// <summary>The Authorization header, or on the hub path only the WebSocket transport's query parameter.</summary>
    private string? BearerToken()
    {
        var header = Request.Headers.Authorization.ToString();
        if (header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return header["Bearer ".Length..].Trim();
        if (header.Length == 0 && Request.Path.StartsWithSegments(HubPath))
        {
            var query = Request.Query["access_token"].ToString();
            if (query.Length > 0) return query;
        }
        return null;
    }
}
