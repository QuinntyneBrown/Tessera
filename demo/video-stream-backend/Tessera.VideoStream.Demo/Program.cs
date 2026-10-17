using Microsoft.AspNetCore.HttpLogging;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using Tessera.VideoStream.Demo.Authentication;
using Tessera.VideoStream.Demo.Catalogue;
using Tessera.VideoStream.Demo.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddOptions<StreamCatalogueOptions>().Bind(builder.Configuration).ValidateOnStart();
builder.Services.AddSingleton<IValidateOptions<StreamCatalogueOptions>, StreamCatalogueValidator>();
builder.Services.AddSingleton<StreamCatalogue>();

// The one place a real host swaps in its identity provider's scheme.
builder.Services.AddAuthentication(DemoTokenAuthenticationHandler.Scheme)
    .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, DemoTokenAuthenticationHandler>(
        DemoTokenAuthenticationHandler.Scheme, null);
builder.Services.AddAuthorization();

// Request logs carry no query string, because the WebSocket transport puts the token there; the
// hosting diagnostics that log full URLs stay at Warning.
builder.Logging.AddFilter("Microsoft.AspNetCore.Hosting.Diagnostics", LogLevel.Warning);
builder.Services.AddHttpLogging(options => options.LoggingFields =
    HttpLoggingFields.RequestMethod | HttpLoggingFields.RequestPath | HttpLoggingFields.ResponseStatusCode | HttpLoggingFields.Duration);

builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

builder.Services.AddSignalR().AddMessagePackProtocol();
// MessagePack only: a JSON client is refused at the handshake.
builder.Services.Configure<HubOptions>(options => options.SupportedProtocols = ["messagepack"]);

var app = builder.Build();

app.UseHttpLogging();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapHub<VideoStreamHub>(DemoTokenAuthenticationHandler.HubPath);
app.MapDemoToken();

app.Run();
