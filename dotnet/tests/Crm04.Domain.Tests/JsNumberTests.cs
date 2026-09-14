using Crm04.Domain.Configuration;
using Crm04.Domain.Util;
using Shouldly;

namespace Crm04.Domain.Tests;

/// <summary>
/// <see cref="JsNumber.ToFixed"/> against JavaScript's actual behaviour.
///
/// Every expectation below was taken from running the expression in Node, not from what .NET
/// happens to produce - the point of the helper is that the two differ. If any of these ever
/// need "correcting", the alarm messages have drifted from the TypeScript app and the parity
/// gate is about to fail.
/// </summary>
public class JsNumberTests
{
    [Theory]
    // The textbook divergence. 1.005 is really 1.00499999999999989, so JavaScript rounds DOWN
    // while a decimal-based .NET rounding would round up to "1.01".
    [InlineData(1.005d, 2, "1.00")]
    [InlineData(1.015d, 2, "1.01")]     // 1.0149999999999999
    [InlineData(1.025d, 2, "1.02")]     // 1.0249999999999999 - also below, despite appearances
    // Exactly representable halves round away from zero, because toFixed strips the sign first.
    [InlineData(0.5d, 0, "1")]
    [InlineData(1.5d, 0, "2")]
    [InlineData(2.5d, 0, "3")]
    [InlineData(-1.5d, 0, "-2")]
    [InlineData(-2.5d, 0, "-3")]
    // Sign is retained even when the magnitude rounds to zero.
    [InlineData(-0.0001d, 2, "-0.00")]
    [InlineData(0d, 2, "0.00")]
    // Zero padding on the left of the decimal point.
    [InlineData(0.004d, 2, "0.00")]
    [InlineData(0.006d, 2, "0.01")]
    [InlineData(0.0001d, 3, "0.000")]
    // Plain cases that the alarm messages actually hit.
    [InlineData(331.2d, 0, "331")]
    [InlineData(288d, 0, "288")]
    [InlineData(1366.4d, 0, "1366")]
    [InlineData(-7.65d, 1, "-7.7")]     // 7.65 is 7.650000000000000355 - above the midpoint
    [InlineData(28.9d, 1, "28.9")]
    [InlineData(56.94d, 1, "56.9")]
    public void ToFixedMatchesJavaScript(double value, int digits, string expected)
    {
        JsNumber.ToFixed(value, digits).ShouldBe(expected);
    }

    [Fact]
    public void ToFixedHandlesTheNonFiniteCasesTheWayJavaScriptDoes()
    {
        JsNumber.ToFixed(double.NaN, 2).ShouldBe("NaN");
        JsNumber.ToFixed(double.PositiveInfinity, 2).ShouldBe("Infinity");
        JsNumber.ToFixed(double.NegativeInfinity, 2).ShouldBe("-Infinity");

        // JavaScript gives up on toFixed at 1e21 and falls back to String(n) - note the
        // lower-case 'e', which .NET's "R" format does not produce.
        JsNumber.ToFixed(1e21d, 2).ShouldBe("1e+21");
    }

    [Fact]
    public void NegativeZeroFormatsWithoutItsSign()
    {
        // JavaScript prints String(-0) as "0", but (-0).toFixed(2) as "0.00" - the sign is only
        // carried when the ORIGINAL value was strictly negative, which -0 is not.
        JsNumber.ToJsString(-0d).ShouldBe("0");
        JsNumber.ToFixed(-0d, 2).ShouldBe("0.00");
    }

    [Fact]
    public void ToFixedRejectsDigitsOutsideTheSpecifiedRange()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => JsNumber.ToFixed(1d, -1));
        Should.Throw<ArgumentOutOfRangeException>(() => JsNumber.ToFixed(1d, 101));
    }

    [Theory]
    // The bare interpolations the alarm messages actually contain - "±5 µm target", "of 360 t".
    [InlineData(5d, "5")]
    [InlineData(360d, "360")]
    [InlineData(41d, "41")]
    [InlineData(2.5d, "2.5")]
    [InlineData(0.1d, "0.1")]
    [InlineData(-7.65d, "-7.65")]
    [InlineData(1234.5678d, "1234.5678")]
    // The magnitude boundaries, where .NET's "R" and JavaScript genuinely disagree.
    // JavaScript stays positional up to 1e21 exclusive; "R" would give "1E+20" here.
    [InlineData(1e20d, "100000000000000000000")]
    [InlineData(1e21d, "1e+21")]
    [InlineData(1.5e21d, "1.5e+21")]
    // ...and down to 1e-6 inclusive; below that it goes exponential, with no zero-padding on
    // the exponent - "R" would give "1E-07".
    [InlineData(0.000001d, "0.000001")]
    [InlineData(0.0000001d, "1e-7")]
    [InlineData(1.5e-7d, "1.5e-7")]
    [InlineData(0.0001d, "0.0001")]
    public void ToJsStringMatchesJavaScriptNumberToString(double value, string expected)
    {
        JsNumber.ToJsString(value).ShouldBe(expected);
    }

    [Fact]
    public void ToJsStringHandlesTheNonFiniteCases()
    {
        JsNumber.ToJsString(double.NaN).ShouldBe("NaN");
        JsNumber.ToJsString(double.PositiveInfinity).ShouldBe("Infinity");
        JsNumber.ToJsString(double.NegativeInfinity).ShouldBe("-Infinity");
    }
}

/// <summary>
/// The engineering constants that are DERIVED rather than declared. If one of these drifts, every
/// alarm threshold and every tag limit moves with it, silently.
/// </summary>
public class EngineeringConfigTests
{
    [Fact]
    public void ForceLimitsAreTheDocumentedFractionsOfTheMillRating()
    {
        var rating = MillConfig.Default.Ratings.MaxRollingForce;
        rating.ShouldBe(360d);

        EngineeringConfig.ForceLimits.Warning.ShouldBe(288d);
        EngineeringConfig.ForceLimits.Alarm.ShouldBe(331.2d, 1e-9d);
        EngineeringConfig.ForceLimits.Trip.ShouldBe(360d);
    }

    [Fact]
    public void HydraulicPressureIsDerivedFromTheRealCylinderGeometry()
    {
        // p = F / (2 · πD²/4) with a Ø420 ram per housing, converted kg/cm² -> bar.
        // The manual's working limit is 210 kg/cm², and the rating is set by the stand rather
        // than by the hydraulics, so this must sit comfortably below it.
        EngineeringConfig.HydraulicPressureAtMaxForce.ShouldBeInRange(120d, 135d);
        EngineeringConfig.HydraulicPressureMin.ShouldBe(41d);
    }

    [Fact]
    public void TensionLimitsConvertTheManualsKgfFiguresExactlyOnce()
    {
        // §1.4 states 6900 kgf maximum and 690 kgf minimum. This is the single conversion point.
        EngineeringConfig.TensionLimits.EntryMax.ShouldBe(6900d * 9.80665d / 1000d, 1e-12d);
        EngineeringConfig.TensionLimits.EntryMin.ShouldBe(690d * 9.80665d / 1000d, 1e-12d);

        // Both reels are identical machines; which one is "entry" is a role, not a rating.
        EngineeringConfig.TensionLimits.ExitMax.ShouldBe(EngineeringConfig.TensionLimits.EntryMax);
        EngineeringConfig.TensionLimits.ExitMin.ShouldBe(EngineeringConfig.TensionLimits.EntryMin);
    }

    [Fact]
    public void MainDriveRatedTorqueStaysConsistentWithPowerAndBaseSpeed()
    {
        // T_rated = P_rated / ω_base. The drive model depends on this relation holding, so a
        // change to the kW or the base rpm that forgets the torque is a real defect.
        var r = MillConfig.Default.Ratings;
        var derived = r.MainDriveRating / (2d * Math.PI * r.MainDriveBaseRpm / 60d);

        derived.ShouldBe(r.MainDriveRatedTorque, 0.2d);
    }
}
