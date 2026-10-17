namespace Tessera.VideoStream.Demo.Catalogue;

/// <summary>The top-level <c>MediaRoot</c> and <c>Streams</c> configuration keys.</summary>
public sealed class StreamCatalogueOptions
{
    public string MediaRoot { get; set; } = "media";

    public Dictionary<string, StreamCatalogueEntry> Streams { get; set; } = [];
}

/// <summary>One <c>Streams:{id}</c> entry.</summary>
public sealed class StreamCatalogueEntry
{
    public const string DefaultCodecs = "avc1.4d401f,mp4a.40.2";

    public string Title { get; set; } = "";

    /// <summary>A path relative to <see cref="StreamCatalogueOptions.MediaRoot"/>.</summary>
    public string File { get; set; } = "";

    public bool Loop { get; set; }

    public string Codecs { get; set; } = DefaultCodecs;

    /// <summary>The full path of <see cref="File"/>, set when the catalogue is built.</summary>
    public string ResolvedPath { get; set; } = "";

    public string MimeType => $"video/mp4; codecs=\"{Codecs}\"";
}
