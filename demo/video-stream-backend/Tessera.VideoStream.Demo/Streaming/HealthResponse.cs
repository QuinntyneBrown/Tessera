using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Tessera.VideoStream.Demo.Streaming;

/// <summary>Writes <c>{ status, description, ffmpeg, activeSessions }</c>.</summary>
public static class HealthResponse
{
    public static Task WriteAsync(HttpContext context, HealthReport report)
    {
        var entry = report.Entries["ffmpeg"];
        return context.Response.WriteAsJsonAsync(new
        {
            status = report.Status.ToString(),
            description = entry.Description,
            ffmpeg = entry.Data["ffmpeg"],
            activeSessions = entry.Data["activeSessions"],
        });
    }
}
