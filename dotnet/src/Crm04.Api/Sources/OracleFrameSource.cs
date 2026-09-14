using Crm04.Domain.Types;
using Crm04.Persistence;
using Crm04.Persistence.Raw;
using Crm04.Persistence.Seed;

namespace Crm04.Api.Sources;

public sealed class OracleSourceOptions
{
    /// <summary>
    /// Never replay a backlog on startup: begin at the newest frame. A 10 Hz UI gains nothing
    /// from watching an hour of history stream past, and it could never catch up anyway.
    /// </summary>
    public bool StartAtLatest { get; set; } = true;

    /// <summary>
    /// If more than this many frames are pending, publish only the newest and skip the rest.
    /// The API holds ONE MachineState, not a queue - the same rule machineStore follows.
    /// </summary>
    public int CatchUpThreshold { get; set; } = 5;
}

/// <summary>
/// Reads frames the Feeder has written into Oracle. The production frame source.
///
/// HOW IT DETECTS NEW FRAMES WITHOUT HAMMERING THE DATABASE. Three cheap levers:
///
///   1. The idle poll is a primary-key range scan that returns zero rows - sub-millisecond,
///      fully buffer-cached. Twenty of those a second is invisible load.
///   2. Adaptive backoff, 50 ms up to 500 ms while nothing arrives, snapping back on the first
///      hit. A stopped feeder costs two queries a second rather than twenty.
///   3. Catch-up collapse: never replay a backlog.
///
/// A push alternative exists - ODP.NET Continuous Query Notification on CURRENT_FRAME - and
/// would remove the polling entirely. It needs CHANGE NOTIFICATION privilege and an inbound
/// callback port from the database to this host, which is usually a non-starter on a plant
/// network. Polling at this cost is the right default; the seam is <see cref="IFrameSource"/>
/// if that ever changes.
/// </summary>
public sealed class OracleFrameSource : IFrameSource
{
    private readonly OracleConnectionFactory _factory;
    private readonly OracleSourceOptions _options;
    private readonly ILogger<OracleFrameSource> _log;

    private static readonly int[] BackoffMs = [50, 50, 100, 250, 500];

    private RawFrameReader? _reader;
    private long _watermark;
    private int _idleStep;
    private DateTimeOffset _nextPollAt = DateTimeOffset.MinValue;
    private OperatingMode _mode = OperatingMode.Simulation;

    // Headers fetched but not yet turned into frames. Read in one round trip, drained one per
    // tick, so a burst costs one query rather than one per frame.
    private readonly Queue<FrameHeader> _pending = new();

    public OracleFrameSource(
        OracleConnectionFactory factory,
        OracleSourceOptions options,
        ILogger<OracleFrameSource> log)
    {
        _factory = factory;
        _options = options;
        _log = log;
    }

    public string SourceId { get; private set; } = "oracle";

    /// <summary>
    /// Taken from the frames themselves, not from configuration. FRAME.OP_MODE records what the
    /// writer said the values were, so a replayed simulator frame stays SIMULATION however it is
    /// read back. The transport does not get to upgrade a value's provenance.
    /// </summary>
    public OperatingMode Mode => _modeOverride ?? _mode;

    private OperatingMode? _modeOverride;

    /// <summary>
    /// Override how stored frames are badged.
    ///
    /// FRAME.OP_MODE records what the writer said the values were, and that stays the default -
    /// a replayed simulator frame does not become a measurement by being read out of a database.
    /// The override exists for the §7.4 rehearsal: showing the same rows under the availability
    /// rules of the real CRM04 extract. It never upgrades quality, only the availability lens.
    /// </summary>
    public bool TrySetMode(OperatingMode mode)
    {
        _modeOverride = mode;
        return true;
    }

    public long Watermark => _watermark;

    public async Task StartAsync(CancellationToken ct)
    {
        var tagIds = await TagDefinitionSeeder.LoadMapAsync(_factory, ct);

        if (tagIds.Count == 0)
        {
            throw new InvalidOperationException(
                "TAG_DEF is empty. Create the schema and seed the catalogue first:\n" +
                "  dotnet run --project src/Crm04.Feeder -- --apply-ddl");
        }

        _reader = new RawFrameReader(_factory, tagIds.IdByName);

        if (_options.StartAtLatest)
        {
            _watermark = await _reader.GetLatestFrameIdAsync(ct);
        }

        SourceId = $"oracle:{_factory.Redacted.Split("SERVICE_NAME=").LastOrDefault()?.TrimEnd(')', ';', ' ') ?? "crm04"}";

        _log.LogInformation(
            "Oracle source ready: {Tags} tags in TAG_DEF, starting at frame {Watermark}.",
            tagIds.Count, _watermark);
    }

    public async ValueTask<SourceFrame?> NextFrameAsync(CancellationToken ct)
    {
        if (_reader is null) return null;

        if (_pending.Count == 0)
        {
            if (DateTimeOffset.UtcNow < _nextPollAt) return null;

            var headers = await _reader.GetHeadersAfterAsync(_watermark, max: 50, ct);

            if (headers.Count == 0)
            {
                _idleStep = Math.Min(_idleStep + 1, BackoffMs.Length - 1);
                _nextPollAt = DateTimeOffset.UtcNow.AddMilliseconds(BackoffMs[_idleStep]);
                return null;
            }

            _idleStep = 0;
            _nextPollAt = DateTimeOffset.MinValue;
            _watermark = headers[^1].FrameId;

            // Catch-up collapse. If we fell a long way behind - a pause, a slow query, a restart
            // without StartAtLatest - jump to the newest frame rather than replaying at wall-clock
            // speed, which would never catch up and would show old data as if it were current.
            if (headers.Count > _options.CatchUpThreshold)
            {
                _log.LogInformation(
                    "Skipping {Count} backlogged frame(s); publishing only frame {FrameId}.",
                    headers.Count - 1, headers[^1].FrameId);
                _pending.Enqueue(headers[^1]);
            }
            else
            {
                foreach (var h in headers) _pending.Enqueue(h);
            }
        }

        var header = _pending.Dequeue();
        var values = await _reader.ReadFrameAsync(header.FrameId, ct);
        _mode = header.Mode;

        // The header said how many rows it wrote. A shortfall means we are reading a frame whose
        // samples had not all committed, or that rows have been lost - either way, a truncated
        // frame would be misread downstream as "many tags are absent from this feed", which looks
        // exactly like a legitimate §7.4 degradation. Say so instead.
        if (values.Count < header.TagCount)
        {
            _log.LogWarning(
                "Frame {FrameId} is short: header declared {Declared} tags, read {Actual}.",
                header.FrameId, header.TagCount, values.Count);
        }

        return new SourceFrame(
            FrameId: header.FrameId,
            TimestampMs: header.EpochMs,
            Values: values,
            SolverIterations: 0,
            GaugemeterResidualUm: 0d);
    }

    public ValueTask DisposeAsync()
    {
        _pending.Clear();
        return ValueTask.CompletedTask;
    }
}
