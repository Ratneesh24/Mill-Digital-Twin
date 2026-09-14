using Crm04.Domain.Configuration;
using Crm04.Domain.Types;

namespace Crm04.Domain.Projection;

/// <param name="Mode">Operating mode, which decides how every tag is badged.</param>
/// <param name="Communication">Feed health, owned by the caller (the frame watcher).</param>
/// <param name="Diagnostics">
/// Values the projection cannot derive from tags. In the .NET topology the solver diagnostics
/// come from whatever produced the frame, so they arrive here as context rather than as tags.
/// </param>
public readonly record struct AdapterContext(
    OperatingMode Mode,
    CommState Communication,
    DiagnosticsState Diagnostics);

/// <summary>
/// TAG FRAME -&gt; MACHINE STATE PROJECTION. Port of <c>src/communication/dataAdapter.ts</c>.
///
/// §4 non-negotiable: "the twin and the UI must never hold independent copies of a process
/// value. There is exactly ONE authoritative MachineState object."
///
/// THIS IS THE ONLY PLACE MachineState IS CONSTRUCTED. <see cref="MachineState"/>'s constructor
/// is internal to this assembly, and this is the only type in the assembly that calls it. Every
/// field below is read from a Tag - nothing here recomputes physics, and nothing here invents a
/// fallback number. Where a tag is absent the field becomes null and the UI renders NO TAG (§7.4).
///
/// Read this class as the audit trail for §18: every row of the Digital Twin Audit Table maps to
/// exactly one assignment below.
/// </summary>
public static class MachineStateProjector
{
    // -----------------------------------------------------------------------------------
    // Typed readers. Every one returns null rather than a substitute value.
    // -----------------------------------------------------------------------------------

    /// <summary>A numeric read that is allowed to be unknown.</summary>
    private static double? Num(TagFrame tags, string tagName) => tags.Numeric(tagName);

    /// <summary>
    /// Numeric read for a field the state type REQUIRES to be a number. Used only where the tag
    /// is guaranteed present on every supported feed; the fallback exists to satisfy the type,
    /// never to fabricate a reading - a missing tag here would already have been caught by the
    /// tag inventory.
    /// </summary>
    private static double NumOr(TagFrame tags, string tagName, double fallback) =>
        tags.Numeric(tagName) ?? fallback;

    private static string? Str(TagFrame tags, string tagName) => tags.TryGet(tagName)?.Value.AsCoercedString;

    private static bool? Bool(TagFrame tags, string tagName) => tags.TryGet(tagName)?.Value.AsCoercedBoolean;

    private static Health ProjectHealth(TagFrame tags, string tagName)
    {
        var raw = Str(tags, tagName);
        if (raw is null) return Health.NoTag;
        return raw switch
        {
            "HEALTHY" => Health.Healthy,
            "WARNING" => Health.Warning,
            "FAULT" => Health.Fault,
            "OFF" => Health.Off,
            _ => Health.Unknown,
        };
    }

    private static CtrlState Ctrl(TagFrame tags, string tagName)
    {
        var raw = Str(tags, tagName);
        if (raw is null) return CtrlState.NoTag;
        return raw switch
        {
            "ON" => CtrlState.On,
            "OFF" => CtrlState.Off,
            "FAULT" => CtrlState.Fault,
            _ => CtrlState.Unknown,
        };
    }

    /// <summary>
    /// Subtraction that propagates unavailability instead of turning it into 0. This one helper
    /// is why a missing roll-gap reference shows as "—" rather than as a deviation of zero.
    /// </summary>
    private static double? Diff(double? a, double? b, double scale = 1d) =>
        a is null || b is null ? null : (a.Value - b.Value) * scale;

    /// <summary>
    /// Specific tension (stress) from tension force, N/mm²: σ = T / (h · w).
    ///
    /// Reproduced from <c>src/simulation/rollingModel.ts:181</c> rather than referenced, because
    /// it is a unit conversion of a value the projection already holds, not a physics model - it
    /// presents the same tension against the strip section and is not a second source (§18).
    /// </summary>
    private static double SpecificTension(double tensionKn, double thicknessMm, double widthMm)
    {
        var area = thicknessMm * widthMm;
        if (area <= 0d) return 0d;
        return tensionKn * 1000d / area;
    }

    // -----------------------------------------------------------------------------------
    // Sub-projections
    // -----------------------------------------------------------------------------------

    private static ReelState ProjectReel(TagFrame tags, ReelId reel)
    {
        var prefix = reel.ToWire();

        // The role is DERIVED from the feed, never from which physical reel this is. On a
        // reversal the roles swap while the reels stay where they are bolted (§1). Anything
        // unrecognised falls to IDLE - claiming a reel is paying off when we do not know is
        // worse than admitting we do not know.
        var role = WireNames.TryParseReelRole(Str(tags, $"{prefix}.ROLE"), out var parsedRole)
            ? parsedRole
            : ReelRole.Idle;

        var brake = WireNames.TryParseBrakeState(Str(tags, $"{prefix}.BRAKE"), out var parsedBrake)
            ? parsedBrake
            : (BrakeState?)null;

        var status = Str(tags, $"{prefix}.STATUS") switch
        {
            "RUNNING" => ReelStatus.Running,
            "STOPPED" => ReelStatus.Stopped,
            "FAULT" => ReelStatus.Fault,
            _ => ReelStatus.Unknown,
        };

        // The pay-off reel has no tension reference of its own; the tension reels take theirs
        // from whichever end of the pass they are currently serving.
        var tensionReference = reel == ReelId.Por
            ? 0d
            : role == ReelRole.Payoff
                ? NumOr(tags, "TENSION.ENTRY.REF", 0d)
                : NumOr(tags, "TENSION.EXIT.REF", 0d);

        return new ReelState(
            Id: reel,
            Role: role,
            Tension: NumOr(tags, $"{prefix}.TENSION", 0d),
            TensionReference: tensionReference,
            // Falling back to the mandrel diameter, not zero: an empty mandrel is the physically
            // correct "no coil" reading, and a zero-diameter reel would divide by zero downstream.
            Diameter: NumOr(tags, $"{prefix}.DIAMETER", MillConfig.Default.Geometry.MandrelDiameter),
            Length: NumOr(tags, $"{prefix}.LENGTH", 0d),
            Torque: NumOr(tags, $"{prefix}.TORQUE", 0d),
            Current: NumOr(tags, $"{prefix}.CURRENT", 0d),
            Thickness: Num(tags, $"{prefix}.THICKNESS"),
            Rpm: NumOr(tags, $"{prefix}.RPM", 0d),
            Layers: Num(tags, $"{prefix}.LAYERS"),
            Brake: brake,
            Status: status);
    }

    private static RollState ProjectRoll(
        TagFrame tags,
        string rpmTag,
        string? bendingTag,
        string actualDiameterTag,
        double nominalDiameter,
        double surfaceSpeed) =>
        new(
            // Geometry for the scene and for the rpm model comes from config, so the twin renders
            // correctly on a feed with no roll-shop data.
            Diameter: nominalDiameter,
            ActualDiameter: Num(tags, actualDiameterTag),
            BarrelLength: MillConfig.Default.Geometry.BarrelLength,
            Rpm: NumOr(tags, rpmTag, 0d),
            // Backup rolls have no bending tag at all, so they pass null for the tag name. Work
            // rolls have one that may itself be absent. Both end as null, and the twin must NOT
            // animate a fake bend either way (§7.4).
            BendingForce: bendingTag is null ? null : Num(tags, bendingTag),
            // Roll wear / accumulated rolled length is a Phase 4 item - no tag, no model.
            RolledLength: null,
            SurfaceSpeed: surfaceSpeed);

    private static GaugeState ProjectGauge(
        TagFrame tags,
        string thicknessTag,
        string readyTag,
        double? referenceThickness)
    {
        var thickness = Num(tags, thicknessTag);
        return new GaugeState(
            Thickness: thickness,
            Deviation: Diff(thickness, referenceThickness, 1000d),
            Ready: Bool(tags, readyTag),
            // No "measuring head in line" tag exists on either feed; the head position is only
            // known when the gauge itself reports ready.
            InLine: Bool(tags, readyTag));
    }

    // -----------------------------------------------------------------------------------
    // The projection
    // -----------------------------------------------------------------------------------

    public static MachineState Project(TagFrame tags, AdapterContext ctx)
    {
        var geometry = MillConfig.Default.Geometry;
        var ratings = MillConfig.Default.Ratings;

        var width = NumOr(tags, "STRIP.WIDTH", ratings.MaxStripWidth);

        var rollingDirection = Str(tags, "MILL.DIRECTION") == "REVERSE"
            ? RollingDirection.Reverse
            : RollingDirection.Forward;

        // The TypeScript reads `str(tags,'MILL.STATUS') ?? 'IDLE'` and casts, so an unrecognised
        // status string would flow through untyped. C# cannot carry an arbitrary string in the
        // enum, so an unparseable status also becomes IDLE. This is the one place the port is not
        // literal, and it is the safe direction: an IDLE mill is inert, whereas propagating a
        // status nothing downstream recognises would leave the interlock panel and the twin
        // disagreeing about what the machine is doing.
        var machineStatus = WireNames.TryParseMachineStatus(Str(tags, "MILL.STATUS"), out var parsedStatus)
            ? parsedStatus
            : MachineStatus.Idle;

        var speedActual = NumOr(tags, "MILL.SPEED.ACTUAL", 0d);
        var surfaceSpeed = speedActual;

        var thicknessActual = NumOr(tags, "STRIP.THICKNESS", 0d);
        var thicknessReference = NumOr(tags, "STRIP.THICKNESS.REF", 0d);
        var thicknessEntry = NumOr(tags, "STRIP.THICKNESS.ENTRY", 0d);

        var gapReference = Num(tags, "ROLL.GAP.REF");
        var gapActual = NumOr(tags, "ROLL.GAP.ACTUAL", 0d);

        var forceActual = NumOr(tags, "ROLL.FORCE.ACTUAL", 0d);

        var entryTension = NumOr(tags, "TENSION.ENTRY", 0d);
        var exitTension = NumOr(tags, "TENSION.EXIT", 0d);

        var driveTorque = NumOr(tags, "DRIVE.TORQUE", 0d);

        var wrDiameter = geometry.WorkRollDiameter;
        var burDiameter = geometry.BackupRollDiameter;

        return new MachineState(
            machineStatus: machineStatus,
            statusReason: Str(tags, "MILL.STATUS.REASON") ?? string.Empty,
            rollingDirection: rollingDirection,
            operatingMode: ctx.Mode,

            speed: new SpeedState(
                Reference: NumOr(tags, "MILL.SPEED.REF", 0d),
                Actual: speedActual),

            rollGap: new RollGapState(
                Reference: gapReference,
                Actual: gapActual,
                // Loaded gap vs commanded position, µm. Null-safe: on a feed with no position tag
                // this is genuinely unknowable, not zero.
                Deviation: Diff(gapActual, gapReference, 1000d),
                Os: Num(tags, "ROLL.GAP.OS"),
                Ds: Num(tags, "ROLL.GAP.DS"),
                Tilt: Num(tags, "ROLL.GAP.TILT")),

            rollingForce: new RollingForceState(
                Actual: forceActual,
                Reference: NumOr(tags, "ROLL.FORCE.REF", 0d),
                Percentage: forceActual / ratings.MaxRollingForce * 100d,
                Os: Num(tags, "ROLL.FORCE.OS"),
                Ds: Num(tags, "ROLL.FORCE.DS"),
                DifferentialRef: Num(tags, "ROLL.FORCE.DIFF_REF")),

            tension: new TensionState(
                Entry: entryTension,
                Exit: exitTension,
                EntryReference: NumOr(tags, "TENSION.ENTRY.REF", 0d),
                ExitReference: NumOr(tags, "TENSION.EXIT.REF", 0d),
                // Specific tension is a presentation of the same tension value against the strip
                // section - a unit conversion, not a second source (§18).
                EntrySpecific: SpecificTension(entryTension, thicknessEntry, width),
                ExitSpecific: SpecificTension(exitTension, thicknessActual, width),
                Dtr: ProjectReel(tags, ReelId.Dtr),
                Etr: ProjectReel(tags, ReelId.Etr),
                Por: ProjectReel(tags, ReelId.Por)),

            thickness: new ThicknessState(
                Entry: thicknessEntry,
                Reference: thicknessReference,
                Actual: thicknessActual,
                Deviation: NumOr(tags, "STRIP.THICKNESS.DEVIATION", 0d),
                Target: NumOr(tags, "STRIP.THICKNESS.REF", 0d),
                Reduction: NumOr(tags, "STRIP.REDUCTION", 0d)),

            rolls: new RollsState(
                UpperWork: ProjectRoll(tags, "WR.TOP.RPM", "WR.TOP.BENDING", "WR.TOP.DIAMETER", wrDiameter, surfaceSpeed),
                LowerWork: ProjectRoll(tags, "WR.BOTTOM.RPM", "WR.BOTTOM.BENDING", "WR.BOTTOM.DIAMETER", wrDiameter, surfaceSpeed),
                UpperBackup: ProjectRoll(tags, "BUR.TOP.RPM", null, "BUR.TOP.DIAMETER", burDiameter, surfaceSpeed),
                LowerBackup: ProjectRoll(tags, "BUR.BOTTOM.RPM", null, "BUR.BOTTOM.DIAMETER", burDiameter, surfaceSpeed)),

            coil: new CoilState(
                // "NO TAG" is the literal the TypeScript uses here. It reaches the UI as text
                // rather than as an id, which is the honest rendering when the feed carries no
                // coil identity.
                Id: Str(tags, "COIL.ID") ?? "NO TAG",
                Width: width,
                EntryThickness: NumOr(tags, "STRIP.THICKNESS.ENTRY", 0d),
                CurrentThickness: thicknessActual,
                FinalThickness: NumOr(tags, "STRIP.THICKNESS.REF", 0d),
                Length: NumOr(tags, "COIL.LENGTH", 0d),
                RemainingLength: NumOr(tags, "COIL.REMAINING_LENGTH", 0d),
                Diameter: NumOr(tags, "COIL.DIAMETER", geometry.MandrelDiameter),
                Grade: Str(tags, "COIL.GRADE")),

            pass: new PassState(
                Current: (int)NumOr(tags, "PASS.NUMBER", 1d),
                Total: (int)NumOr(tags, "PASS.TOTAL", 1d),
                InputThickness: thicknessEntry,
                TargetThickness: thicknessReference,
                Reduction: NumOr(tags, "STRIP.REDUCTION", 0d),
                Progress: NumOr(tags, "PASS.PROGRESS", 0d) / 100d),

            drive: new DriveState(
                Torque: driveTorque,
                Current: NumOr(tags, "DRIVE.CURRENT", 0d),
                Power: NumOr(tags, "DRIVE.POWER", 0d),
                Rpm: NumOr(tags, "DRIVE.RPM", 0d),
                TorquePercentage: driveTorque / ratings.MainDriveRatedTorque * 100d),

            hydraulics: new HydraulicsState(
                LoadingPressure: Num(tags, "HYD.LOADING.PRESSURE"),
                BendingPressure: Num(tags, "HYD.BENDING.PRESSURE"),
                GapPosition: Num(tags, "HYD.GAP.POSITION"),
                LpPressure: Num(tags, "LP.PRESSURE")),

            auxiliarySystems: new AuxiliarySystemsState(
                Lubrication: ProjectHealth(tags, "LUBRICATION.STATUS"),
                Coolant: ProjectHealth(tags, "COOLANT.STATUS"),
                Exhaust: ProjectHealth(tags, "EXHAUST.STATUS"),
                LpSystem: ProjectHealth(tags, "LP.STATUS"),
                HpLoading: ProjectHealth(tags, "HP.LOADING.STATUS"),
                HpBending: ProjectHealth(tags, "HP.BENDING.STATUS")),

            gauges: new GaugesState(
                // The DTR-side gauge measures the delivered strip only when DTR is the exit side;
                // otherwise it is the entry gauge and has no exit reference, so its deviation is
                // null rather than a comparison against the wrong target.
                Dtr: ProjectGauge(
                    tags,
                    "GAUGE.DTR.THICKNESS",
                    "GAUGE.DTR.READY",
                    rollingDirection == RollingDirection.Reverse ? thicknessReference : null),
                Etr: ProjectGauge(
                    tags,
                    "GAUGE.ETR.THICKNESS",
                    "GAUGE.ETR.READY",
                    rollingDirection == RollingDirection.Forward ? thicknessReference : null)),

            interlocks: new InterlockFlags(
                Mill: Bool(tags, "MILL.INTERLOCK"),
                Drive: Bool(tags, "DRIVE.READY"),
                Gauge: Bool(tags, "GAUGE.READY"),
                Hydraulic: Bool(tags, "HYDRAULIC.READY"),
                Tension: Bool(tags, "TENSION.READY"),
                EmergencyStop: Bool(tags, "EMERGENCY.STOP")),

            controls: new ControlsState(
                Agc: Ctrl(tags, "AGC.STATUS"),
                Thfb: Ctrl(tags, "THFB.STATUS"),
                Thff: Ctrl(tags, "THFF.STATUS"),
                Spff: Ctrl(tags, "SPFF.STATUS"),
                Mfc: Ctrl(tags, "MFC.STATUS"),
                Trf: Ctrl(tags, "TRF.STATUS"),
                PositionMode: Ctrl(tags, "POSITION.MODE.STATUS"),
                RollGapClosed: Ctrl(tags, "ROLLGAP.CLOSED.STATUS"),
                Bending: Ctrl(tags, "BENDING.STATUS")),

            diagnostics: new DiagnosticsState(
                MassFlowErrorPct: NumOr(tags, "MILL.MASSFLOW.ERROR", 0d),
                GaugemeterResidualUm: ctx.Diagnostics.GaugemeterResidualUm,
                SolverIterations: ctx.Diagnostics.SolverIterations),

            communication: ctx.Communication);
    }

    /// <summary>
    /// MachineState used before the first frame arrives, and after a source is disconnected.
    /// Everything reads zero / NO TAG and the status is IDLE - the twin must not show a plausible
    /// mill until a frame actually lands.
    ///
    /// Built by projecting an EMPTY frame rather than by writing out the defaults, so it cannot
    /// drift from the projection: whatever <see cref="Project"/> does with a missing tag is by
    /// definition what the empty state contains.
    /// </summary>
    public static MachineState Empty(OperatingMode mode) =>
        Project(
            TagFrame.Empty(mode),
            new AdapterContext(
                Mode: mode,
                Communication: new CommState(
                    Connected: false,
                    SourceName: "No source",
                    LastFrameTimestamp: 0L,
                    LastValidTimestamp: 0L,
                    AgeMs: 0d,
                    Stale: true,
                    UpdateRateHz: 0d,
                    FramesReceived: 0L),
                Diagnostics: DiagnosticsState.Empty));
}
