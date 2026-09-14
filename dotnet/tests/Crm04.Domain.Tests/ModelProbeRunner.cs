using Crm04.Domain.Machine;
using Crm04.Domain.Simulation;
using Crm04.Domain.Types;

namespace Crm04.Domain.Tests;

/// <summary>
/// Runs one probe row through the C# port and returns the result under the TYPESCRIPT field
/// names, ready to be compared against the captured TypeScript output.
///
/// The field mapping below is written out by hand on purpose. Reflecting over the C# records
/// would rename <c>forceKN</c> to <c>ForceKn</c> by convention and could silently drop a renamed
/// field; spelling it out makes every field an explicit, reviewable line - and <c>forceKN</c> is
/// exactly the case where the two naming conventions disagree.
///
/// This lives apart from the test class so that both the per-suite assertions
/// (<see cref="ModelParityTests"/>) and the divergence characterisation
/// (<see cref="ModelDivergenceTests"/>) drive the same code rather than two copies that can drift.
/// </summary>
public static class ModelProbeRunner
{
    /// <summary>Every suite the fixture can contain, and how to evaluate it in C#.</summary>
    public static readonly IReadOnlyDictionary<string, Func<ModelProbe, object?>> Functions =
        new Dictionary<string, Func<ModelProbe, object?>>(StringComparer.Ordinal)
        {
            // ------------------------------------------------------------------ rollingModel
            ["CalculateReduction"] = p =>
                RollingModel.CalculateReduction(p.D("inputThickness"), p.D("outputThickness")),

            ["OutputThicknessFromReduction"] = p =>
                RollingModel.OutputThicknessFromReduction(p.D("inputThickness"), p.D("reductionPct")),

            ["CalculateTrueStrain"] = p =>
                RollingModel.CalculateTrueStrain(p.D("inputThickness"), p.D("outputThickness")),

            ["CalculateMeanFlowStress"] = p =>
                RollingModel.CalculateMeanFlowStress(
                    p.D("inputThickness"), p.D("outputThickness"), p.D("accumulatedStrain")),

            ["CalculateFlattenedRadius"] = p =>
                RollingModel.CalculateFlattenedRadius(
                    p.D("nominalRadiusMm"), p.D("forcePerWidthNPerMm"), p.D("draftMm")),

            ["CalculateContactLength"] = p =>
                RollingModel.CalculateContactLength(p.D("flattenedRadiusMm"), p.D("draftMm")),

            ["RollSurfaceSpeedFromStripSpeed"] = p =>
                RollingModel.RollSurfaceSpeedFromStripSpeed(p.D("stripExitSpeedMpm")),

            ["CalculateRollRpm"] = p =>
                RollingModel.CalculateRollRpm(p.D("surfaceSpeedMpm"), p.D("rollDiameterMm")),

            ["EntrySpeedFromMassFlow"] = p =>
                RollingModel.EntrySpeedFromMassFlow(
                    p.D("exitSpeedMpm"), p.D("inputThickness"), p.D("outputThickness")),

            ["MassFlowError"] = p =>
                RollingModel.MassFlowError(
                    p.D("inputThickness"), p.D("entrySpeedMpm"),
                    p.D("outputThickness"), p.D("exitSpeedMpm")),

            ["SpecificTension"] = p =>
                RollingModel.SpecificTension(p.D("tensionKn"), p.D("thicknessMm"), p.D("widthMm")),

            ["TensionForceFromSpecific"] = p =>
                RollingModel.TensionForceFromSpecific(
                    p.D("specificTensionNPerMm2"), p.D("thicknessMm"), p.D("widthMm")),

            // --------------------------------------------------------------------- coilModel
            ["CoilRadiusFromLength"] = p =>
                CoilModel.CoilRadiusFromLength(
                    p.D("mandrelRadiusMm"), p.D("stripThicknessMm"), p.D("woundLengthM")),

            ["CoilLengthFromRadius"] = p =>
                CoilModel.CoilLengthFromRadius(
                    p.D("mandrelRadiusMm"), p.D("stripThicknessMm"), p.D("outerRadiusMm")),

            ["CoilLayers"] = p =>
                CoilModel.CoilLayers(
                    p.D("mandrelRadiusMm"), p.D("stripThicknessMm"), p.D("outerRadiusMm")),

            ["ReelRpm"] = p => CoilModel.ReelRpm(p.D("lineSpeedMpm"), p.D("coilRadiusMm")),

            ["ReelTorque"] = p => CoilModel.ReelTorque(p.D("tensionKn"), p.D("coilRadiusMm")),

            ["ReelCurrent"] = p =>
                CoilModel.ReelCurrent(p.D("torqueKNm"), p.D("ratedTorqueKNm"), p.D("ratedCurrentA")),

            ["CoilMass"] = p =>
                CoilModel.CoilMass(p.D("mandrelRadiusMm"), p.D("outerRadiusMm"), p.D("widthMm")),

            ["LengthAfterReduction"] = p =>
                CoilModel.LengthAfterReduction(
                    p.D("lengthM"), p.D("inputThickness"), p.D("outputThickness")),

            // ------------------------------------------------------------------ tensionModel
            ["CalculateTensionReferences"] = p =>
            {
                var r = TensionModel.CalculateTensionReferences(
                    p.D("entrySpecificTension"), p.D("exitSpecificTension"),
                    p.D("inputThickness"), p.D("outputThickness"), p.D("width"));

                return new Dictionary<string, object?>
                {
                    ["entryKN"] = r.EntryKn,
                    ["exitKN"] = r.ExitKn,
                    ["entrySpecific"] = r.EntrySpecific,
                    ["exitSpecific"] = r.ExitSpecific,
                };
            },

            ["StepTension"] = p =>
                TensionModel.StepTension(p.D("current"), p.D("reference"), p.D("dt")),

            ["TensionReferenceForState"] = p =>
                TensionModel.TensionReferenceForState(
                    p.D("fullReferenceKn"), p.D("speedMpm"), p.B("threaded")),

            // -------------------------------------------------------------------- forceModel
            ["CalculateRollingForce"] = p => Describe(ForceOf(p)),

            ["EstimateForceFromTorque"] = p =>
                ForceModel.EstimateForceFromTorque(p.D("rollTorqueKNm"), p.D("contactLengthMm")),

            // -------------------------------------------------------------------- driveModel
            ["CalculateDrive"] = p =>
            {
                var r = DriveModel.CalculateDrive(new DriveInput(
                    ForceTonnes: p.D("forceTonnes"),
                    ContactLengthMm: p.D("contactLengthMm"),
                    RollRpm: p.D("rollRPM"),
                    WorkRollDiameter: p.D("workRollDiameter"),
                    EntryTensionKn: p.D("entryTensionKN"),
                    ExitTensionKn: p.D("exitTensionKN"),
                    Rolling: p.B("rolling")));

                return new Dictionary<string, object?>
                {
                    ["torque"] = r.Torque,
                    ["rollTorque"] = r.RollTorque,
                    ["tensionTorque"] = r.TensionTorque,
                    ["power"] = r.Power,
                    ["current"] = r.Current,
                    ["rpm"] = r.Rpm,
                    ["torquePercentage"] = r.TorquePercentage,
                };
            },

            ["HydraulicPressureFromForce"] = p =>
                DriveModel.HydraulicPressureFromForce(p.D("forceTonnes")),

            // ---------------------------------------------------------------- thicknessModel
            ["SolveGaugemeter"] = p =>
            {
                var r = ThicknessModel.SolveGaugemeter(new GaugemeterSolveInput(
                    GapPosition: p.D("gapPosition"),
                    InputThickness: p.D("inputThickness"),
                    Width: p.D("width"),
                    WorkRollDiameter: p.D("workRollDiameter"),
                    EntryTension: p.D("entryTension"),
                    ExitTension: p.D("exitTension"),
                    AccumulatedStrain: p.D("accumulatedStrain"),
                    FlowStressScale: p.DN("flowStressScale")));

                return new Dictionary<string, object?>
                {
                    ["outputThickness"] = r.OutputThickness,
                    ["force"] = Describe(r.Force),
                    ["millStretch"] = r.MillStretch,
                    // Compared as a value, never a tolerance. The loop exits on a tolerance, so an
                    // iteration count that differs by one means the two solvers took different
                    // paths - and every number after that point agrees by coincidence rather than
                    // by construction. This field is the canary that tells drift from breakage.
                    ["iterations"] = r.Iterations,
                    ["residualUm"] = r.ResidualUm,
                    ["noBite"] = r.NoBite,
                };
            },

            ["InverseGaugemeter"] = p =>
                ThicknessModel.InverseGaugemeter(p.D("deliveredThicknessMm"), p.D("forceTonnes")),

            ["GapPositionForTargetThickness"] = p =>
                ThicknessModel.GapPositionForTargetThickness(
                    p.D("targetThickness"), p.D("inputThickness"), p.D("width"),
                    p.D("workRollDiameter"), p.D("entryTension"), p.D("exitTension"),
                    p.D("accumulatedStrain")),

            ["HagcStep"] = p =>
            {
                var r = ThicknessModel.HagcStep(
                    new HagcState(p.D("integral")),
                    p.D("gapPosition"),
                    p.D("measuredThickness"),
                    p.D("referenceThickness"),
                    p.D("dt"),
                    p.B("enabled"));

                return new Dictionary<string, object?>
                {
                    ["gapPosition"] = r.GapPosition,
                    ["state"] = new Dictionary<string, object?> { ["integral"] = r.State.Integral },
                };
            },

            // ----------------------------------------------------------- simulationScenarios
            ["ApplyScenario"] = p =>
            {
                // The fixture includes one deliberately invalid id, to exercise the TypeScript's
                // `default` arm. C#'s enum cannot hold that value, so the equivalent is an
                // out-of-range cast, which reaches the same `_ => Base` arm. Asserting it proves
                // the default is a real fallback rather than an unreachable line.
                var id = WireNames.TryParseScenarioId(p.S("id"), out var parsed)
                    ? parsed
                    : (ScenarioId)(-1);

                var m = SimulationScenarios.Apply(id);

                return new Dictionary<string, object?>
                {
                    ["flowStressScale"] = m.FlowStressScale,
                    ["gapOffsetMm"] = m.GapOffsetMm,
                    ["forceScale"] = m.ForceScale,
                    ["agcEnabled"] = m.AgcEnabled,
                    ["gaugeReady"] = m.GaugeReady,
                    ["hydraulicPressureFactor"] = m.HydraulicPressureFactor,
                    ["bendingForceKN"] = m.BendingForceKn,
                    ["bendingPressureBar"] = m.BendingPressureBar,
                };
            },
            // ------------------------------------------------------ machineStateMachine
            ["Transition"] = p =>
            {
                var r = MachineTransitions.Transition(
                    WireNames.ParseMachineStatus(p.S("current")),
                    ParseEvent(p.S("event")),
                    new TransitionContext(
                        MillReady: p.B("millReady"),
                        InterlockReason: p.SN("interlockReason"),
                        Speed: p.D("speed"),
                        Threaded: p.B("threaded"),
                        ScheduleComplete: p.B("scheduleComplete")));

                return Describe(r);
            },

            ["BeginReversal"] = p =>
                Describe(MachineTransitions.BeginReversal(
                    WireNames.ParseMachineStatus(p.S("current")))),

            // ----------------------------------------------------------- reversingEngine
            ["StepReversal"] = p =>
            {
                var before = new ReversalState(
                    ParsePhase(p.S("phase")),
                    p.D("elapsed"),
                    p.SN("pendingDirection") is { } d ? WireNames.ParseRollingDirection(d) : null);

                return Describe(ReversalSequencer.Step(before, p.D("dt"), p.D("speed")));
            },

            ["ReversalProgress"] = p =>
                ReversalSequencer.Progress(
                    new ReversalState(ParsePhase(p.S("phase")), p.D("elapsed"), null)),

            ["StartReversal"] = p =>
                Describe(ReversalSequencer.Start(
                    WireNames.ParseRollingDirection(p.S("currentDirection")),
                    p.SN("nextDirection") is { } n ? WireNames.ParseRollingDirection(n) : null)),
        };

    public static object? Run(ModelProbe p) =>
        Functions.TryGetValue(p.Suite, out var f)
            ? f(p)
            : throw new InvalidOperationException(
                $"Probe suite '{p.Suite}' is exported by scripts/exportModelProbes.ts but no C# " +
                "evaluator is registered for it in ModelProbeRunner.Functions.");

    /// <summary>
    /// Wire names for the simulation-local event enum.
    ///
    /// Kept here rather than in <c>WireNames</c> on purpose: <c>MachineEventType</c> never crosses
    /// a wire. It is not an Oracle column, not a SignalR payload and not part of the REST surface
    /// - it is internal to the engine, and the only reason a string form exists at all is that the
    /// TypeScript union is one. Putting it beside the domain enums would suggest an external
    /// contract that does not exist.
    /// </summary>
    private static MachineEventType ParseEvent(string s) => s switch
    {
        "ENABLE" => MachineEventType.Enable,
        "START" => MachineEventType.Start,
        "STOP" => MachineEventType.Stop,
        "FAST_STOP" => MachineEventType.FastStop,
        "RESET" => MachineEventType.Reset,
        "REQUEST_ROLL_CHANGE" => MachineEventType.RequestRollChange,
        "THREADED" => MachineEventType.Threaded,
        "AT_SPEED" => MachineEventType.AtSpeed,
        "SPEED_ZERO" => MachineEventType.SpeedZero,
        "PASS_COMPLETE" => MachineEventType.PassComplete,
        "REVERSAL_COMPLETE" => MachineEventType.ReversalComplete,
        "SCHEDULE_COMPLETE" => MachineEventType.ScheduleComplete,
        "INTERLOCK_LOST" => MachineEventType.InterlockLost,
        "INTERLOCK_OK" => MachineEventType.InterlockOk,
        "FAULT" => MachineEventType.Fault,
        _ => throw new FormatException($"'{s}' is not a MachineEventType."),
    };

    private static ReversalPhase ParsePhase(string s) => s switch
    {
        "NONE" => ReversalPhase.None,
        "SETTLE" => ReversalPhase.Settle,
        "FLIP" => ReversalPhase.Flip,
        "REPOSITION" => ReversalPhase.Reposition,
        "COMPLETE" => ReversalPhase.Complete,
        _ => throw new FormatException($"'{s}' is not a ReversalPhase."),
    };

    private static string PhaseWire(ReversalPhase p) => p switch
    {
        ReversalPhase.None => "NONE",
        ReversalPhase.Settle => "SETTLE",
        ReversalPhase.Flip => "FLIP",
        ReversalPhase.Reposition => "REPOSITION",
        ReversalPhase.Complete => "COMPLETE",
        _ => throw new ArgumentOutOfRangeException(nameof(p), p, null),
    };

    private static Dictionary<string, object?> Describe(TransitionResult r) => new()
    {
        ["status"] = r.Status.ToWire(),
        // Compared by ordinal string equality. These sentences reach the operator's screen.
        ["reason"] = r.Reason,
        ["changed"] = r.Changed,
    };

    private static Dictionary<string, object?> Describe(ReversalState s) => new()
    {
        ["phase"] = PhaseWire(s.Phase),
        ["elapsed"] = s.Elapsed,
        ["pendingDirection"] = s.PendingDirection?.ToWire(),
    };

    private static RollingForceResult ForceOf(ModelProbe p) =>
        ForceModel.CalculateRollingForce(new RollingForceInput(
            InputThickness: p.D("inputThickness"),
            OutputThickness: p.D("outputThickness"),
            Width: p.D("width"),
            WorkRollDiameter: p.D("workRollDiameter"),
            EntryTension: p.D("entryTension"),
            ExitTension: p.D("exitTension"),
            AccumulatedStrain: p.D("accumulatedStrain"),
            FlowStressScale: p.DN("flowStressScale")));

    /// <summary>
    /// The force result under its TypeScript field names. Note <c>forceKN</c> - the one name where
    /// the C# casing rule (<c>ForceKn</c>) and the TypeScript spelling diverge.
    /// </summary>
    private static Dictionary<string, object?> Describe(RollingForceResult r) => new()
    {
        ["forceTonnes"] = r.ForceTonnes,
        ["forceKN"] = r.ForceKn,
        ["contactLength"] = r.ContactLength,
        ["flattenedRadius"] = r.FlattenedRadius,
        ["meanFlowStress"] = r.MeanFlowStress,
        ["meanPressure"] = r.MeanPressure,
        ["frictionMultiplier"] = r.FrictionMultiplier,
        ["meanTensionStress"] = r.MeanTensionStress,
    };
}
