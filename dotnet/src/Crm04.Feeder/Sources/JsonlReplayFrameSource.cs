using Crm04.Domain.Replay;
using Crm04.Domain.Tags;
using Crm04.Domain.Types;

namespace Crm04.Feeder.Sources;

public sealed class ReplaySourceOptions
{
    public string? Directory { get; set; }

    public bool Loop { get; set; } = true;

    /// <summary>SIMULATION | SIM_46TAG | LIVE. See <see cref="IFrameSource.Mode"/>.</summary>
    public string Mode { get; set; } = "SIMULATION";
}

/// <summary>
/// Replays the dataset exported from the TypeScript simulator into Oracle.
///
/// The physics was deliberately not ported, so something has to put process values in the
/// database. Until a real gateway exists, this is it — and being honest about that matters:
/// the frames are badged SIMULATION, and the feed-status panel says the source is a looping
/// replay rather than implying a live mill.
///
/// A 30-minute replay wraps every 30 minutes, which an observer will eventually notice. That is
/// preferable to pretending otherwise.
/// </summary>
public sealed class JsonlReplayFrameSource : IFrameSource
{
    private readonly ILogger<JsonlReplayFrameSource> _log;
    private readonly string _directory;
    private readonly bool _loop;

    private ReplayFrame[] _frames = [];
    private int _index;
    private bool _exhausted;

    public JsonlReplayFrameSource(ReplaySourceOptions options, ILogger<JsonlReplayFrameSource> log)
    {
        _log = log;
        _directory = options.Directory ?? DefaultDirectory();
        _loop = options.Loop;
        Mode = WireNames.ParseOperatingMode(options.Mode);

        // FRAME.OP_MODE decides how a row is badged for the rest of its life. Writing simulator
        // output as LIVE would plant fabricated "measurements" in the plant's own history.
        if (Mode == OperatingMode.Live)
        {
            throw new InvalidOperationException(
                "Replay:Mode 'LIVE' is refused. The replay is simulator output and must not be " +
                "recorded as plant data. Use SIMULATION.");
        }

        SourceId = $"replay:{Path.GetFileName(_directory)}";
    }

    public string SourceId { get; private set; }

    public OperatingMode Mode { get; }

    public int FrameCount => _frames.Length;

    /// <summary>How far through the replay we are, 0..1. Shown on the feed-status panel.</summary>
    public double Position => _frames.Length == 0 ? 0d : (double)_index / _frames.Length;

    public Task StartAsync(CancellationToken ct)
    {
        var replayPath = Path.Combine(_directory, "crm04-replay.jsonl");
        var manifestPath = Path.Combine(_directory, "manifest.json");

        if (!File.Exists(replayPath))
        {
            throw new FileNotFoundException(
                $"Replay dataset not found at {replayPath}. Generate it from the repository root:\n" +
                "  npx tsx scripts/exportSimFrames.ts --minutes 30",
                replayPath);
        }

        if (File.Exists(manifestPath))
        {
            var manifest = ReplayManifest.Load(manifestPath);
            var unknown = manifest.UnknownTags(t => TagCatalog.TryGet(t) is not null);

            // A replay built from a different revision of tagDefinitions.ts would carry tags with
            // no row in TAG_DEF. The writer would have to skip them and the twin would show a
            // quietly incomplete mill, so refuse to start and say why.
            if (unknown.Count > 0)
            {
                throw new InvalidOperationException(
                    $"Replay carries {unknown.Count} tag(s) the catalogue does not declare " +
                    $"({string.Join(", ", unknown.Take(5))}). Regenerate both from the same source:\n" +
                    "  npx tsx scripts/exportTagCatalog.ts\n" +
                    "  npx tsx scripts/exportSimFrames.ts");
            }
        }

        _frames = ReplayFile.Read(replayPath).ToArray();
        if (_frames.Length == 0) throw new InvalidOperationException($"{replayPath} contained no frames.");

        SourceId = $"replay:{Path.GetFileName(replayPath)}";

        _log.LogInformation(
            "Replay loaded: {Frames} frames ({Minutes:F1} min), {Tags} tags per frame, mode {Mode}, loop={Loop}.",
            _frames.Length,
            _frames.Length * 100 / 60000d,
            _frames[0].Values.Count,
            Mode.ToWire(),
            _loop);

        return Task.CompletedTask;
    }

    public ValueTask<FeedFrame?> NextFrameAsync(CancellationToken ct)
    {
        if (_exhausted || _frames.Length == 0) return ValueTask.FromResult<FeedFrame?>(null);

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

        return ValueTask.FromResult<FeedFrame?>(new FeedFrame(
            Values: frame.Values,
            SolverIterations: frame.SolverIterations,
            GaugemeterResidualUm: frame.GaugemeterResidualUm));
    }

    public ValueTask DisposeAsync()
    {
        _frames = [];
        return ValueTask.CompletedTask;
    }

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
