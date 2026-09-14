using Crm04.Domain.Machine;
using Crm04.Domain.Projection;
using Crm04.Domain.Types;
using Shouldly;

namespace Crm04.Domain.Tests;

/// <summary>
/// The three-state interlock rule (§13.2). OK / BLOCKED / NO_TAG, and the difference between the
/// last two is what the operator is actually told.
/// </summary>
public class InterlockEngineTests
{
    private static InterlockInputs AllGood() => new(
        DriveReady: true,
        HydraulicReady: true,
        TensionReady: true,
        GaugeReady: true,
        EmergencyStop: false,
        FastStop: false,
        CommunicationHealthy: true);

    [Fact]
    public void EverythingHealthyMakesTheMillReadyWithNoReason()
    {
        var chain = InterlockEngine.Evaluate(AllGood());

        chain.MillReady.ShouldBeTrue();
        chain.BlockingReason.ShouldBeNull();
        chain.Nodes.Count.ShouldBe(7);
        chain.Nodes.ShouldAllBe(n => n.Ok);

        InterlockEngine.Readout(chain).Title.ShouldBe("MILL READY");
    }

    [Fact]
    public void ABlockedLinkNamesItsCauseNeverABareNotReady()
    {
        var chain = InterlockEngine.Evaluate(AllGood() with { HydraulicReady = false });

        chain.MillReady.ShouldBeFalse();
        chain.BlockingReason.ShouldBe("HYDRAULIC SYSTEM NOT READY");

        var readout = InterlockEngine.Readout(chain);
        readout.Title.ShouldBe("MILL NOT READY");
        readout.Reason.ShouldBe("Reason: HYDRAULIC SYSTEM NOT READY");
        readout.Unverified.ShouldBeFalse();
    }

    [Fact]
    public void AMissingTagHoldsTheMillButReportsItAsUnverified()
    {
        // The CRM04 46-tag feed has no interlock status words at all. Reporting "MAIN DRIVE NOT
        // READY" when the truth is "nothing on this feed tells us" would be exactly the
        // plausible-looking falsehood the provenance contract exists to prevent.
        var chain = InterlockEngine.Evaluate(AllGood() with { DriveReady = null });

        chain.MillReady.ShouldBeFalse();
        chain.BlockingReason.ShouldBe($"MAIN DRIVE READY — {InterlockEngine.NoTagSuffix}");

        var readout = InterlockEngine.Readout(chain);
        readout.Title.ShouldBe("MILL READY UNVERIFIED");
        readout.Unverified.ShouldBeTrue();
    }

    [Fact]
    public void ADefinitelyBlockedLinkOutranksAMerelyUnknownOneEvenWhenItComesLater()
    {
        // ESTOP is evaluated first and has no tag; HYDRAULIC is evaluated later and is genuinely
        // faulted. The fault is what the operator has to go and fix, so it is what gets reported.
        var chain = InterlockEngine.Evaluate(AllGood() with
        {
            EmergencyStop = null,
            HydraulicReady = false,
        });

        chain.MillReady.ShouldBeFalse();
        chain.BlockingReason.ShouldBe("HYDRAULIC SYSTEM NOT READY");
        InterlockEngine.Readout(chain).Unverified.ShouldBeFalse();
    }

    [Fact]
    public void TheFirstOfSeveralGenuineFailuresIsTheOneReported()
    {
        // Downstream links usually fail BECAUSE of the upstream one, so the chain reports the
        // earliest genuine failure rather than the last.
        var chain = InterlockEngine.Evaluate(AllGood() with
        {
            DriveReady = false,
            HydraulicReady = false,
            TensionReady = false,
        });

        chain.BlockingReason.ShouldBe("MAIN DRIVE NOT READY");
    }

    [Fact]
    public void AStaleFeedCannotArmTheMill()
    {
        var chain = InterlockEngine.Evaluate(AllGood() with { CommunicationHealthy = false });

        chain.MillReady.ShouldBeFalse();
        chain.BlockingReason.ShouldBe("DATA FEED STALE OR LOST");
    }

    [Fact]
    public void AnActiveEmergencyStopBlocksAheadOfEverythingElse()
    {
        var chain = InterlockEngine.Evaluate(AllGood() with { EmergencyStop = true, DriveReady = false });

        chain.BlockingReason.ShouldBe("EMERGENCY STOP ACTIVE");
    }

    [Fact]
    public void FastStopIsDerivedFromTheMillStatusNotFromATag()
    {
        // There is no fast-stop status word on either feed; FAST_STOP is a mill state.
        var state = MachineStateProjector.Empty(OperatingMode.Simulation);
        var inputs = InterlockInputs.From(state);

        inputs.FastStop.ShouldBe(false);
        state.MachineStatus.ShouldBe(MachineStatus.Idle);
    }
}

public class EmptyStateTests
{
    [Fact]
    public void EmptyStateShowsAnInertMillNotAPlausibleOne()
    {
        var state = MachineStateProjector.Empty(OperatingMode.Live);

        state.MachineStatus.ShouldBe(MachineStatus.Idle);
        state.StatusReason.ShouldBe(string.Empty);
        state.Speed.Actual.ShouldBe(0d);
        state.RollingForce.Actual.ShouldBe(0d);
        state.Communication.Connected.ShouldBeFalse();
        state.Communication.Stale.ShouldBeTrue();
        state.Communication.SourceName.ShouldBe("No source");
    }

    [Fact]
    public void EmptyStateRendersNoTagRatherThanZeroForEveryOptionalField()
    {
        var state = MachineStateProjector.Empty(OperatingMode.Live);

        state.RollGap.Reference.ShouldBeNull();
        state.RollGap.Deviation.ShouldBeNull();
        state.RollGap.Os.ShouldBeNull();
        state.Hydraulics.LoadingPressure.ShouldBeNull();
        state.Hydraulics.BendingPressure.ShouldBeNull();
        state.Rolls.UpperWork.BendingForce.ShouldBeNull();
        state.Gauges.Dtr.Thickness.ShouldBeNull();
        state.Coil.Grade.ShouldBeNull();
        state.Interlocks.Mill.ShouldBeNull();
        state.Tension.Dtr.Brake.ShouldBeNull();
    }

    [Fact]
    public void EmptyStateFallsBackToGeometryNotZeroWhereZeroWouldBeWrong()
    {
        var state = MachineStateProjector.Empty(OperatingMode.Live);

        // An empty mandrel is the physically correct "no coil" reading, and a zero-diameter reel
        // would divide by zero downstream.
        state.Tension.Dtr.Diameter.ShouldBe(508d);
        state.Coil.Diameter.ShouldBe(508d);

        // Roll geometry comes from config so the 3D scene renders even with no feed at all.
        state.Rolls.UpperWork.Diameter.ShouldBe(215d);
        state.Rolls.UpperBackup.Diameter.ShouldBe(550d);
        state.Rolls.UpperWork.BarrelLength.ShouldBe(600d);
    }

    [Fact]
    public void EmptyStateRaisesOnlyTheCommunicationAlarm()
    {
        var alarms = AlarmEngine.Evaluate(MachineStateProjector.Empty(OperatingMode.Live));

        alarms.Count.ShouldBe(1);
        alarms[0].Id.ShouldBe("COMMUNICATION_LOST");
        alarms[0].Message.ShouldBe("COMMUNICATION LOST — DATA SOURCE DISCONNECTED");

        // Critically, no HYDRAULIC_PRESSURE_LOW. An alarm engine that treated "no tag" as "zero"
        // would raise a permanent, meaningless pressure alarm on an empty feed (§7.4).
        alarms.ShouldNotContain(a => a.Id == "HYDRAULIC_PRESSURE_LOW");
    }
}
