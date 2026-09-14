using System.Diagnostics;
using System.Globalization;
using Crm04.Domain.Configuration;
using Crm04.Domain.Machine;
using Crm04.Domain.Projection;
using Crm04.Domain.Replay;
using Crm04.Domain.Tags;
using Crm04.Domain.Types;
using Crm04.Domain.Util;

namespace Crm04.Tools.Replay;

/// <summary>
/// M1 DEMO HARNESS. Drives the whole ported domain pipeline from a replay file and prints the
/// resulting MachineState to the console at 10 Hz.
///
///   ReplayFile -> TagFactory.MakeFrame -> MachineStateProjector.Project
///              -> AlarmEngine.Evaluate / InterlockEngine.Evaluate -> console
///
/// NO DATABASE, NO API, NO UI. That is the point: it makes the domain port demonstrable and
/// debuggable on its own, before Oracle or Blazor exist. Everything it prints has already been
/// proved identical to the TypeScript app by the parity gate, so what you are watching is the
/// React application's own numbers arriving through C#.
///
///   dotnet run --project src/Crm04.Tools.Replay -- [--speed 5] [--frames 600]
/// </summary>
public static class Program
{
    public static int Main(string[] args)
    {
        var file = Arg(args, "file", DefaultReplayPath());
        var speed = double.Parse(Arg(args, "speed", "5"), CultureInfo.InvariantCulture);
        var maxFrames = int.Parse(Arg(args, "frames", "0"), CultureInfo.InvariantCulture);
        var mode = WireNames.ParseOperatingMode(Arg(args, "mode", "SIMULATION"));

        if (!File.Exists(file))
        {
            Console.Error.WriteLine($"""
                Replay file not found: {file}

                Generate it from the TypeScript simulator first, in the repository root:
                  npx tsx scripts/exportSimFrames.ts --minutes 30
                """);
            return 1;
        }

        PrintHeader(file, mode, speed);

        // The comm state the frame watcher will own for real in M3. Built here the same way so
        // the console shows the same staleness and rate behaviour the API will.
        var framesReceived = 0L;
        long lastFrameTimestamp = 0;
        var periodMs = EngineeringConfig.FrameTickMs;

        var stopwatch = Stopwatch.StartNew();
        var frameIndex = 0;
        var alarmsSeen = new Dictionary<string, int>(StringComparer.Ordinal);

        foreach (var replay in ReplayFile.Read(file))
        {
            framesReceived++;

            // Wall-clock stamping, exactly as the Feeder will do it: the file carries relative
            // time only, so a replay played tomorrow still produces fresh frames.
            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var ageMs = lastFrameTimestamp == 0 ? 0d : nowMs - lastFrameTimestamp;
            lastFrameTimestamp = nowMs;

            var comm = new CommState(
                Connected: true,
                SourceName: $"replay:{Path.GetFileName(file)}",
                LastFrameTimestamp: nowMs,
                LastValidTimestamp: nowMs,
                AgeMs: ageMs,
                Stale: ageMs > EngineeringConfig.StaleAfterMs,
                UpdateRateHz: 1000d / periodMs,
                FramesReceived: framesReceived);

            var tags = TagFactory.MakeFrame(replay.Values, nowMs, mode);

            var state = MachineStateProjector.Project(
                tags,
                new AdapterContext(
                    Mode: mode,
                    Communication: comm,
                    Diagnostics: new DiagnosticsState(
                        MassFlowErrorPct: 0d,
                        GaugemeterResidualUm: replay.GaugemeterResidualUm,
                        SolverIterations: replay.SolverIterations)));

            var alarms = AlarmEngine.Evaluate(state);
            var chain = InterlockEngine.Evaluate(InterlockInputs.From(state));

            foreach (var a in alarms)
            {
                alarmsSeen[a.Id] = alarmsSeen.GetValueOrDefault(a.Id) + 1;
            }

            Render(state, alarms, chain, replay, tags.Count);

            frameIndex++;
            if (maxFrames > 0 && frameIndex >= maxFrames) break;

            // Pace the replay. speed=1 is real time; the default 5 makes a 30-minute capture
            // watchable in six.
            var targetMs = frameIndex * periodMs / speed;
            var sleep = targetMs - stopwatch.Elapsed.TotalMilliseconds;
            if (sleep > 1d) Thread.Sleep((int)sleep);
        }

        PrintFooter(frameIndex, stopwatch.Elapsed, alarmsSeen);
        return 0;
    }

    // -----------------------------------------------------------------------------------

    /// <summary>
    /// True when stdout is a real terminal. When it is not - piped to a file, captured by CI,
    /// read by another process - cursor positioning throws and a repainting dashboard would be
    /// meaningless anyway, so the tool prints one line per frame instead.
    /// </summary>
    private static readonly bool Interactive = !Console.IsOutputRedirected;

    private static void Render(
        MachineState s,
        IReadOnlyList<AlarmCondition> alarms,
        InterlockChain chain,
        ReplayFrame replay,
        int tagCount)
    {
        if (!Interactive)
        {
            RenderLine(s, alarms, chain, replay);
            return;
        }

        Console.SetCursorPosition(0, HeaderLines);

        var readout = InterlockEngine.Readout(chain);

        WriteLinePadded($"  FRAME {replay.N,-8} t+{replay.DtMs / 1000.0,8:F1} s      tags {tagCount}      solver {replay.SolverIterations} iter");
        WriteLinePadded("");
        WriteLinePadded($"  STATUS      {MachineStatusRules.Label(s.MachineStatus),-14} {s.RollingDirection.ToWire(),-8}  pass {s.Pass.Current}/{s.Pass.Total}  {s.Pass.Progress * 100,5:F1}%");
        WriteLinePadded($"  INTERLOCK   {readout.Title,-24} {readout.Reason ?? string.Empty}");
        WriteLinePadded("");
        WriteLinePadded($"  SPEED       {Val(s.Speed.Actual, 0),9} m/min   ref {Val(s.Speed.Reference, 0),9}");
        WriteLinePadded($"  FORCE       {Val(s.RollingForce.Actual, 0),9} t       {s.RollingForce.Percentage,5:F1}% of rating   ref {Val(s.RollingForce.Reference, 0),9}");
        WriteLinePadded($"  THICKNESS   {Val(s.Thickness.Actual, 3),9} mm      dev {Val(s.Thickness.Deviation, 1),7} um   entry {Val(s.Thickness.Entry, 3),8} mm");
        WriteLinePadded($"  ROLL GAP    {Val(s.RollGap.Actual, 3),9} mm      ref {NullableVal(s.RollGap.Reference, 3),9}   dev {NullableVal(s.RollGap.Deviation, 1),8} um");
        WriteLinePadded($"  TENSION     entry {Val(s.Tension.Entry, 1),7} kN    exit {Val(s.Tension.Exit, 1),7} kN    ({Val(s.Tension.EntrySpecific, 1)} / {Val(s.Tension.ExitSpecific, 1)} N/mm2)");
        WriteLinePadded($"  DRIVE       {Val(s.Drive.Torque, 1),9} kNm     {Val(s.Drive.Current, 0),7} A     {Val(s.Drive.Power, 0),7} kW    {s.Drive.TorquePercentage,5:F1}%");
        WriteLinePadded("");
        WriteLinePadded($"  DTR  {s.Tension.Dtr.Role.ToWire(),-8} d {Val(s.Tension.Dtr.Diameter, 0),5} mm  L {Val(s.Tension.Dtr.Length, 0),6} m  T {Val(s.Tension.Dtr.Tension, 1),6} kN  {s.Tension.Dtr.Status.ToWire()}");
        WriteLinePadded($"  ETR  {s.Tension.Etr.Role.ToWire(),-8} d {Val(s.Tension.Etr.Diameter, 0),5} mm  L {Val(s.Tension.Etr.Length, 0),6} m  T {Val(s.Tension.Etr.Tension, 1),6} kN  {s.Tension.Etr.Status.ToWire()}");
        WriteLinePadded($"  POR  {s.Tension.Por.Role.ToWire(),-8} d {Val(s.Tension.Por.Diameter, 0),5} mm  L {Val(s.Tension.Por.Length, 0),6} m  layers {NullableVal(s.Tension.Por.Layers, 0)}");
        WriteLinePadded("");

        // NO TAG rendering, which is the whole point of §7.4 - these fields print a dash rather
        // than a plausible zero when the active feed carries no such tag.
        WriteLinePadded($"  HYDRAULICS  load {NullableVal(s.Hydraulics.LoadingPressure, 0),7} bar   bend {NullableVal(s.Hydraulics.BendingPressure, 0),7} bar   pos {NullableVal(s.Hydraulics.GapPosition, 3),8} mm");
        WriteLinePadded($"  WR BENDING  top {NullableVal(s.Rolls.UpperWork.BendingForce, 0),8} kN    bottom {NullableVal(s.Rolls.LowerWork.BendingForce, 0),8} kN");
        WriteLinePadded($"  GAUGES      DTR {NullableVal(s.Gauges.Dtr.Thickness, 3),8} mm    ETR {NullableVal(s.Gauges.Etr.Thickness, 3),8} mm");
        WriteLinePadded("");
        WriteLinePadded($"  ALARMS ({alarms.Count})");

        for (var i = 0; i < 4; i++)
        {
            WriteLinePadded(i < alarms.Count ? $"    [{alarms[i].Severity.ToWire(),-7}] {alarms[i].Message}" : string.Empty);
        }
    }

    /// <summary>
    /// Non-interactive rendering: one line per frame, sampled to once a second so a piped run
    /// stays readable. Deliberately carries the NO TAG dashes too, because the point of watching
    /// this output is to see which fields the active feed cannot supply.
    /// </summary>
    private static void RenderLine(
        MachineState s,
        IReadOnlyList<AlarmCondition> alarms,
        InterlockChain chain,
        ReplayFrame replay)
    {
        if (replay.N % 10 != 0) return;

        var alarmText = alarms.Count == 0 ? string.Empty : $"  ALARM: {alarms[0].Message}";

        Console.WriteLine(
            $"t+{replay.DtMs / 1000.0,7:F1}s  {MachineStatusRules.Label(s.MachineStatus),-13} " +
            $"{s.RollingDirection.ToWire(),-8} p{s.Pass.Current}/{s.Pass.Total} " +
            $"{s.Pass.Progress * 100,5:F1}%  " +
            $"spd {Val(s.Speed.Actual, 0),3} m/min  " +
            $"F {Val(s.RollingForce.Actual, 0),3} t  " +
            $"h {Val(s.Thickness.Actual, 3),5} mm  " +
            $"dev {Val(s.Thickness.Deviation, 1),6} um  " +
            $"gap {NullableVal(s.RollGap.Reference, 3),5}  " +
            $"Te {Val(s.Tension.Entry, 1),5} Tx {Val(s.Tension.Exit, 1),5} kN  " +
            $"hyd {NullableVal(s.Hydraulics.LoadingPressure, 0),3}  " +
            $"bend {NullableVal(s.Rolls.UpperWork.BendingForce, 0),3}  " +
            $"{(chain.MillReady ? "READY" : "HELD")}{alarmText}");
    }

    /// <summary>A required value. Always a number, so it always prints.</summary>
    private static string Val(double v, int decimals) => JsNumber.ToFixed(v, decimals);

    /// <summary>
    /// An optional value. Prints an em dash when null, never a zero - the console is obeying the
    /// same §7.4 rule the UI does, because "no tag" and "zero" are different statements.
    /// </summary>
    private static string NullableVal(double? v, int decimals) =>
        v is null ? "—" : JsNumber.ToFixed(v.Value, decimals);

    private const int HeaderLines = 6;

    /// <summary>
    /// Pad to the terminal width so a shorter line fully overwrites the longer one that was
    /// there on the previous repaint, instead of leaving its tail behind.
    /// </summary>
    private static void WriteLinePadded(string s) => Console.WriteLine(s.PadRight(Math.Max(0, Console.WindowWidth - 1)));

    private static void PrintHeader(string file, OperatingMode mode, double speed)
    {
        if (Interactive)
        {
            Console.Clear();
            Console.CursorVisible = false;
        }

        Console.WriteLine();
        Console.WriteLine("  CRM04 4HI REVERSING MILL — DOMAIN REPLAY (M1)");
        Console.WriteLine($"  {MillConfig.Default.Identity.Plant}");
        Console.WriteLine($"  source {Path.GetFileName(file)}   mode {mode.ToWire()}   speed x{JsNumber.ToJsString(speed)}   catalogue {TagCatalog.Count} tags");
        Console.WriteLine("  ─────────────────────────────────────────────────────────────────────────────");
        Console.WriteLine();
    }

    private static void PrintFooter(int frames, TimeSpan elapsed, Dictionary<string, int> alarmsSeen)
    {
        if (Interactive) Console.CursorVisible = true;
        Console.WriteLine();
        Console.WriteLine($"  {frames} frames in {elapsed.TotalSeconds:F1} s");

        if (alarmsSeen.Count == 0)
        {
            Console.WriteLine("  no alarms raised");
            return;
        }

        Console.WriteLine("  alarms raised:");
        foreach (var (id, count) in alarmsSeen.OrderByDescending(kv => kv.Value))
        {
            Console.WriteLine($"    {id,-24} {count} frame(s)");
        }
    }

    private static string Arg(string[] args, string name, string fallback)
    {
        var i = Array.IndexOf(args, $"--{name}");
        return i >= 0 && i + 1 < args.Length ? args[i + 1] : fallback;
    }

    /// <summary>
    /// Walk up from the binary to the repository's <c>dotnet/</c> folder. Lets the tool be run
    /// with a bare <c>dotnet run</c> from anywhere in the solution.
    /// </summary>
    private static string DefaultReplayPath()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Crm04.sln")))
        {
            dir = dir.Parent;
        }

        return dir is null
            ? Path.Combine("data", "replay", "crm04-replay.jsonl")
            : Path.Combine(dir.FullName, "data", "replay", "crm04-replay.jsonl");
    }
}
