namespace Crm04.Web.State;

/// <summary>
/// Two-way map between process tags, schematic regions, and parameter groups.
///
/// Clicking a parameter row locates its tag on the mill schematic (region pulse); clicking a
/// schematic region flashes the owning parameter group. Both directions stay inside these
/// tables so the wiring cannot drift from the layout. Regions: stand, payoff, coiler, entry,
/// exit, gauges.
/// </summary>
public static class MillRegions
{
    /// <summary>Tag prefix → schematic region. Longest-prefix match wins.</summary>
    private static readonly (string Prefix, string Region)[] TagRegions =
    [
        ("ROLL.FORCE", "stand"),
        ("ROLL.GAP", "stand"),
        ("WR.", "stand"),
        ("BUR.", "stand"),
        ("HYD.GAP", "stand"),
        ("HYD.LOADING", "stand"),
        ("HYD.BENDING", "stand"),
        ("AGC.", "stand"),
        ("STRIP.", "stand"),
        ("MILL.SPEED", "stand"),
        ("MILL.MASSFLOW", "stand"),
        // Gauges have no separate drawing - they sit on the stand in this schematic.
        ("GAUGE.", "stand"),
        ("DTR.", "coiler"),
        ("ETR.", "payoff"),
        ("POR.", "payoff"),
        ("TENSION.ENTRY", "entry"),
        ("TENSION.EXIT", "exit"),
        ("COIL.", "payoff"),
        ("DRIVE.", "stand"),
        ("HYD.", "stand"),
        ("LP.", "stand"),
        ("COOLANT.", "stand"),
        ("LUBRICATION.", "stand"),
    ];

    /// <summary>Schematic region → parameter-group title (must match ParameterGroup Title).</summary>
    /// <remarks>Regions without their own drawing (gauges) fold into the stand.</remarks>
    public static readonly IReadOnlyDictionary<string, string> RegionGroups =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["stand"] = "ROLLING",
            ["payoff"] = "TENSION",
            ["coiler"] = "TENSION",
            ["entry"] = "TENSION",
            ["exit"] = "TENSION",
        };

    public static string RegionFor(string tagName)
    {
        var best = "stand";
        var bestLen = -1;
        foreach (var (prefix, region) in TagRegions)
        {
            if (prefix.Length > bestLen && tagName.StartsWith(prefix, StringComparison.Ordinal))
            {
                best = region;
                bestLen = prefix.Length;
            }
        }

        return best;
    }
}
