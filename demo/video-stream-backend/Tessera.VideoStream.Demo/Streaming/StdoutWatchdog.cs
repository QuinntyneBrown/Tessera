namespace Tessera.VideoStream.Demo.Streaming;

/// <summary>
/// Wraps FFmpeg's standard output and reports, once, when no bytes have arrived for 15 s while the
/// process should be producing a live stream.
/// </summary>
public sealed class StdoutWatchdog : Stream
{
    public static readonly TimeSpan Limit = TimeSpan.FromSeconds(15);

    private readonly Stream inner;
    private readonly TimeProvider time;
    private readonly Action onHung;
    private readonly ITimer timer;
    private DateTimeOffset lastBytes;
    private int fired;

    public StdoutWatchdog(Stream inner, TimeProvider time, Action onHung)
    {
        this.inner = inner;
        this.time = time;
        this.onHung = onHung;
        lastBytes = time.GetUtcNow();
        timer = time.CreateTimer(_ => Check(), null, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(1));
    }

    public long BytesRead { get; private set; }

    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        var count = await inner.ReadAsync(buffer, cancellationToken);
        Record(count);
        return count;
    }

    public override int Read(byte[] buffer, int offset, int count)
    {
        var read = inner.Read(buffer, offset, count);
        Record(read);
        return read;
    }

    public override async ValueTask DisposeAsync()
    {
        await timer.DisposeAsync();
        await base.DisposeAsync();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) timer.Dispose();
        base.Dispose(disposing);
    }

    private void Record(int count)
    {
        if (count == 0) return;
        BytesRead += count;
        lastBytes = time.GetUtcNow();
    }

    private void Check()
    {
        if (time.GetUtcNow() - lastBytes >= Limit && Interlocked.Exchange(ref fired, 1) == 0) onHung();
    }

    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => throw new NotSupportedException();
    public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
    public override void Flush() { }
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
}
