using System.Buffers;
using System.Buffers.Binary;
using System.IO.Pipelines;
using System.Runtime.CompilerServices;
using System.Text;

namespace Tessera.VideoStream.Demo.Streaming;

/// <summary>
/// Splits a fragmented-MP4 byte stream into one initialisation segment (<c>ftyp</c> + <c>moov</c>)
/// and fragments (<c>moof</c> + <c>mdat</c>). A box split across reads is reassembled first.
/// </summary>
public static class Mp4FragmentReader
{
    private const int HeaderSize = 8;

    public static async IAsyncEnumerable<FragmentEvent> ReadAsync(
        Stream stream,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var reader = PipeReader.Create(stream, new StreamPipeReaderOptions(leaveOpen: true));
        var init = new List<byte[]>();
        byte[]? moof = null;
        try
        {
            while (true)
            {
                var (type, box) = await ReadBoxAsync(reader, ct);
                if (box is null) yield break;
                switch (type)
                {
                    case "ftyp" or "moov":
                        init.Add(box);
                        if (type == "moov")
                        {
                            yield return new InitSegment(Concat(init));
                            init.Clear();
                        }
                        break;
                    case "moof":
                        moof = box;
                        break;
                    case "mdat" when moof is not null:
                        yield return new Fragment(Concat([moof, box]));
                        moof = null;
                        break;
                    // sidx, free, mfra and any other box carry nothing the player needs.
                }
            }
        }
        finally
        {
            await reader.CompleteAsync();
        }
    }

    /// <summary>Reads one whole box, or returns a null box at a clean end of stream.</summary>
    private static async Task<(string Type, byte[]? Box)> ReadBoxAsync(PipeReader reader, CancellationToken ct)
    {
        while (true)
        {
            var result = await reader.ReadAsync(ct);
            var buffer = result.Buffer;
            if (buffer.Length >= HeaderSize)
            {
                Span<byte> header = stackalloc byte[HeaderSize];
                buffer.Slice(0, HeaderSize).CopyTo(header);
                var size = BinaryPrimitives.ReadUInt32BigEndian(header);
                if (size is 0 or 1)
                    throw new InvalidDataException($"Unsupported MP4 box size {size}.");
                if (size < HeaderSize)
                    throw new InvalidDataException($"Invalid MP4 box size {size}.");
                if (buffer.Length >= size)
                {
                    var box = buffer.Slice(0, size).ToArray();
                    reader.AdvanceTo(buffer.GetPosition(size));
                    return (Encoding.ASCII.GetString(header[4..]), box);
                }
            }
            if (result.IsCompleted)
            {
                if (buffer.Length > 0) throw new InvalidDataException("The MP4 stream ended inside a box.");
                return ("", null);
            }
            reader.AdvanceTo(buffer.Start, buffer.End);
        }
    }

    private static byte[] Concat(List<byte[]> parts)
    {
        var bytes = new byte[parts.Sum(p => p.Length)];
        var offset = 0;
        foreach (var part in parts)
        {
            part.CopyTo(bytes, offset);
            offset += part.Length;
        }
        return bytes;
    }
}
