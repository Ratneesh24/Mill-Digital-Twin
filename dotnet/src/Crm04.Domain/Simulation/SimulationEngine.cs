using Crm04.Domain.Coils;
using Crm04.Domain.Configuration;
using Crm04.Domain.Machine;
using Crm04.Domain.Types;

namespace Crm04.Domain.Simulation;

/// <summary>One raw tag frame as the engine emits it, before any badging.</summary>
public sealed class RawFrame : Dictionary<string, TagValue>
{
    public RawFrame() : base(StringComparer.Ordinal)
    {
    }
}

/// <summary>
/// SIMULATION ENGINE - the deterministic mill model. Port of
/// <c>src/simulation/simulationEngine.ts</c>.
///
/// Produces a raw tag frame every tick. It knows nothing about Blazor, nothing about provenance
/// badges and nothing about the 3D scene: it is the "PLC" the rest of the application talks to.
///
/// THE DEPENDENCY CHAIN (§8.6) is honoured by CONSTRUCTION, not by convention. Each tick evaluates
/// in this order, and each step consumes only the outputs of the steps above it:
///
/// <list type="number">
/// <item>interlocks -&gt; mill ready</item>
/// <item>state machine -&gt; status</item>
/// <item>speed ramp -&gt; mill speed</item>
/// <item>tension loops -&gt; entry / exit tension</item>
/// <item>gaugemeter solve -&gt; delivered thickness AND roll force (coupled)</item>
/// <item>kinematics -&gt; entry speed, roll rpm, reel rpm</item>
/// <item>drive -&gt; torque, power, current</item>
/// <item>coil geometry -&gt; diameters, lengths, remaining length</item>
/// <item>pass / reversal -&gt; pass number, direction</item>
/// </list>
///
/// There is no step that invents a value. Nothing is randomised except X-ray gauge noise, which is
/// applied at the instrument only (§19.2).
///
/// TWO RULES FOR ANYONE EDITING <see cref="Tick"/>.
///
/// It is ONE LONG METHOD AND IT STAYS THAT WAY. The numbered sections below are the source's own,
/// including its quirk of numbering two of them 4. Extracting them into private helpers is the one
/// refactor guaranteed to change evaluation order silently, and evaluation order is the contract -
/// later steps read fields that earlier steps have already overwritten.
///
/// The arithmetic is reproduced TOKEN FOR TOKEN, parentheses included. Floating-point addition is
/// not associative, so re-associating an expression changes the last bits, and the last bits of a
/// force feed a solver whose iteration count is a discrete decision. The parity gate is what
/// proves this discipline held.
///
/// SINGLE-THREADED BY CONTRACT. Nothing here locks. Commands are queued and drained at the top of
/// a tick by the caller, never applied from another thread.
/// </summary>
public sealed class SimulationEngine
{
    /// <summary>
    /// Amplitude of the incoming hot-band thickness variation, mm (±).
    ///
    /// This is a REAL disturbance, not decoration: an as-rolled hot band carries longitudinal
    /// gauge variation of roughly ±1% and rejecting it is the entire job of the AGC. Without it
    /// the thickness trend would be pure instrument noise and the AGC would have nothing to do,
    /// which would make the twin misleading about how the mill actually behaves.
    ///
    /// Represented as a fixed multi-harmonic profile in coil position - deterministic, so the
    /// simulation stays reproducible (§19.2). Attenuated each pass because successive passes
    /// progressively iron the variation out.
    /// </summary>
    private const double EntryProfileAmplitudeMm = 0.028;

    private const double EntryProfileAttenuation = 0.55;

    private readonly PassSchedule _schedule;
    private readonly SeededRandom _rng = new();
    private readonly List<MachineEventType> _pendingEvents = [];

    private SimState _state;

    public SimulationEngine(PassSchedule? schedule = null)
    {
        _schedule = schedule ?? PassSchedule.Demo;
        _state = BuildInitialState();
    }

    public MachineStatus Status => _state.Status;

    /// <summary>True while the simulated PLC is deliberately not publishing (§17 test 8).</summary>
    public bool IsPublishing => _state.CommsHealthy;

    /// <summary>Diagnostics the projection copies into MachineState.Diagnostics.</summary>
    public (int SolverIterations, double GaugemeterResidualUm) Diagnostics =>
        (_state.SolverIterations, _state.ResidualUm);

    /// <summary>The RNG state, read only by the parity gate, which asserts it bit-exact per tick.</summary>
    public uint RngState => _rng.State;

    // -------------------------------------------------------------------------
    // Commands. These modify SIMULATED state only (§14.4 - the twin is read-only with respect to
    // the real machine).
    //
    // Each `??` below is the TypeScript's own destructuring default, unwrapped exactly once. Do
    // not "simplify" a nullable away: absent JSON binding to `false` instead of `true` is how
    // SET_AGC ends up switching AGC off.
    // -------------------------------------------------------------------------
    public void Command(SimulationCommand cmd)
    {
        var s = _state;
        switch (cmd.Type)
        {
            case SimulationCommandType.Start:
                _pendingEvents.Add(MachineEventType.Start);
                break;

            case SimulationCommandType.Stop:
                _pendingEvents.Add(MachineEventType.Stop);
                break;

            case SimulationCommandType.FastStop:
                s.FastStopLatched = true;
                _pendingEvents.Add(MachineEventType.FastStop);
                break;

            case SimulationCommandType.Reset:
                s.FastStopLatched = false;
                s.EStop = false;
                _pendingEvents.Add(MachineEventType.Reset);
                break;

            case SimulationCommandType.SetSpeedReference:
                s.SpeedReferenceTrim =
                    (cmd.Value ?? 0) - PassScheduleMath.GetPass(_schedule, s.PassNumber).SpeedReference;
                break;

            case SimulationCommandType.TrimSpeedReference:
                s.SpeedReferenceTrim += cmd.Value ?? 0;
                break;

            case SimulationCommandType.TrimRollGap:
                s.GapTrim += cmd.Value ?? 0;
                break;

            case SimulationCommandType.SetAgc:
                s.AgcEnabled = cmd.Flag ?? true;
                // Dropping the integrator on handover prevents a step when AGC re-arms.
                s.Hagc = new HagcState(0);
                break;

            case SimulationCommandType.TrimEntryTension:
                s.EntryTensionTrim += cmd.Value ?? 0;
                break;

            case SimulationCommandType.TrimExitTension:
                s.ExitTensionTrim += cmd.Value ?? 0;
                break;

            case SimulationCommandType.LoadNextCoil:
                _state = BuildInitialState();
                _state.Threaded = false;
                _state.Status = MachineStatus.Ready;
                _rng.Reset();
                break;

            case SimulationCommandType.SetScenario:
                s.Scenario = cmd.Scenario ?? ScenarioId.Normal;
                if (s.Scenario == ScenarioId.EmergencyStop)
                {
                    s.EStop = true;
                    _pendingEvents.Add(MachineEventType.FastStop);
                }

                // The TypeScript's three-branch if/else-if/else: every scenario other than
                // COMMUNICATION_LOSS restores comms, including NORMAL. Written out rather than
                // folded to a single assignment so it still reads as the original.
                if (s.Scenario == ScenarioId.CommunicationLoss) s.CommsHealthy = false;
                else if (s.Scenario != ScenarioId.Normal) s.CommsHealthy = true;
                else s.CommsHealthy = true;
                break;

            case SimulationCommandType.SetAuxHealth:
                if (cmd.System is { } system) s.AuxHealth[system] = cmd.Flag ?? true;
                break;

            default:
                break;
        }
    }

    // -------------------------------------------------------------------------
    // The tick.
    // -------------------------------------------------------------------------

    /// <summary>
    /// Advance the mill by <paramref name="dtSeconds"/> and emit the resulting frame.
    ///
    /// dt is FIXED by the caller at <c>EngineeringConfig.FrameTickMs / 1000d</c>, never measured
    /// from a wall clock: a simulation paced by the scheduler is not reproducible, and a
    /// reproducible simulation is the whole basis of the parity gate. The clamp below is kept
    /// from the source for fidelity even though a fixed dt can no longer trip it.
    /// </summary>
    public RawFrame Tick(double dtSeconds)
    {
        var s = _state;
        var dt = UnitConversion.Clamp(dtSeconds, 0, 0.25); // guard against tab-restore time jumps
        s.TimeS += dt;

        var coil = _schedule.Coil;
        var mods = SimulationScenarios.Apply(s.Scenario);
        var wrDiameter = MillConfig.Default.Geometry.WorkRollDiameter;
        var mandrelRadius = MillConfig.Default.Geometry.MandrelDiameter / 2;

        // ---- 1. Interlocks --------------------------------------------------
        var hydraulicReady =
            s.AuxHealth[AuxSystem.HpLoading] && s.AuxHealth[AuxSystem.LpSystem] &&
            mods.HydraulicPressureFactor > 0.5;

        var chain = InterlockEngine.Evaluate(new InterlockInputs(
            DriveReady: !s.EStop && s.AuxHealth[AuxSystem.Lubrication],
            HydraulicReady: hydraulicReady,
            TensionReady: !s.EStop,
            GaugeReady: mods.GaugeReady,
            EmergencyStop: s.EStop,
            FastStop: s.FastStopLatched,
            CommunicationHealthy: s.CommsHealthy));

        var ctx = new TransitionContext(
            MillReady: chain.MillReady,
            InterlockReason: chain.BlockingReason,
            Speed: s.Speed,
            Threaded: s.Threaded,
            ScheduleComplete: s.PassNumber >= _schedule.Passes.Count && s.PayoffLength <= 0.5);

        // ---- 2. State machine ------------------------------------------------
        // Queued operator commands first, then the signals this tick produces.
        var queued = _pendingEvents.ToArray();
        _pendingEvents.Clear();
        foreach (var e in queued)
        {
            ApplyTransition(e, ctx);
        }

        // A broken interlock must take the mill out of READY, not just out of ROLLING. Otherwise a
        // mill sitting at READY with a dead gauge keeps displaying "Mill ready - all interlocks
        // healthy", which is exactly the bare-status failure §13.2 forbids.
        if (!chain.MillReady)
        {
            if (s.Status != MachineStatus.Idle && s.Status != MachineStatus.Fault &&
                s.Status != MachineStatus.FastStop)
            {
                ApplyTransition(MachineEventType.InterlockLost, ctx);
            }
            else if (s.Status == MachineStatus.Idle)
            {
                s.StatusReason = chain.BlockingReason ?? s.StatusReason;
            }
        }
        else if (s.Status == MachineStatus.Idle)
        {
            ApplyTransition(MachineEventType.InterlockOk, ctx);
        }

        // ---- 3. Pass change & reversal sequencing ----------------------------
        // Done BEFORE the pass entry is read, so every value emitted this tick belongs to the same
        // pass. Running it at the end instead would publish one frame carrying the new pass number
        // alongside the old pass's thickness reference - an internally inconsistent frame, which
        // is the precise thing §18 exists to catch.
        //
        // Safe to run first: the flip only happens during REVERSING, when the strip is already at
        // a standstill, so it acts on last tick's settled state.
        StepPassAndReversal(dt);

        var pass = PassScheduleMath.GetPass(_schedule, s.PassNumber);

        // ---- 4. Speed ramp ---------------------------------------------------
        var scheduleSpeed = pass.SpeedReference + s.SpeedReferenceTrim;
        var speedReference = UnitConversion.Clamp(scheduleSpeed, 0, EngineeringConfig.SpeedLimits.Max);
        var targetSpeed = TargetSpeedFor(s.Status, speedReference);
        var rate =
            s.Status == MachineStatus.FastStop
                ? EngineeringConfig.FastStopDeceleration
                : targetSpeed < s.Speed
                    ? EngineeringConfig.Deceleration
                    : EngineeringConfig.Acceleration;
        s.Speed = RampTowards(s.Speed, targetSpeed, rate * dt);
        if (s.Speed < 0.05 && targetSpeed <= 0) s.Speed = 0;

        if (s.Speed == 0 && (s.Status == MachineStatus.Decelerating || s.Status == MachineStatus.FastStop))
        {
            ApplyTransition(MachineEventType.SpeedZero, ctx);
        }

        if (s.Status == MachineStatus.Threading &&
            s.Speed >= EngineeringConfig.SpeedLimits.ThreadingSpeed * 0.98)
        {
            s.Threaded = true;
            ApplyTransition(MachineEventType.Threaded, ctx);
        }

        // ---- 4. Tension loops -------------------------------------------------
        // (The source numbers two sections 4. Kept, so the two files still line up.)
        //
        // Entry thickness varies along the coil (hot-band profile) - this is the disturbance the
        // AGC exists to reject.
        var entryThickness = Math.Max(
            0.05,
            s.PassInputThickness + EntryThicknessDeviation(s.PositionM, s.PassNumber));

        var tensionRefs = TensionModel.CalculateTensionReferences(
            pass.EntrySpecificTension,
            pass.ExitSpecificTension,
            entryThickness,
            pass.OutputThickness,
            coil.Width);

        var entryRefFull = UnitConversion.Clamp(
            tensionRefs.EntryKn + s.EntryTensionTrim,
            EngineeringConfig.TensionLimits.EntryMin,
            EngineeringConfig.TensionLimits.EntryMax);

        var exitRefFull = UnitConversion.Clamp(
            tensionRefs.ExitKn + s.ExitTensionTrim,
            EngineeringConfig.TensionLimits.ExitMin,
            EngineeringConfig.TensionLimits.ExitMax);

        var entryTarget = TensionModel.TensionReferenceForState(entryRefFull, s.Speed, s.Threaded);
        var exitTarget = TensionModel.TensionReferenceForState(exitRefFull, s.Speed, s.Threaded);
        s.EntryTension = TensionModel.StepTension(s.EntryTension, entryTarget, dt);
        s.ExitTension = TensionModel.StepTension(s.ExitTension, exitTarget, dt);

        // ---- 5. Gaugemeter solve (thickness AND force, coupled) --------------
        var gapCommand = s.GapPosition + s.GapTrim + mods.GapOffsetMm;
        var rolling = MachineStatusRules.IsRolling(s.Status) && s.Threaded;

        var solve = ThicknessModel.SolveGaugemeter(new GaugemeterSolveInput(
            GapPosition: gapCommand,
            InputThickness: entryThickness,
            Width: coil.Width,
            WorkRollDiameter: wrDiameter,
            EntryTension: s.EntryTension,
            ExitTension: s.ExitTension,
            AccumulatedStrain: PassScheduleMath.AccumulatedStrainBeforePass(_schedule, s.PassNumber),
            FlowStressScale: mods.FlowStressScale));

        // Force only exists while the rolls are actually working the strip. A stopped-but-threaded
        // mill still carries the set-up load through the capsules, so it is held at a fraction
        // rather than dropped to zero.
        var forceScale = rolling ? 1 : s.Threaded ? 0.12 : 0;
        var force = solve.Force.ForceTonnes * forceScale * mods.ForceScale;
        var deliveredThickness = rolling ? solve.OutputThickness : s.DeliveredThickness;

        s.DeliveredThickness = deliveredThickness;
        s.Force = force;
        s.ContactLength = solve.Force.ContactLength;
        s.SolverIterations = solve.Iterations;
        s.ResidualUm = solve.ResidualUm;

        // ---- 5b. HAGC --------------------------------------------------------
        // Fed the model thickness, standing in for the real FILTERED gauge signal. Feeding it the
        // noisy displayed value instead would inject instrument noise straight into the capsule
        // position, which is not what the mill does.
        if (rolling)
        {
            var stepped = ThicknessModel.HagcStep(
                s.Hagc,
                s.GapPosition,
                deliveredThickness,
                pass.OutputThickness,
                dt,
                s.AgcEnabled && mods.AgcEnabled);
            s.GapPosition = stepped.GapPosition;
            s.Hagc = stepped.State;
        }

        // ---- 6. Kinematics ---------------------------------------------------
        var exitSpeed = s.Speed;
        var entrySpeed = RollingModel.EntrySpeedFromMassFlow(exitSpeed, entryThickness, deliveredThickness);
        var rollSurfaceSpeed = RollingModel.RollSurfaceSpeedFromStripSpeed(exitSpeed);
        var wrRpm = RollingModel.CalculateRollRpm(rollSurfaceSpeed, wrDiameter);
        // BUR is driven by contact with the WR: equal surface speed, so rpm scales inversely with
        // diameter.
        var burRpm = RollingModel.CalculateRollRpm(
            rollSurfaceSpeed, MillConfig.Default.Geometry.BackupRollDiameter);

        // ---- 7. Drive --------------------------------------------------------
        var drive = DriveModel.CalculateDrive(new DriveInput(
            ForceTonnes: force,
            ContactLengthMm: solve.Force.ContactLength,
            RollRpm: wrRpm,
            WorkRollDiameter: wrDiameter,
            EntryTensionKn: s.EntryTension,
            ExitTensionKn: s.ExitTension,
            Rolling: rolling));

        // ---- 8. Coil geometry & length bookkeeping ---------------------------
        if (rolling && dt > 0)
        {
            var paidOff = entrySpeed / 60 * dt;
            var wound = exitSpeed / 60 * dt;
            s.PayoffLength = Math.Max(0, s.PayoffLength - paidOff);
            s.WoundLength += wound;
            s.PositionM += paidOff;
        }

        var payoff = ReversingRules.PayoffReel(s.Direction);
        var winder = ReversingRules.TensionReel(s.Direction);

        var payoffRadius = CoilModel.CoilRadiusFromLength(mandrelRadius, entryThickness, s.PayoffLength);
        var winderRadius = CoilModel.CoilRadiusFromLength(mandrelRadius, deliveredThickness, s.WoundLength);
        var porRadius = CoilModel.CoilRadiusFromLength(mandrelRadius, s.PorThickness, s.PorLength);

        var payoffRpm = CoilModel.ReelRpm(entrySpeed, payoffRadius);
        var winderRpm = CoilModel.ReelRpm(exitSpeed, winderRadius);

        var payoffTorque = CoilModel.ReelTorque(s.EntryTension, payoffRadius);
        var winderTorque = CoilModel.ReelTorque(s.ExitTension, winderRadius);

        // ---- 9. Pass completion ------------------------------------------------
        // Ending a pass starts a deceleration ramp; it does NOT flip anything here. The flip
        // itself is sequenced at the top of the next tick, once the strip has actually come to
        // rest (§9: no instant flip).
        if (rolling && s.PayoffLength <= 0.5)
        {
            ApplyTransition(MachineEventType.PassComplete, ctx);
        }

        // ---- Instrument signals ----------------------------------------------
        // Noise is added HERE, at the X-ray gauges, and nowhere else. The ORDER of these two calls
        // is part of the contract: each consumes two draws from the generator, so swapping them
        // would put different noise on both gauges and diverge the RNG stream for good.
        var gaugeExit = ThicknessModel.ApplyGaugeNoise(deliveredThickness, _rng);
        var gaugeEntry = ThicknessModel.ApplyGaugeNoise(entryThickness, _rng);
        var thicknessDeviationUm = (gaugeExit - pass.OutputThickness) * 1000;

        // ---- OS / DS split (§2 BUR taper + -9 t differential reference) -------
        // First-order representation: the AGC holds a commanded force differential between the
        // sides, and the resulting side-to-side gap difference follows from the mill modulus.
        // Carried in the model from day one even though Phase 1 renders a single value.
        var diffRef = MillConfig.Default.Agc.DifferentialForceReference;
        var forceOs = force / 2 - diffRef / 2;
        var forceDs = force / 2 + diffRef / 2;
        var tiltMm = diffRef / EngineeringConfig.MillModulus;
        var gapOs = deliveredThickness - tiltMm / 2;
        var gapDs = deliveredThickness + tiltMm / 2;

        var remainingLength = s.PayoffLength;
        var passProgress = s.PassTotalLength > 0
            ? UnitConversion.Clamp(1 - s.PayoffLength / s.PassTotalLength, 0, 1) * 100
            : 0;

        // ---- Emit the frame ---------------------------------------------------
        var frame = new RawFrame
        {
            // MILL
            ["MILL.SPEED.REF"] = TagValue.FromNumber(speedReference),
            ["MILL.SPEED.ACTUAL"] = TagValue.FromNumber(exitSpeed),
            ["MILL.SPEED.ENTRY"] = TagValue.FromNumber(entrySpeed),
            ["MILL.DIRECTION"] = TagValue.FromString(s.Direction.ToWire()),
            ["MILL.STATUS"] = TagValue.FromString(s.Status.ToWire()),
            ["MILL.STATUS.REASON"] = TagValue.FromString(s.StatusReason),
            ["MILL.INTERLOCK"] = TagValue.FromBoolean(chain.MillReady),
            ["MILL.MASSFLOW.ERROR"] = TagValue.FromNumber(RollingModel.MassFlowError(
                entryThickness,
                entrySpeed,
                deliveredThickness,
                exitSpeed)),

            // ROLL GAP
            ["ROLL.GAP.REF"] = TagValue.FromNumber(gapCommand),
            ["ROLL.GAP.ACTUAL"] = TagValue.FromNumber(deliveredThickness),
            ["ROLL.GAP.OS"] = TagValue.FromNumber(gapOs),
            ["ROLL.GAP.DS"] = TagValue.FromNumber(gapDs),
            ["ROLL.GAP.TILT"] = TagValue.FromNumber(tiltMm * 1000),

            // ROLL FORCE
            ["ROLL.FORCE.ACTUAL"] = TagValue.FromNumber(force),
            ["ROLL.FORCE.REF"] = TagValue.FromNumber(pass.PredictedForce),
            ["ROLL.FORCE.OS"] = TagValue.FromNumber(forceOs),
            ["ROLL.FORCE.DS"] = TagValue.FromNumber(forceDs),
            ["ROLL.FORCE.DIFF_REF"] = TagValue.FromNumber(diffRef),

            // STRIP
            ["STRIP.WIDTH"] = TagValue.FromNumber(coil.Width),
            ["STRIP.THICKNESS"] = TagValue.FromNumber(gaugeExit),
            ["STRIP.THICKNESS.ENTRY"] = TagValue.FromNumber(gaugeEntry),
            ["STRIP.THICKNESS.REF"] = TagValue.FromNumber(pass.OutputThickness),
            ["STRIP.THICKNESS.DEVIATION"] = TagValue.FromNumber(thicknessDeviationUm),
            ["STRIP.REDUCTION"] = TagValue.FromNumber(
                RollingModel.CalculateReduction(entryThickness, deliveredThickness)),

            // TENSION
            ["TENSION.ENTRY"] = TagValue.FromNumber(s.EntryTension),
            ["TENSION.EXIT"] = TagValue.FromNumber(s.ExitTension),
            ["TENSION.ENTRY.REF"] = TagValue.FromNumber(entryRefFull),
            ["TENSION.EXIT.REF"] = TagValue.FromNumber(exitRefFull),

            // COIL / PASS
            ["COIL.ID"] = TagValue.FromString(coil.Id),
            ["COIL.GRADE"] = TagValue.From(coil.Grade),
            ["COIL.LENGTH"] = TagValue.FromNumber(s.PassTotalLength),
            ["COIL.REMAINING_LENGTH"] = TagValue.FromNumber(remainingLength),
            ["COIL.DIAMETER"] = TagValue.FromNumber(payoffRadius * 2),
            ["PASS.NUMBER"] = TagValue.FromNumber(s.PassNumber),
            ["PASS.TOTAL"] = TagValue.FromNumber(_schedule.Passes.Count),
            ["PASS.PROGRESS"] = TagValue.FromNumber(passProgress),

            // DRIVE
            ["DRIVE.TORQUE"] = TagValue.FromNumber(drive.Torque),
            ["DRIVE.CURRENT"] = TagValue.FromNumber(drive.Current),
            ["DRIVE.POWER"] = TagValue.FromNumber(drive.Power),
            ["DRIVE.RPM"] = TagValue.FromNumber(drive.Rpm),

            // ROLLS. Upper and lower work rolls counter-rotate, hence the sign flip; the whole set
            // reverses when `direction` flips.
            ["WR.TOP.RPM"] = TagValue.FromNumber(wrRpm * ReversingRules.DirectionSign(s.Direction)),
            ["WR.BOTTOM.RPM"] = TagValue.FromNumber(-wrRpm * ReversingRules.DirectionSign(s.Direction)),
            ["BUR.TOP.RPM"] = TagValue.FromNumber(burRpm * ReversingRules.DirectionSign(s.Direction)),
            ["BUR.BOTTOM.RPM"] = TagValue.FromNumber(-burRpm * ReversingRules.DirectionSign(s.Direction)),
            ["WR.TOP.BENDING"] = TagValue.From(mods.BendingForceKn),
            ["WR.BOTTOM.BENDING"] = TagValue.From(mods.BendingForceKn),
            ["WR.TOP.DIAMETER"] = TagValue.FromNumber(wrDiameter),
            ["WR.BOTTOM.DIAMETER"] = TagValue.FromNumber(wrDiameter),
            ["BUR.TOP.DIAMETER"] = TagValue.FromNumber(MillConfig.Default.Geometry.BackupRollDiameter),
            ["BUR.BOTTOM.DIAMETER"] = TagValue.FromNumber(MillConfig.Default.Geometry.BackupRollDiameter),

            // HYDRAULICS
            ["HYD.LOADING.PRESSURE"] = TagValue.FromNumber(
                DriveModel.HydraulicPressureFromForce(force) * mods.HydraulicPressureFactor),
            ["HYD.BENDING.PRESSURE"] = TagValue.From(mods.BendingPressureBar),
            ["HYD.GAP.POSITION"] = TagValue.FromNumber(gapCommand),
            ["LP.PRESSURE"] = TagValue.FromNumber(
                s.AuxHealth[AuxSystem.LpSystem] ? EngineeringConfig.LpSystemPressure : 0.4),

            // AUXILIARY STATUS
            ["LP.STATUS"] = TagValue.FromString(AuxStatus(s.AuxHealth[AuxSystem.LpSystem])),
            ["HP.LOADING.STATUS"] = TagValue.FromString(AuxStatus(s.AuxHealth[AuxSystem.HpLoading])),
            ["HP.BENDING.STATUS"] = TagValue.FromString(AuxStatus(s.AuxHealth[AuxSystem.HpBending])),
            ["COOLANT.STATUS"] = TagValue.FromString(AuxStatus(s.AuxHealth[AuxSystem.Coolant])),
            ["LUBRICATION.STATUS"] = TagValue.FromString(AuxStatus(s.AuxHealth[AuxSystem.Lubrication])),
            ["EXHAUST.STATUS"] = TagValue.FromString(AuxStatus(s.AuxHealth[AuxSystem.Exhaust])),

            // PROCESS CONTROL
            ["AGC.STATUS"] = TagValue.FromString(Ctrl(s.AgcEnabled && mods.AgcEnabled && rolling)),
            ["THFB.STATUS"] = TagValue.FromString(Ctrl(s.AgcEnabled && rolling)),
            ["THFF.STATUS"] = TagValue.FromString(Ctrl(s.AgcEnabled && rolling)),
            ["SPFF.STATUS"] = TagValue.FromString(Ctrl(rolling)),
            ["MFC.STATUS"] = TagValue.FromString(Ctrl(s.AgcEnabled && rolling)),
            ["TRF.STATUS"] = TagValue.FromString(Ctrl(s.Threaded)),
            ["POSITION.MODE.STATUS"] = TagValue.FromString(Ctrl(!s.AgcEnabled)),
            ["ROLLGAP.CLOSED.STATUS"] = TagValue.FromString(Ctrl(gapCommand < entryThickness)),
            ["BENDING.STATUS"] = TagValue.FromString(Ctrl(s.AuxHealth[AuxSystem.HpBending])),

            // INTERLOCKS
            ["DRIVE.READY"] = TagValue.FromBoolean(!s.EStop && s.AuxHealth[AuxSystem.Lubrication]),
            ["GAUGE.READY"] = TagValue.FromBoolean(mods.GaugeReady),
            ["HYDRAULIC.READY"] = TagValue.FromBoolean(hydraulicReady),
            ["TENSION.READY"] = TagValue.FromBoolean(!s.EStop),
            ["EMERGENCY.STOP"] = TagValue.FromBoolean(s.EStop),
            ["FAST.STOP"] = TagValue.FromBoolean(s.FastStopLatched),

            // GAUGES. Each isotope gauge is bolted to one side of the stand and never moves; what
            // it MEASURES swaps with direction. On FORWARD the ETR side is upstream of the bite,
            // so the ETR gauge reads incoming and the DTR gauge reads delivered.
            ["GAUGE.ETR.THICKNESS"] = TagValue.FromNumber(payoff == ReelId.Etr ? gaugeEntry : gaugeExit),
            ["GAUGE.DTR.THICKNESS"] = TagValue.FromNumber(payoff == ReelId.Dtr ? gaugeEntry : gaugeExit),
            ["GAUGE.DTR.READY"] = TagValue.FromBoolean(mods.GaugeReady),
            ["GAUGE.ETR.READY"] = TagValue.FromBoolean(mods.GaugeReady),
        };

        // Reels. Which physical reel gets the payoff numbers is decided ONLY by the
        // direction-derived role - nothing here is hardcoded to a side.
        WriteReel(frame, payoff, new ReelFrameValues(
            Tension: s.EntryTension,
            Diameter: payoffRadius * 2,
            Length: s.PayoffLength,
            Torque: payoffTorque,
            Current: CoilModel.ReelCurrent(
                payoffTorque,
                MillConfig.Default.Ratings.ReelRatedTorque,
                MillConfig.Default.Ratings.ReelRatedCurrent),
            // Both reels turn the SAME way in space - they are two pulleys with the strip running
            // between them. Only their rpm differs, because their diameters and line speeds differ.
            Rpm: payoffRpm * ReversingRules.DirectionSign(s.Direction),
            Thickness: entryThickness,
            Role: ReversingRules.RoleOf(payoff, s.Direction).ToWire(),
            Brake: rolling ? "RELEASED" : "APPLIED",
            Status: rolling ? "RUNNING" : "STOPPED"));

        WriteReel(frame, winder, new ReelFrameValues(
            Tension: s.ExitTension,
            Diameter: winderRadius * 2,
            Length: s.WoundLength,
            Torque: winderTorque,
            Current: CoilModel.ReelCurrent(
                winderTorque,
                MillConfig.Default.Ratings.ReelRatedTorque,
                MillConfig.Default.Ratings.ReelRatedCurrent),
            Rpm: winderRpm * ReversingRules.DirectionSign(s.Direction),
            Thickness: deliveredThickness,
            Role: ReversingRules.RoleOf(winder, s.Direction).ToWire(),
            Brake: rolling ? "RELEASED" : "APPLIED",
            Status: rolling ? "RUNNING" : "STOPPED"));

        // POR holds the NEXT coil waiting to be charged: braked, no tension, no load.
        frame["POR.TENSION"] = TagValue.FromNumber(0);
        frame["POR.DIAMETER"] = TagValue.FromNumber(porRadius * 2);
        frame["POR.LENGTH"] = TagValue.FromNumber(s.PorLength);
        frame["POR.TORQUE"] = TagValue.FromNumber(0);
        frame["POR.CURRENT"] = TagValue.FromNumber(0);
        frame["POR.RPM"] = TagValue.FromNumber(0);
        frame["POR.LAYERS"] = TagValue.FromNumber(
            CoilModel.CoilLayers(mandrelRadius, s.PorThickness, porRadius));
        frame["POR.BRAKE"] = TagValue.FromString("APPLIED");
        frame["POR.STATUS"] = TagValue.FromString("STOPPED");

        return frame;
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    private SimState BuildInitialState()
    {
        var pass = PassScheduleMath.GetPass(_schedule, 1);
        var coil = _schedule.Coil;
        var totalLength = PassScheduleMath.CoilLengthAtThickness(
            coil.OuterDiameter / 2, coil.InnerDiameter / 2, coil.EntryThickness);

        var tensions = TensionModel.CalculateTensionReferences(
            pass.EntrySpecificTension,
            pass.ExitSpecificTension,
            pass.InputThickness,
            pass.OutputThickness,
            coil.Width);

        // Preposition the capsule so the first pass starts on gauge rather than hunting for it -
        // this is what the AGC position pre-set does.
        var gapPosition = ThicknessModel.GapPositionForTargetThickness(
            pass.OutputThickness,
            pass.InputThickness,
            coil.Width,
            MillConfig.Default.Geometry.WorkRollDiameter,
            tensions.EntryKn,
            tensions.ExitKn,
            0);

        return new SimState
        {
            TimeS = 0,
            Status = MachineStatus.Ready,
            StatusReason = "Mill ready — all interlocks healthy",
            Direction = pass.Direction,
            Speed = 0,
            SpeedReferenceTrim = 0,
            GapPosition = gapPosition,
            GapTrim = 0,
            Hagc = new HagcState(0),
            AgcEnabled = true,
            EntryTension = 0,
            ExitTension = 0,
            EntryTensionTrim = 0,
            ExitTensionTrim = 0,
            PassNumber = 1,
            PassInputThickness = pass.InputThickness,
            PayoffLength = totalLength,
            WoundLength = 0,
            PassTotalLength = totalLength,
            PositionM = 0,
            Threaded = true,
            Reversal = ReversalSequencer.Initial,
            PorLength = totalLength,
            PorThickness = coil.EntryThickness,
            Scenario = ScenarioId.Normal,
            EStop = false,
            FastStopLatched = false,
            AuxHealth = new Dictionary<AuxSystem, bool>
            {
                [AuxSystem.Lubrication] = true,
                [AuxSystem.Coolant] = true,
                [AuxSystem.Exhaust] = true,
                [AuxSystem.LpSystem] = true,
                [AuxSystem.HpLoading] = true,
                [AuxSystem.HpBending] = true,
            },
            CommsHealthy = true,
            DeliveredThickness = pass.OutputThickness,
            Force = 0,
            ContactLength = 0,
            SolverIterations = 0,
            ResidualUm = 0,
        };
    }

    /// <summary>
    /// Advance the pass / reversal sequence (§9).
    ///
    /// Runs at the TOP of a tick, on the state the previous tick settled into. A reversal only
    /// ever begins from a genuine standstill, and <see cref="ReversalSequencer.Step"/>
    /// independently refuses to advance while the strip is moving - the "no instant flip" rule is
    /// enforced in both places rather than trusted to either.
    /// </summary>
    private void StepPassAndReversal(double dt)
    {
        var s = _state;
        var scheduleComplete = s.PassNumber >= _schedule.Passes.Count;

        if (s.Status == MachineStatus.Stopped &&
            s.PayoffLength <= 0.5 &&
            !scheduleComplete &&
            s.Reversal.Phase == ReversalPhase.None)
        {
            var begun = MachineTransitions.BeginReversal(s.Status);
            if (begun.Changed)
            {
                s.Status = begun.Status;
                s.StatusReason = begun.Reason;
                s.Reversal = ReversalSequencer.Start(
                    s.Direction, PassScheduleMath.GetPass(_schedule, s.PassNumber + 1).Direction);
            }
        }

        if (s.Reversal.Phase == ReversalPhase.None) return;

        var next = ReversalSequencer.Step(s.Reversal, dt, s.Speed);
        if (next.Phase == ReversalPhase.Flip && s.Reversal.Phase != ReversalPhase.Flip)
        {
            ApplyFlip();
        }

        s.Reversal = next;

        if (next.Phase == ReversalPhase.Complete)
        {
            s.Reversal = ReversalSequencer.Initial;
            // The reversal is finished, so the mill may roll again. Context here is trivially
            // satisfiable - the mill is stopped, threaded and mid-schedule.
            ApplyTransition(MachineEventType.ReversalComplete, new TransitionContext(
                MillReady: true,
                InterlockReason: null,
                Speed: s.Speed,
                Threaded: s.Threaded,
                ScheduleComplete: false));
        }
    }

    /// <summary>
    /// Apply one event. Note that <c>Speed</c> and <c>Threaded</c> are overridden with LIVE values
    /// while the rest of the context stays as it was captured at the top of the tick - the
    /// TypeScript's <c>{ ...ctx, speed, threaded }</c>. It matters: several transitions fire after
    /// the speed ramp has already moved, and they must see the new speed, not the old one.
    /// </summary>
    private void ApplyTransition(MachineEventType e, TransitionContext ctx)
    {
        var s = _state;
        var result = MachineTransitions.Transition(
            s.Status, e, ctx with { Speed = s.Speed, Threaded = s.Threaded });
        s.Status = result.Status;
        s.StatusReason = result.Reason;
    }

    /// <summary>
    /// The FLIP step of the reversal (§9): direction changes, entry/exit roles swap, and the coil
    /// rolls over to the next pass. Everything that defines "which way is the mill going" changes
    /// in this one place, on one tick.
    /// </summary>
    private void ApplyFlip()
    {
        var s = _state;
        var coil = _schedule.Coil;
        var nextPassNumber = Math.Min(s.PassNumber + 1, _schedule.Passes.Count);
        var nextPass = PassScheduleMath.GetPass(_schedule, nextPassNumber);

        // The reel that was winding becomes the reel that pays off. Its contents - length at the
        // just-delivered thickness - become the next pass's input.
        var newPayoffLength = s.WoundLength > 0
            ? s.WoundLength
            : CoilModel.LengthAfterReduction(s.PassTotalLength, s.PassInputThickness, s.DeliveredThickness);

        // The TypeScript writes `nextPass.direction ?? oppositeDirection(s.direction)`, but
        // `direction` is required on a schedule entry, so the fallback is unreachable there and
        // simply absent here - C#'s type system already guarantees what the `??` was guarding.
        s.Direction = nextPass.Direction;
        s.PassNumber = nextPassNumber;
        s.PassInputThickness = nextPass.InputThickness;
        s.PayoffLength = newPayoffLength;
        s.PassTotalLength = newPayoffLength;
        s.WoundLength = 0;
        s.PositionM = 0;
        s.Hagc = new HagcState(0);

        // Preposition the capsule for the new pass - the AGC position pre-set.
        var tensions = TensionModel.CalculateTensionReferences(
            nextPass.EntrySpecificTension,
            nextPass.ExitSpecificTension,
            nextPass.InputThickness,
            nextPass.OutputThickness,
            coil.Width);

        s.GapPosition = ThicknessModel.GapPositionForTargetThickness(
            nextPass.OutputThickness,
            nextPass.InputThickness,
            coil.Width,
            MillConfig.Default.Geometry.WorkRollDiameter,
            tensions.EntryKn,
            tensions.ExitKn,
            PassScheduleMath.AccumulatedStrainBeforePass(_schedule, nextPassNumber));
        s.GapTrim = 0;
    }

    private static double TargetSpeedFor(MachineStatus status, double speedReference) => status switch
    {
        MachineStatus.Rolling or MachineStatus.SkinPass => speedReference,
        MachineStatus.Threading => EngineeringConfig.SpeedLimits.ThreadingSpeed,
        MachineStatus.Rewind => speedReference * 0.5,
        // IDLE, READY, DECELERATING, STOPPED, REVERSING, FAST_STOP, FAULT, WARMUP, ROLL_CHANGE -
        // none of these produce line speed.
        _ => 0,
    };

    /// <summary>
    /// Longitudinal entry-thickness deviation at a position along the coil, mm. Three
    /// incommensurate harmonics so the pattern does not visibly repeat.
    /// </summary>
    internal static double EntryThicknessDeviation(double positionM, int passNumber)
    {
        var amplitude =
            EntryProfileAmplitudeMm * Math.Pow(EntryProfileAttenuation, passNumber - 1);
        var p = positionM;
        return amplitude *
               (0.55 * Math.Sin(p / 41.3) + 0.3 * Math.Sin(p / 13.7 + 1.1) + 0.15 * Math.Sin(p / 4.9 + 2.3));
    }

    internal static double RampTowards(double current, double target, double maxStep)
    {
        if (current < target) return Math.Min(current + maxStep, target);
        if (current > target) return Math.Max(current - maxStep, target);
        return current;
    }

    private static string AuxStatus(bool ok) => ok ? "HEALTHY" : "FAULT";

    private static string Ctrl(bool on) => on ? "ON" : "OFF";

    private readonly record struct ReelFrameValues(
        double Tension,
        double Diameter,
        double Length,
        double Torque,
        double Current,
        double Rpm,
        double Thickness,
        string Role,
        string Brake,
        string Status);

    private static void WriteReel(RawFrame frame, ReelId reel, ReelFrameValues v)
    {
        var p = reel.ToWire();
        frame[$"{p}.TENSION"] = TagValue.FromNumber(v.Tension);
        frame[$"{p}.DIAMETER"] = TagValue.FromNumber(v.Diameter);
        frame[$"{p}.LENGTH"] = TagValue.FromNumber(v.Length);
        frame[$"{p}.TORQUE"] = TagValue.FromNumber(v.Torque);
        frame[$"{p}.CURRENT"] = TagValue.FromNumber(v.Current);
        frame[$"{p}.RPM"] = TagValue.FromNumber(v.Rpm);
        frame[$"{p}.THICKNESS"] = TagValue.FromNumber(v.Thickness);
        frame[$"{p}.ROLE"] = TagValue.FromString(v.Role);
        frame[$"{p}.BRAKE"] = TagValue.FromString(v.Brake);
        frame[$"{p}.STATUS"] = TagValue.FromString(v.Status);
    }

    /// <summary>
    /// The mill's internal state.
    ///
    /// A MUTABLE CLASS, DELIBERATELY. <see cref="Tick"/> mutates these fields in place as it walks
    /// the nine sections, and later sections read what earlier ones wrote - section 5 overwrites
    /// <see cref="DeliveredThickness"/> and section 8 reads it back. A record would advertise
    /// value semantics and invite someone to <c>with</c>-clone it, which would silently give one
    /// section a stale copy. The only wholesale replacement is LOAD_NEXT_COIL, which assigns a
    /// fresh instance.
    /// </summary>
    private sealed class SimState
    {
        public required double TimeS { get; set; }

        public required MachineStatus Status { get; set; }

        public required string StatusReason { get; set; }

        public required RollingDirection Direction { get; set; }

        public required double Speed { get; set; }

        public required double SpeedReferenceTrim { get; set; }

        /// <summary>Unloaded roll gap position S0, mm.</summary>
        public required double GapPosition { get; set; }

        public required double GapTrim { get; set; }

        public required HagcState Hagc { get; set; }

        public required bool AgcEnabled { get; set; }

        public required double EntryTension { get; set; }

        public required double ExitTension { get; set; }

        public required double EntryTensionTrim { get; set; }

        public required double ExitTensionTrim { get; set; }

        public required int PassNumber { get; set; }

        /// <summary>Nominal input thickness for the current pass, mm.</summary>
        public required double PassInputThickness { get; set; }

        /// <summary>Length still to be paid off this pass, m.</summary>
        public required double PayoffLength { get; set; }

        /// <summary>Length wound onto the tension reel this pass, m.</summary>
        public required double WoundLength { get; set; }

        /// <summary>Total strip length of the coil at the current input thickness, m.</summary>
        public required double PassTotalLength { get; set; }

        /// <summary>Distance rolled this pass, m - position along the coil for the entry profile.</summary>
        public required double PositionM { get; set; }

        public required bool Threaded { get; set; }

        public required ReversalState Reversal { get; set; }

        /// <summary>POR holds the next coil waiting to be charged.</summary>
        public required double PorLength { get; set; }

        public required double PorThickness { get; set; }

        public required ScenarioId Scenario { get; set; }

        public required bool EStop { get; set; }

        public required bool FastStopLatched { get; set; }

        public required Dictionary<AuxSystem, bool> AuxHealth { get; set; }

        public required bool CommsHealthy { get; set; }

        /// <summary>Last solved values, retained so a stopped mill reports a coherent frame.</summary>
        public required double DeliveredThickness { get; set; }

        public required double Force { get; set; }

        public required double ContactLength { get; set; }

        public required int SolverIterations { get; set; }

        public required double ResidualUm { get; set; }
    }
}
