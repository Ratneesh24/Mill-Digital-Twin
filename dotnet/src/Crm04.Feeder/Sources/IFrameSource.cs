using Crm04.Domain.Types;

namespace Crm04.Feeder.Sources;

/// <param name="Values">
/// Tag name to raw value, with no provenance attached. A tag ABSENT means the feed has no such
/// tag; a tag present holding <see cref="TagValue.Null"/> means it exists and currently reads
/// nothing. Preserving that difference from the source onwards is what makes §7.4 work.
/// </param>
public sealed record FeedFrame(
    IReadOnlyDictionary<string, TagValue> Values,
    int SolverIterations,
    double GaugemeterResidualUm);

/// <summary>
/// Where the Feeder gets frames to write.
///
/// THE OPC UA SEAM. Today the only implementation replays the dataset exported from the
/// TypeScript simulator. An <c>OpcUaFrameSource</c> slots in behind this interface without the
/// write path changing at all: the address-space mapping it needs already exists in
/// <c>src/communication/opcUaAdapter.ts</c> and ports directly.
///
/// The contract that makes the swap free: the source does NOT sleep and does NOT stamp time.
/// The Feeder's PeriodicTimer owns the clock, so a pull-based replay and a push-based gateway
/// look identical from the writer's side.
/// </summary>
public interface IFrameSource : IAsyncDisposable
{
    /// <summary>Recorded in FRAME.SOURCE_ID, so a row can always be traced to what produced it.</summary>
    string SourceId { get; }

    /// <summary>
    /// How the values must be badged. The SOURCE decides this, not a UI preference: a replayed
    /// simulator frame is SIMULATION however it reaches the screen.
    /// </summary>
    OperatingMode Mode { get; }

    Task StartAsync(CancellationToken ct);

    /// <summary>The next frame, or null when the source has nothing right now.</summary>
    ValueTask<FeedFrame?> NextFrameAsync(CancellationToken ct);
}
