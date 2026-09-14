using Crm04.Contracts;
using Crm04.Domain.Types;

namespace Crm04.Web.State;

/// <summary>A tag as the UI sees it: the frame's value joined to the catalogue's metadata.</summary>
/// <param name="Present">False when this feed carries no such tag at all - render NO TAG (§7.4).</param>
public readonly record struct UiTag(
    string TagName,
    double? Number,
    string? Text,
    bool Present,
    TagStatus Status,
    TagQuality Quality,
    Provenance Provenance,
    string? Unit,
    int? Decimals,
    string? LiveNote,
    TagLimitsDto? Limits)
{
    /// <summary>
    /// True when there is nothing to show and the readout must print a dash.
    ///
    /// Three different situations collapse here - the feed has no such tag, the tag reads null,
    /// or the catalogue marks it UNAVAILABLE in this mode. They all render the same way, but
    /// <see cref="LiveNote"/> is what tells the operator which one they are looking at.
    /// </summary>
    public bool HasNothingToShow =>
        !Present || Provenance == Provenance.Unavailable || (Number is null && Text is null);

    public static UiTag Missing(string tagName) => new(
        tagName, null, null, false, TagStatus.Unknown, TagQuality.NoTag,
        Provenance.Unavailable, null, null, null, null);
}

/// <summary>
/// The C# <c>machineStore.tags</c>: the current value of every tag, indexed by ordinal.
///
/// A singleton. Every viewer is looking at the same mill, so one store serves the whole process
/// and a newly opened browser tab costs nothing.
///
/// THE VERSION STAMPS ARE THE PERFORMANCE STORY. Each tag carries a counter that is bumped only
/// when its RENDERED representation changes - the value rounded to its display precision, plus
/// status and quality. A rolling force that wobbles in the sixth decimal at 10 Hz does not bump
/// anything, so <c>ValueReadout.ShouldRender</c> returns false and Blazor produces no diff for it.
/// Without that, a steady mill would still generate a full re-render of every readout ten times
/// a second and the circuit would spend its life shipping identical HTML.
/// </summary>
public sealed class TagStore
{
    private readonly object _gate = new();
    private readonly Dictionary<string, int> _ordinalByName = new(StringComparer.Ordinal);

    private TagCatalogDto? _catalog;
    private UiTag[] _tags = [];
    private int[] _versions = [];

    /// <summary>
    /// A short rolling history per tag, for the KPI sparklines.
    ///
    /// Kept HERE rather than fetched from /api/trends because a sparkline is a glance at the last
    /// few seconds, not a chart: nine of them repainting twice a second would otherwise be nine
    /// HTTP round trips per repaint for a 26-pixel-high trace. The full trend history still lives
    /// in the API, where it belongs.
    /// </summary>
    private const int SparkCapacity = 64;

    private double[][] _spark = [];
    private int[] _sparkCount = [];
    private int[] _sparkHead = [];

    public bool HasCatalog => _catalog is not null;

    public OperatingMode Mode => _catalog?.Mode ?? OperatingMode.Simulation;

    /// <summary>Bumped on every frame. Components with no single tag of their own watch this.</summary>
    public int GlobalVersion { get; private set; }

    public void SetCatalog(TagCatalogDto catalog)
    {
        lock (_gate)
        {
            _catalog = catalog;
            _ordinalByName.Clear();
            for (var i = 0; i < catalog.Tags.Count; i++) _ordinalByName[catalog.Tags[i].TagName] = i;

            _tags = new UiTag[catalog.Tags.Count];
            _versions = new int[catalog.Tags.Count];
            for (var i = 0; i < catalog.Tags.Count; i++) _tags[i] = UiTag.Missing(catalog.Tags[i].TagName);

            // Sparkline history survives a catalogue refresh when the size is unchanged - a mode
            // switch re-badges the same tags and should not blank every trace on screen.
            if (_spark.Length != catalog.Tags.Count)
            {
                _spark = new double[catalog.Tags.Count][];
                for (var i = 0; i < catalog.Tags.Count; i++) _spark[i] = new double[SparkCapacity];
                _sparkCount = new int[catalog.Tags.Count];
                _sparkHead = new int[catalog.Tags.Count];
            }
        }
    }

    /// <summary>
    /// The last few seconds of a tag, oldest first. Empty when there is nothing to draw.
    /// </summary>
    public double[] Spark(string tagName)
    {
        lock (_gate)
        {
            if (!_ordinalByName.TryGetValue(tagName, out var i)) return [];

            var count = _sparkCount[i];
            if (count < 2) return [];

            var result = new double[count];
            var start = (_sparkHead[i] - count + SparkCapacity) % SparkCapacity;
            for (var k = 0; k < count; k++) result[k] = _spark[i][(start + k) % SparkCapacity];
            return result;
        }
    }

    public UiTag Get(string tagName)
    {
        lock (_gate)
        {
            return _ordinalByName.TryGetValue(tagName, out var i) ? _tags[i] : UiTag.Missing(tagName);
        }
    }

    /// <summary>The render gate. See the class comment for why this is not micro-optimisation.</summary>
    public int VersionOf(string tagName)
    {
        lock (_gate)
        {
            return _ordinalByName.TryGetValue(tagName, out var i) ? _versions[i] : 0;
        }
    }

    public void Apply(CompactFrameDto frame)
    {
        lock (_gate)
        {
            if (_catalog is null) return;

            // Strings arrive sparse - most tags are numeric, only status words and roles are text.
            Dictionary<int, string>? strings = null;
            for (var s = 0; s < frame.StrIx.Length; s++)
            {
                strings ??= new Dictionary<int, string>(frame.StrIx.Length);
                strings[frame.StrIx[s]] = frame.Str[s];
            }

            var n = Math.Min(_tags.Length, frame.Present.Length);
            for (var i = 0; i < n; i++)
            {
                var def = _catalog.Tags[i];
                var present = frame.Present[i] == 1;
                string? text = null;
                strings?.TryGetValue(i, out text);

                var next = new UiTag(
                    TagName: def.TagName,
                    Number: present ? frame.Num[i] : null,
                    Text: present ? text : null,
                    Present: present,
                    Status: (TagStatus)frame.Status[i],
                    Quality: (TagQuality)frame.Quality[i],
                    Provenance: def.Provenance,
                    Unit: def.Unit,
                    Decimals: def.Decimals,
                    LiveNote: def.LiveNote,
                    Limits: def.Limits);

                if (!RendersTheSame(_tags[i], next, def.Decimals)) _versions[i]++;
                _tags[i] = next;

                // Sparkline history. Only real numbers are appended: a null reading is a gap in
                // knowledge, and carrying the last value forward would draw a flat line that
                // looks like a steady measurement of something we cannot actually see.
                if (next.Number is { } v && double.IsFinite(v))
                {
                    _spark[i][_sparkHead[i]] = v;
                    _sparkHead[i] = (_sparkHead[i] + 1) % SparkCapacity;
                    if (_sparkCount[i] < SparkCapacity) _sparkCount[i]++;
                }
            }

            GlobalVersion++;
        }
    }

    /// <summary>
    /// Would these two tags paint the same pixels?
    ///
    /// The comparison is on the ROUNDED value, at the precision the readout actually prints. This
    /// is the whole trick: at 10 Hz a force reading changes in the fifth decimal on every frame
    /// and never once changes the "251" the operator sees.
    /// </summary>
    private static bool RendersTheSame(UiTag a, UiTag b, int? decimals)
    {
        if (a.Present != b.Present || a.Status != b.Status || a.Quality != b.Quality) return false;
        if (!string.Equals(a.Text, b.Text, StringComparison.Ordinal)) return false;
        if (a.Number is null != (b.Number is null)) return false;
        if (a.Number is null) return true;

        var d = Math.Clamp(decimals ?? 3, 0, 15);
        return Math.Round(a.Number.Value, d, MidpointRounding.AwayFromZero)
            .Equals(Math.Round(b.Number!.Value, d, MidpointRounding.AwayFromZero));
    }
}
