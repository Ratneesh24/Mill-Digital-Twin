using Crm04.Domain.Types;

namespace Crm04.Api.Sources;

/// <summary>One raw frame as it leaves the source, before any badging.</summary>
/// <param name="Values">
/// Tag name to raw value. A tag ABSENT from this dictionary means the feed has no such tag;
/// a tag present with a null value means it exists and currently reads nothing. Preserving that
/// difference all the way from the source is what makes §7.4 work end to end.
/// </param>
public sealed record SourceFrame(
    long FrameId,
    long TimestampMs,
    IReadOnlyDictionary<string, TagValue> Values,
    int SolverIterations,
    double GaugemeterResidualUm);

/// <summary>
/// Where process values come from.
///
/// THIS IS THE ORACLE SEAM. Today the only implementation is
/// <see cref="ReplayFrameSource"/>, which plays back the dataset exported from the TypeScript
/// simulator. In M2 an <c>OracleFrameSource</c> joins it, polling FRAME/TAG_SAMPLE for rows the
/// Feeder has written, and in M9 an OPC UA gateway source can sit behind the same interface.
///
/// Nothing above this line knows or cares which one is running: the pipeline, the projection,
/// the alarms and the whole UI are identical either way. That is the same property the
/// TypeScript app gets from its DataSource interface, and it is why the twin can be developed
/// and demonstrated before the database exists.
/// </summary>
public interface IFrameSource : IAsyncDisposable
{
    /// <summary>Human-readable identity, shown in the diagnostics panel. e.g. "replay:crm04-replay.jsonl".</summary>
    string SourceId { get; }

    /// <summary>
    /// How values from this source must be badged. A replayed simulator frame is SIMULATION;
    /// a real plant feed is LIVE. The source declares this - it is not a UI preference.
    ///
    /// There is deliberately no setter and no override. LIVE is EARNED by the data, never
    /// asserted by a client: the old mode switch let a request re-badge replayed simulator values,
    /// and on a live-only plant display that is exactly the claim that must be impossible.
    /// </summary>
    OperatingMode Mode { get; }

    Task StartAsync(CancellationToken ct);

    /// <summary>
    /// The next frame, or null when the source has nothing new right now. The source does NOT
    /// sleep and does NOT stamp wall-clock time; the publisher owns the clock, so swapping a
    /// pull-based replay for a push-based gateway changes nothing downstream.
    /// </summary>
    ValueTask<SourceFrame?> NextFrameAsync(CancellationToken ct);
}
