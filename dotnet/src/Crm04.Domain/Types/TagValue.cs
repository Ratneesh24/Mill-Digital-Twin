using Crm04.Domain.Util;

namespace Crm04.Domain.Types;

/// <summary>
/// Discriminator for <see cref="TagValue"/>. The letters match the <c>VAL_KIND</c> column in
/// the Oracle <c>TAG_SAMPLE</c> table exactly, so a row round-trips without a lookup table.
/// </summary>
public enum TagValueKind : byte
{
    /// <summary>'X' - the tag IS on this feed, but its value right now is null.</summary>
    Null = 0,

    /// <summary>'N' - a numeric value.</summary>
    Number = 1,

    /// <summary>'S' - a string / enum value such as MILL.STATUS or DTR.ROLE.</summary>
    String = 2,

    /// <summary>'B' - a boolean value.</summary>
    Boolean = 3,
}

/// <summary>
/// Port of the TypeScript <c>TagValue = number | string | boolean | null</c>.
///
/// Modelled as a struct with an explicit kind rather than <c>object?</c> for two reasons:
/// it avoids boxing on the 10 Hz path, and it makes the load-bearing distinction between
/// "value is null" and "tag is absent" impossible to lose by accident. A <see cref="TagValue"/>
/// whose kind is <see cref="TagValueKind.Null"/> means the first; the tag simply not being
/// present in the frame dictionary means the second.
///
/// The numeric accessors deliberately reproduce JavaScript's semantics rather than C#'s:
/// <see cref="AsFiniteNumber"/> mirrors <c>numericValue()</c> in <c>src/data/tagMap.ts:161</c>,
/// which returns null for anything that is not a finite number - including a numeric-looking
/// string. Widening that to "parse whatever you can" would let a string tag masquerade as a
/// reading, which is exactly what the Â§7 tag model exists to prevent.
/// </summary>
public readonly struct TagValue : IEquatable<TagValue>
{
    private readonly double _number;
    private readonly string? _string;

    private TagValue(TagValueKind kind, double number, string? str)
    {
        Kind = kind;
        _number = number;
        _string = str;
    }

    public TagValueKind Kind { get; }

    /// <summary>The tag exists on the feed but currently carries no value ('X' in Oracle).</summary>
    public static readonly TagValue Null = new(TagValueKind.Null, 0d, null);

    public static TagValue FromNumber(double value) => new(TagValueKind.Number, value, null);

    public static TagValue FromString(string value) =>
        new(TagValueKind.String, 0d, value ?? throw new ArgumentNullException(nameof(value)));

    public static TagValue FromBoolean(bool value) => new(TagValueKind.Boolean, value ? 1d : 0d, null);

    /// <summary>Nullable-double convenience: null becomes <see cref="Null"/>.</summary>
    public static TagValue From(double? value) => value.HasValue ? FromNumber(value.Value) : Null;

    /// <summary>Nullable-bool convenience: null becomes <see cref="Null"/>.</summary>
    public static TagValue From(bool? value) => value.HasValue ? FromBoolean(value.Value) : Null;

    /// <summary>Nullable-string convenience: null becomes <see cref="Null"/>.</summary>
    public static TagValue From(string? value) => value is null ? Null : FromString(value);

    public bool IsNull => Kind == TagValueKind.Null;

    /// <summary>
    /// The value as a finite number, or null. Port of <c>numericValue()</c>: a non-number kind
    /// returns null, and so does a Number kind holding NaN or an infinity - JavaScript's
    /// <c>Number.isFinite</c> check, which the alarm and status logic both depend on.
    /// </summary>
    public double? AsFiniteNumber =>
        Kind == TagValueKind.Number && double.IsFinite(_number) ? _number : null;

    /// <summary>
    /// The raw numeric payload without the finiteness filter. Use this only where the caller
    /// genuinely needs to see a NaN, such as when persisting a frame verbatim.
    /// </summary>
    public double? AsRawNumber => Kind == TagValueKind.Number ? _number : null;

    public string? AsString => Kind == TagValueKind.String ? _string : null;

    public bool? AsBoolean => Kind == TagValueKind.Boolean ? _number != 0d : null;

    /// <summary>
    /// Boolean coercion matching <c>bool()</c> in <c>src/communication/dataAdapter.ts:60</c>:
    /// a real boolean passes through; the strings "true" and "ON" are true and every other
    /// string is false; a number yields null rather than the C-style "non-zero is true", which
    /// the TypeScript reader deliberately does not do.
    /// </summary>
    public bool? AsCoercedBoolean => Kind switch
    {
        TagValueKind.Boolean => _number != 0d,
        TagValueKind.String => _string is "true" or "ON",
        _ => null,
    };

    /// <summary>
    /// String coercion matching <c>str()</c> in <c>src/communication/dataAdapter.ts:54</c>:
    /// a string passes through, anything else non-null is stringified, and null stays null.
    /// </summary>
    public string? AsCoercedString => Kind switch
    {
        TagValueKind.Null => null,
        TagValueKind.String => _string,
        TagValueKind.Boolean => _number != 0d ? "true" : "false",
        // Number-to-string is JavaScript's, not .NET's - see JsNumber.ToJsString for why the two
        // disagree. This matters here because a numeric tag stringified for a status comparison
        // must produce the same text the TypeScript would have compared against.
        TagValueKind.Number => JsNumber.ToJsString(_number),
        _ => null,
    };

    public bool Equals(TagValue other)
    {
        if (Kind != other.Kind) return false;
        return Kind switch
        {
            TagValueKind.Null => true,
            TagValueKind.String => string.Equals(_string, other._string, StringComparison.Ordinal),
            // Bit comparison, not ==, so two NaN payloads compare equal. Frame equality is used
            // for change detection, and a readout that is NaN twice running has not changed.
            _ => BitConverter.DoubleToInt64Bits(_number) == BitConverter.DoubleToInt64Bits(other._number),
        };
    }

    public override bool Equals(object? obj) => obj is TagValue other && Equals(other);

    public override int GetHashCode() => Kind switch
    {
        TagValueKind.Null => 0,
        TagValueKind.String => HashCode.Combine(Kind, _string),
        _ => HashCode.Combine(Kind, _number),
    };

    public static bool operator ==(TagValue a, TagValue b) => a.Equals(b);

    public static bool operator !=(TagValue a, TagValue b) => !a.Equals(b);

    public override string ToString() => AsCoercedString ?? "null";

    /// <summary>The Oracle <c>VAL_KIND</c> character for this value.</summary>
    public char ToValKind() => Kind switch
    {
        TagValueKind.Number => 'N',
        TagValueKind.String => 'S',
        TagValueKind.Boolean => 'B',
        TagValueKind.Null => 'X',
        _ => throw new ArgumentOutOfRangeException(nameof(Kind), Kind, "Unmapped TagValueKind."),
    };

    /// <summary>Rebuild a value from the Oracle column trio.</summary>
    public static TagValue FromValKind(char valKind, double? num, string? str) => valKind switch
    {
        'N' => num.HasValue ? FromNumber(num.Value) : Null,
        'B' => num.HasValue ? FromBoolean(num.Value != 0d) : Null,
        'S' => str is null ? Null : FromString(str),
        'X' => Null,
        _ => throw new FormatException($"Unknown VAL_KIND '{valKind}'."),
    };
}
