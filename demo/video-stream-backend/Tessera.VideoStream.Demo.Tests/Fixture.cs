namespace Tessera.VideoStream.Demo.Tests;

/// <summary>The committed ten-second fragmented MP4 fixture.</summary>
internal static class Fixture
{
    public static string Path { get; } =
        System.IO.Path.Combine(AppContext.BaseDirectory, "Fixtures", "lecture-10s.fmp4");

    public static byte[] Bytes => File.ReadAllBytes(Path);
}

/// <summary>A stream that hands out its bytes in slices of fixed sizes, cycling through them.</summary>
internal sealed class SlicingStream(byte[] bytes, params int[] sliceSizes) : Stream
{
    private int position;
    private int next;

    public override int Read(byte[] buffer, int offset, int count)
    {
        var size = Math.Min(Math.Min(count, sliceSizes[next++ % sliceSizes.Length]), bytes.Length - position);
        Array.Copy(bytes, position, buffer, offset, size);
        position += size;
        return size;
    }

    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => throw new NotSupportedException();
    public override long Position { get => position; set => throw new NotSupportedException(); }
    public override void Flush() { }
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
}
