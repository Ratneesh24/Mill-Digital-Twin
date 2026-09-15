using Crm04.Domain.Replay;
using Crm04.Domain.Tags;
using Crm04.Domain.Types;

namespace Crm04.Api.Sources;

public sealed class ReplayOptions
{
    /// <summary>Directory holding <c>crm04-replay.jsonl</c> and <c>manifest.json</c>.</summary>
    public string? Directory { get; set; }

    /// <summary>Start again from the beginning when the replay ends. On by default.</summary>
    public bool Loop { get; set; } = true;

    /// <summary>
    /// How the frames are badged. Keep it SIMULATION.
    ///
    ///   SIMULATION  every value badged SIM - the honest description of simulator output.
    ///   SIM_46TAG   the same numbers shown with the availability rules of the real CRM04 extract,
    ///               still at SIMULATION quality. Permitted, but no longer surfaced anywhere.
    ///   LIVE        REFUSED. It would give simulator output plant provenance and GOOD quality.
    ///
    /// The replay itself only runs in Development; see Source:Kind in Program.cs.
    /// </summary>
    public string Mode { get; set; } = "SIMULATION";
}

/// <summary>
/// Plays back the dataset exported from the TypeScript simulator by
/// <c>scripts/exportSimFrames.ts</c>.
///
/// This is what lets the whole stack run on localhost with no Oracle instance. It is a stand-in
/// for the database, not a shortcut around it: it produces exactly the shape an
/// <c>OracleFrameSource</c> will produce, so nothing downstream needs revisiting when the real
/// source lands.
///
/// TWO THINGS IT DELIBERATELY DOES NOT DO. It does not sleep - the publisher owns the tick, so
/// pacing lives in one place. And it does not use the file's own timestamps: the replay carries
/// time RELATIVE to its start, and every frame is stamped with wall-clock time as it is emitted.
/// Baking absolute timestamps into a replay would make every frame look hours stale the day
/// after it was recorded, and the staleness watchdog would correctly reject the lot.
///
/// It loads the frames into memory once. A 30-minute replay is 18,000 frames of ~108 values;
/// re-reading 54 MB of JSON on every loop would be a strange way to spend a CPU.
/// </summary>
public sealed class ReplayFrameSource : IFrameSource
{
    private readonly ILogger<ReplayFrameSource> _log;
    private readonly string _directory;
    private readonly bool _loop;

    private ReplayFrame[] _frames = [];
    private int _index;
    private long _frameId;
    private bool _exhausted;

    public ReplayFrameSource(ReplayOptions options, ILogger<ReplayFrameSource> log)
    {
        _log = log;
        _directory = options.Directory ?? DefaultDirectory();
        _loop = options.Loop;
        Mode = WireNames.ParseOperatingMode(options.Mode);

        // A replay is simulator output. Badged LIVE, TagFactory would give every value plant
        // provenance and GOOD quality - fabricated readings indistinguishable from measurements.
        // That is precisely what removing the mode selector was meant to make impossible.
        if (Mode == OperatingMode.Live)
        {
            throw new InvalidOperationException(
                "Replay:Mode 'LIVE' is refused. The replay is simulator output; badging it LIVE would " +
                "present fabricated values as plant measurements with GOOD quality. Use SIMULATION.");
        }

        SourceId = $"replay:{Path.GetFileName(_directory)}";
    }

    public string SourceId { get; private set; }

    /// <summary>
    /// How these frames are badged. Defaults to SIMULATION, because they came from the simulator
    /// and saying so is the whole provenance contract - a model output must not claim instrument
    /// quality.
    ///
    /// Note that pointing the twin at Oracle will not change this by itself either: the source
    /// that produced the rows is what decides, not the transport that carried them.
    /// </summary>
    public OperatingMode Mode { get; }

    public Task StartAsync(CancellationToken ct)
    {
        var replayPath = Path.Combine(_directory, "crm04-replay.jsonl");
        var manifestPath = Path.Combine(_directory, "manifest.json");

        if (!File.Exists(replayPath))
        {
            throw new FileNotFoundException(
                $"Replay dataset not found at {replayPath}. Generate it from the TypeScript " +
                "simulator first, in the repository root:\n" +
                "  npx tsx scripts/exportSimFrames.ts --minutes 30",
                replayPath);
        }

        if (File.Exists(manifestPath))
        {
            var manifest = ReplayManifest.Load(manifestPath);
            var unknown = manifest.UnknownTags(t => TagCatalog.TryGet(t) is not null);

            // A replay generated from a different revision of tagDefinitions.ts would deliver tags
            // the catalogue cannot name. TagFactory would mark each one BAD and discard its value,
            // and the twin would show a quietly incomplete mill. Refusing to start says so out loud.
            if (unknown.Count > 0)
            {
                throw new InvalidOperationException(
                    $"Replay carries {unknown.Count} tag(s) the catalogue does not declare " +
                    $"({string.Join(", ", unknown.Take(5))}). The replay and the C# catalogue were " +
                    "generated from different revisions of tagDefinitions.ts. Regenerate both:\n" +
                    "  npx tsx scripts/exportTagCatalog.ts\n" +
                    "  npx tsx scripts/exportSimFrames.ts");
            }
        }

        _frames = ReplayFile.Read(replayPath).ToArray();
        if (_frames.Length == 0) throw new InvalidOperationException($"{replayPath} contained no frames.");

        SourceId = $"replay:{Path.GetFileName(replayPath)}";

        _log.LogInformation(
            "Replay source ready: {Frames} frames ({Minutes:F1} min of mill time), {Tags} tags per frame, loop={Loop}.",
            _frames.Length,
            _frames.Length * 100 / 60000d,
            _frames[0].Values.Count,
            _loop);

        return Task.CompletedTask;
    }

    public ValueTask<SourceFrame?> NextFrameAsync(CancellationToken ct)
    {
        if (_exhausted || _frames.Length == 0) return ValueTask.FromResult<SourceFrame?>(null);

        var frame = _frames[_index];
        _index++;

        if (_index >= _frames.Length)
        {
            if (_loop)
            {
                _index = 0;
                _log.LogInformation("Replay wrapped after {Frames} frames.", _frames.Length);
            }
            else
            {
                _exhausted = true;
            }
        }

        return ValueTask.FromResult<SourceFrame?>(new SourceFrame(
            FrameId: ++_frameId,
            TimestampMs: DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            Values: frame.Values,
            SolverIterations: frame.SolverIterations,
            GaugemeterResidualUm: frame.GaugemeterResidualUm));
    }

    public ValueTask DisposeAsync()
    {
        _frames = [];
        return ValueTask.CompletedTask;
    }

    /// <summary>Walk up from the binary to the repository's <c>dotnet/</c> folder.</summary>
    private static string DefaultDirectory()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Crm04.sln")))
        {
            dir = dir.Parent;
        }

        return Path.Combine(dir?.FullName ?? ".", "data", "replay");
    }
}
