using Crm04.Domain.Types;

namespace Crm04.Domain.Machine;

/// <summary>
/// Which reel is doing what, derived from the rolling direction. Port of the role half of
/// <c>src/machine/reversingEngine.ts</c>; the sequencer half - the SETTLE / FLIP / REPOSITION
/// dwell that makes a reversal take four seconds instead of happening instantly - is
/// <see cref="Crm04.Domain.Simulation.ReversalSequencer"/>.
///
/// THE ONE PLACE ALLOWED TO DECIDE THIS. §1 of the spec: a reel's role is never hardcoded to a
/// side. On a reversal the strip changes direction and the two tension reels swap jobs while
/// staying exactly where they are bolted. Every consumer - the projection, the 3D scene, the
/// reel panel - asks here rather than repeating the direction test, because a second copy is a
/// second thing that can disagree after a reversal.
/// </summary>
public static class ReversingRules
{
    /// <summary>The reel paying strip INTO the mill for this direction.</summary>
    public static ReelId PayoffReel(RollingDirection direction) =>
        direction == RollingDirection.Forward ? ReelId.Etr : ReelId.Dtr;

    /// <summary>The reel taking strip OUT of the mill for this direction.</summary>
    public static ReelId TensionReel(RollingDirection direction) =>
        direction == RollingDirection.Forward ? ReelId.Dtr : ReelId.Etr;

    public static ReelRole RoleOf(ReelId reel, RollingDirection direction)
    {
        if (PayoffReel(direction) == reel) return ReelRole.Payoff;
        if (TensionReel(direction) == reel) return ReelRole.Tension;
        return ReelRole.Idle;
    }

    /// <summary>
    /// +1 forward, -1 reverse. Drives every rotation and translation in the scene, so flipping it
    /// reverses the whole line at once rather than each part deciding for itself.
    /// </summary>
    public static int DirectionSign(RollingDirection direction) =>
        direction == RollingDirection.Forward ? 1 : -1;
}
