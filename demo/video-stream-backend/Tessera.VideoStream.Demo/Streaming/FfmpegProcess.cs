using System.ComponentModel;
using System.Diagnostics;
using Tessera.VideoStream.Demo.Catalogue;

namespace Tessera.VideoStream.Demo.Streaming;

/// <summary>
/// One FFmpeg child process writing fragmented MP4 to standard output. Standard error is drained
/// continuously so it can never stall the encoder; its last lines are kept for failure reports.
/// </summary>
public sealed class FfmpegProcess : IDisposable
{
    private const int TailLines = 20;

    private readonly Process process;
    private readonly Queue<string> tail = new();

    private FfmpegProcess(Process process, ILogger logger)
    {
        this.process = process;
        process.ErrorDataReceived += (_, line) =>
        {
            if (line.Data is null) return;
            logger.LogDebug("ffmpeg: {Line}", line.Data);
            lock (tail)
            {
                tail.Enqueue(line.Data);
                if (tail.Count > TailLines) tail.Dequeue();
            }
        };
        process.BeginErrorReadLine();
    }

    public Stream StandardOutput => process.StandardOutput.BaseStream;

    public int ExitCode => process.ExitCode;

    public IReadOnlyList<string> StderrTail
    {
        get { lock (tail) return tail.ToArray(); }
    }

    /// <summary>The argument list for one catalogue entry; each element is passed as one argument.</summary>
    public static IReadOnlyList<string> Arguments(StreamCatalogueEntry entry) =>
    [
        "-hide_banner", "-loglevel", "warning", "-re",
        .. entry.Loop ? new[] { "-stream_loop", "-1" } : [],
        "-i", entry.ResolvedPath,
        "-map", "0:v:0", "-map", "0:a:0?",
        // A keyframe every second at 30 fps, so every fragment can start a decoder.
        "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-profile:v", "main",
        "-pix_fmt", "yuv420p", "-r", "30", "-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
        "-c:a", "aac", "-ar", "48000", "-b:a", "96k",
        "-f", "mp4", "-movflags", "frag_keyframe+empty_moov+default_base_moof", "-frag_duration", "1000000",
        "pipe:1",
    ];

    /// <summary>Starts the executable; a missing one is a failure that restarting cannot fix.</summary>
    public static FfmpegProcess Start(string executable, IReadOnlyList<string> arguments, ILogger logger)
    {
        var startInfo = new ProcessStartInfo(executable)
        {
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        foreach (var argument in arguments) startInfo.ArgumentList.Add(argument);
        try
        {
            return new FfmpegProcess(Process.Start(startInfo)!, logger);
        }
        catch (Exception error) when (error is Win32Exception or FileNotFoundException)
        {
            logger.LogError("FFmpeg could not be started from {Path}: {Reason}", executable, error.Message);
            throw new SourceFailedException("ffmpeg not found", retryable: false);
        }
    }

    public Task WaitForExitAsync(CancellationToken ct) => process.WaitForExitAsync(ct);

    public void KillTree()
    {
        try
        {
            process.Kill(entireProcessTree: true);
        }
        catch (InvalidOperationException)
        {
            // It has already exited.
        }
    }

    public void Dispose()
    {
        KillTree();
        process.Dispose();
    }
}
