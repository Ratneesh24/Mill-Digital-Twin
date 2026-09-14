using System.Globalization;
using System.Text.Json;
using Crm04.Domain.Types;

namespace Crm04.Domain.Tests;

/// <summary>
/// One parity case: the raw tag values that went in, and everything the TypeScript pipeline
/// produced from them.
/// </summary>
/// <param name="Tags">Tag name -&gt; (value, quality, status, provenance) as makeTag resolved it.</param>
/// <param name="State">Flattened MachineState, "a.b.c" -&gt; leaf.</param>
/// <param name="Alarms">One flattened AlarmCondition per raised condition, in order.</param>
public sealed record GoldenCase(
    int N,
    long Dt,
    OperatingMode Mode,
    int SolverIterations,
    double GaugemeterResidualUm,
    IReadOnlyDictionary<string, TagValue> Raw,
    IReadOnlyDictionary<string, GoldenTag> Tags,
    IReadOnlyDictionary<string, object?> State,
    IReadOnlyList<IReadOnlyDictionary<string, object?>> Alarms,
    IReadOnlyDictionary<string, object?> Interlocks)
{
    public override string ToString() => $"frame {N} / {Mode.ToWire()}";
}

public readonly record struct GoldenTag(TagValue Value, string Quality, string Status, string Provenance);

/// <summary>
/// Loads <c>golden/parity.jsonl</c>, written by <c>scripts/exportGolden.ts</c>.
///
/// Loaded once and cached: xUnit constructs a fresh test class per case, and re-parsing a
/// multi-megabyte fixture 720 times would dominate the run.
/// </summary>
public static class GoldenFixtures
{
    private const string RelativePath = "golden/parity.jsonl";

    private static readonly Lazy<IReadOnlyList<GoldenCase>> Cases = new(Load, isThreadSafe: true);

    public static IReadOnlyList<GoldenCase> All => Cases.Value;

    /// <summary>xUnit MemberData needs object[]; the case itself is the single argument.</summary>
    public static IEnumerable<object[]> AsMemberData() => All.Select(c => new object[] { c });

    private static IReadOnlyList<GoldenCase> Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, RelativePath);
        if (!File.Exists(path))
        {
            throw new FileNotFoundException(
                $"Golden fixtures not found at {path}.\n" +
                "Generate them from the TypeScript app first:\n" +
                "  npx tsx scripts/exportSimFrames.ts\n" +
                "  npx tsx scripts/exportGolden.ts",
                path);
        }

        var cases = new List<GoldenCase>();
        foreach (var line in File.ReadLines(path))
        {
            if (line.Length == 0) continue;
            cases.Add(ParseCase(JsonDocument.Parse(line).RootElement));
        }

        if (cases.Count == 0) throw new InvalidOperationException($"{path} contained no cases.");
        return cases;
    }

    private static GoldenCase ParseCase(JsonElement e)
    {
        var raw = new Dictionary<string, TagValue>(StringComparer.Ordinal);
        foreach (var p in e.GetProperty("raw").EnumerateObject())
        {
            raw[p.Name] = ToTagValue(p.Value);
        }

        var tags = new Dictionary<string, GoldenTag>(StringComparer.Ordinal);
        foreach (var p in e.GetProperty("tags").EnumerateObject())
        {
            var a = p.Value;
            tags[p.Name] = new GoldenTag(
                Value: ToTagValue(a[0]),
                Quality: a[1].GetString()!,
                Status: a[2].GetString()!,
                Provenance: a[3].GetString()!);
        }

        var alarms = e.GetProperty("alarms").EnumerateArray().Select(ToFlatMap).ToList();

        return new GoldenCase(
            N: e.GetProperty("n").GetInt32(),
            Dt: e.GetProperty("dt").GetInt64(),
            Mode: WireNames.ParseOperatingMode(e.GetProperty("mode").GetString()),
            SolverIterations: e.GetProperty("solverIterations").GetInt32(),
            GaugemeterResidualUm: e.GetProperty("gaugemeterResidualUm").GetDouble(),
            Raw: raw,
            Tags: tags,
            State: ToFlatMap(e.GetProperty("state")),
            Alarms: alarms,
            Interlocks: ToFlatMap(e.GetProperty("interlocks")));
    }

    private static Dictionary<string, object?> ToFlatMap(JsonElement obj)
    {
        var map = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var p in obj.EnumerateObject())
        {
            map[p.Name] = p.Value.ValueKind switch
            {
                JsonValueKind.Null => null,
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Number => p.Value.GetDouble(),
                JsonValueKind.String => p.Value.GetString(),
                _ => throw new InvalidOperationException(
                    $"Unexpected leaf kind {p.Value.ValueKind} at '{p.Name}' - the flattened map " +
                    "should contain only scalars."),
            };
        }

        return map;
    }

    /// <summary>
    /// JSON leaf to <see cref="TagValue"/>. The kinds line up one-for-one with the TypeScript
    /// union <c>number | string | boolean | null</c>, which is the whole point of the struct.
    /// </summary>
    private static TagValue ToTagValue(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.Null => TagValue.Null,
        JsonValueKind.Number => TagValue.FromNumber(e.GetDouble()),
        JsonValueKind.String => TagValue.FromString(e.GetString()!),
        JsonValueKind.True => TagValue.FromBoolean(true),
        JsonValueKind.False => TagValue.FromBoolean(false),
        _ => throw new InvalidOperationException(
            $"Tag values must be number, string, boolean or null; got {e.ValueKind}."),
    };

    /// <summary>
    /// A readable rendering of a leaf for assertion messages. Numbers use round-trip formatting
    /// so a failure caused by the seventeenth significant digit is actually visible in the output
    /// rather than being hidden behind a shortened display.
    /// </summary>
    public static string Describe(object? v) => v switch
    {
        null => "null",
        string s => $"\"{s}\"",
        bool b => b ? "true" : "false",
        double d => d.ToString("R", CultureInfo.InvariantCulture),
        _ => Convert.ToString(v, CultureInfo.InvariantCulture) ?? "?",
    };
}
