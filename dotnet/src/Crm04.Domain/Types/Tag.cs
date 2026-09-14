using System.Diagnostics.CodeAnalysis;

namespace Crm04.Domain.Types;

/// <summary>
/// Port of the TypeScript <c>TagLimits</c>. Every bound is optional; a null bound means
/// "not configured", which is why these are <c>double?</c> and not sentinel values.
/// </summary>
public readonly record struct TagLimits(
    double? Low = null,
    double? High = null,
    double? WarningLow = null,
    double? WarningHigh = null,
    double? AlarmLow = null,
    double? AlarmHigh = null,
    double? TripHigh = null)
{
    /// <summary>True when no bound at all is configured, i.e. the TypeScript <c>limits?</c> was absent.</summary>
    public bool IsEmpty =>
        Low is null && High is null && WarningLow is null && WarningHigh is null &&
        AlarmLow is null && AlarmHigh is null && TripHigh is null;

    public static readonly TagLimits None = default;
}

/// <summary>
/// Port of <c>src/types/tags.ts</c>.
///
/// Every value that reaches a pixel travels as a Tag. The Tag carries not just the number but
/// where the number came from (<see cref="Provenance"/>) and whether it can be trusted right
/// now (<see cref="Quality"/>). The UI is forbidden from rendering a CALCULATED, SIMULATED or
/// ESTIMATED value with the appearance of a MEASURED one (§7.3), so provenance is a first-class
/// field, not a styling afterthought.
///
/// THE CONSTRUCTOR IS INTERNAL ON PURPOSE. <see cref="Tags.TagFactory"/> is the only producer,
/// mirroring the TypeScript rule that <c>makeTag()</c> is the only Tag constructor in the
/// application (<c>src/data/tagMap.ts:104</c>). Nothing outside this assembly can fabricate a
/// Tag with a provenance it did not earn.
/// </summary>
public sealed record Tag
{
    internal Tag(
        string tagName,
        TagValue value,
        string? unit,
        long timestamp,
        TagQuality quality,
        TagStatus status,
        Provenance provenance,
        TagLimits limits)
    {
        TagName = tagName;
        Value = value;
        Unit = unit;
        Timestamp = timestamp;
        Quality = quality;
        Status = status;
        Provenance = provenance;
        Limits = limits;
    }

    public string TagName { get; }

    public TagValue Value { get; }

    public string? Unit { get; }

    /// <summary>Epoch milliseconds. Matches the TypeScript <c>number</c> timestamp exactly.</summary>
    public long Timestamp { get; }

    public TagQuality Quality { get; }

    public TagStatus Status { get; }

    public Provenance Provenance { get; }

    public TagLimits Limits { get; }

    /// <summary>
    /// The value as a finite number, or null. This is the accessor almost every caller wants -
    /// see <see cref="TagValue.AsFiniteNumber"/> for why "or null" is not a convenience.
    /// </summary>
    public double? Numeric => Value.AsFiniteNumber;

    /// <summary>True when this tag has nothing to show and the UI must render "NO TAG" (§7.4).</summary>
    public bool IsUnavailable => Provenance == Provenance.Unavailable;

    /// <summary>
    /// A copy re-stamped as STALE. Used by the staleness watchdog, which marks the whole frame
    /// rather than dropping it - the values are still the last known truth, they are just old.
    /// A tag with no value on this feed stays NO_TAG; staleness cannot make an absent tag worse.
    /// </summary>
    internal Tag AsStale() =>
        Quality == TagQuality.NoTag
            ? this
            : new Tag(TagName, Value, Unit, Timestamp, TagQuality.Stale, Status, Provenance, Limits);
}

/// <summary>
/// A single normalised frame from any data source: tag name to <see cref="Tag"/>.
///
/// A missing key and a present key holding a null value are DIFFERENT THINGS and the whole
/// §7.4 contract rests on the difference: missing means the feed has no such tag, present-null
/// means the tag exists and is currently reading nothing. <see cref="TryGet"/> collapses both
/// to null deliberately, because most readers want exactly that; anything that needs to tell
/// them apart calls <see cref="Contains"/>.
/// </summary>
public sealed class TagFrame
{
    private readonly Dictionary<string, Tag> _tags;

    internal TagFrame(Dictionary<string, Tag> tags, long timestamp, OperatingMode mode)
    {
        _tags = tags;
        Timestamp = timestamp;
        Mode = mode;
    }

    /// <summary>Epoch milliseconds this frame was stamped with.</summary>
    public long Timestamp { get; }

    public OperatingMode Mode { get; }

    public int Count => _tags.Count;

    public IEnumerable<string> TagNames => _tags.Keys;

    public IEnumerable<Tag> Tags => _tags.Values;

    /// <summary>The tag, or null when this feed carries no such tag at all.</summary>
    public Tag? TryGet(string tagName) => _tags.TryGetValue(tagName, out var t) ? t : null;

    public bool TryGet(string tagName, [NotNullWhen(true)] out Tag? tag) => _tags.TryGetValue(tagName, out tag);

    /// <summary>True when the feed carries this tag, regardless of whether its value is null.</summary>
    public bool Contains(string tagName) => _tags.ContainsKey(tagName);

    /// <summary>
    /// The finite numeric value of a tag, or null when the tag is absent, unavailable, null,
    /// or non-numeric. Port of <c>numericValue(tags[name])</c>, which is how every numeric
    /// read in <c>dataAdapter.ts</c> begins.
    /// </summary>
    public double? Numeric(string tagName) => TryGet(tagName)?.Numeric;

    /// <summary>An empty frame - what the UI holds before the first frame arrives.</summary>
    public static TagFrame Empty(OperatingMode mode) => new([], 0L, mode);
}

/// <summary>
/// Port of the TypeScript <c>TagDefinition</c> - one row of the tag catalogue.
///
/// This is declarative metadata, not a value. It is generated from
/// <c>src/data/tagDefinitions.ts</c> rather than hand-written, and seeded into the Oracle
/// <c>TAG_DEF</c> table from the same source, so the two cannot drift.
/// </summary>
/// <param name="TagName">Dotted tag name, e.g. <c>MILL.SPEED.ACTUAL</c>.</param>
/// <param name="Description">Human-readable description shown in the tag inventory.</param>
/// <param name="Unit">Engineering unit, or null for status/enum tags.</param>
/// <param name="SimulationProvenance">Provenance when the simulation is the source.</param>
/// <param name="LiveAvailability">Provenance once bound to the real CRM04 extract (§7.4).</param>
/// <param name="LiveNote">Why the live availability is not MEASURED. Shown in the tooltip.</param>
/// <param name="Limits">Limit bounds driving <see cref="TagStatus"/> and the alarm engine.</param>
/// <param name="Decimals">Display precision. Also drives change detection in the Blazor TagStore.</param>
/// <param name="Ordinal">
/// Stable wire position. The compact frame DTO is an array indexed by this, so it MUST match
/// <c>TAG_DEF.ORDINAL</c> in Oracle - a reordered catalogue would silently shift every value.
/// </param>
public sealed record TagDefinition(
    string TagName,
    string Description,
    string? Unit,
    Provenance SimulationProvenance,
    LiveAvailability LiveAvailability,
    string? LiveNote,
    TagLimits Limits,
    int? Decimals,
    int Ordinal);
