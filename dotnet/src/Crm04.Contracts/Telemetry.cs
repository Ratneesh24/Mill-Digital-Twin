using Crm04.Domain.Types;

namespace Crm04.Contracts;

/// <summary>
/// The static half of the tag contract. Fetched ONCE when a client connects, then cached.
///
/// Everything here is constant for a given (tag, operating mode) pair - the name, the unit, the
/// limits, the resolved provenance. Re-sending 122 copies of it ten times a second, forever,
/// would be ~90 KB/s of pure repetition, which is what a naive "serialise the Tag objects"
/// approach does. Splitting it out is what takes the per-frame payload from ~9 KB to ~1.4 KB.
/// </summary>
/// <param name="Etag">Changes when the catalogue changes, so a client knows to re-fetch.</param>
/// <param name="Tags">Indexed by wire ordinal. Position IS the identity on the frame wire.</param>
public sealed record TagCatalogDto(
    OperatingMode Mode,
    string Etag,
    IReadOnlyList<TagCatalogEntryDto> Tags);

/// <param name="Provenance">
/// ALREADY RESOLVED for the mode. The client never re-derives it - that decision belongs to
/// TagFactory on the server, so no client can choose a friendlier badge for a value.
/// </param>
public sealed record TagCatalogEntryDto(
    string TagName,
    string Description,
    string? Unit,
    int? Decimals,
    Provenance Provenance,
    string? LiveNote,
    TagLimitsDto? Limits);

public sealed record TagLimitsDto(
    double? Low,
    double? High,
    double? WarningLow,
    double? WarningHigh,
    double? AlarmLow,
    double? AlarmHigh,
    double? TripHigh);

/// <summary>
/// The dynamic half: one frame, as parallel arrays indexed by wire ordinal.
///
/// <paramref name="Present"/> IS THE POINT OF THIS TYPE. It carries the distinction the whole
/// §7.4 contract rests on:
///
///   Present[i] == 0                     the feed has no such tag at all      -> render NO TAG
///   Present[i] == 1 &amp;&amp; Num[i] == null   the tag exists and reads nothing now  -> render NO TAG,
///                                                                               but it is a
///                                                                               different fact
///
/// Both render as a dash, but they are different statements about the mill, and an encoding that
/// collapsed them would make the twin unable to tell "not instrumented" from "instrument down".
/// </summary>
/// <param name="Num">Numeric values by ordinal. Null where the value is null or non-numeric.</param>
/// <param name="StrIx">Ordinals carrying a string value. Sparse - most tags are numeric.</param>
/// <param name="Str">String values, parallel to <paramref name="StrIx"/>.</param>
/// <param name="Status">TagStatus by ordinal, as the enum's integer value.</param>
/// <param name="Quality">TagQuality by ordinal, as the enum's integer value.</param>
/// <param name="Present">1 when the feed carries this tag at all, 0 when it does not.</param>
public sealed record CompactFrameDto(
    long FrameId,
    long Ts,
    double?[] Num,
    int[] StrIx,
    string[] Str,
    byte[] Status,
    byte[] Quality,
    byte[] Present);

/// <summary>
/// The structured facts about the mill that are not simply "the value of one tag" - the ones a
/// panel needs but a tag readout cannot express: derived percentages, the pass position, the
/// health of our own link to the data, and the interlock verdict.
///
/// Everything else the UI shows comes from <see cref="CompactFrameDto"/> through the tag
/// readout, which is what keeps the number beside the machine and the number in the KPI bar
/// provably the same number.
/// </summary>
/// <param name="EntrySpecificTension">
/// N/mm². DERIVED, not a tag - it is the entry tension presented against the strip section, a
/// unit conversion of a value already on screen rather than a second source (§18).
/// </param>
/// <param name="RollGapDeviation">
/// µm. DERIVED from the gap actual and reference. NULL rather than zero when the reference is
/// unavailable, which it is on the real CRM04 feed - there is no HAGC/LVDT position tag, so the
/// deviation is genuinely unknowable rather than nil.
/// </param>
public sealed record MillSummaryDto(
    MachineStatus MachineStatus,
    string StatusLabel,
    string StatusReason,
    RollingDirection Direction,
    OperatingMode Mode,
    int PassCurrent,
    int PassTotal,
    double PassProgress,
    double ForcePercentage,
    double TorquePercentage,
    double EntrySpecificTension,
    double ExitSpecificTension,
    double? RollGapDeviation,
    double ThroughputTph,
    double? SpecificEnergyKwhT,
    double? PassTimeRemainingSeconds,
    string CoilId,
    string? CoilGrade,
    CommStateDto Communication,
    SystemStatusDto Systems);

/// <summary>
/// Every subsystem's state, for the one-box System Status board.
///
/// These are STATUS WORDS, not process values, which is why they travel here rather than through
/// the tag frame: a control mode is an enum the UI renders as a pill, not a number a readout
/// prints. Nullable interlocks are three-state - ready, not ready, or NO TAG AT ALL - and the
/// third is the common case on the real CRM04 extract.
/// </summary>
public sealed record SystemStatusDto(
    bool? MillInterlock,
    bool? DriveReady,
    bool? HydraulicReady,
    bool? GaugeReady,
    bool? TensionReady,
    bool? EmergencyStop,
    CtrlState Agc,
    CtrlState Bending,
    CtrlState MassFlowControl,
    CtrlState PositionMode,
    CtrlState TensionRegulation,
    Health Coolant,
    Health Lubrication,
    Health Exhaust);

public sealed record CommStateDto(
    bool Connected,
    string SourceName,
    long LastFrameTimestamp,
    double AgeMs,
    bool Stale,
    double UpdateRateHz,
    long FramesReceived);

public sealed record AlarmDto(
    string Id,
    AlarmSeverity Severity,
    string Parameter,
    string TagName,
    double ActualValue,
    double Limit,
    string Unit,
    string Message,
    TwinSection? Section);

public sealed record InterlockNodeDto(string Id, string Label, bool Ok, string Reason);

/// <param name="Title">"MILL READY", "MILL NOT READY", or "MILL READY UNVERIFIED".</param>
/// <param name="Unverified">
/// True when the only thing holding the mill is a MISSING tag rather than a failing link. The
/// mill is held either way; the operator is told which situation they are in (§13.2).
/// </param>
public sealed record InterlockChainDto(
    IReadOnlyList<InterlockNodeDto> Nodes,
    bool MillReady,
    string? BlockingReason,
    string Title,
    string? Reason,
    bool Unverified);

/// <summary>
/// One push from <c>/hubs/telemetry</c>. Everything the dashboard needs for one instant, in one
/// message, so a client can never render a frame's tags beside a different frame's alarms.
/// </summary>
public sealed record TelemetryEnvelope(
    CompactFrameDto Frame,
    MillSummaryDto Summary,
    IReadOnlyList<AlarmDto> Alarms,
    InterlockChainDto Interlocks);

/// <summary>
/// One trend signal's metadata. Sent once with the catalogue; the chart joins it to the points.
/// </summary>
/// <param name="Provenance">
/// Resolved for the active mode from the owning tag. This is why a chart series can be badged
/// EST or NO TAG rather than being drawn as an anonymous line indistinguishable from a real
/// measurement.
/// </param>
public sealed record TrendSignalDto(
    string Key,
    string Label,
    string Unit,
    string Color,
    int Decimals,
    string Group,
    string TagName,
    bool IsReference,
    Provenance Provenance,
    string? LiveNote,
    bool AvailableOnThisFeed);

/// <param name="Windows">Window keys the API offers, e.g. "1m", "5m", "15m", "30m", "1h".</param>
public sealed record TrendCatalogDto(
    IReadOnlyList<TrendSignalDto> Signals,
    IReadOnlyList<string> Groups,
    IReadOnlyList<string> Windows);

/// <summary>
/// One series. Parallel arrays rather than an array of points: it is roughly half the JSON, and
/// it is the shape uPlot's <c>setData</c> wants, so the chart does no reshaping on every repaint.
/// </summary>
/// <param name="T">Epoch milliseconds.</param>
/// <param name="V">Averaged values, parallel to <paramref name="T"/>.</param>
public sealed record TrendSeriesDto(string Key, long[] T, double[] V);

/// <param name="ReferenceLines">
/// Limit lines from the owning tag's configured bounds, so the chart shows the same thresholds
/// the alarm engine actually uses rather than hand-placed decoration.
/// </param>
public sealed record TrendResponseDto(
    string Window,
    long WindowMs,
    IReadOnlyList<TrendSeriesDto> Series,
    IReadOnlyDictionary<string, TrendLimitDto> ReferenceLines);

public sealed record TrendLimitDto(
    double? WarningLow,
    double? WarningHigh,
    double? AlarmLow,
    double? AlarmHigh,
    double? TripHigh);

/// <summary>Feed health for the diagnostics panel. Answers "is what I am looking at current?".</summary>
public sealed record FeedDiagnosticsDto(
    string SourceId,
    bool Running,
    long FramesPublished,
    long FrameId,
    double PublishRateHz,
    double LastFrameAgeMs,
    bool Stale,
    int TagsInFrame,
    int CatalogueSize,
    double PipelineMsP50,
    double PipelineMsP99);
