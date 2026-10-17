using System.Runtime.CompilerServices;
using Tessera.VideoStream.Demo.Catalogue;

namespace Tessera.VideoStream.Demo.Streaming;

/// <summary>
/// The demonstration's source: one FFmpeg run per enumeration, parsed into init segments and
/// fragments. A non-zero exit, unreadable output, or a hung process ends the run with a
/// <see cref="SourceFailedException"/> naming only the exit code.
/// </summary>
public sealed class FfmpegFragmentSource(StreamCatalogueEntry entry, string executable, TimeProvider time, ILogger logger)
    : IFragmentSource
{
    public async IAsyncEnumerable<FragmentEvent> ReadAsync([EnumeratorCancellation] CancellationToken ct)
    {
        using var process = FfmpegProcess.Start(executable, FfmpegProcess.Arguments(entry), logger);
        var failure = "";
        await using var stdout = new StdoutWatchdog(process.StandardOutput, time, () =>
        {
            failure = "no output for 15 s";
            process.KillTree();
        });
        var events = Mp4FragmentReader.ReadAsync(stdout, ct).GetAsyncEnumerator(ct);
        try
        {
            while (true)
            {
                try
                {
                    if (!await events.MoveNextAsync()) break;
                }
                catch (InvalidDataException error)
                {
                    failure = error.Message;
                    process.KillTree();
                    break;
                }
                yield return events.Current;
            }
            await process.WaitForExitAsync(ct);
        }
        finally
        {
            await events.DisposeAsync();
            process.KillTree();
        }

        if (failure.Length == 0 && process.ExitCode == 0) yield break;
        logger.LogError("FFmpeg exited {ExitCode}{Failure}. Last standard error lines:{NewLine}{Stderr}",
            process.ExitCode, failure.Length > 0 ? $" ({failure})" : "", Environment.NewLine,
            string.Join(Environment.NewLine, process.StderrTail));
        throw new SourceFailedException($"ffmpeg exited {process.ExitCode}");
    }
}
