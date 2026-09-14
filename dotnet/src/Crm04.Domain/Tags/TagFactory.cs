using Crm04.Domain.Types;

namespace Crm04.Domain.Tags;

/// <summary>
/// TAG RESOLUTION - port of <c>src/data/tagMap.ts</c>, the single place where the §7.3 provenance
/// and §7.4 availability rules are applied.
///
/// Every <see cref="Tag"/> that reaches the store passes through <see cref="MakeTag"/>. That is
/// what guarantees a CALCULATED / SIMULATED / ESTIMATED value can never accidentally be rendered
/// with the appearance of a MEASURED one: no component chooses a badge, the badge is a property
/// of the value. <see cref="Tag"/>'s constructor is internal to this assembly, so this really is
/// the only producer rather than merely the intended one.
/// </summary>
public static class TagFactory
{
    /// <summary>
    /// Resolve the provenance a tag carries in a given operating mode.
    ///
    /// SIMULATION - the simulation engine is the source, so everything it produces is SIMULATED,
    ///              except values that are genuinely setpoints (REFERENCE) or genuinely derived
    ///              from other displayed values (CALCULATED). Being honest about this inside the
    ///              sim is what makes the sim a useful rehearsal for the live feed.
    ///
    /// SIM_46TAG  - the simulation still produces the numbers, but they are shown with the
    ///              provenance they WILL have on the real CRM04 feed. This is the §7.4 rehearsal
    ///              mode: force degrades to ESTIMATED, roll gap to CALCULATED, bending to NO TAG.
    ///
    /// LIVE       - the gateway is the source and <see cref="TagDefinition.LiveAvailability"/> is
    ///              the truth.
    ///
    /// In the .NET topology every frame originates in Oracle, but the mode still decides how the
    /// value is badged - a replayed simulator frame must not claim to be an instrument reading.
    /// </summary>
    public static Provenance ResolveProvenance(TagDefinition def, OperatingMode mode)
    {
        if (mode == OperatingMode.Simulation) return def.SimulationProvenance;

        // Both SIM_46TAG and LIVE present the live-feed provenance.
        return def.LiveAvailability switch
        {
            LiveAvailability.Measured => Provenance.Measured,
            LiveAvailability.Reference => Provenance.Reference,
            LiveAvailability.Calculated => Provenance.Calculated,
            LiveAvailability.Estimated => Provenance.Estimated,
            LiveAvailability.Unavailable => Provenance.Unavailable,
            _ => Provenance.Unavailable,
        };
    }

    /// <summary>True when the tag has no value at all on this feed and must render "NO TAG".</summary>
    public static bool IsUnavailable(string tagName, OperatingMode mode)
    {
        var def = TagCatalog.TryGet(tagName);
        if (def is null) return true;
        if (mode == OperatingMode.Simulation) return false;
        return def.LiveAvailability == LiveAvailability.Unavailable;
    }

    /// <summary>
    /// Evaluate a numeric value against its configured limits. Trip beats alarm beats warning;
    /// a value with no limits is always NORMAL, and a non-numeric or non-finite value is UNKNOWN
    /// rather than NORMAL - "we cannot judge this" is not the same statement as "this is fine".
    ///
    /// The comparison order below is load-bearing and matches <c>evaluateStatus</c> exactly:
    /// a value above both alarmHigh and warningHigh must report ALARM, so the high checks run
    /// before the low ones and the severe before the mild.
    /// </summary>
    public static TagStatus EvaluateStatus(TagDefinition def, TagValue value)
    {
        var v = value.AsFiniteNumber;
        if (v is null) return TagStatus.Unknown;

        var l = def.Limits;
        if (l.IsEmpty) return TagStatus.Normal;

        if (l.TripHigh is { } trip && v >= trip) return TagStatus.Trip;
        if (l.AlarmHigh is { } alarmHigh && v >= alarmHigh) return TagStatus.Alarm;
        if (l.AlarmLow is { } alarmLow && v <= alarmLow) return TagStatus.Alarm;
        if (l.WarningHigh is { } warnHigh && v >= warnHigh) return TagStatus.Warning;
        if (l.WarningLow is { } warnLow && v <= warnLow) return TagStatus.Warning;
        return TagStatus.Normal;
    }

    /// <summary>
    /// Quality for a tag in a given mode.
    ///
    /// A simulated value is never GOOD - it is SIMULATION. That distinction is what stops the
    /// twin claiming instrument-grade confidence for a model output.
    /// </summary>
    public static TagQuality ResolveQuality(Provenance provenance, OperatingMode mode, bool stale)
    {
        if (provenance == Provenance.Unavailable) return TagQuality.NoTag;
        if (stale) return TagQuality.Stale;
        if (mode == OperatingMode.Live) return TagQuality.Good;
        return TagQuality.Simulation;
    }

    /// <summary>
    /// Build a fully-qualified Tag. THE ONLY CONSTRUCTOR FOR A TAG IN THE APPLICATION.
    /// </summary>
    public static Tag MakeTag(string tagName, TagValue value, long timestamp, OperatingMode mode, bool stale = false)
    {
        if (!TagCatalog.TryGet(tagName, out var def))
        {
            // An unknown tag is an integration error, not a value. Surface it as such rather than
            // letting an unnamed number onto a screen (§14.5 "invalid tag").
            return new Tag(
                tagName: tagName,
                value: TagValue.Null,
                unit: null,
                timestamp: timestamp,
                quality: TagQuality.Bad,
                status: TagStatus.Unknown,
                provenance: Provenance.Unavailable,
                limits: TagLimits.None);
        }

        var provenance = ResolveProvenance(def, mode);
        var unavailable = provenance == Provenance.Unavailable;

        // An UNAVAILABLE tag's value is discarded even if the feed supplied one. A gateway that
        // sends a number for a tag the catalogue says does not exist on this feed is wrong, and
        // showing that number would be worse than showing nothing.
        var resolvedValue = unavailable ? TagValue.Null : value;

        return new Tag(
            tagName: tagName,
            value: resolvedValue,
            unit: def.Unit,
            timestamp: timestamp,
            quality: ResolveQuality(provenance, mode, stale),
            status: unavailable ? TagStatus.Unknown : EvaluateStatus(def, resolvedValue),
            provenance: provenance,
            limits: def.Limits);
    }

    /// <summary>
    /// Build a whole frame from raw values. The counterpart of the <c>mapValues(raw, makeTag)</c>
    /// step in <c>machineStore.applyFrame</c>.
    ///
    /// Only tags PRESENT in <paramref name="raw"/> appear in the result. A tag the catalogue
    /// declares but this feed does not send stays absent, and every reader then sees null - which
    /// is the §7.4 "NO TAG" outcome and is deliberately distinct from a present tag whose value
    /// happens to be null.
    /// </summary>
    public static TagFrame MakeFrame(
        IReadOnlyDictionary<string, TagValue> raw,
        long timestamp,
        OperatingMode mode,
        bool stale = false)
    {
        var tags = new Dictionary<string, Tag>(raw.Count, StringComparer.Ordinal);
        foreach (var (name, value) in raw)
        {
            tags[name] = MakeTag(name, value, timestamp, mode, stale);
        }

        return new TagFrame(tags, timestamp, mode);
    }

    /// <summary>Re-stamp every tag in a frame as STALE, keeping the last known values (§14.5).</summary>
    public static TagFrame MarkStale(TagFrame frame)
    {
        var tags = new Dictionary<string, Tag>(frame.Count, StringComparer.Ordinal);
        foreach (var tag in frame.Tags)
        {
            tags[tag.TagName] = tag.AsStale();
        }

        return new TagFrame(tags, frame.Timestamp, frame.Mode);
    }

    /// <summary>UI badge text for a provenance (§7.3).</summary>
    public static string ProvenanceBadge(Provenance p) => p switch
    {
        Provenance.Measured => "LIVE",
        Provenance.Reference => "REF",
        Provenance.Calculated => "CALC",
        Provenance.Simulated => "SIM",
        Provenance.Estimated => "EST",
        Provenance.Unavailable => "NO TAG",
        _ => "NO TAG",
    };

    /// <summary>Long-form description used in tooltips and the tag inventory page.</summary>
    public static string ProvenanceMeaning(Provenance p) => p switch
    {
        Provenance.Measured => "Real PLC / instrument value, GOOD quality",
        Provenance.Reference => "Setpoint from the pass schedule / MMS",
        Provenance.Calculated => "Derived from measured values",
        Provenance.Simulated => "Produced by the simulation engine",
        Provenance.Estimated => "Model fill-in — no instrument exists for this value",
        Provenance.Unavailable => "No tag on this feed — nothing is being displayed",
        _ => "No tag on this feed — nothing is being displayed",
    };
}
