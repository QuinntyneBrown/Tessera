// Acceptance tests. Traces to L2-086 and L2-093.
using Tessera.VideoStream.Demo.Streaming;

namespace Tessera.VideoStream.Demo.Tests;

public class Mp4FragmentReaderTests
{
    public static TheoryData<int[]> SliceSizes => new()
    {
        new[] { 1 },
        new[] { 7 },
        new[] { 4096 },
        // 3 then 5 splits every 8-byte box header that does not happen to align.
        new[] { 3, 5 },
    };

    [Theory]
    [MemberData(nameof(SliceSizes))]
    public async Task Yields_one_init_segment_then_fragments_whatever_the_read_sizes(int[] sizes)
    {
        // L2-086 AC2 and AC5: the fixture yields one ftyp+moov segment first, then 10 ± 1
        // moof+mdat fragments, however standard output is sliced.
        var events = await ReadAll(new SlicingStream(Fixture.Bytes, sizes));

        Assert.IsType<InitSegment>(events[0]);
        Assert.Equal("ftyp", BoxType(events[0].Bytes, 0));
        Assert.Contains("moov", BoxTypes(events[0].Bytes));
        var fragments = events.Skip(1).ToList();
        Assert.All(fragments, e => Assert.IsType<Fragment>(e));
        Assert.All(fragments, e => Assert.Equal(["moof", "mdat"], BoxTypes(e.Bytes)));
        Assert.InRange(fragments.Count, 9, 11);
    }

    [Fact]
    public async Task Reassembles_the_whole_fixture_without_losing_bytes()
    {
        // L2-086 AC2: no byte of the init segment or of any fragment is lost or duplicated.
        var bytes = Fixture.Bytes;
        var events = await ReadAll(new SlicingStream(bytes, 3, 5));

        // The fixture's only other box is a trailing index, so the events are a prefix of the file.
        var joined = events.SelectMany(e => e.Bytes.ToArray()).ToArray();
        Assert.Equal(bytes.AsSpan(0, joined.Length).ToArray(), joined);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    public async Task Rejects_box_sizes_a_live_stream_never_uses(int size)
    {
        // L2-086 AC3: size 0 (to end of file) and size 1 (64-bit size) throw InvalidDataException.
        var bytes = new byte[16];
        bytes[3] = (byte)size;
        "ftyp"u8.CopyTo(bytes.AsSpan(4));

        await Assert.ThrowsAsync<InvalidDataException>(() => ReadAll(new MemoryStream(bytes)));
    }

    private static async Task<List<FragmentEvent>> ReadAll(Stream stream)
    {
        var events = new List<FragmentEvent>();
        await foreach (var e in Mp4FragmentReader.ReadAsync(stream, TestContext.Current.CancellationToken))
            events.Add(e);
        return events;
    }

    private static string BoxType(ReadOnlyMemory<byte> bytes, int offset) =>
        System.Text.Encoding.ASCII.GetString(bytes.Span.Slice(offset + 4, 4));

    private static List<string> BoxTypes(ReadOnlyMemory<byte> bytes)
    {
        var types = new List<string>();
        for (var offset = 0; offset < bytes.Length;)
        {
            types.Add(BoxType(bytes, offset));
            offset += (int)System.Buffers.Binary.BinaryPrimitives.ReadUInt32BigEndian(bytes.Span[offset..]);
        }
        return types;
    }
}
