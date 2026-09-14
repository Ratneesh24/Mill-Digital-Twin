namespace Crm04.Domain.Types;

/// <summary>
/// Port of the TypeScript string-union types in <c>src/types/</c>.
///
/// The TypeScript side uses screaming-snake string literals ('MEASURED', 'FAST_STOP').
/// Those exact strings are the wire format - they appear in Oracle columns, in the
/// SignalR payloads, and in the golden parity fixtures - so every enum here has an
/// explicit two-way mapping in <see cref="WireNames"/> rather than relying on
/// <c>Enum.ToString()</c> matching by accident.
/// </summary>
public enum Provenance
{
    /// <summary>Real PLC / instrument value, GOOD quality.</summary>
    Measured,

    /// <summary>Setpoint from the pass schedule / MMS.</summary>
    Reference,

    /// <summary>Derived from measured values, e.g. gaugemeter thickness.</summary>
    Calculated,

    /// <summary>Produced by the simulation engine.</summary>
    Simulated,

    /// <summary>Model fill-in where no instrument exists.</summary>
    Estimated,

    /// <summary>No tag exists on this feed. Render "NO TAG", never a number.</summary>
    Unavailable,
}

/// <summary>
/// How a tag behaves on the real CRM04 feed (§7.4). Distinct from <see cref="Provenance"/>:
/// this is the catalogue's declaration, provenance is what a given mode resolves it to.
/// </summary>
public enum LiveAvailability
{
    Measured,
    Reference,
    Calculated,
    Estimated,
    Unavailable,
}

/// <summary>
/// A simulated value is never <see cref="Good"/> - it is <see cref="Simulation"/>. That
/// distinction is what stops the twin claiming instrument-grade confidence for a model output.
/// </summary>
public enum TagQuality
{
    Good,
    Bad,
    Stale,
    Simulation,
    NoTag,
}

public enum TagStatus
{
    Normal,
    Warning,
    Alarm,
    Trip,
    Unknown,
}

public enum MachineStatus
{
    Idle,
    Ready,
    Threading,
    Rolling,
    Decelerating,
    Reversing,
    Stopped,
    FastStop,
    Warmup,
    SkinPass,
    Rewind,
    RollChange,
    Fault,
}

public enum RollingDirection
{
    Forward,
    Reverse,
}

/// <summary>
/// SIMULATION - full simulated mill, everything badged SIM.
/// SIM_46TAG  - the same simulation filtered through the CRM04 historian tag inventory, so the
///              twin degrades exactly as it will on the real feed (force EST, gap CALC,
///              bending NO TAG) - §7.4.
/// LIVE       - gateway feed, real provenance.
/// </summary>
public enum OperatingMode
{
    Simulation,
    Sim46Tag,
    Live,
}

/// <summary>
/// <see cref="NoTag"/> is distinct from <see cref="Unknown"/> on purpose. Unknown means
/// "we have a tag and cannot interpret it"; NoTag means "this feed has no such tag at all"
/// (§7.4), and the UI must say so rather than show a plausible-looking state.
/// </summary>
public enum Health
{
    Healthy,
    Warning,
    Fault,
    Off,
    Unknown,
    NoTag,
}

public enum CtrlState
{
    On,
    Off,
    Fault,
    Unknown,
    NoTag,
}

/// <summary>Logical role of a reel, derived from rolling direction - never hardcoded (§1).</summary>
public enum ReelRole
{
    Payoff,
    Tension,
    Idle,
}

public enum ReelId
{
    Dtr,
    Etr,
    Por,
}

public enum ReelStatus
{
    Running,
    Stopped,
    Fault,
    Unknown,
}

public enum BrakeState
{
    Applied,
    Released,
}

public enum AlarmSeverity
{
    Info,
    Warning,
    Alarm,
    Trip,
}

/// <summary>Named regions of the 3D twin that an alarm can highlight.</summary>
public enum TwinSection
{
    Stand,
    RollBite,
    EntryReel,
    ExitReel,
    Hydraulics,
    Drive,
    GaugeEntry,
    GaugeExit,
    Strip,
}

public enum MachineEventCategory
{
    State,
    Pass,
    Setpoint,
    Alarm,
    Comms,
    Operator,
}

/// <summary>
/// The operating conditions the simulator can be driven into so the §17 validation tests are
/// exercisable from the UI. Port of the TypeScript <c>ScenarioId</c> union in
/// <c>src/simulation/simulationScenarios.ts</c>.
///
/// A scenario is a set of MODIFIERS applied to the physics inputs, never a set of fake outputs -
/// see <see cref="Crm04.Domain.Simulation.SimulationScenarios"/>.
/// </summary>
public enum ScenarioId
{
    Normal,
    HighForce,
    ThicknessExcursion,
    AgcOff,
    HydraulicLow,
    GaugeNotReady,
    CommunicationLoss,
    EmergencyStop,
}

/// <summary>
/// Two-way mapping between the enums above and the screaming-snake strings the TypeScript
/// app, the Oracle schema and the SignalR wire format all use.
///
/// Every switch is exhaustive and throws on an unmapped member, so adding an enum value
/// without adding its wire name is a runtime failure at first use rather than a silently
/// mistranslated tag. Parsing is the mirror image and is deliberately case-sensitive - a
/// gateway sending 'rolling' instead of 'ROLLING' is an integration fault worth surfacing.
/// </summary>
public static class WireNames
{
    // ----------------------------------------------------------------- Provenance
    public static string ToWire(this Provenance v) => v switch
    {
        Provenance.Measured => "MEASURED",
        Provenance.Reference => "REFERENCE",
        Provenance.Calculated => "CALCULATED",
        Provenance.Simulated => "SIMULATED",
        Provenance.Estimated => "ESTIMATED",
        Provenance.Unavailable => "UNAVAILABLE",
        _ => throw Unmapped(v),
    };

    public static bool TryParseProvenance(string? s, out Provenance v)
    {
        switch (s)
        {
            case "MEASURED": v = Provenance.Measured; return true;
            case "REFERENCE": v = Provenance.Reference; return true;
            case "CALCULATED": v = Provenance.Calculated; return true;
            case "SIMULATED": v = Provenance.Simulated; return true;
            case "ESTIMATED": v = Provenance.Estimated; return true;
            case "UNAVAILABLE": v = Provenance.Unavailable; return true;
            default: v = default; return false;
        }
    }

    public static Provenance ParseProvenance(string? s) =>
        TryParseProvenance(s, out var v) ? v : throw Unparsable<Provenance>(s);

    // ----------------------------------------------------------- LiveAvailability
    public static string ToWire(this LiveAvailability v) => v switch
    {
        LiveAvailability.Measured => "MEASURED",
        LiveAvailability.Reference => "REFERENCE",
        LiveAvailability.Calculated => "CALCULATED",
        LiveAvailability.Estimated => "ESTIMATED",
        LiveAvailability.Unavailable => "UNAVAILABLE",
        _ => throw Unmapped(v),
    };

    public static bool TryParseLiveAvailability(string? s, out LiveAvailability v)
    {
        switch (s)
        {
            case "MEASURED": v = LiveAvailability.Measured; return true;
            case "REFERENCE": v = LiveAvailability.Reference; return true;
            case "CALCULATED": v = LiveAvailability.Calculated; return true;
            case "ESTIMATED": v = LiveAvailability.Estimated; return true;
            case "UNAVAILABLE": v = LiveAvailability.Unavailable; return true;
            default: v = default; return false;
        }
    }

    public static LiveAvailability ParseLiveAvailability(string? s) =>
        TryParseLiveAvailability(s, out var v) ? v : throw Unparsable<LiveAvailability>(s);

    // ---------------------------------------------------------------- TagQuality
    public static string ToWire(this TagQuality v) => v switch
    {
        TagQuality.Good => "GOOD",
        TagQuality.Bad => "BAD",
        TagQuality.Stale => "STALE",
        TagQuality.Simulation => "SIMULATION",
        TagQuality.NoTag => "NO_TAG",
        _ => throw Unmapped(v),
    };

    public static TagQuality ParseTagQuality(string? s) => s switch
    {
        "GOOD" => TagQuality.Good,
        "BAD" => TagQuality.Bad,
        "STALE" => TagQuality.Stale,
        "SIMULATION" => TagQuality.Simulation,
        "NO_TAG" => TagQuality.NoTag,
        _ => throw Unparsable<TagQuality>(s),
    };

    // ----------------------------------------------------------------- TagStatus
    public static string ToWire(this TagStatus v) => v switch
    {
        TagStatus.Normal => "NORMAL",
        TagStatus.Warning => "WARNING",
        TagStatus.Alarm => "ALARM",
        TagStatus.Trip => "TRIP",
        TagStatus.Unknown => "UNKNOWN",
        _ => throw Unmapped(v),
    };

    public static TagStatus ParseTagStatus(string? s) => s switch
    {
        "NORMAL" => TagStatus.Normal,
        "WARNING" => TagStatus.Warning,
        "ALARM" => TagStatus.Alarm,
        "TRIP" => TagStatus.Trip,
        "UNKNOWN" => TagStatus.Unknown,
        _ => throw Unparsable<TagStatus>(s),
    };

    // ------------------------------------------------------------- MachineStatus
    public static string ToWire(this MachineStatus v) => v switch
    {
        MachineStatus.Idle => "IDLE",
        MachineStatus.Ready => "READY",
        MachineStatus.Threading => "THREADING",
        MachineStatus.Rolling => "ROLLING",
        MachineStatus.Decelerating => "DECELERATING",
        MachineStatus.Reversing => "REVERSING",
        MachineStatus.Stopped => "STOPPED",
        MachineStatus.FastStop => "FAST_STOP",
        MachineStatus.Warmup => "WARMUP",
        MachineStatus.SkinPass => "SKIN_PASS",
        MachineStatus.Rewind => "REWIND",
        MachineStatus.RollChange => "ROLL_CHANGE",
        MachineStatus.Fault => "FAULT",
        _ => throw Unmapped(v),
    };

    public static bool TryParseMachineStatus(string? s, out MachineStatus v)
    {
        switch (s)
        {
            case "IDLE": v = MachineStatus.Idle; return true;
            case "READY": v = MachineStatus.Ready; return true;
            case "THREADING": v = MachineStatus.Threading; return true;
            case "ROLLING": v = MachineStatus.Rolling; return true;
            case "DECELERATING": v = MachineStatus.Decelerating; return true;
            case "REVERSING": v = MachineStatus.Reversing; return true;
            case "STOPPED": v = MachineStatus.Stopped; return true;
            case "FAST_STOP": v = MachineStatus.FastStop; return true;
            case "WARMUP": v = MachineStatus.Warmup; return true;
            case "SKIN_PASS": v = MachineStatus.SkinPass; return true;
            case "REWIND": v = MachineStatus.Rewind; return true;
            case "ROLL_CHANGE": v = MachineStatus.RollChange; return true;
            case "FAULT": v = MachineStatus.Fault; return true;
            default: v = default; return false;
        }
    }

    public static MachineStatus ParseMachineStatus(string? s) =>
        TryParseMachineStatus(s, out var v) ? v : throw Unparsable<MachineStatus>(s);

    // ---------------------------------------------------------- RollingDirection
    public static string ToWire(this RollingDirection v) => v switch
    {
        RollingDirection.Forward => "FORWARD",
        RollingDirection.Reverse => "REVERSE",
        _ => throw Unmapped(v),
    };

    public static bool TryParseRollingDirection(string? s, out RollingDirection v)
    {
        switch (s)
        {
            case "FORWARD": v = RollingDirection.Forward; return true;
            case "REVERSE": v = RollingDirection.Reverse; return true;
            default: v = default; return false;
        }
    }

    public static RollingDirection ParseRollingDirection(string? s) =>
        TryParseRollingDirection(s, out var v) ? v : throw Unparsable<RollingDirection>(s);

    // ------------------------------------------------------------- OperatingMode
    public static string ToWire(this OperatingMode v) => v switch
    {
        OperatingMode.Simulation => "SIMULATION",
        OperatingMode.Sim46Tag => "SIM_46TAG",
        OperatingMode.Live => "LIVE",
        _ => throw Unmapped(v),
    };

    public static bool TryParseOperatingMode(string? s, out OperatingMode v)
    {
        switch (s)
        {
            case "SIMULATION": v = OperatingMode.Simulation; return true;
            case "SIM_46TAG": v = OperatingMode.Sim46Tag; return true;
            case "LIVE": v = OperatingMode.Live; return true;
            default: v = default; return false;
        }
    }

    public static OperatingMode ParseOperatingMode(string? s) =>
        TryParseOperatingMode(s, out var v) ? v : throw Unparsable<OperatingMode>(s);

    // -------------------------------------------------------------------- Health
    public static string ToWire(this Health v) => v switch
    {
        Health.Healthy => "HEALTHY",
        Health.Warning => "WARNING",
        Health.Fault => "FAULT",
        Health.Off => "OFF",
        Health.Unknown => "UNKNOWN",
        Health.NoTag => "NO_TAG",
        _ => throw Unmapped(v),
    };

    public static Health ParseHealth(string? s) => s switch
    {
        "HEALTHY" => Health.Healthy,
        "WARNING" => Health.Warning,
        "FAULT" => Health.Fault,
        "OFF" => Health.Off,
        "UNKNOWN" => Health.Unknown,
        "NO_TAG" => Health.NoTag,
        _ => throw Unparsable<Health>(s),
    };

    // ----------------------------------------------------------------- CtrlState
    public static string ToWire(this CtrlState v) => v switch
    {
        CtrlState.On => "ON",
        CtrlState.Off => "OFF",
        CtrlState.Fault => "FAULT",
        CtrlState.Unknown => "UNKNOWN",
        CtrlState.NoTag => "NO_TAG",
        _ => throw Unmapped(v),
    };

    public static CtrlState ParseCtrlState(string? s) => s switch
    {
        "ON" => CtrlState.On,
        "OFF" => CtrlState.Off,
        "FAULT" => CtrlState.Fault,
        "UNKNOWN" => CtrlState.Unknown,
        "NO_TAG" => CtrlState.NoTag,
        _ => throw Unparsable<CtrlState>(s),
    };

    // ------------------------------------------------------------------ ReelRole
    public static string ToWire(this ReelRole v) => v switch
    {
        ReelRole.Payoff => "PAYOFF",
        ReelRole.Tension => "TENSION",
        ReelRole.Idle => "IDLE",
        _ => throw Unmapped(v),
    };

    public static bool TryParseReelRole(string? s, out ReelRole v)
    {
        switch (s)
        {
            case "PAYOFF": v = ReelRole.Payoff; return true;
            case "TENSION": v = ReelRole.Tension; return true;
            case "IDLE": v = ReelRole.Idle; return true;
            default: v = default; return false;
        }
    }

    public static ReelRole ParseReelRole(string? s) =>
        TryParseReelRole(s, out var v) ? v : throw Unparsable<ReelRole>(s);

    // -------------------------------------------------------------------- ReelId
    public static string ToWire(this ReelId v) => v switch
    {
        ReelId.Dtr => "DTR",
        ReelId.Etr => "ETR",
        ReelId.Por => "POR",
        _ => throw Unmapped(v),
    };

    public static ReelId ParseReelId(string? s) => s switch
    {
        "DTR" => ReelId.Dtr,
        "ETR" => ReelId.Etr,
        "POR" => ReelId.Por,
        _ => throw Unparsable<ReelId>(s),
    };

    // ---------------------------------------------------------------- ReelStatus
    public static string ToWire(this ReelStatus v) => v switch
    {
        ReelStatus.Running => "RUNNING",
        ReelStatus.Stopped => "STOPPED",
        ReelStatus.Fault => "FAULT",
        ReelStatus.Unknown => "UNKNOWN",
        _ => throw Unmapped(v),
    };

    public static ReelStatus ParseReelStatus(string? s) => s switch
    {
        "RUNNING" => ReelStatus.Running,
        "STOPPED" => ReelStatus.Stopped,
        "FAULT" => ReelStatus.Fault,
        "UNKNOWN" => ReelStatus.Unknown,
        _ => throw Unparsable<ReelStatus>(s),
    };

    // ---------------------------------------------------------------- BrakeState
    public static string ToWire(this BrakeState v) => v switch
    {
        BrakeState.Applied => "APPLIED",
        BrakeState.Released => "RELEASED",
        _ => throw Unmapped(v),
    };

    public static bool TryParseBrakeState(string? s, out BrakeState v)
    {
        switch (s)
        {
            case "APPLIED": v = BrakeState.Applied; return true;
            case "RELEASED": v = BrakeState.Released; return true;
            default: v = default; return false;
        }
    }

    // ------------------------------------------------------------- AlarmSeverity
    public static string ToWire(this AlarmSeverity v) => v switch
    {
        AlarmSeverity.Info => "INFO",
        AlarmSeverity.Warning => "WARNING",
        AlarmSeverity.Alarm => "ALARM",
        AlarmSeverity.Trip => "TRIP",
        _ => throw Unmapped(v),
    };

    public static AlarmSeverity ParseAlarmSeverity(string? s) => s switch
    {
        "INFO" => AlarmSeverity.Info,
        "WARNING" => AlarmSeverity.Warning,
        "ALARM" => AlarmSeverity.Alarm,
        "TRIP" => AlarmSeverity.Trip,
        _ => throw Unparsable<AlarmSeverity>(s),
    };

    // --------------------------------------------------------------- TwinSection
    public static string ToWire(this TwinSection v) => v switch
    {
        TwinSection.Stand => "STAND",
        TwinSection.RollBite => "ROLL_BITE",
        TwinSection.EntryReel => "ENTRY_REEL",
        TwinSection.ExitReel => "EXIT_REEL",
        TwinSection.Hydraulics => "HYDRAULICS",
        TwinSection.Drive => "DRIVE",
        TwinSection.GaugeEntry => "GAUGE_ENTRY",
        TwinSection.GaugeExit => "GAUGE_EXIT",
        TwinSection.Strip => "STRIP",
        _ => throw Unmapped(v),
    };

    public static TwinSection ParseTwinSection(string? s) => s switch
    {
        "STAND" => TwinSection.Stand,
        "ROLL_BITE" => TwinSection.RollBite,
        "ENTRY_REEL" => TwinSection.EntryReel,
        "EXIT_REEL" => TwinSection.ExitReel,
        "HYDRAULICS" => TwinSection.Hydraulics,
        "DRIVE" => TwinSection.Drive,
        "GAUGE_ENTRY" => TwinSection.GaugeEntry,
        "GAUGE_EXIT" => TwinSection.GaugeExit,
        "STRIP" => TwinSection.Strip,
        _ => throw Unparsable<TwinSection>(s),
    };

    // ------------------------------------------------------- MachineEventCategory
    public static string ToWire(this MachineEventCategory v) => v switch
    {
        MachineEventCategory.State => "STATE",
        MachineEventCategory.Pass => "PASS",
        MachineEventCategory.Setpoint => "SETPOINT",
        MachineEventCategory.Alarm => "ALARM",
        MachineEventCategory.Comms => "COMMS",
        MachineEventCategory.Operator => "OPERATOR",
        _ => throw Unmapped(v),
    };

    public static MachineEventCategory ParseMachineEventCategory(string? s) => s switch
    {
        "STATE" => MachineEventCategory.State,
        "PASS" => MachineEventCategory.Pass,
        "SETPOINT" => MachineEventCategory.Setpoint,
        "ALARM" => MachineEventCategory.Alarm,
        "COMMS" => MachineEventCategory.Comms,
        "OPERATOR" => MachineEventCategory.Operator,
        _ => throw Unparsable<MachineEventCategory>(s),
    };

    // ------------------------------------------------------------------ ScenarioId
    public static string ToWire(this ScenarioId v) => v switch
    {
        ScenarioId.Normal => "NORMAL",
        ScenarioId.HighForce => "HIGH_FORCE",
        ScenarioId.ThicknessExcursion => "THICKNESS_EXCURSION",
        ScenarioId.AgcOff => "AGC_OFF",
        ScenarioId.HydraulicLow => "HYDRAULIC_LOW",
        ScenarioId.GaugeNotReady => "GAUGE_NOT_READY",
        ScenarioId.CommunicationLoss => "COMMUNICATION_LOSS",
        ScenarioId.EmergencyStop => "EMERGENCY_STOP",
        _ => throw Unmapped(v),
    };

    public static bool TryParseScenarioId(string? s, out ScenarioId v)
    {
        switch (s)
        {
            case "NORMAL": v = ScenarioId.Normal; return true;
            case "HIGH_FORCE": v = ScenarioId.HighForce; return true;
            case "THICKNESS_EXCURSION": v = ScenarioId.ThicknessExcursion; return true;
            case "AGC_OFF": v = ScenarioId.AgcOff; return true;
            case "HYDRAULIC_LOW": v = ScenarioId.HydraulicLow; return true;
            case "GAUGE_NOT_READY": v = ScenarioId.GaugeNotReady; return true;
            case "COMMUNICATION_LOSS": v = ScenarioId.CommunicationLoss; return true;
            case "EMERGENCY_STOP": v = ScenarioId.EmergencyStop; return true;
            default: v = default; return false;
        }
    }

    public static ScenarioId ParseScenarioId(string? s) =>
        TryParseScenarioId(s, out var v) ? v : throw Unparsable<ScenarioId>(s);

    // ------------------------------------------------------------------- reflection
    // The typed methods above are what application code calls. These two exist for the JSON
    // converter and the golden-fixture flattener, which only know they are holding "some domain
    // enum" and still have to produce the same wire string the typed path would.

    /// <summary>The wire name of any domain enum value.</summary>
    public static string WireOf(Enum e) => e switch
    {
        Provenance v => v.ToWire(),
        LiveAvailability v => v.ToWire(),
        TagQuality v => v.ToWire(),
        TagStatus v => v.ToWire(),
        MachineStatus v => v.ToWire(),
        RollingDirection v => v.ToWire(),
        OperatingMode v => v.ToWire(),
        Health v => v.ToWire(),
        CtrlState v => v.ToWire(),
        ReelRole v => v.ToWire(),
        ReelId v => v.ToWire(),
        ReelStatus v => v.ToWire(),
        BrakeState v => v.ToWire(),
        AlarmSeverity v => v.ToWire(),
        TwinSection v => v.ToWire(),
        MachineEventCategory v => v.ToWire(),
        ScenarioId v => v.ToWire(),
        _ => throw new ArgumentOutOfRangeException(
            nameof(e), e, $"No wire mapping for enum type {e.GetType().Name}."),
    };

    /// <summary>Parse a wire name back to a value of the given domain enum type.</summary>
    public static object ParseWire(Type type, string? s)
    {
        if (type == typeof(Provenance)) return ParseProvenance(s);
        if (type == typeof(LiveAvailability)) return ParseLiveAvailability(s);
        if (type == typeof(TagQuality)) return ParseTagQuality(s);
        if (type == typeof(TagStatus)) return ParseTagStatus(s);
        if (type == typeof(MachineStatus)) return ParseMachineStatus(s);
        if (type == typeof(RollingDirection)) return ParseRollingDirection(s);
        if (type == typeof(OperatingMode)) return ParseOperatingMode(s);
        if (type == typeof(Health)) return ParseHealth(s);
        if (type == typeof(CtrlState)) return ParseCtrlState(s);
        if (type == typeof(ReelRole)) return ParseReelRole(s);
        if (type == typeof(ReelId)) return ParseReelId(s);
        if (type == typeof(ReelStatus)) return ParseReelStatus(s);
        if (type == typeof(BrakeState))
        {
            return TryParseBrakeState(s, out var b) ? b : throw Unparsable<BrakeState>(s);
        }

        if (type == typeof(AlarmSeverity)) return ParseAlarmSeverity(s);
        if (type == typeof(TwinSection)) return ParseTwinSection(s);
        if (type == typeof(MachineEventCategory)) return ParseMachineEventCategory(s);
        if (type == typeof(ScenarioId)) return ParseScenarioId(s);

        throw new ArgumentOutOfRangeException(nameof(type), type, $"No wire mapping for enum type {type.Name}.");
    }

    // ----------------------------------------------------------------- diagnostics
    private static ArgumentOutOfRangeException Unmapped<T>(T value) where T : struct, Enum =>
        new(nameof(value), value, $"{typeof(T).Name} member '{value}' has no wire name.");

    private static FormatException Unparsable<T>(string? s) where T : struct, Enum =>
        new($"'{s ?? "<null>"}' is not a valid {typeof(T).Name} wire value.");
}
