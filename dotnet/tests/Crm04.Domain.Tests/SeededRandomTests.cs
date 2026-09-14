using Crm04.Domain.Simulation;
using Shouldly;

namespace Crm04.Domain.Tests;

/// <summary>
/// <see cref="SeededRandom"/> against the TypeScript generator, bit for bit.
///
/// Every expectation below came out of Node running the body of
/// <c>src/config/engineeringConfig.ts</c>'s <c>SeededRandom</c> verbatim - none of them were
/// reasoned out. That matters because the naive all-<c>uint</c> port of this xorshift is wrong in
/// a way that is invisible on inspection: JavaScript's <c>&gt;&gt;</c> is arithmetic on a signed
/// value, C#'s <c>uint &gt;&gt;</c> is logical. Note the third state below, 3242360112 - it is above
/// 2^31, so the signed path is exercised by the third call and a wrong port cannot pass even the
/// first row of <see cref="StateSequenceIsBitExact"/>.
///
/// This generator feeds the X-ray gauge, which feeds STRIP.THICKNESS.DEVIATION, which feeds the
/// thickness alarm. A divergence here would present as a physics disagreement.
/// </summary>
public class SeededRandomTests
{
    /// <summary>The first 20 <c>next()</c> values from the default seed.</summary>
    private static readonly double[] ExpectedNext =
    [
        0.04190932237543166, 0.2844417989253998, 0.7549207918345928, 0.32197487400844693,
        0.2879919158294797, 0.11728733801282942, 0.1394173470325768, 0.1454824295360595,
        0.0650212075561285, 0.28219257458113134, 0.8755100455600768, 0.48924774094484746,
        0.4226056281477213, 0.5714124294463545, 0.5583540557418019, 0.4522934127599001,
        0.2337124738842249, 0.5057106632739305, 0.38958464632742107, 0.16388113843277097,
    ];

    /// <summary>The raw state after each of those 20 calls.</summary>
    private static readonly uint[] ExpectedState =
    [
        179999169, 1221668224, 3242360112, 1382871554, 1236915860, 503745281, 598792946,
        624842277, 279263960, 1212007879, 3760287013, 2101303047, 1815077352, 2454197697,
        2398112409, 1942585416, 1003787432, 2172010760, 1673253315, 703864130,
    ];

    /// <summary>The first 10 <c>normal()</c> deviates from a freshly seeded generator.</summary>
    private static readonly double[] ExpectedNormal =
    [
        -0.5408404403499235, -0.3276676582771205, 1.1684530436451963, 1.2119131647068995,
        -0.46968664856839276, -0.5144760038620502, -1.1825709681375474, -1.031455844187413,
        -1.703991159798427, 0.7072457091660335,
    ];

    [Fact]
    public void StateSequenceIsBitExact()
    {
        var rng = new SeededRandom();
        for (var i = 0; i < ExpectedState.Length; i++)
        {
            rng.Next();
            rng.State.ShouldBe(ExpectedState[i], $"state diverged at call {i + 1}");
        }
    }

    [Fact]
    public void UniformSequenceIsBitExact()
    {
        var rng = new SeededRandom();
        for (var i = 0; i < ExpectedNext.Length; i++)
        {
            // Exact equality, not a tolerance: x / 2^32 is a single exact division of an integer
            // by a power of two, so any difference at all means the state diverged.
            rng.Next().ShouldBe(ExpectedNext[i], $"next() diverged at call {i + 1}");
        }
    }

    [Fact]
    public void NormalSequenceMatchesJavaScript()
    {
        var rng = new SeededRandom();
        for (var i = 0; i < ExpectedNormal.Length; i++)
        {
            // sqrt/log/cos may differ from V8 in the last ulp, so this one gets a tolerance -
            // but a tight one, because a genuine state divergence is order-1, not 1e-15.
            var actual = rng.Normal();
            Math.Abs(actual - ExpectedNormal[i]).ShouldBeLessThan(
                1e-14, $"normal() diverged at call {i + 1}: expected {ExpectedNormal[i]}, got {actual}");
        }
    }

    [Fact]
    public void ArithmeticShiftIsActuallyExercised()
    {
        // Documents WHY the int cast in Next() is load-bearing rather than decorative: a state
        // above 2^31 appears within three calls, and that is where the two shifts disagree.
        var rng = new SeededRandom();
        rng.Next();
        rng.Next();
        rng.Next();
        rng.State.ShouldBeGreaterThan((uint)int.MaxValue);
    }

    [Fact]
    public void ResetRestoresTheSequence()
    {
        var rng = new SeededRandom();
        var first = new[] { rng.Next(), rng.Next(), rng.Next() };
        rng.Reset();
        new[] { rng.Next(), rng.Next(), rng.Next() }.ShouldBe(first);
    }

    [Fact]
    public void UniformOutputStaysInRange()
    {
        var rng = new SeededRandom();
        for (var i = 0; i < 10_000; i++)
        {
            var v = rng.Next();
            v.ShouldBeGreaterThanOrEqualTo(0d);
            v.ShouldBeLessThan(1d);
        }
    }

    [Fact]
    public void JsEpsilonIsNotDoubleEpsilon()
    {
        // The trap this constant exists to avoid. double.Epsilon is 4.94e-324; feeding it to
        // Math.Log yields about -744.4 instead of -36.0, and Normal() would return a deviate
        // roughly 4.5x too large with no exception anywhere.
        SeededRandom.JsEpsilon.ShouldBe(Math.Pow(2, -52));
        SeededRandom.JsEpsilon.ShouldNotBe(double.Epsilon);
    }
}
