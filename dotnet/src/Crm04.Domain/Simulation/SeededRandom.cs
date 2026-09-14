namespace Crm04.Domain.Simulation;

/// <summary>
/// Deterministic pseudo-random generator. Port of <c>SeededRandom</c> in
/// <c>src/config/engineeringConfig.ts</c>.
///
/// §19.2 forbids "random independent values". Instrument noise is nevertheless physically real, so
/// it is produced by a SEEDED generator: the simulation is reproducible run-to-run, and noise is
/// applied only at the point where a real instrument would add it (the X-ray gauge signal), never
/// to a process value that other values depend on.
///
/// THE ONE THING TO UNDERSTAND BEFORE TOUCHING <see cref="Next"/>. The TypeScript writes
/// <c>x ^= x &gt;&gt; 17</c>. In JavaScript <c>&gt;&gt;</c> applies ToInt32 to its operand first and then
/// shifts ARITHMETICALLY - so for any state at or above 2^31 the shifted-in bits are ones, not
/// zeros. C#'s <c>uint &gt;&gt; 17</c> is a LOGICAL shift and shifts in zeros. Writing the obvious
/// all-<c>uint</c> xorshift here produces a different stream within a few calls, and because this
/// generator feeds the X-ray gauge it would move STRIP.THICKNESS.DEVIATION and hence the thickness
/// alarm - a divergence that looks like a physics bug and is not one. The port below casts to
/// <see cref="int"/> for exactly the one shift that JavaScript performs on a signed value.
///
/// Single-threaded by contract, like the engine that owns it.
/// </summary>
public sealed class SeededRandom
{
    /// <summary>The TypeScript default seed, <c>0x2f6e2b1</c>.</summary>
    public const uint DefaultSeed = 0x2f6e2b1;

    private uint _state;

    public SeededRandom(uint seed = DefaultSeed) => _state = seed;

    /// <summary>The raw generator state. Read by the parity gate, which asserts it bit-exact.</summary>
    public uint State => _state;

    /// <summary>xorshift32 - uniform in [0, 1).</summary>
    public double Next()
    {
        // JS:  let x = this.state
        //      x ^= x << 13;  x >>>= 0
        //      x ^= x >> 17                 <-- ToInt32 first, ARITHMETIC shift
        //      x ^= x << 5;   x >>>= 0
        var x = _state;
        x ^= x << 13;

        var i = unchecked((int)x);   // JS ToInt32
        i ^= i >> 17;                // arithmetic - see the class remarks
        i ^= i << 5;
        x = unchecked((uint)i);      // JS >>> 0

        _state = x;
        return x / 4294967296d;      // 0x1_0000_0000
    }

    /// <summary>Box-Muller normal deviate, mean 0, unit variance.</summary>
    public double Normal()
    {
        // Number.EPSILON is 2^-52, NOT double.Epsilon (4.94e-324). Using the latter would let
        // Math.Log see a denormal and return roughly -745 instead of -36, and nothing downstream
        // would flag it.
        var u1 = Math.Max(Next(), JsEpsilon);
        var u2 = Next();
        return Math.Sqrt(-2 * Math.Log(u1)) * Math.Cos(2 * Math.PI * u2);
    }

    public void Reset(uint seed = DefaultSeed) => _state = seed;

    /// <summary>JavaScript's <c>Number.EPSILON</c> = 2^-52. See <see cref="Normal"/>.</summary>
    public const double JsEpsilon = 2.220446049250313E-16;
}
