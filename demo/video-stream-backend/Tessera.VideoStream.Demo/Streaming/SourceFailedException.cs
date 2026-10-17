namespace Tessera.VideoStream.Demo.Streaming;

/// <summary>
/// A source run that failed. <see cref="Exception.Message"/> becomes the client's
/// <c>source-failed: {reason}</c> text, so it never carries FFmpeg output.
/// </summary>
public sealed class SourceFailedException(string reason, bool retryable = true) : Exception(reason)
{
    /// <summary>False when the source could not start at all, so restarting cannot help.</summary>
    public bool Retryable => retryable;
}
