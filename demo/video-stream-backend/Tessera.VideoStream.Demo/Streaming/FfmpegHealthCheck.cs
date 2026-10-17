using System.Diagnostics;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Tessera.VideoStream.Demo.Sessions;

namespace Tessera.VideoStream.Demo.Streaming;

/// <summary><c>/healthz</c>: whether <c>{Ffmpeg:Path} -version</c> succeeds, and how many sessions are live.</summary>
public sealed class FfmpegHealthCheck(IConfiguration configuration, StreamSessionRegistry registry) : IHealthCheck
{
    private static readonly TimeSpan ProbeTimeout = TimeSpan.FromSeconds(5);

    public static string PathFrom(IConfiguration configuration) => configuration["Ffmpeg:Path"] ?? "ffmpeg";

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        var path = PathFrom(configuration);
        var available = await ProbeAsync(path, ct);
        var data = new Dictionary<string, object> { ["ffmpeg"] = available, ["activeSessions"] = registry.ActiveSessions };
        return available
            ? HealthCheckResult.Healthy(data: data)
            : HealthCheckResult.Unhealthy($"FFmpeg was not found or failed at '{path}'.", data: data);
    }

    /// <summary>True when the executable runs <c>-version</c> and exits 0 within 5 s.</summary>
    public static async Task<bool> ProbeAsync(string path, CancellationToken ct)
    {
        try
        {
            using var process = FfmpegProcess.Start(path, ["-version"], Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(ProbeTimeout);
            await process.StandardOutput.CopyToAsync(Stream.Null, timeout.Token);
            await process.WaitForExitAsync(timeout.Token);
            return process.ExitCode == 0;
        }
        catch (Exception error) when (error is SourceFailedException or OperationCanceledException)
        {
            return false;
        }
    }
}
