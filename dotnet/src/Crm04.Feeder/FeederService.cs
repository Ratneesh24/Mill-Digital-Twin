using System.Diagnostics;
using Crm04.Domain.Configuration;
using Crm04.Domain.Types;
using Crm04.Feeder.Sources;
using Crm04.Persistence;
using Crm04.Persistence.Raw;
using Crm04.Persistence.Seed;

namespace Crm04.Feeder;

/// <summary>
/// The 10 Hz write loop. The only process that inserts process values into Oracle.
///
/// Its whole job is: take a frame from the source, stamp it with wall-clock time, write it, and
/// stay on schedule. The interesting decisions are about what to do when it CANNOT stay on
/// schedule, because a feeder that silently falls behind produces a database that looks healthy
/// and is minutes stale.
/// </summary>
public sealed class FeederService : BackgroundService
{
    private readonly IFrameSource _source;
    private readonly OracleConnectionFactory _factory;
    private readonly ILogger<FeederService> _log;

    private RawFrameWriter? _writer;
    private readonly double[] _writeMs = new double[256];
    private int _writeCount;

    public FeederService(IFrameSource source, OracleConnectionFactory factory, ILogger<FeederService> log)
    {
        _source = source;
        _factory = factory;
        _log = log;
    }

    public long FramesWritten { get; private set; }

    /// <summary>
    /// Frames dropped because the writer could not keep up. Surfaced rather than hidden: a
    /// non-zero and growing count is the signal that the database cannot sustain the rate.
    /// </summary>
    public long FramesDropped { get; private set; }

    public double WriteMsP50 => Percentile(0.50);

    public double WriteMsP99 => Percentile(0.99);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        TagIdMap tagIds;
        try
        {
            await _source.StartAsync(ct);

            // Bring TAG_DEF in line with the compiled catalogue and get the id map. This also
            // verifies the ordinals, which is the check that stops every value on the SignalR
            // wire landing on the wrong tag.
            tagIds = await TagDefinitionSeeder.EnsureSeededAsync(_factory, ct);
            _log.LogInformation("TAG_DEF seeded and verified: {Count} tags.", tagIds.Count);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Feeder could not start. Nothing will be written.");
            return;
        }

        _writer = new RawFrameWriter(_factory, tagIds.IdByName);

        _log.LogInformation(
            "Feeding {SourceId} into {Target} at {Rate} Hz in {Mode} mode.",
            _source.SourceId,
            _factory.Redacted,
            1000 / EngineeringConfig.FrameTickMs,
            _source.Mode.ToWire());

        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(EngineeringConfig.FrameTickMs));
        var sw = new Stopwatch();
        var consecutiveFailures = 0;

        while (await timer.WaitForNextTickAsync(ct))
        {
            try
            {
                var frame = await _source.NextFrameAsync(ct);
                if (frame is null) continue;

                sw.Restart();
                await _writer.WriteFrameAsync(
                    frame.Values,
                    DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    _source.SourceId,
                    _source.Mode,
                    ct);
                sw.Stop();

                _writeMs[_writeCount % _writeMs.Length] = sw.Elapsed.TotalMilliseconds;
                _writeCount++;
                FramesWritten++;
                consecutiveFailures = 0;

                // A write that overran the tick means the next frame is already late. DROP it
                // rather than queueing: a queue would grow without bound and the twin would fall
                // further behind wall-clock time with every tick, showing old data as if current.
                // Losing a frame is the honest failure - the gap is visible, a lag is not.
                if (sw.Elapsed.TotalMilliseconds > EngineeringConfig.FrameTickMs * 3)
                {
                    FramesDropped++;
                    if (FramesDropped % 50 == 1)
                    {
                        _log.LogWarning(
                            "Write took {Ms:F0} ms against a {Budget} ms budget; {Dropped} frame(s) dropped so far.",
                            sw.Elapsed.TotalMilliseconds,
                            EngineeringConfig.FrameTickMs,
                            FramesDropped);
                    }
                }

                if (FramesWritten % 600 == 0)
                {
                    _log.LogInformation(
                        "{Frames} frames written. Write p50 {P50:F1} ms, p99 {P99:F1} ms, {Dropped} dropped.",
                        FramesWritten, WriteMsP50, WriteMsP99, FramesDropped);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                consecutiveFailures++;
                FramesDropped++;

                // One failed write must not stop the feed - the next frame is 100 ms away. A
                // SUSTAINED failure is different: it means the database is gone, and hammering it
                // ten times a second while logging each attempt helps nobody.
                if (consecutiveFailures is 1 or 10 or 100)
                {
                    _log.LogError(ex, "Frame write failed ({Count} consecutive).", consecutiveFailures);
                }

                if (consecutiveFailures >= 10) await Task.Delay(TimeSpan.FromSeconds(2), ct);
            }
        }

        _log.LogInformation("Feeder stopping after {Frames} frames ({Dropped} dropped).", FramesWritten, FramesDropped);
    }

    public override void Dispose()
    {
        _writer?.Dispose();
        base.Dispose();
    }

    private double Percentile(double p)
    {
        var n = Math.Min(_writeCount, _writeMs.Length);
        if (n == 0) return 0d;

        var copy = new double[n];
        Array.Copy(_writeMs, copy, n);
        Array.Sort(copy);
        return copy[Math.Clamp((int)(p * (n - 1)), 0, n - 1)];
    }
}

/// <summary>
/// Housekeeping: trend rollup and retention. Both are WRITES, which is why they live in the
/// Feeder rather than the API.
///
/// Deliberately on a slow timer and off the frame path. Neither is urgent — a trend bucket that
/// appears five seconds late is invisible, and retention only has to keep up with a table
/// growing at 155 MB an hour — and putting them on the 10 Hz loop would risk a partition drop
/// landing between a frame's header and its samples.
/// </summary>
public sealed class MaintenanceService : BackgroundService
{
    private readonly Persistence.Maintenance.TrendRollupService _rollup;
    private readonly Persistence.Maintenance.RetentionService _retention;
    private readonly ILogger<MaintenanceService> _log;
    private readonly TimeSpan _retentionWindow;

    public MaintenanceService(
        Persistence.Maintenance.TrendRollupService rollup,
        Persistence.Maintenance.RetentionService retention,
        IConfiguration config,
        ILogger<MaintenanceService> log)
    {
        _rollup = rollup;
        _retention = retention;
        _log = log;
        _retentionWindow = TimeSpan.FromHours(config.GetValue("Retention:Hours", 2.0));
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Let the feeder get frames in first; rolling up an empty table is pointless work.
        await Task.Delay(TimeSpan.FromSeconds(15), ct);

        using var rollupTimer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        var lastRetention = DateTimeOffset.UtcNow;

        while (await rollupTimer.WaitForNextTickAsync(ct))
        {
            try
            {
                // Lookback exceeds the 5 s interval so a bucket that closed during a slow run is
                // not skipped. The MERGE recomputes rather than accumulates, so overlap is free.
                await _rollup.RollUpAsync(TimeSpan.FromSeconds(30), ct);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Trend rollup failed; will retry.");
            }

            if (DateTimeOffset.UtcNow - lastRetention < TimeSpan.FromMinutes(1)) continue;
            lastRetention = DateTimeOffset.UtcNow;

            try
            {
                var result = await _retention.ApplyAsync(_retentionWindow, ct);
                if (result.FramePartitionsDropped + result.SamplePartitionsDropped > 0)
                {
                    _log.LogInformation(
                        "Retention dropped {Frames} FRAME and {Samples} TAG_SAMPLE partition(s) below frame {Cutoff}.",
                        result.FramePartitionsDropped, result.SamplePartitionsDropped, result.CutoffFrameId);
                }

                await _retention.TrimTrendsAsync(ct);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Retention failed; will retry.");
            }
        }
    }
}
