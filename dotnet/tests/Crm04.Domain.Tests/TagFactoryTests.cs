using Crm04.Domain.Tags;
using Crm04.Domain.Types;
using Shouldly;

namespace Crm04.Domain.Tests;

/// <summary>
/// Rules the parity fixtures cannot reach, because the simulator never produces the inputs:
/// unknown tags, deliberately supplied values on unavailable tags, staleness.
/// </summary>
public class TagFactoryTests
{
    private const long Ts = 1_700_000_000_000L;

    [Fact]
    public void UnknownTagIsAnIntegrationErrorNotAValue()
    {
        var tag = TagFactory.MakeTag("MILL.NOT.A.REAL.TAG", TagValue.FromNumber(42d), Ts, OperatingMode.Live);

        // The number is discarded. Letting an unnamed value onto a screen is the failure mode
        // this rule exists to prevent (§14.5).
        tag.Value.IsNull.ShouldBeTrue();
        tag.Quality.ShouldBe(TagQuality.Bad);
        tag.Status.ShouldBe(TagStatus.Unknown);
        tag.Provenance.ShouldBe(Provenance.Unavailable);
        tag.Unit.ShouldBeNull();
        tag.Limits.IsEmpty.ShouldBeTrue();
    }

    [Fact]
    public void UnavailableTagDiscardsASuppliedValue()
    {
        // WR.TOP.BENDING has no tag on the real feed. A gateway that sends a number for it is
        // wrong, and showing that number would be worse than showing nothing.
        var def = TagCatalog.TryGet("WR.TOP.BENDING");
        def.ShouldNotBeNull();
        def.LiveAvailability.ShouldBe(LiveAvailability.Unavailable);

        var tag = TagFactory.MakeTag("WR.TOP.BENDING", TagValue.FromNumber(320d), Ts, OperatingMode.Live);

        tag.Value.IsNull.ShouldBeTrue();
        tag.Provenance.ShouldBe(Provenance.Unavailable);
        tag.Quality.ShouldBe(TagQuality.NoTag);
        tag.Status.ShouldBe(TagStatus.Unknown);
        tag.IsUnavailable.ShouldBeTrue();
    }

    [Fact]
    public void SameTagCarriesTheValueInSimulationAndNotOnTheLiveFeed()
    {
        var sim = TagFactory.MakeTag("WR.TOP.BENDING", TagValue.FromNumber(320d), Ts, OperatingMode.Simulation);
        var live = TagFactory.MakeTag("WR.TOP.BENDING", TagValue.FromNumber(320d), Ts, OperatingMode.Live);

        sim.Numeric.ShouldBe(320d);
        live.Numeric.ShouldBeNull();
    }

    [Fact]
    public void ASimulatedValueIsNeverGoodQuality()
    {
        foreach (var def in TagCatalog.All)
        {
            var tag = TagFactory.MakeTag(def.TagName, TagValue.FromNumber(1d), Ts, OperatingMode.Simulation);
            tag.Quality.ShouldNotBe(TagQuality.Good, $"{def.TagName} claimed instrument-grade quality in SIMULATION");
        }
    }

    [Fact]
    public void StaleMarksEveryTagExceptTheOnesThatHaveNoTagAtAll()
    {
        var raw = new Dictionary<string, TagValue>(StringComparer.Ordinal)
        {
            ["MILL.SPEED.ACTUAL"] = TagValue.FromNumber(180d),
            ["WR.TOP.BENDING"] = TagValue.FromNumber(320d),
        };

        var frame = TagFactory.MarkStale(TagFactory.MakeFrame(raw, Ts, OperatingMode.Live));

        frame.TryGet("MILL.SPEED.ACTUAL")!.Quality.ShouldBe(TagQuality.Stale);

        // Staleness cannot make an absent tag worse: NO_TAG already says everything there is to say.
        frame.TryGet("WR.TOP.BENDING")!.Quality.ShouldBe(TagQuality.NoTag);
    }

    [Fact]
    public void StalenessKeepsTheLastKnownValueRatherThanBlankingIt()
    {
        var raw = new Dictionary<string, TagValue>(StringComparer.Ordinal)
        {
            ["MILL.SPEED.ACTUAL"] = TagValue.FromNumber(180d),
        };

        var frame = TagFactory.MarkStale(TagFactory.MakeFrame(raw, Ts, OperatingMode.Live));

        // The value is still the last thing the mill told us. It is old, not absent - which is
        // why the UI strikes it through instead of replacing it with a dash.
        frame.TryGet("MILL.SPEED.ACTUAL")!.Numeric.ShouldBe(180d);
    }

    [Theory]
    [InlineData(100d, TagStatus.Normal)]
    [InlineData(288d, TagStatus.Warning)]      // warningHigh = 360 * 0.8
    [InlineData(331.2d, TagStatus.Alarm)]      // alarmHigh   = 360 * 0.92
    [InlineData(360d, TagStatus.Trip)]         // tripHigh    = 360
    [InlineData(500d, TagStatus.Trip)]
    public void StatusPrecedenceIsTripThenAlarmThenWarning(double force, TagStatus expected)
    {
        var tag = TagFactory.MakeTag("ROLL.FORCE.ACTUAL", TagValue.FromNumber(force), Ts, OperatingMode.Simulation);
        tag.Status.ShouldBe(expected);
    }

    [Fact]
    public void ANonNumericValueIsUnknownRatherThanNormal()
    {
        // "We cannot judge this" is not the same statement as "this is fine".
        var def = TagCatalog.TryGet("ROLL.FORCE.ACTUAL")!;

        TagFactory.EvaluateStatus(def, TagValue.Null).ShouldBe(TagStatus.Unknown);
        TagFactory.EvaluateStatus(def, TagValue.FromString("HIGH")).ShouldBe(TagStatus.Unknown);
        TagFactory.EvaluateStatus(def, TagValue.FromNumber(double.NaN)).ShouldBe(TagStatus.Unknown);
        TagFactory.EvaluateStatus(def, TagValue.FromNumber(double.PositiveInfinity)).ShouldBe(TagStatus.Unknown);
    }

    [Fact]
    public void AbsentAndNullAreDifferentThings()
    {
        var raw = new Dictionary<string, TagValue>(StringComparer.Ordinal)
        {
            ["MILL.SPEED.ACTUAL"] = TagValue.Null,
        };

        var frame = TagFactory.MakeFrame(raw, Ts, OperatingMode.Live);

        // Present but null: the feed carries the tag and it is currently reading nothing.
        frame.Contains("MILL.SPEED.ACTUAL").ShouldBeTrue();
        frame.Numeric("MILL.SPEED.ACTUAL").ShouldBeNull();

        // Absent: the feed has no such tag at all.
        frame.Contains("MILL.SPEED.REF").ShouldBeFalse();
        frame.Numeric("MILL.SPEED.REF").ShouldBeNull();
    }
}

public class TagCatalogTests
{
    [Fact]
    public void OrdinalsAreDenseUniqueAndMatchArrayPosition()
    {
        // The compact frame DTO is an array indexed by ordinal. If ordinals were sparse,
        // duplicated, or out of step with the array, every value on the wire would land in the
        // wrong slot - a bug that would look like plausible readings on the wrong gauges.
        for (var i = 0; i < TagCatalog.All.Count; i++)
        {
            TagCatalog.All[i].Ordinal.ShouldBe(i);
        }

        TagCatalog.All.Select(d => d.Ordinal).Distinct().Count().ShouldBe(TagCatalog.Count);
    }

    [Fact]
    public void TagNamesAreUniqueAndResolvable()
    {
        TagCatalog.All.Select(d => d.TagName).Distinct().Count().ShouldBe(TagCatalog.Count);

        foreach (var def in TagCatalog.All)
        {
            TagCatalog.TryGet(def.TagName).ShouldBeSameAs(def);
            TagCatalog.OrdinalOf(def.TagName).ShouldBe(def.Ordinal);
        }
    }

    [Fact]
    public void InventoryCountsSumToTheCatalogue()
    {
        var inv = TagCatalog.Inventory;
        var sum = inv.MeasuredOnLiveFeed + inv.ReferenceOnLiveFeed + inv.CalculatedOnLiveFeed +
                  inv.EstimatedOnLiveFeed + inv.UnavailableOnLiveFeed;

        sum.ShouldBe(inv.Total);
        inv.Total.ShouldBe(TagCatalog.Count);
    }

    [Fact]
    public void EveryTagWithANonMeasuredLiveAvailabilityExplainsItself()
    {
        // §7.4: a degraded tag must say why, because that note is what the UI puts in the
        // provenance tooltip. Without it the operator sees a badge and no reason for it.
        foreach (var def in TagCatalog.All.Where(d => d.LiveAvailability != LiveAvailability.Measured))
        {
            if (def.LiveAvailability == LiveAvailability.Reference) continue;

            def.LiveNote.ShouldNotBeNullOrWhiteSpace(
                $"{def.TagName} is {def.LiveAvailability} on the live feed but carries no explanation");
        }
    }
}
