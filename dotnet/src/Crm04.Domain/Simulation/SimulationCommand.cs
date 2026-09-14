using Crm04.Domain.Types;

namespace Crm04.Domain.Simulation;

/// <summary>What an operator can ask the simulated mill to do. Port of the TypeScript
/// <c>SimulationCommandType</c> union.</summary>
public enum SimulationCommandType
{
    Start,
    Stop,
    FastStop,
    Reset,
    SetSpeedReference,
    TrimSpeedReference,
    TrimRollGap,
    SetAgc,
    TrimEntryTension,
    TrimExitTension,
    LoadNextCoil,
    SetScenario,
    SetAuxHealth,
}

/// <summary>
/// The auxiliary systems whose health an operator can toggle.
///
/// WIRE FORMAT WARNING. Unlike every other enum in this codebase these are camelCase on the wire -
/// <c>"lpSystem"</c>, <c>"hpLoading"</c>, <c>"hpBending"</c> - because the TypeScript declares
/// them as object keys rather than as a screaming-snake union. The general
/// <c>WireEnumConverter</c> would serialise them as <c>LP_SYSTEM</c>, and a SET_AUX_HEALTH
/// command would then fail to bind and return 400 with nothing in the log explaining why. See
/// <see cref="AuxSystemNames"/>.
/// </summary>
public enum AuxSystem
{
    Lubrication,
    Coolant,
    Exhaust,
    LpSystem,
    HpLoading,
    HpBending,
}

/// <summary>The camelCase wire names for <see cref="AuxSystem"/>. See that type's remarks.</summary>
public static class AuxSystemNames
{
    public static string ToWire(this AuxSystem v) => v switch
    {
        AuxSystem.Lubrication => "lubrication",
        AuxSystem.Coolant => "coolant",
        AuxSystem.Exhaust => "exhaust",
        AuxSystem.LpSystem => "lpSystem",
        AuxSystem.HpLoading => "hpLoading",
        AuxSystem.HpBending => "hpBending",
        _ => throw new ArgumentOutOfRangeException(nameof(v), v, "No wire name for this AuxSystem."),
    };

    public static bool TryParse(string? s, out AuxSystem v)
    {
        switch (s)
        {
            case "lubrication": v = AuxSystem.Lubrication; return true;
            case "coolant": v = AuxSystem.Coolant; return true;
            case "exhaust": v = AuxSystem.Exhaust; return true;
            case "lpSystem": v = AuxSystem.LpSystem; return true;
            case "hpLoading": v = AuxSystem.HpLoading; return true;
            case "hpBending": v = AuxSystem.HpBending; return true;
            default: v = default; return false;
        }
    }
}

/// <summary>
/// One operator command. Port of the TypeScript <c>SimulationCommand</c> interface.
///
/// EVERY OPTIONAL FIELD IS NULLABLE, AND THAT IS LOAD-BEARING. The TypeScript reads
/// <c>cmd.flag ?? true</c> and <c>cmd.value ?? 0</c> - defaults that fire on <c>undefined</c>. A
/// non-nullable <c>bool Flag</c> here would bind absent JSON to <c>false</c>, so a
/// <c>SET_AGC</c> command with no flag would turn AGC OFF instead of on. No exception, no log
/// line, and an operator watching the gauge wander. The engine unwraps each one exactly once,
/// with the TypeScript's own default, at the top of its switch arm.
/// </summary>
public sealed record SimulationCommand(
    SimulationCommandType Type,
    double? Value = null,
    bool? Flag = null,
    ScenarioId? Scenario = null,
    AuxSystem? System = null);

/// <summary>Wire names for <see cref="SimulationCommandType"/>, matching the TypeScript union.</summary>
public static class SimulationCommandNames
{
    public static string ToWire(this SimulationCommandType v) => v switch
    {
        SimulationCommandType.Start => "START",
        SimulationCommandType.Stop => "STOP",
        SimulationCommandType.FastStop => "FAST_STOP",
        SimulationCommandType.Reset => "RESET",
        SimulationCommandType.SetSpeedReference => "SET_SPEED_REFERENCE",
        SimulationCommandType.TrimSpeedReference => "TRIM_SPEED_REFERENCE",
        SimulationCommandType.TrimRollGap => "TRIM_ROLL_GAP",
        SimulationCommandType.SetAgc => "SET_AGC",
        SimulationCommandType.TrimEntryTension => "TRIM_ENTRY_TENSION",
        SimulationCommandType.TrimExitTension => "TRIM_EXIT_TENSION",
        SimulationCommandType.LoadNextCoil => "LOAD_NEXT_COIL",
        SimulationCommandType.SetScenario => "SET_SCENARIO",
        SimulationCommandType.SetAuxHealth => "SET_AUX_HEALTH",
        _ => throw new ArgumentOutOfRangeException(nameof(v), v, "No wire name for this command."),
    };

    /// <summary>Every accepted command, in declaration order - quoted back in a 400 response.</summary>
    public static IReadOnlyList<string> All { get; } =
        Enum.GetValues<SimulationCommandType>().Select(ToWire).ToArray();

    public static bool TryParse(string? s, out SimulationCommandType v)
    {
        foreach (var candidate in Enum.GetValues<SimulationCommandType>())
        {
            if (string.Equals(candidate.ToWire(), s, StringComparison.Ordinal))
            {
                v = candidate;
                return true;
            }
        }

        v = default;
        return false;
    }
}
