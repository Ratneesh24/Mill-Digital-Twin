using System.Collections;
using System.Globalization;
using System.Reflection;
using Crm04.Domain.Types;

namespace Crm04.Domain.Tests;

/// <summary>
/// Flattens a C# object graph into the same "a.b.c" -&gt; leaf map that
/// <c>scripts/exportGolden.ts</c> produces from the TypeScript objects.
///
/// Reflection rather than a hand-written mapping, deliberately. A hand-written flattener would
/// have to be updated whenever <see cref="MachineState"/> gains a field, and the failure mode of
/// forgetting is that the new field is silently never compared - the parity gate would keep
/// passing while covering less. Reflecting over public properties means a new field is compared
/// from the moment it exists, and if the TypeScript has no matching path the test says so.
///
/// The naming rule is the only thing that has to agree with the TypeScript, and it is one line:
/// C# PascalCase property names lower-case their first character to become the TypeScript field
/// name. That holds across the whole state tree, including the awkward ones - Os/Ds/Rpm/Dtr map
/// to os/ds/rpm/dtr, and LpSystem maps to lpSystem.
/// </summary>
internal static class GoldenFlattener
{
    /// <summary>Sentinel for "this path does not exist", distinct from "this path is null".</summary>
    internal static readonly object Missing = new();

    internal static Dictionary<string, object?> Flatten(object? root)
    {
        var into = new Dictionary<string, object?>(StringComparer.Ordinal);
        Walk(root, string.Empty, into);
        return into;
    }

    private static void Walk(object? value, string path, Dictionary<string, object?> into)
    {
        if (value is null)
        {
            into[path] = null;
            return;
        }

        switch (value)
        {
            case string s:
                into[path] = s;
                return;
            case bool b:
                into[path] = b;
                return;
            case Enum e:
                into[path] = WireOf(e);
                return;
            case TagValue tv:
                into[path] = LeafOfTagValue(tv);
                return;
        }

        var type = value.GetType();
        if (IsNumeric(type))
        {
            into[path] = Convert.ToDouble(value, CultureInfo.InvariantCulture);
            return;
        }

        if (value is IEnumerable enumerable and not string)
        {
            var i = 0;
            foreach (var item in enumerable)
            {
                Walk(item, $"{path}.{i}", into);
                i++;
            }

            into[$"{path}.length"] = (double)i;
            return;
        }

        foreach (var prop in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (prop.GetIndexParameters().Length > 0) continue;

            var name = CamelCase(prop.Name);
            var childPath = path.Length == 0 ? name : $"{path}.{name}";
            Walk(prop.GetValue(value), childPath, into);
        }
    }

    private static object? LeafOfTagValue(TagValue v) => v.Kind switch
    {
        TagValueKind.Null => null,
        TagValueKind.Number => v.AsRawNumber,
        TagValueKind.String => v.AsString,
        TagValueKind.Boolean => v.AsBoolean,
        _ => null,
    };

    private static bool IsNumeric(Type t) =>
        t == typeof(double) || t == typeof(float) || t == typeof(int) || t == typeof(long) ||
        t == typeof(short) || t == typeof(byte) || t == typeof(uint) || t == typeof(ulong) ||
        t == typeof(decimal);

    private static string CamelCase(string name) =>
        name.Length == 0 ? name : char.ToLowerInvariant(name[0]) + name[1..];

    /// <summary>
    /// The wire spelling of any enum in the domain. Routed through <see cref="WireNames"/> rather
    /// than <c>ToString()</c>, so the test is checking the same mapping the application ships.
    /// </summary>
    private static string WireOf(Enum e) => e switch
    {
        Provenance v => v.ToWire(),
        LiveAvailability v => v.ToWire(),
        TagQuality v => v.ToWire(),
        TagStatus v => v.ToWire(),
        MachineStatus v => v.ToWire(),
        RollingDirection v => v.ToWire(),
        OperatingMode v => v.ToWire(),
        Health v => v.ToWire(),
        CtrlState v => v.ToWire(),
        ReelRole v => v.ToWire(),
        ReelId v => v.ToWire(),
        ReelStatus v => v.ToWire(),
        BrakeState v => v.ToWire(),
        AlarmSeverity v => v.ToWire(),
        TwinSection v => v.ToWire(),
        MachineEventCategory v => v.ToWire(),
        _ => throw new InvalidOperationException($"No wire mapping for enum type {e.GetType().Name}."),
    };
}
