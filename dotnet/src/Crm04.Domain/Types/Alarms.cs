namespace Crm04.Domain.Types;

/// <summary>
/// Port of <c>src/types/alarms.ts</c> - the latched alarm as the UI sees it.
///
/// The pure rule evaluation produces an <see cref="AlarmCondition"/>; latching, acknowledgement
/// and clear-time bookkeeping turn that into an <see cref="Alarm"/>. Keeping them as two types
/// is what lets the rules stay a pure function of <see cref="MachineState"/>.
/// </summary>
/// <param name="Id">Stable rule id, e.g. <c>HIGH_ROLLING_FORCE</c>.</param>
/// <param name="Parameter">Human-readable parameter name, e.g. "Rolling force".</param>
/// <param name="TagName">Tag the rule watches - lets the UI highlight the affected section.</param>
/// <param name="Section">Twin section to highlight while this alarm is active (§17 test 7).</param>
/// <param name="ClearedAt">When the alarm cleared, if it has.</param>
public sealed record Alarm(
    string Id,
    long Timestamp,
    AlarmSeverity Severity,
    string Parameter,
    string TagName,
    double ActualValue,
    double Limit,
    string Unit,
    string Message,
    bool Acknowledged,
    bool Active,
    long? ClearedAt = null,
    TwinSection? Section = null);

/// <summary>
/// One violated rule at one instant. Produced by the pure alarm engine; carries no timestamp,
/// no acknowledgement and no active flag, because none of those are properties of the rule -
/// they belong to the latching layer above it.
/// </summary>
public sealed record AlarmCondition(
    string Id,
    AlarmSeverity Severity,
    string Parameter,
    string TagName,
    double ActualValue,
    double Limit,
    string Unit,
    string Message,
    TwinSection? Section = null);

/// <summary>
/// One link in the interlock chain. <paramref name="Reason"/> is never empty when
/// <paramref name="Ok"/> is false - §13.2 forbids showing a bare "NOT READY".
/// </summary>
public sealed record InterlockNode(string Id, string Label, bool Ok, string Reason);

/// <param name="BlockingReason">First failing node, used for the "Reason: …" line. Null when ready.</param>
public sealed record InterlockChain(
    IReadOnlyList<InterlockNode> Nodes,
    bool MillReady,
    string? BlockingReason)
{
    public static readonly InterlockChain Empty = new([], false, "NO DATA");
}
