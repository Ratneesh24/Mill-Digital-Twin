using System.Globalization;
using System.Numerics;
using Crm04.Domain.Types;

namespace Crm04.Domain.Util;

/// <summary>
/// JavaScript-compatible number formatting.
///
/// WHY THIS EXISTS. Alarm messages in the TypeScript app are built with template literals that
/// call <c>toFixed()</c> - "HIGH ROLLING FORCE — 331 t exceeds 331 t". Those strings are
/// user-facing, they are stored in ALARM_EVENT, and the golden parity test compares them
/// character for character. .NET's <c>ToString("F0")</c> is NOT the same function: it rounds the
/// shortest decimal representation of the double, whereas <c>toFixed</c> is specified against
/// the double's EXACT binary value. The textbook case is 1.005, which is really
/// 1.00499999999999989 - JavaScript prints "1.00" and .NET prints "1.01".
///
/// <see cref="ToFixed"/> therefore implements ECMA-262 Number.prototype.toFixed exactly, using
/// <see cref="BigInteger"/> so the arithmetic is done on the true value rather than on a decimal
/// approximation of it. It is only called when an alarm actually fires, so the cost is irrelevant
/// and the correctness is not.
/// </summary>
public static class JsNumber
{
    /// <summary>
    /// ECMA-262 Number.prototype.toFixed.
    ///
    /// The specification takes the absolute value first and then picks the integer n for which
    /// n / 10^f is closest to x, resolving a tie by taking the LARGER n. Applied after the sign
    /// has been stripped, that is round-half-away-from-zero - so (-1.5).toFixed(0) is "-2", and
    /// (-0.0001).toFixed(2) is "-0.00", sign retained on a zero result.
    /// </summary>
    public static string ToFixed(double x, int digits)
    {
        if (digits is < 0 or > 100)
        {
            throw new ArgumentOutOfRangeException(nameof(digits), digits, "toFixed digits must be 0..100.");
        }

        if (double.IsNaN(x)) return "NaN";

        // JavaScript gives up on toFixed at 1e21 and falls back to ToString. Reproduced so a
        // pathological value formats the same on both sides rather than throwing here.
        if (double.IsInfinity(x) || Math.Abs(x) >= 1e21) return ToJsString(x);

        var sign = string.Empty;
        if (x < 0d)
        {
            sign = "-";
            x = -x;
        }

        // Decompose the double exactly: x == mantissa * 2^exponent.
        var bits = BitConverter.DoubleToInt64Bits(x);
        var biasedExponent = (int)((bits >> 52) & 0x7FF);
        var fraction = bits & 0xF_FFFF_FFFF_FFFFL;

        BigInteger mantissa;
        int exponent;
        if (biasedExponent == 0)
        {
            // Subnormal: no implicit leading bit.
            mantissa = fraction;
            exponent = -1074;
        }
        else
        {
            mantissa = fraction | (1L << 52);
            exponent = biasedExponent - 1075;
        }

        // n = floor(x * 10^digits + 1/2), evaluated as an exact rational so no intermediate
        // rounding can creep in. Everything here is non-negative, so BigInteger's truncating
        // division is a floor.
        var pow10 = BigInteger.Pow(10, digits);
        BigInteger numerator, denominator;
        if (exponent >= 0)
        {
            numerator = mantissa * BigInteger.Pow(2, exponent) * pow10;
            denominator = BigInteger.One;
        }
        else
        {
            numerator = mantissa * pow10;
            denominator = BigInteger.Pow(2, -exponent);
        }

        var n = (2 * numerator + denominator) / (2 * denominator);

        var body = n.ToString(CultureInfo.InvariantCulture);
        if (digits == 0) return sign + body;

        if (body.Length <= digits) body = body.PadLeft(digits + 1, '0');
        return sign + body[..^digits] + "." + body[^digits..];
    }

    /// <summary>
    /// JavaScript <c>String(n)</c> / <c>Number::toString</c>. Used wherever the TypeScript
    /// interpolates a bare number into a message or serialises one to JSON.
    ///
    /// .NET's <c>ToString("R")</c> is NOT this function, in two ways that both matter:
    ///
    ///   * It switches to exponential notation at a different magnitude. String(1e20) in
    ///     JavaScript is "100000000000000000000"; "R" gives "1E+20". JavaScript only goes
    ///     exponential once the decimal exponent reaches 21, or below -6.
    ///   * It spells the exponent differently - "1E+21" and "1E-07" against JavaScript's
    ///     "1e+21" and "1e-7".
    ///
    /// So the shortest round-tripping digits are taken from "R" (which is exactly the digit
    /// string JavaScript would choose) and then re-rendered under the ECMA-262 rules.
    /// </summary>
    public static string ToJsString(double x)
    {
        if (double.IsNaN(x)) return "NaN";
        if (double.IsPositiveInfinity(x)) return "Infinity";
        if (double.IsNegativeInfinity(x)) return "-Infinity";
        if (x == 0d) return "0";                       // covers -0, which JavaScript prints as "0"

        var sign = x < 0d ? "-" : string.Empty;
        var r = Math.Abs(x).ToString("R", CultureInfo.InvariantCulture);

        // Split "R" into its digit string and a decimal exponent n, defined as in the spec:
        // value == 0.<digits> x 10^n.
        var exponent = 0;
        var eIndex = r.IndexOf('E', StringComparison.Ordinal);
        if (eIndex >= 0)
        {
            exponent = int.Parse(r[(eIndex + 1)..], CultureInfo.InvariantCulture);
            r = r[..eIndex];
        }

        var dot = r.IndexOf('.');
        var digits = dot < 0 ? r : r.Remove(dot, 1);
        var n = (dot < 0 ? r.Length : dot) + exponent;

        // Leading zeros shift the exponent; trailing zeros are noise.
        var lead = 0;
        while (lead < digits.Length - 1 && digits[lead] == '0') lead++;
        digits = digits[lead..];
        n -= lead;
        digits = digits.TrimEnd('0');
        if (digits.Length == 0) return "0";

        var k = digits.Length;

        if (k <= n && n <= 21) return sign + digits + new string('0', n - k);
        if (0 < n && n <= 21) return sign + digits[..n] + "." + digits[n..];
        if (-6 < n && n <= 0) return sign + "0." + new string('0', -n) + digits;

        var e = n - 1;
        var mantissa = k == 1 ? digits : digits[..1] + "." + digits[1..];
        return sign + mantissa + "e" + (e >= 0 ? "+" : "-") + Math.Abs(e).ToString(CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// JavaScript <c>Math.round</c>: ties go toward +∞, NOT away from zero. The two differ only
    /// for negative halves - Math.round(-0.5) is -0 in JavaScript but -1 with AwayFromZero.
    /// </summary>
    public static double Round(double x) => Math.Floor(x + 0.5d);
}
