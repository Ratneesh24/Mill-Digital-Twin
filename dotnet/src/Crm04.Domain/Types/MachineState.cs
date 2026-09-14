namespace Crm04.Domain.Types;

/// <summary>
/// Port of <c>src/types/machine.ts</c>.
///
/// There is exactly ONE authoritative MachineState object in the application. Components
/// subscribe to it; they never compute their own version of a value. MachineState is a pure
/// projection of the current <see cref="TagFrame"/>, produced by
/// <c>Crm04.Domain.Projection.MachineStateProjector</c> - the C# counterpart of
/// <c>src/communication/dataAdapter.ts</c>, which the TypeScript app documents as the only
/// place MachineState is constructed.
///
/// THE CONSTRUCTOR IS INTERNAL so that rule survives the port: no code outside this assembly
/// can build a MachineState, and inside the assembly only the projector does.
///
/// Note how many fields are nullable. In this domain <c>null</c> means "no tag on this feed"
/// and is a different statement from zero (§7.4). Every <c>double?</c> below is deliberate;
/// collapsing one to a default would turn a missing reading into a plausible-looking number,
/// which is the specific failure this type is shaped to prevent.
/// </summary>
public sealed record MachineState
{
    internal MachineState(
        MachineStatus machineStatus,
        string statusReason,
        RollingDirection rollingDirection,
        OperatingMode operatingMode,
        SpeedState speed,
        RollGapState rollGap,
        RollingForceState rollingForce,
        TensionState tension,
        ThicknessState thickness,
        RollsState rolls,
        CoilState coil,
        PassState pass,
        DriveState drive,
        HydraulicsState hydraulics,
        AuxiliarySystemsState auxiliarySystems,
        GaugesState gauges,
        InterlockFlags interlocks,
        ControlsState controls,
        DiagnosticsState diagnostics,
        CommState communication)
    {
        MachineStatus = machineStatus;
        StatusReason = statusReason;
        RollingDirection = rollingDirection;
        OperatingMode = operatingMode;
        Speed = speed;
        RollGap = rollGap;
        RollingForce = rollingForce;
        Tension = tension;
        Thickness = thickness;
        Rolls = rolls;
        Coil = coil;
        Pass = pass;
        Drive = drive;
        Hydraulics = hydraulics;
        AuxiliarySystems = auxiliarySystems;
        Gauges = gauges;
        Interlocks = interlocks;
        Controls = controls;
        Diagnostics = diagnostics;
        Communication = communication;
    }

    public MachineStatus MachineStatus { get; }

    /// <summary>Reason string for the current status - used by the interlock panel (§13.2).</summary>
    public string StatusReason { get; }

    public RollingDirection RollingDirection { get; }

    public OperatingMode OperatingMode { get; }

    public SpeedState Speed { get; }

    public RollGapState RollGap { get; }

    public RollingForceState RollingForce { get; }

    public TensionState Tension { get; }

    public ThicknessState Thickness { get; }

    public RollsState Rolls { get; }

    public CoilState Coil { get; }

    public PassState Pass { get; }

    public DriveState Drive { get; }

    public HydraulicsState Hydraulics { get; }

    public AuxiliarySystemsState AuxiliarySystems { get; }

    public GaugesState Gauges { get; }

    /// <summary>Null members mean this feed carries no interlock chain tag (§7.4).</summary>
    public InterlockFlags Interlocks { get; }

    public ControlsState Controls { get; }

    public DiagnosticsState Diagnostics { get; }

    public CommState Communication { get; }
}

/// <param name="Reference">Mill speed reference, m/min.</param>
/// <param name="Actual">Mill speed actual (exit strip speed), m/min.</param>
public readonly record struct SpeedState(double Reference, double Actual)
{
    /// <summary>Fixed unit, carried so a readout never has to guess. Matches the TS literal type.</summary>
    public string Unit => "m/min";
}

/// <param name="Reference">
/// Unloaded roll gap position S0 commanded by HAGC, mm. Null on the 46-tag feed - there is no
/// HAGC/LVDT position tag (§7.4).
/// </param>
/// <param name="Actual">Loaded gap = delivered thickness, mm.</param>
/// <param name="Deviation">actual - reference, µm. Null when the reference is unavailable.</param>
/// <param name="Os">Operator side, mm. Null when no LVDT tag exists (§7.4).</param>
/// <param name="Ds">Drive side, mm. Null when no LVDT tag exists (§7.4).</param>
/// <param name="Tilt">OS-DS tilt, µm. Null when unavailable.</param>
public readonly record struct RollGapState(
    double? Reference,
    double Actual,
    double? Deviation,
    double? Os,
    double? Ds,
    double? Tilt);

/// <param name="Actual">Total roll separating force, t.</param>
/// <param name="Reference">Pass-schedule predicted force, t.</param>
/// <param name="Percentage">actual / maximum rolling force, %.</param>
/// <param name="Os">Operator side share, t. Null when unavailable.</param>
/// <param name="Ds">Drive side share, t. Null when unavailable.</param>
/// <param name="DifferentialRef">Standing AGC differential force reference, t (§2 CRM04 -9 t issue).</param>
public readonly record struct RollingForceState(
    double Actual,
    double Reference,
    double Percentage,
    double? Os,
    double? Ds,
    double? DifferentialRef);

/// <summary>
/// Entry and exit are LOGICAL roles that follow the rolling direction, never fixed sides of the
/// mill (§1). On a reversal they swap, and so do the reels behind them.
/// </summary>
public sealed record TensionState(
    double Entry,
    double Exit,
    double EntryReference,
    double ExitReference,
    double EntrySpecific,
    double ExitSpecific,
    ReelState Dtr,
    ReelState Etr,
    ReelState Por);

/// <param name="Id">Physical identity of the reel.</param>
/// <param name="Role">Logical role for the current pass - derived from rolling direction (§1).</param>
/// <param name="Tension">Tension actually applied to the strip, kN.</param>
/// <param name="TensionReference">Tension reference from the pass schedule, kN.</param>
/// <param name="Diameter">Outside coil diameter, mm.</param>
/// <param name="Length">Strip length currently on the reel, m.</param>
/// <param name="Torque">Reel motor torque, kNm.</param>
/// <param name="Current">Reel motor current, A.</param>
/// <param name="Thickness">Strip thickness at this reel, mm. Null for POR.</param>
/// <param name="Rpm">Reel rotational speed, rpm. Sign follows rolling direction.</param>
/// <param name="Layers">Wraps on the mandrel. Null for DTR/ETR - POR only (§7.2).</param>
/// <param name="Brake">Null when no brake status word exists on this feed.</param>
public sealed record ReelState(
    ReelId Id,
    ReelRole Role,
    double Tension,
    double TensionReference,
    double Diameter,
    double Length,
    double Torque,
    double Current,
    double? Thickness,
    double Rpm,
    double? Layers,
    BrakeState? Brake,
    ReelStatus Status);

/// <param name="Entry">Entry thickness for this pass, mm.</param>
/// <param name="Reference">Exit thickness reference for this pass, mm.</param>
/// <param name="Actual">Delivered thickness, mm.</param>
/// <param name="Deviation">actual - reference, µm.</param>
/// <param name="Target">Final target thickness for the coil, mm.</param>
/// <param name="Reduction">Reduction achieved this pass, %.</param>
public readonly record struct ThicknessState(
    double Entry,
    double Reference,
    double Actual,
    double Deviation,
    double Target,
    double Reduction);

public sealed record RollsState(
    RollState UpperWork,
    RollState LowerWork,
    RollState UpperBackup,
    RollState LowerBackup);

/// <param name="Diameter">
/// Nominal (design) roll body diameter from the mill configuration, mm. This is what the 3D
/// scene and the rpm model use, so the twin renders correctly even on a feed with no roll-shop data.
/// </param>
/// <param name="ActualDiameter">
/// Actual ground diameter reported by the roll shop, mm. Null when no roll ID / diameter tag
/// exists (§7.4) - a different quantity from <paramref name="Diameter"/>, not a duplicate.
/// </param>
/// <param name="BarrelLength">Barrel length, mm.</param>
/// <param name="Rpm">Rotational speed, rpm. Sign encodes direction of rotation.</param>
/// <param name="BendingForce">
/// Bending force per chock, kN. Null when no bending tag exists on the active feed - the twin
/// must NOT animate a fake bend (§7.4).
/// </param>
/// <param name="RolledLength">Accumulated rolled length since the last roll change, km.</param>
/// <param name="SurfaceSpeed">Surface speed, m/min.</param>
public readonly record struct RollState(
    double Diameter,
    double? ActualDiameter,
    double BarrelLength,
    double Rpm,
    double? BendingForce,
    double? RolledLength,
    double SurfaceSpeed);

/// <param name="Thickness">Measured thickness at this gauge, mm.</param>
/// <param name="Deviation">Deviation from the reference for this gauge, µm.</param>
/// <param name="Ready">Null when no gauge-ready status word exists on this feed.</param>
/// <param name="InLine">X-ray gauge measuring head in/out of the pass line.</param>
public readonly record struct GaugeState(
    double? Thickness,
    double? Deviation,
    bool? Ready,
    bool? InLine);

public readonly record struct GaugesState(GaugeState Dtr, GaugeState Etr);

/// <param name="Grade">Null when grade must be joined from MES and is not on the feed (§7.4).</param>
public sealed record CoilState(
    string Id,
    double Width,
    double EntryThickness,
    double CurrentThickness,
    double FinalThickness,
    double Length,
    double RemainingLength,
    double Diameter,
    string? Grade);

/// <param name="Progress">Fraction of this pass completed, 0..1.</param>
public readonly record struct PassState(
    int Current,
    int Total,
    double InputThickness,
    double TargetThickness,
    double Reduction,
    double Progress);

/// <param name="Torque">Main mill drive torque, kNm.</param>
/// <param name="Current">Main mill drive armature current, A.</param>
/// <param name="Power">Main mill drive power, kW.</param>
/// <param name="Rpm">Main mill drive speed, rpm.</param>
/// <param name="TorquePercentage">Torque as % of rating.</param>
public readonly record struct DriveState(
    double Torque,
    double Current,
    double Power,
    double Rpm,
    double TorquePercentage);

/// <param name="LoadingPressure">HAGC capsule loading pressure, bar. Null when no tag (§7.4).</param>
/// <param name="BendingPressure">Work roll bending pressure, bar. Null when no tag (§7.4).</param>
/// <param name="GapPosition">HAGC capsule position, mm. Null when no LVDT tag (§7.4).</param>
/// <param name="LpPressure">LP lubrication pressure, bar. Null when no tag (§7.4).</param>
public readonly record struct HydraulicsState(
    double? LoadingPressure,
    double? BendingPressure,
    double? GapPosition,
    double? LpPressure);

public readonly record struct AuxiliarySystemsState(
    Health Lubrication,
    Health Coolant,
    Health Exhaust,
    Health LpSystem,
    Health HpLoading,
    Health HpBending);

public readonly record struct InterlockFlags(
    bool? Mill,
    bool? Drive,
    bool? Gauge,
    bool? Hydraulic,
    bool? Tension,
    bool? EmergencyStop);

public readonly record struct ControlsState(
    CtrlState Agc,
    CtrlState Thfb,
    CtrlState Thff,
    CtrlState Spff,
    CtrlState Mfc,
    CtrlState Trf,
    CtrlState PositionMode,
    CtrlState RollGapClosed,
    CtrlState Bending);

/// <param name="MassFlowErrorPct">
/// Mass-flow cross-check (§8.1): h_entry·v_entry vs h_exit·v_exit. Surfaced as a diagnostic,
/// never used as a hidden correction.
/// </param>
/// <param name="GaugemeterResidualUm">Gaugemeter residual, |actual - (S0 + F/M)|, µm.</param>
/// <param name="SolverIterations">Solver iterations used on the last simulation tick.</param>
public readonly record struct DiagnosticsState(
    double MassFlowErrorPct,
    double GaugemeterResidualUm,
    int SolverIterations)
{
    public static readonly DiagnosticsState Empty = new(0d, 0d, 0);
}

/// <param name="LastFrameTimestamp">Timestamp of the last frame accepted by the adapter.</param>
/// <param name="LastValidTimestamp">Timestamp of the last frame whose quality was GOOD.</param>
/// <param name="AgeMs">Age of the newest frame, ms.</param>
/// <param name="UpdateRateHz">Measured update rate of the incoming feed, Hz.</param>
public readonly record struct CommState(
    bool Connected,
    string SourceName,
    long LastFrameTimestamp,
    long LastValidTimestamp,
    double AgeMs,
    bool Stale,
    double UpdateRateHz,
    long FramesReceived)
{
    /// <summary>What the UI holds before anything has connected.</summary>
    public static readonly CommState Disconnected =
        new(false, "NONE", 0L, 0L, 0d, false, 0d, 0L);
}

/// <summary>A machine event for the §11.4 event timeline.</summary>
public sealed record MachineEvent(
    string Id,
    long Timestamp,
    MachineEventCategory Category,
    string Message);
