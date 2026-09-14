using Shouldly;

namespace Crm04.Domain.Tests;

/// <summary>
/// THE DIAGNOSTIC GATE. Every stateless physics function, swept over hundreds of input rows by
/// <c>scripts/exportModelProbes.ts</c> and compared to the TypeScript result.
///
/// WHY THIS EXISTS SEPARATELY FROM THE ENGINE PARITY GATE. The engine gate runs 18,000 ticks and
/// compares trajectories. It is the right end-to-end test and a useless diagnostic: when it fails
/// it says "tick 412 disagrees", and the cause is one multiplication somewhere inside eleven
/// files. These tests turn that into "CalculateMeanFlowStress differs by 3 ulp at row 218", which
/// is a fixable sentence.
///
/// Because these functions carry no state, the tolerance here is far tighter than anything the
/// engine gate can afford - see <see cref="ModelProbeFixtures.RelativeTolerance"/>, which is a
/// measured figure rather than a chosen one. If one of these fails, the port is wrong; it is not
/// drift, and <see cref="ModelDivergenceTests"/> is the test that makes that claim checkable.
///
/// One thin method per suite, so a failure names the function in the test report rather than
/// burying it in one giant theory. The evaluation itself lives in <see cref="ModelProbeRunner"/>.
/// </summary>
public class ModelParityTests
{
    // -------------------------------------------------------------------------- rollingModel

    [Theory, MemberData(nameof(Rows), "CalculateReduction")]
    public void CalculateReduction(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "OutputThicknessFromReduction")]
    public void OutputThicknessFromReduction(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "CalculateTrueStrain")]
    public void CalculateTrueStrain(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "CalculateMeanFlowStress")]
    public void CalculateMeanFlowStress(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "CalculateFlattenedRadius")]
    public void CalculateFlattenedRadius(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "CalculateContactLength")]
    public void CalculateContactLength(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "RollSurfaceSpeedFromStripSpeed")]
    public void RollSurfaceSpeedFromStripSpeed(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "CalculateRollRpm")]
    public void CalculateRollRpm(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "EntrySpeedFromMassFlow")]
    public void EntrySpeedFromMassFlow(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "MassFlowError")]
    public void MassFlowError(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "SpecificTension")]
    public void SpecificTension(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "TensionForceFromSpecific")]
    public void TensionForceFromSpecific(ModelProbe p) => Check(p);

    // ----------------------------------------------------------------------------- coilModel

    [Theory, MemberData(nameof(Rows), "CoilRadiusFromLength")]
    public void CoilRadiusFromLength(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "CoilLengthFromRadius")]
    public void CoilLengthFromRadius(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "CoilLayers")]
    public void CoilLayers(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "ReelRpm")]
    public void ReelRpm(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "ReelTorque")]
    public void ReelTorque(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "ReelCurrent")]
    public void ReelCurrent(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "CoilMass")]
    public void CoilMass(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "LengthAfterReduction")]
    public void LengthAfterReduction(ModelProbe p) => Check(p);

    // -------------------------------------------------------------------------- tensionModel

    [Theory, MemberData(nameof(Rows), "CalculateTensionReferences")]
    public void CalculateTensionReferences(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "StepTension")]
    public void StepTension(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "TensionReferenceForState")]
    public void TensionReferenceForState(ModelProbe p) => Check(p);

    // ---------------------------------------------------------------------------- forceModel

    [Theory, MemberData(nameof(Rows), "CalculateRollingForce")]
    public void CalculateRollingForce(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "EstimateForceFromTorque")]
    public void EstimateForceFromTorque(ModelProbe p) => Check(p);

    // ---------------------------------------------------------------------------- driveModel

    [Theory, MemberData(nameof(Rows), "CalculateDrive")]
    public void CalculateDrive(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "HydraulicPressureFromForce")]
    public void HydraulicPressureFromForce(ModelProbe p) => Check(p);

    // ------------------------------------------------------------------------ thicknessModel

    [Theory, MemberData(nameof(Rows), "SolveGaugemeter")]
    public void SolveGaugemeter(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "InverseGaugemeter")]
    public void InverseGaugemeter(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "GapPositionForTargetThickness")]
    public void GapPositionForTargetThickness(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "HagcStep")]
    public void HagcStep(ModelProbe p) => Check(p);

    // -------------------------------------------------------------------- simulationScenarios

    [Theory, MemberData(nameof(Rows), "ApplyScenario")]
    public void ApplyScenario(ModelProbe p) => Check(p);

    // -------------------------------------------------------------------- machineStateMachine

    /// <summary>
    /// The whole transition table: 13 statuses × 15 events × 16 contexts = 3,120 rows, every one
    /// of them swept. Discrete and total, so there is no reason to sample and no tolerance to
    /// argue about - status, reason string and the changed flag are all compared exactly.
    ///
    /// This is what eliminates the "the mill reverses one tick late" class of bug before the
    /// engine is even assembled, and it is why the reason strings can be trusted: every sentence
    /// the operator can see is asserted here character for character, including the ones behind a
    /// <c>??</c> fallback that only fires when the interlock chain has no reason of its own.
    /// </summary>
    [Theory, MemberData(nameof(Rows), "Transition")]
    public void Transition(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "BeginReversal")]
    public void BeginReversal(ModelProbe p) => Check(p);

    // ------------------------------------------------------------------------ reversingEngine

    [Theory, MemberData(nameof(Rows), "StepReversal")]
    public void StepReversal(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "ReversalProgress")]
    public void ReversalProgress(ModelProbe p) => Check(p);

    [Theory, MemberData(nameof(Rows), "StartReversal")]
    public void StartReversal(ModelProbe p) => Check(p);

    // --------------------------------------------------------------------------- meta-checks

    /// <summary>
    /// Every suite the export writes has a test method consuming it.
    ///
    /// Without this, adding a sweep to the script and forgetting the test method is invisible: the
    /// fixture grows, the run stays green, and a whole function goes ungated. The reverse
    /// direction is covered automatically - <see cref="ModelProbeFixtures.Suite"/> throws when a
    /// test asks for a suite the fixture does not contain, and
    /// <see cref="ModelProbeRunner.Run"/> throws when the fixture contains a suite with no
    /// evaluator.
    /// </summary>
    [Fact]
    public void EverySuiteInTheFixtureIsConsumedByATest()
    {
        var consumed = typeof(ModelParityTests)
            .GetMethods()
            .SelectMany(m => m.GetCustomAttributes(typeof(MemberDataAttribute), false))
            .Cast<MemberDataAttribute>()
            .SelectMany(a => a.Parameters)
            .OfType<string>()
            .ToHashSet(StringComparer.Ordinal);

        var orphaned = ModelProbeFixtures.SuiteNames.Except(consumed).Order().ToList();

        orphaned.ShouldBeEmpty(
            $"these probe suites are exported but never asserted: {string.Join(", ", orphaned)}. " +
            "Add a test method for each, or drop the sweep from scripts/exportModelProbes.ts.");
    }

    [Fact]
    public void TheFixtureIsSubstantial()
    {
        // A guard against the fixture silently emptying out - a failed export that wrote a stub,
        // or a sweep whose bounds collapsed to one row. The gate going quiet is worse than the
        // gate going red.
        ModelProbeFixtures.ProbeCount.ShouldBeGreaterThan(10_000);
        ModelProbeFixtures.SourceHash.Length.ShouldBe(64);
    }

    // ------------------------------------------------------------------------------- helpers

    public static IEnumerable<object[]> Rows(string suite) => ModelProbeFixtures.Rows(suite);

    private static void Check(ModelProbe p) =>
        ModelProbeFixtures.AssertMatches(p, ModelProbeRunner.Run(p));
}
