using Crm04.Domain.Types;

namespace Crm04.Web.Components.Common;

/// <summary>
/// Pill styling for health and control states. Port of the style maps in
/// <c>src/components/common/Panel.tsx</c>.
///
/// NOTE HOW NO_TAG IS STYLED IN BOTH: dashed border, no fill. It must not read as a state the
/// mill is in - "nothing on this feed tells us" is a different fact from OFF, and an operator has
/// to be able to see which one they are looking at (§7.4).
/// </summary>
public static class Pills
{
    public static string HealthClass(Health health) => health switch
    {
        Health.Healthy => "text-healthy border-healthy/40 bg-healthy/10",
        Health.Warning => "text-warning border-warning/40 bg-warning/10",
        Health.Fault => "text-alarm border-alarm/50 bg-alarm/10",
        Health.Off => "text-text-faint border-line bg-transparent",
        Health.NoTag => "text-prov-notag border-prov-notag/60 border-dashed bg-transparent",
        _ => "text-text-faint border-line bg-transparent",
    };

    public static string HealthText(Health health) => health switch
    {
        Health.Healthy => "HEALTHY",
        Health.Warning => "WARNING",
        Health.Fault => "FAULT",
        Health.Off => "OFF",
        Health.NoTag => "NO TAG",
        _ => "UNKNOWN",
    };

    public static string CtrlClass(CtrlState state) => state switch
    {
        CtrlState.On => "text-healthy border-healthy/40 bg-healthy/10",
        CtrlState.Off => "text-text-faint border-line bg-transparent",
        CtrlState.Fault => "text-alarm border-alarm/50 bg-alarm/10",
        CtrlState.NoTag => "text-prov-notag border-prov-notag/60 border-dashed bg-transparent",
        _ => "text-text-faint border-line bg-transparent",
    };

    public static string CtrlText(CtrlState state) => state switch
    {
        CtrlState.On => "ON",
        CtrlState.Off => "OFF",
        CtrlState.Fault => "FAULT",
        CtrlState.NoTag => "NO TAG",
        _ => "—",
    };
}
