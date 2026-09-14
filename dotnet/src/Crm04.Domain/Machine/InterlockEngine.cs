using Crm04.Domain.Types;

namespace Crm04.Domain.Machine;

/// <summary>
/// Inputs to the interlock chain. A null member means the active feed carries NO TAG for that
/// link - which is a third state, not a false.
/// </summary>
/// <param name="CommunicationHealthy">
/// False when the data feed is stale or lost. Not nullable: we always know whether OUR OWN link
/// is alive, even when we know nothing about the mill's.
/// </param>
public readonly record struct InterlockInputs(
    bool? DriveReady,
    bool? HydraulicReady,
    bool? TensionReady,
    bool? GaugeReady,
    bool? EmergencyStop,
    bool? FastStop,
    bool CommunicationHealthy)
{
    /// <summary>
    /// Gather the inputs from a projected state. Fast stop is derived from the machine status
    /// rather than from a tag, because FAST_STOP is a mill state and there is no separate status
    /// word for it on either feed.
    /// </summary>
    public static InterlockInputs From(MachineState state) => new(
        DriveReady: state.Interlocks.Drive,
        HydraulicReady: state.Interlocks.Hydraulic,
        TensionReady: state.Interlocks.Tension,
        GaugeReady: state.Interlocks.Gauge,
        EmergencyStop: state.Interlocks.EmergencyStop,
        FastStop: state.MachineStatus == MachineStatus.FastStop,
        CommunicationHealthy: state.Communication.Connected && !state.Communication.Stale);
}

/// <summary>
/// INTERLOCK ENGINE - §13.2 of the master spec. Port of <c>src/machine/interlockEngine.ts</c>.
///
///   DRIVE ✓ -&gt; HYDRAULIC ✓ -&gt; TENSION ✓ -&gt; GAUGE ✓ -&gt; MILL READY ✓
///
///   MILL READY = Drive Ready AND Hydraulic Ready AND Tension Ready AND Gauge Ready
///                AND NOT E-Stop AND NOT critical interlock
///
/// On failure the chain NAMES THE CAUSE. A bare "MILL NOT READY" is explicitly forbidden, so
/// <see cref="InterlockChain.BlockingReason"/> is always populated when the mill is not ready.
///
/// THREE STATES, NOT TWO. A link can be OK, BLOCKED, or NO_TAG - because on the CRM04 46-tag feed
/// there are no interlock status words at all (§7.4). Reporting "MAIN DRIVE NOT READY" when the
/// truth is "nothing on this feed tells us" would be exactly the plausible-looking falsehood the
/// provenance contract exists to prevent. The mill is still held not-ready, because a mill whose
/// interlocks cannot be verified must not be treated as ready - but the operator is told which of
/// the two situations they are in.
/// </summary>
public static class InterlockEngine
{
    /// <summary>
    /// The suffix that marks a link as unknown rather than blocked. Matched by string on purpose:
    /// it is the same test the TypeScript makes, and it is what
    /// <see cref="Readout"/> keys "MILL READY UNVERIFIED" off.
    /// </summary>
    public const string NoTagSuffix = "NO TAG ON THIS FEED";

    private static InterlockNode BuildNode(string id, string label, bool? ok, string blockedReason, string tagLabel)
    {
        if (ok is null)
        {
            return new InterlockNode(id, label, Ok: false, Reason: $"{tagLabel} — {NoTagSuffix}");
        }

        return new InterlockNode(id, label, Ok: ok.Value, Reason: ok.Value ? string.Empty : blockedReason);
    }

    /// <summary>
    /// Evaluate the chain IN ORDER. The first failing link is the blocking reason, because on a
    /// real mill that is the one the operator has to go and fix - the downstream links are usually
    /// failing BECAUSE of it.
    ///
    /// A definitively BLOCKED link outranks a missing one: if the drive is genuinely faulted and
    /// the gauge status simply has no tag, the fault is what matters.
    /// </summary>
    public static InterlockChain Evaluate(InterlockInputs inputs)
    {
        var nodes = new InterlockNode[]
        {
            BuildNode(
                "ESTOP", "EMERGENCY STOP",
                inputs.EmergencyStop is null ? null : !inputs.EmergencyStop.Value,
                "EMERGENCY STOP ACTIVE", "EMERGENCY STOP STATUS"),
            BuildNode(
                "FAST_STOP", "FAST STOP",
                inputs.FastStop is null ? null : !inputs.FastStop.Value,
                "FAST STOP ACTIVE", "FAST STOP STATUS"),
            BuildNode(
                "COMMS", "DATA FEED",
                inputs.CommunicationHealthy,
                "DATA FEED STALE OR LOST", "DATA FEED"),
            BuildNode(
                "DRIVE", "DRIVE READY",
                inputs.DriveReady,
                "MAIN DRIVE NOT READY", "MAIN DRIVE READY"),
            BuildNode(
                "HYDRAULIC", "HYDRAULIC READY",
                inputs.HydraulicReady,
                "HYDRAULIC SYSTEM NOT READY", "HYDRAULIC READY"),
            BuildNode(
                "TENSION", "TENSION READY",
                inputs.TensionReady,
                "REEL TENSION NOT READY", "REEL TENSION READY"),
            BuildNode(
                "GAUGE", "GAUGE READY",
                inputs.GaugeReady,
                "ETR GAUGE NOT READY", "GAUGE READY"),
        };

        // A genuinely blocked link is reported ahead of a merely unknown one.
        var definitelyBlocked = Array.Find(nodes, n => !n.Ok && !n.Reason.EndsWith(NoTagSuffix, StringComparison.Ordinal));
        var firstFailure = definitelyBlocked ?? Array.Find(nodes, n => !n.Ok);

        return new InterlockChain(
            Nodes: nodes,
            MillReady: firstFailure is null,
            BlockingReason: firstFailure?.Reason);
    }

    /// <summary>
    /// Formatted two-line readout for the interlock panel (§13.2).
    ///
    /// "MILL READY UNVERIFIED" rather than "MILL NOT READY" when the only thing stopping it is a
    /// missing tag: the mill may well be ready, we simply cannot see it from here. Both are held
    /// as not-ready by <see cref="InterlockChain.MillReady"/>.
    /// </summary>
    public static InterlockReadout Readout(InterlockChain chain)
    {
        if (chain.MillReady) return new InterlockReadout("MILL READY", null, Unverified: false);

        var unverified = chain.BlockingReason?.EndsWith(NoTagSuffix, StringComparison.Ordinal) ?? false;
        return new InterlockReadout(
            Title: unverified ? "MILL READY UNVERIFIED" : "MILL NOT READY",
            Reason: $"Reason: {chain.BlockingReason ?? "UNKNOWN INTERLOCK"}",
            Unverified: unverified);
    }
}

public readonly record struct InterlockReadout(string Title, string? Reason, bool Unverified);
