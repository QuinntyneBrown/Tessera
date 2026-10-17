using System.Diagnostics.CodeAnalysis;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;

namespace Tessera.VideoStream.Demo.Catalogue;

/// <summary>
/// The configured streams, looked up by identifier only. A client never supplies a path, and every
/// catalogued file has been checked at startup to lie under the media root.
/// </summary>
public sealed class StreamCatalogue(IOptions<StreamCatalogueOptions> options)
{
    private readonly IReadOnlyDictionary<string, StreamCatalogueEntry> entries = options.Value.Streams;

    public bool TryGet(string streamId, [NotNullWhen(true)] out StreamCatalogueEntry? entry) =>
        entries.TryGetValue(streamId, out entry);
}

public static partial class StreamIdValidator
{
    public static bool IsValid([NotNullWhen(true)] string? streamId) => streamId is not null && Pattern().IsMatch(streamId);

    [GeneratedRegex("^[a-z0-9][a-z0-9-]{0,63}$")]
    private static partial Regex Pattern();
}

/// <summary>Resolves each entry's file and fails startup, naming the entry, when it escapes the media root.</summary>
public sealed class StreamCatalogueValidator(IHostEnvironment environment) : IValidateOptions<StreamCatalogueOptions>
{
    public ValidateOptionsResult Validate(string? name, StreamCatalogueOptions options)
    {
        var root = Path.GetFullPath(options.MediaRoot, environment.ContentRootPath);
        var rootWithSeparator = Path.EndsInDirectorySeparator(root) ? root : root + Path.DirectorySeparatorChar;
        var failures = new List<string>();
        foreach (var (id, entry) in options.Streams)
        {
            var path = Path.GetFullPath(entry.File, root);
            if (!path.StartsWith(rootWithSeparator, StringComparison.Ordinal))
                failures.Add($"Streams:{id}:File resolves outside MediaRoot.");
            else if (!File.Exists(path))
                failures.Add($"Streams:{id}:File does not exist under MediaRoot.");
            else
                entry.ResolvedPath = path;
        }
        return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
    }
}
