using System.Text.Json;
using Crm04.Domain.Types;

namespace Crm04.Domain.Replay;

/// <summary>
/// One record of the replay file: a full tag snapshot plus the solver diagnostics that produced it.
/// </summary>
/// <param name="N">Frame index in the original simulation run.</param>
/// <param name="DtMs">
/// Milliseconds since the START OF THE REPLAY, never an absolute timestamp. Whoever plays the
/// file back stamps wall-clock time itself, so the same file is still valid tomorrow.
/// </param>
/// <param name="Values">
/// Raw tag values, exactly as the simulation engine emitted them - no provenance, no quality.
/// Badging happens downstream in <c>TagFactory</c>, which is why a replayed frame and a gateway
/// frame are indistinguishable to everything above the source.
/// </param>
public sealed record ReplayFrame(
    int N,
    long DtMs,
    int SolverIterations,
    double GaugemeterResidualUm,
    IReadOnlyDictionary<string, TagValue> Values);

/// <summary>
/// Reader for the JSONL replay produced by <c>scripts/exportSimFrames.ts</c>.
///
/// WHY THIS LIVES IN THE DOMAIN. It is the format contract between the TypeScript exporter and
/// two separate .NET consumers - <c>Crm04.Feeder</c>, which writes the frames into Oracle, and
/// <c>Crm04.Tools.Replay</c>, which drives the pipeline without a database. Duplicating the
/// parser in both would guarantee they eventually disagree about the format. It is pure parsing
/// over a stream the caller opens, so it brings no dependency with it and the domain stays free
/// of I/O policy.
///
/// Streamed line by line rather than loaded whole: a 30-minute replay is over 50 MB.
/// </summary>
public static class ReplayFile
{
    /// <summary>
    /// Read frames lazily. The enumerable can be re-enumerated, which is how a looping feeder
    /// starts the replay again without holding the file in memory.
    /// </summary>
    public static IEnumerable<ReplayFrame> Read(string path)
    {
        foreach (var line in File.ReadLines(path))
        {
            if (line.Length == 0) continue;
            yield return ParseLine(line);
        }
    }

    public static ReplayFrame ParseLine(string line)
    {
        using var doc = JsonDocument.Parse(line);
        var root = doc.RootElement;

        var values = new Dictionary<string, TagValue>(StringComparer.Ordinal);
        foreach (var p in root.GetProperty("v").EnumerateObject())
        {
            values[p.Name] = ToTagValue(p.Value);
        }

        return new ReplayFrame(
            N: root.GetProperty("n").GetInt32(),
            DtMs: root.GetProperty("dt").GetInt64(),
            SolverIterations: root.TryGetProperty("solverIterations", out var si) ? si.GetInt32() : 0,
            GaugemeterResidualUm: root.TryGetProperty("gaugemeterResidualUm", out var gr) ? gr.GetDouble() : 0d,
            Values: values);
    }

    /// <summary>
    /// A JSON leaf to a <see cref="TagValue"/>. The four JSON scalar kinds map one-for-one onto
    /// the TypeScript union <c>number | string | boolean | null</c>, which is exactly why the
    /// replay format round-trips losslessly and a CSV would not.
    /// </summary>
    private static TagValue ToTagValue(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.Null => TagValue.Null,
        JsonValueKind.Number => TagValue.FromNumber(e.GetDouble()),
        JsonValueKind.String => TagValue.FromString(e.GetString()!),
        JsonValueKind.True => TagValue.FromBoolean(true),
        JsonValueKind.False => TagValue.FromBoolean(false),
        _ => throw new FormatException(
            $"Replay tag values must be number, string, boolean or null; got {e.ValueKind}."),
    };
}

/// <summary>
/// The sidecar <c>manifest.json</c>. Read before a replay starts so a stale file cannot quietly
/// feed tags the catalogue does not know about.
/// </summary>
public sealed record ReplayManifest(
    string GeneratedAt,
    int FrameCount,
    int PeriodMs,
    long DurationMs,
    int TagCount,
    IReadOnlyList<string> Tags,
    string Sha256)
{
    public static ReplayManifest Load(string path)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var r = doc.RootElement;
        return new ReplayManifest(
            GeneratedAt: r.GetProperty("generatedAt").GetString() ?? string.Empty,
            FrameCount: r.GetProperty("frameCount").GetInt32(),
            PeriodMs: r.GetProperty("periodMs").GetInt32(),
            DurationMs: r.GetProperty("durationMs").GetInt64(),
            TagCount: r.GetProperty("tagCount").GetInt32(),
            Tags: r.GetProperty("tags").EnumerateArray().Select(t => t.GetString()!).ToList(),
            Sha256: r.GetProperty("sha256").GetString() ?? string.Empty);
    }

    /// <summary>
    /// Tags in the replay that the catalogue does not declare. A non-empty result means the
    /// replay was generated from a different revision of <c>tagDefinitions.ts</c> than the one the
    /// C# catalogue was generated from, and every such tag would land as quality BAD.
    /// </summary>
    public IReadOnlyList<string> UnknownTags(Func<string, bool> isKnown) =>
        Tags.Where(t => !isKnown(t)).ToList();
}
