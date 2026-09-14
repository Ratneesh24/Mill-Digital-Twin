namespace Crm04.Web.State;

/// <summary>
/// Previous-pass actuals for the KPI "vs previous pass" deltas.
///
/// There is no historian behind this deployment, so the only honest source of "previous pass"
/// is observation: when the mill's pass counter increments, the current readings of a small
/// metric set are frozen as the baseline the new pass is compared against. Session-only by
/// design - a reload clears it and the delta rows hide until the next pass boundary, rather
/// than printing a comparison against nothing.
///
/// Scoped per circuit: two viewers can be on different passes of the same mill.
/// </summary>
public sealed class PassHistory
{
    /// <summary>Tags snapshotted at each pass boundary. Keyed by tag name.</summary>
    public static readonly IReadOnlyList<string> TrackedTags =
    [
        "STRIP.THICKNESS",
        "STRIP.THICKNESS.ENTRY",
        "STRIP.REDUCTION",
        "ROLL.FORCE.ACTUAL",
        "MILL.SPEED.ACTUAL",
        "TENSION.ENTRY",
        "TENSION.EXIT",
        "DRIVE.TORQUE",
        "DRIVE.CURRENT",
        "DRIVE.POWER",
    ];

    private int _lastPass = -1;
    private Dictionary<string, double> _previous = new(StringComparer.Ordinal);

    /// <summary>
    /// Call when a fresh summary arrives. Snapshots the tracked tags the first time a new pass
    /// number is seen; the values frozen are the ones that become "previous pass".
    /// </summary>
    public void NotePass(int passCurrent, Func<string, double?> read)
    {
        if (passCurrent == _lastPass) return;

        // The very first observation establishes the baseline pass without producing deltas.
        if (_lastPass != -1)
        {
            var snap = new Dictionary<string, double>(StringComparer.Ordinal);
            foreach (var tag in TrackedTags)
            {
                if (read(tag) is { } v && double.IsFinite(v)) snap[tag] = v;
            }

            _previous = snap;
        }

        _lastPass = passCurrent;
    }

    /// <summary>Percent change of this tag's current value vs the frozen previous pass, or null.</summary>
    public double? DeltaPercent(string tag, double? current)
    {
        if (current is not { } c || !double.IsFinite(c)) return null;
        if (!_previous.TryGetValue(tag, out var prev) || !double.IsFinite(prev)) return null;
        if (Math.Abs(prev) < 1e-12) return null;
        var d = (c - prev) / Math.Abs(prev) * 100d;
        return double.IsFinite(d) ? d : null;
    }
}
