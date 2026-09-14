using System.Globalization;
using System.Text.Json;

namespace Crm04.Domain.Tests;

/// <summary>One swept input row and the output the TypeScript produced from it.</summary>
/// <param name="Suite">The function under test.</param>
/// <param name="Index">Row number within the suite - quoted in failure messages.</param>
/// <param name="In">Named inputs, keyed exactly as <c>scripts/exportModelProbes.ts</c> writes them.</param>
/// <param name="Out">The expected result: a scalar, or an object to be compared field by field.</param>
public sealed record ModelProbe(string Suite, int Index, JsonElement In, JsonElement Out)
{
    public double D(string name) => In.GetProperty(name).GetDouble();

    public bool B(string name) => In.GetProperty(name).GetBoolean();

    public string S(string name) => In.GetProperty(name).GetString()!;

    /// <summary>
    /// A nullable input. JSON <c>null</c> here means the TypeScript caller passed
    /// <c>undefined</c> and the destructuring default fired - which is exactly the case a
    /// non-nullable C# parameter would get silently wrong.
    /// </summary>
    public double? DN(string name)
    {
        var e = In.GetProperty(name);
        return e.ValueKind == JsonValueKind.Null ? null : e.GetDouble();
    }

    /// <summary>A nullable string input - <c>interlockReason</c> and the like.</summary>
    public string? SN(string name)
    {
        var e = In.GetProperty(name);
        return e.ValueKind == JsonValueKind.Null ? null : e.GetString();
    }

    public override string ToString() => $"{Suite}[{Index}]";
}

/// <summary>
/// Loads <c>golden/model-probes.json</c>, written by <c>scripts/exportModelProbes.ts</c>.
///
/// FIXTURE STALENESS IS THE FAILURE MODE TO FEAR HERE. A fixture regenerated from a changed
/// TypeScript engine, against an unchanged C# port, makes this gate go green while comparing
/// nothing meaningful - it would be measuring the new TypeScript against a port of the old one and
/// reporting agreement. The export records a sha256 over the ten TypeScript sources; it is printed
/// in every failure message, so when a test fails the first question ("is my fixture current?")
/// can be answered from the output rather than by guessing.
/// </summary>
public static class ModelProbeFixtures
{
    private const string RelativePath = "golden/model-probes.json";

    private static readonly Lazy<Loaded> Fixture = new(Load, isThreadSafe: true);

    public static string SourceHash => Fixture.Value.SourceHash;

    public static int ProbeCount => Fixture.Value.Probes.Count;

    public static IReadOnlyList<ModelProbe> Suite(string name) =>
        Fixture.Value.BySuite.TryGetValue(name, out var rows)
            ? rows
            : throw new InvalidOperationException(
                $"No probe suite named '{name}' in {RelativePath}. Suites present: " +
                string.Join(", ", Fixture.Value.BySuite.Keys.Order()) +
                $".\nRegenerate with: npx tsx scripts/exportModelProbes.ts");

    /// <summary>xUnit MemberData for one suite.</summary>
    public static IEnumerable<object[]> Rows(string name) =>
        Suite(name).Select(p => new object[] { p });

    public static IEnumerable<string> SuiteNames => Fixture.Value.BySuite.Keys;

    private sealed record Loaded(
        string SourceHash,
        IReadOnlyList<ModelProbe> Probes,
        IReadOnlyDictionary<string, IReadOnlyList<ModelProbe>> BySuite);

    private static Loaded Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, RelativePath);
        if (!File.Exists(path))
        {
            throw new FileNotFoundException(
                $"Model probe fixtures not found at {path}.\n" +
                "Generate them from the TypeScript app first:\n" +
                "  npx tsx scripts/exportModelProbes.ts",
                path);
        }

        // The document is held for the lifetime of the run: JsonElement is a view over it, so
        // disposing it would invalidate every probe.
        var doc = JsonDocument.Parse(File.ReadAllBytes(path));
        var root = doc.RootElement;

        var all = new List<ModelProbe>();
        var bySuite = new Dictionary<string, IReadOnlyList<ModelProbe>>(StringComparer.Ordinal);

        foreach (var suite in root.GetProperty("suites").EnumerateObject())
        {
            var rows = new List<ModelProbe>();
            var i = 0;
            foreach (var row in suite.Value.EnumerateArray())
            {
                var probe = new ModelProbe(suite.Name, i++, row.GetProperty("in"), row.GetProperty("out"));
                rows.Add(probe);
                all.Add(probe);
            }

            bySuite[suite.Name] = rows;
        }

        if (all.Count == 0) throw new InvalidOperationException($"{path} contained no probes.");

        return new Loaded(root.GetProperty("sourceHash").GetString()!, all, bySuite);
    }

    // -----------------------------------------------------------------------------------
    // Comparison
    // -----------------------------------------------------------------------------------

    /// <summary>
    /// Relative tolerance for the stateless models.
    ///
    /// MEASURED, NOT CHOSEN. Running the whole probe set at exact equality shows that 12,470 of
    /// 12,978 rows are BIT-IDENTICAL to the TypeScript, and every row that is not traces to
    /// <c>Math.Log</c> or <c>Math.Pow</c> differing between V8 and .NET in the last ulp - the
    /// four functions that diverge at all are exactly the four that call them
    /// (<c>CalculateTrueStrain</c>, <c>CalculateMeanFlowStress</c>, and the two that build on
    /// them). <c>Math.Sqrt</c> is IEEE correctly-rounded and <c>Math.Exp</c> agreed on every row,
    /// so neither contributes.
    ///
    /// Worst observed relative divergence, well-conditioned inputs:
    /// <list type="bullet">
    /// <item><c>CalculateTrueStrain</c> 2.0e-16 - one ulp, one <c>Math.Log</c>.</item>
    /// <item><c>CalculateMeanFlowStress</c> 2.7e-15 - about twelve ulp through <c>Math.Pow</c>.</item>
    /// <item><c>GapPositionForTargetThickness</c> 6.5e-15.</item>
    /// </list>
    ///
    /// 1e-12 therefore sits three orders above the noise and many orders below any porting
    /// mistake: a lost <c>d</c> suffix, a re-associated expression or a literal <c>1.22</c> in
    /// place of <c>n + 1</c> all move a result by 1e-3 or more, not 1e-12.
    /// </summary>
    public const double RelativeTolerance = 1e-12;

    /// <summary>
    /// The looser bound for the two functions that ITERATE, and why they get one.
    ///
    /// <c>CalculateRollingForce</c> runs an eight-step Hitchcock fixed point, and
    /// <c>SolveGaugemeter</c> runs twelve outer gaugemeter steps with a full force solve inside
    /// each. One ulp of <c>Math.Pow</c> at step one is carried into step two's input, so these are
    /// not stateless and cannot be held to the stateless standard. Measured worst relative
    /// divergence: 7.2e-13 for the force solve, 5.4e-12 for the gaugemeter solve.
    ///
    /// 1e-10 leaves roughly twenty times headroom. On the quantities involved that is nine orders
    /// below anything observable - 1e-10 relative on a 1 mm delivered thickness is 1e-13 mm,
    /// against a ±5 µm gauge tolerance.
    ///
    /// The ITERATION COUNT is still compared exactly (see <c>ModelProbeRunner</c>), so a
    /// difference that changes the solver's path is caught regardless of this tolerance.
    /// </summary>
    public const double IteratedRelativeTolerance = 1e-10;

    /// <summary>
    /// Suites evaluated with <see cref="IteratedRelativeTolerance"/>. Deliberately a short,
    /// explicit list rather than a heuristic: if a third function ever needs to be on it, that
    /// should be a decision someone makes and justifies, not something that happens.
    /// </summary>
    private static readonly HashSet<string> IteratedSuites =
        new(StringComparer.Ordinal) { "CalculateRollingForce", "SolveGaugemeter" };

    /// <summary>The relative tolerance that applies to a given probe suite.</summary>
    public static double ToleranceFor(string suite) =>
        IteratedSuites.Contains(suite) ? IteratedRelativeTolerance : RelativeTolerance;

    /// <summary>
    /// Absolute floor on the comparison, so a value that is already indistinguishable from zero is
    /// not held to a relative standard it cannot meet.
    ///
    /// 1e-9 is nine orders below the resolution of every quantity in the model - µm of thickness,
    /// mm of gap, tonnes of force, MPa of pressure. It can therefore only ever excuse a difference
    /// in a number that no instrument, display or alarm could distinguish from zero.
    /// <see cref="ModelDivergenceTests"/> pins the measured worst case separately, so this floor
    /// cannot quietly absorb a future regression.
    /// </summary>
    public const double AbsoluteFloor = 1e-9;

    /// <summary>
    /// <c>SolveGaugemeter.residualUm</c> is compared absolutely at this bound instead.
    ///
    /// It is the one field in the whole probe set that is a RESIDUAL BY CONSTRUCTION:
    /// <c>|h - (S0 + F/M)| * 1000</c>, the difference of two converged quantities that agree to
    /// within an ulp of each other. Subtracting them cancels fifteen significant digits and leaves
    /// the sixteenth, so its relative error is amplified by roughly <c>h / residual</c> - about
    /// 1e8 on a converged solve. Holding it to a relative tolerance measures the cancellation, not
    /// the port.
    ///
    /// 1e-6 µm is the right absolute standard: the field exists to answer "did the solver
    /// converge?", and its acceptance threshold is 0.01 µm. Four orders of margin, against a
    /// worst observed disagreement of 2.6e-9 µm. Every OTHER field of the solve result -
    /// outputThickness, millStretch, iterations and all eight force fields - is held to the full
    /// <see cref="RelativeTolerance"/>, so the solve itself is not let off anything.
    /// </summary>
    public const double ResidualAbsoluteTolerance = 1e-6;

    /// <summary>Flattened paths compared with <see cref="ResidualAbsoluteTolerance"/>.</summary>
    private static readonly HashSet<string> ResidualFields =
        new(StringComparer.Ordinal) { "residualUm" };

    /// <summary>
    /// Assert one probe's C# result against the captured TypeScript result.
    ///
    /// <paramref name="actual"/> is either a scalar (double / int / bool / string / null) or a
    /// <c>Dictionary&lt;string, object?&gt;</c> keyed by the TYPESCRIPT field names. Using the
    /// TypeScript names rather than reflecting over the C# record is deliberate: it makes the
    /// rename from <c>forceKN</c> to <c>ForceKn</c> an explicit, reviewable line rather than a
    /// silent naming convention that could drop a field.
    /// </summary>
    public static void AssertMatches(ModelProbe probe, object? actual)
    {
        var expected = new Dictionary<string, object?>(StringComparer.Ordinal);
        FlattenJson(probe.Out, "", expected);

        var got = new Dictionary<string, object?>(StringComparer.Ordinal);
        FlattenActual(actual, "", got);

        var missing = expected.Keys.Except(got.Keys).ToList();
        var extra = got.Keys.Except(expected.Keys).ToList();
        if (missing.Count > 0 || extra.Count > 0)
        {
            throw new Xunit.Sdk.XunitException(
                Header(probe) +
                (missing.Count > 0 ? $"\n  fields the C# result never produced: {string.Join(", ", missing.Select(Name))}" : "") +
                (extra.Count > 0 ? $"\n  fields the C# result produced but TypeScript did not: {string.Join(", ", extra.Select(Name))}" : ""));
        }

        foreach (var (key, want) in expected)
        {
            var have = got[key];
            if (Matches(want, have, ResidualFields.Contains(key), ToleranceFor(probe.Suite))) continue;

            throw new Xunit.Sdk.XunitException(
                Header(probe) +
                $"\n  field    {Name(key)}" +
                $"\n  expected {GoldenFixtures.Describe(want)}" +
                $"\n  actual   {GoldenFixtures.Describe(have)}" +
                Delta(want, have) +
                $"\n  inputs   {probe.In.GetRawText()}");
        }
    }

    private static string Name(string key) => key.Length == 0 ? "<result>" : key;

    private static string Header(ModelProbe probe) =>
        $"{probe.Suite} row {probe.Index} disagrees with the TypeScript model." +
        $"\n  fixture sha256 {SourceHash} (regenerate: npx tsx scripts/exportModelProbes.ts)";

    private static string Delta(object? want, object? have)
    {
        if (want is not double e || have is not double a) return "";
        if (!double.IsFinite(e) || !double.IsFinite(a)) return "";
        var abs = Math.Abs(e - a);
        var rel = abs / Math.Max(Math.Abs(e), 1e-300);
        return $"\n  delta    {abs.ToString("E3", CultureInfo.InvariantCulture)} absolute, " +
               $"{rel.ToString("E3", CultureInfo.InvariantCulture)} relative";
    }

    private static bool Matches(object? want, object? have, bool isResidual, double relTolerance) =>
        (want, have) switch
        {
            (null, null) => true,
            (bool w, bool h) => w == h,
            (string w, string h) => string.Equals(w, h, StringComparison.Ordinal),
            (double w, double h) => CloseEnough(w, h, isResidual, relTolerance),
            _ => false,
        };

    private static bool CloseEnough(double expected, double actual, bool isResidual, double relTolerance)
    {
        if (expected.Equals(actual)) return true;   // covers exact equality and NaN == NaN
        if (double.IsNaN(expected) || double.IsNaN(actual)) return false;
        if (double.IsInfinity(expected) || double.IsInfinity(actual)) return false;

        var difference = Math.Abs(expected - actual);
        if (isResidual) return difference <= ResidualAbsoluteTolerance;

        var scale = Math.Max(Math.Abs(expected), Math.Abs(actual));
        return difference <= Math.Max(relTolerance * scale, AbsoluteFloor);
    }

    /// <summary>
    /// Relative divergence of one leaf, for the characterisation test. Returns 0 when the values
    /// are identical or not both finite numbers, so non-numeric leaves do not distort the
    /// measurement.
    /// </summary>
    public static (double Relative, double Absolute) Divergence(object? want, object? have)
    {
        if (want is not double e || have is not double a) return (0, 0);
        if (!double.IsFinite(e) || !double.IsFinite(a)) return (0, 0);
        if (e.Equals(a)) return (0, 0);

        var abs = Math.Abs(e - a);
        var scale = Math.Max(Math.Abs(e), Math.Abs(a));
        return (scale > 0 ? abs / scale : 0, abs);
    }

    /// <summary>Flatten a probe's expected output to path -&gt; leaf.</summary>
    public static Dictionary<string, object?> FlattenExpected(ModelProbe probe)
    {
        var map = new Dictionary<string, object?>(StringComparer.Ordinal);
        FlattenJson(probe.Out, "", map);
        return map;
    }

    /// <summary>Flatten a C# result to path -&gt; leaf, matching <see cref="FlattenExpected"/>.</summary>
    public static Dictionary<string, object?> FlattenResult(object? actual)
    {
        var map = new Dictionary<string, object?>(StringComparer.Ordinal);
        FlattenActual(actual, "", map);
        return map;
    }

    private static void FlattenJson(JsonElement e, string prefix, Dictionary<string, object?> into)
    {
        switch (e.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var p in e.EnumerateObject())
                {
                    FlattenJson(p.Value, prefix.Length == 0 ? p.Name : $"{prefix}.{p.Name}", into);
                }

                break;

            case JsonValueKind.Null:
                into[prefix] = null;
                break;

            case JsonValueKind.True:
            case JsonValueKind.False:
                into[prefix] = e.GetBoolean();
                break;

            case JsonValueKind.Number:
                into[prefix] = e.GetDouble();
                break;

            case JsonValueKind.String:
                into[prefix] = e.GetString();
                break;

            default:
                throw new InvalidOperationException(
                    $"Unexpected JSON kind {e.ValueKind} at '{prefix}' in the probe fixture.");
        }
    }

    private static void FlattenActual(object? v, string prefix, Dictionary<string, object?> into)
    {
        switch (v)
        {
            case IReadOnlyDictionary<string, object?> map:
                foreach (var (k, child) in map)
                {
                    FlattenActual(child, prefix.Length == 0 ? k : $"{prefix}.{k}", into);
                }

                break;

            // JavaScript has one number type, so every numeric result compares as a double -
            // including the solver's iteration count, which is an int on this side.
            case int i:
                into[prefix] = (double)i;
                break;

            case double d:
                into[prefix] = d;
                break;

            default:
                into[prefix] = v;
                break;
        }
    }
}
