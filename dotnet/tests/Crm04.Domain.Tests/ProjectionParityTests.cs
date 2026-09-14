using Crm04.Domain.Machine;
using Crm04.Domain.Projection;
using Crm04.Domain.Tags;
using Crm04.Domain.Types;

namespace Crm04.Domain.Tests;

/// <summary>
/// THE PARITY GATE.
///
/// Runs the C# pipeline over the same raw tag values the TypeScript pipeline was run over, and
/// asserts the same outputs, field by field, in all three operating modes.
///
/// This is the test that makes the rest of the .NET port defensible. The physics is not being
/// ported - Oracle supplies the numbers - but everything between a raw value and a pixel is:
/// which provenance badge a tag carries, whether a missing reading becomes null or zero, which
/// alarm fires and what its message says, which interlock link is named as the blocker. A port
/// that gets those subtly wrong yields an application that looks entirely correct and quietly
/// misreports the mill.
///
/// Values reach C# as IEEE-754 doubles that round-tripped through JSON, so the comparison is
/// bit-exact in practice; <see cref="Tolerance"/> exists for the arithmetic the projection does
/// itself (percentages, unit scaling) and is far looser than anything observed.
/// </summary>
public class ProjectionParityTests
{
    private const double Tolerance = 1e-9d;

    public static IEnumerable<object[]> Cases => GoldenFixtures.AsMemberData();

    [Fact]
    public void FixturesCoverAllThreeModesAndManyFrames()
    {
        var all = GoldenFixtures.All;

        Assert.True(all.Count >= 300, $"expected a substantial fixture set, found {all.Count} cases");
        Assert.Equal(3, all.Select(c => c.Mode).Distinct().Count());

        // A fixture set that never leaves one mill state would pass while exercising almost
        // nothing. Assert the replay actually moved.
        var statuses = all.Select(c => c.State["machineStatus"]).Distinct().Count();
        Assert.True(statuses >= 3, $"golden frames only cover {statuses} mill status(es)");
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void TagFactoryMatchesTypeScript(GoldenCase c)
    {
        var frame = TagFactory.MakeFrame(c.Raw, c.Dt, c.Mode);

        Assert.Equal(c.Tags.Count, frame.Count);

        foreach (var (name, expected) in c.Tags)
        {
            var tag = frame.TryGet(name);
            Assert.True(tag is not null, $"{c}: tag '{name}' missing from the C# frame");

            Assert.True(
                tag!.Quality.ToWire() == expected.Quality,
                $"{c}: {name}.quality — TS {expected.Quality}, C# {tag.Quality.ToWire()}");

            Assert.True(
                tag.Status.ToWire() == expected.Status,
                $"{c}: {name}.status — TS {expected.Status}, C# {tag.Status.ToWire()}");

            Assert.True(
                tag.Provenance.ToWire() == expected.Provenance,
                $"{c}: {name}.provenance — TS {expected.Provenance}, C# {tag.Provenance.ToWire()}");

            // The value matters as much as the badge: an UNAVAILABLE tag must have had its value
            // discarded, and that is the rule most likely to be lost in translation.
            AssertLeafEqual($"{c}: {name}.value", LeafOf(expected.Value), LeafOf(tag.Value));
        }
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void MachineStateProjectionMatchesTypeScript(GoldenCase c)
    {
        var actual = GoldenFlattener.Flatten(Project(c));
        AssertFlatMapsEqual($"{c}: state", c.State, actual);
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void AlarmEngineMatchesTypeScript(GoldenCase c)
    {
        var conditions = AlarmEngine.Evaluate(Project(c));

        Assert.True(
            conditions.Count == c.Alarms.Count,
            $"{c}: raised {conditions.Count} alarm(s), TypeScript raised {c.Alarms.Count} " +
            $"[C#: {string.Join(", ", conditions.Select(x => x.Id))}] " +
            $"[TS: {string.Join(", ", c.Alarms.Select(a => a.TryGetValue("id", out var v) ? v : "?"))}]");

        // Order is part of the contract: the alarm panel lists conditions in evaluation order,
        // which is severity-shaped by construction (force, then process, then plant, then comms).
        for (var i = 0; i < conditions.Count; i++)
        {
            AssertFlatMapsEqual($"{c}: alarm[{i}]", c.Alarms[i], GoldenFlattener.Flatten(conditions[i]));
        }
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void InterlockEngineMatchesTypeScript(GoldenCase c)
    {
        var chain = InterlockEngine.Evaluate(InterlockInputs.From(Project(c)));
        AssertFlatMapsEqual($"{c}: interlocks", c.Interlocks, GoldenFlattener.Flatten(chain));
    }

    // -----------------------------------------------------------------------------------

    private static MachineState Project(GoldenCase c)
    {
        var frame = TagFactory.MakeFrame(c.Raw, c.Dt, c.Mode);

        // The same deterministic comm state the fixture was generated with. The real one depends
        // on wall-clock frame arrival, which cannot be captured in a fixture.
        var ctx = new AdapterContext(
            Mode: c.Mode,
            Communication: new CommState(
                Connected: true,
                SourceName: "replay",
                LastFrameTimestamp: c.Dt,
                LastValidTimestamp: c.Dt,
                AgeMs: 100d,
                Stale: false,
                UpdateRateHz: 10d,
                FramesReceived: c.N + 1),
            Diagnostics: new DiagnosticsState(
                MassFlowErrorPct: 0d,
                GaugemeterResidualUm: c.GaugemeterResidualUm,
                SolverIterations: c.SolverIterations));

        return MachineStateProjector.Project(frame, ctx);
    }

    private static object? LeafOf(TagValue v) => v.Kind switch
    {
        TagValueKind.Null => null,
        TagValueKind.Number => v.AsRawNumber,
        TagValueKind.String => v.AsString,
        TagValueKind.Boolean => v.AsBoolean,
        _ => null,
    };

    /// <summary>
    /// Compare two flattened maps over the UNION of their keys.
    ///
    /// A path missing on one side is treated as null rather than as a failure, because the two
    /// languages spell "absent" differently: TypeScript omits an optional property entirely
    /// (an AlarmCondition with no twin section has no <c>section</c> key at all) while C# always
    /// has the property and sets it null. Both mean the same thing to a reader of the screen.
    ///
    /// What this deliberately does NOT tolerate is a path carrying a real value on one side and
    /// nothing on the other - that is caught, because the missing side compares as null against a
    /// non-null and fails.
    /// </summary>
    private static void AssertFlatMapsEqual(
        string label,
        IReadOnlyDictionary<string, object?> expected,
        IReadOnlyDictionary<string, object?> actual)
    {
        var keys = new SortedSet<string>(expected.Keys, StringComparer.Ordinal);
        keys.UnionWith(actual.Keys);

        var failures = new List<string>();

        foreach (var key in keys)
        {
            var e = expected.TryGetValue(key, out var ev) ? ev : null;
            var a = actual.TryGetValue(key, out var av) ? av : null;

            if (!LeafEquals(e, a))
            {
                failures.Add($"  {key}\n      TS: {GoldenFixtures.Describe(e)}\n      C#: {GoldenFixtures.Describe(a)}");
            }
        }

        if (failures.Count > 0)
        {
            Assert.Fail($"{label} — {failures.Count} field(s) differ:\n{string.Join("\n", failures)}");
        }
    }

    private static void AssertLeafEqual(string label, object? expected, object? actual)
    {
        if (!LeafEquals(expected, actual))
        {
            Assert.Fail($"{label} — TS {GoldenFixtures.Describe(expected)}, C# {GoldenFixtures.Describe(actual)}");
        }
    }

    private static bool LeafEquals(object? expected, object? actual)
    {
        if (expected is null && actual is null) return true;
        if (expected is null || actual is null) return false;

        if (expected is double e && actual is double a)
        {
            if (double.IsNaN(e) && double.IsNaN(a)) return true;
            if (double.IsInfinity(e) || double.IsInfinity(a)) return e.Equals(a);

            var diff = Math.Abs(e - a);
            if (diff <= Tolerance) return true;

            // Relative tolerance for large magnitudes: a coil length in metres carries enough
            // significant digits that an absolute 1e-9 would be stricter than the double itself.
            var scale = Math.Max(Math.Abs(e), Math.Abs(a));
            return diff <= Tolerance * scale;
        }

        return expected.Equals(actual);
    }
}
