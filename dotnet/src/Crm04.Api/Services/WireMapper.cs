using Crm04.Contracts;
using Crm04.Domain.Machine;
using Crm04.Domain.Tags;
using Crm04.Domain.Types;

namespace Crm04.Api.Services;

/// <summary>
/// Domain objects to wire DTOs. The one place the two shapes meet, so a change to the contract
/// shows up here rather than being scattered across controllers and the hub.
/// </summary>
public static class WireMapper
{
    /// <summary>
    /// The catalogue for one operating mode. Provenance is RESOLVED HERE, on the server: the
    /// client is told what badge a tag carries, never given the inputs to decide for itself.
    /// </summary>
    public static TagCatalogDto Catalog(OperatingMode mode)
    {
        var entries = new TagCatalogEntryDto[TagCatalog.Count];
        foreach (var def in TagCatalog.All)
        {
            entries[def.Ordinal] = new TagCatalogEntryDto(
                TagName: def.TagName,
                Description: def.Description,
                Unit: def.Unit,
                Decimals: def.Decimals,
                Provenance: TagFactory.ResolveProvenance(def, mode),
                LiveNote: def.LiveNote,
                Limits: def.Limits.IsEmpty ? null : new TagLimitsDto(
                    def.Limits.Low, def.Limits.High,
                    def.Limits.WarningLow, def.Limits.WarningHigh,
                    def.Limits.AlarmLow, def.Limits.AlarmHigh,
                    def.Limits.TripHigh));
        }

        // The etag covers the catalogue size and the mode, which is everything that can change
        // its content without a redeploy. A rebuild with a regenerated catalogue changes the
        // count or the assembly, and clients re-fetch.
        var etag = $"{mode.ToWire()}-{TagCatalog.Count}-{typeof(TagCatalog).Assembly.ManifestModule.ModuleVersionId:N}";
        return new TagCatalogDto(mode, etag, entries);
    }

    /// <summary>
    /// A tag frame as parallel ordinal-indexed arrays.
    ///
    /// Note the two distinct ways a slot can hold nothing. <c>Present[i] = 0</c> means the feed
    /// carries no such tag; <c>Present[i] = 1</c> with a null <c>Num[i]</c> means it carries the
    /// tag and the tag reads nothing. Collapsing those would lose the difference between "not
    /// instrumented" and "instrument down", which is exactly what §7.4 is about.
    /// </summary>
    public static CompactFrameDto Frame(long frameId, TagFrame tags)
    {
        var n = TagCatalog.Count;
        var num = new double?[n];
        var status = new byte[n];
        var quality = new byte[n];
        var present = new byte[n];
        var strIx = new List<int>();
        var str = new List<string>();

        foreach (var tag in tags.Tags)
        {
            var ordinal = TagCatalog.OrdinalOf(tag.TagName);

            // A tag the catalogue does not know has no slot on the wire. Dropping it is correct:
            // TagFactory has already marked it BAD and discarded its value, so there is nothing
            // to send. Putting it anywhere else in the array would corrupt another tag's reading.
            if (ordinal is null) continue;

            var i = ordinal.Value;
            present[i] = 1;
            status[i] = (byte)tag.Status;
            quality[i] = (byte)tag.Quality;

            switch (tag.Value.Kind)
            {
                case TagValueKind.Number:
                    num[i] = tag.Value.AsRawNumber;
                    break;
                case TagValueKind.Boolean:
                    // Booleans ride the numeric array as 0/1. The client reads them back through
                    // the catalogue, which knows which tags are status words.
                    num[i] = tag.Value.AsBoolean == true ? 1d : 0d;
                    break;
                case TagValueKind.String:
                    strIx.Add(i);
                    str.Add(tag.Value.AsString!);
                    break;
                case TagValueKind.Null:
                default:
                    break;
            }
        }

        return new CompactFrameDto(
            FrameId: frameId,
            Ts: tags.Timestamp,
            Num: num,
            StrIx: [.. strIx],
            Str: [.. str],
            Status: status,
            Quality: quality,
            Present: present);
    }

    public static MillSummaryDto Summary(MachineState s) => new(
        MachineStatus: s.MachineStatus,
        StatusLabel: MachineStatusRules.Label(s.MachineStatus),
        StatusReason: s.StatusReason,
        Direction: s.RollingDirection,
        Mode: s.OperatingMode,
        PassCurrent: s.Pass.Current,
        PassTotal: s.Pass.Total,
        PassProgress: s.Pass.Progress,
        ForcePercentage: s.RollingForce.Percentage,
        TorquePercentage: s.Drive.TorquePercentage,
        // These three are DERIVED in the projection rather than carried as tags, so they travel
        // here rather than in the frame. They are still the projection's numbers - the UI does not
        // recompute them, which is what keeps §18 true.
        EntrySpecificTension: s.Tension.EntrySpecific,
        ExitSpecificTension: s.Tension.ExitSpecific,
        RollGapDeviation: s.RollGap.Deviation,
        ThroughputTph: RollingEngine.Throughput(s),
        // Null rather than zero at standstill: specific energy per tonne of nothing is undefined,
        // and a displayed 0.0 kWh/t would read as a measured efficiency.
        SpecificEnergyKwhT: RollingEngine.Throughput(s) > 0.01d ? RollingEngine.SpecificEnergy(s) : null,
        PassTimeRemainingSeconds: RollingEngine.PassTimeRemaining(s),
        CoilId: s.Coil.Id,
        CoilGrade: s.Coil.Grade,
        Communication: new CommStateDto(
            Connected: s.Communication.Connected,
            SourceName: s.Communication.SourceName,
            LastFrameTimestamp: s.Communication.LastFrameTimestamp,
            AgeMs: s.Communication.AgeMs,
            Stale: s.Communication.Stale,
            UpdateRateHz: s.Communication.UpdateRateHz,
            FramesReceived: s.Communication.FramesReceived),
        Systems: new SystemStatusDto(
            MillInterlock: s.Interlocks.Mill,
            DriveReady: s.Interlocks.Drive,
            HydraulicReady: s.Interlocks.Hydraulic,
            GaugeReady: s.Interlocks.Gauge,
            TensionReady: s.Interlocks.Tension,
            EmergencyStop: s.Interlocks.EmergencyStop,
            Agc: s.Controls.Agc,
            Bending: s.Controls.Bending,
            MassFlowControl: s.Controls.Mfc,
            PositionMode: s.Controls.PositionMode,
            TensionRegulation: s.Controls.Trf,
            Coolant: s.AuxiliarySystems.Coolant,
            Lubrication: s.AuxiliarySystems.Lubrication,
            Exhaust: s.AuxiliarySystems.Exhaust));

    public static AlarmDto Alarm(AlarmCondition a) => new(
        a.Id, a.Severity, a.Parameter, a.TagName, a.ActualValue, a.Limit, a.Unit, a.Message, a.Section);

    /// <summary>
    /// The interlock chain plus the §13.2 readout. The title is computed here rather than in the
    /// UI because the "MILL READY UNVERIFIED" versus "MILL NOT READY" distinction is a domain
    /// rule about missing tags, not a presentation choice.
    /// </summary>
    public static InterlockChainDto Interlocks(InterlockChain chain)
    {
        var readout = InterlockEngine.Readout(chain);
        return new InterlockChainDto(
            Nodes: chain.Nodes.Select(n => new InterlockNodeDto(n.Id, n.Label, n.Ok, n.Reason)).ToList(),
            MillReady: chain.MillReady,
            BlockingReason: chain.BlockingReason,
            Title: readout.Title,
            Reason: readout.Reason,
            Unverified: readout.Unverified);
    }
}
