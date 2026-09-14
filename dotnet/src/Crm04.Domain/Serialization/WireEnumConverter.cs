using System.Text.Json;
using System.Text.Json.Serialization;
using Crm04.Domain.Types;

namespace Crm04.Domain.Serialization;

/// <summary>
/// Serialises every domain enum using its screaming-snake wire name rather than its C# member
/// name: <c>Provenance.Measured</c> goes out as <c>"MEASURED"</c>, <c>MachineStatus.FastStop</c>
/// as <c>"FAST_STOP"</c>.
///
/// This matters beyond tidiness. Those strings are the contract the TypeScript app, the Oracle
/// CHECK constraints and the gateway payload in <c>docs/INTEGRATION.md</c> all already speak.
/// Letting System.Text.Json emit "FastStop" would fork the wire format from the documented one
/// on the very first serialisation, and nothing would notice until a gateway was connected.
///
/// Routed through <see cref="WireNames"/> so the JSON and the database agree by construction
/// rather than by two parallel lists staying in step.
/// </summary>
public sealed class WireEnumConverter : JsonConverterFactory
{
    public override bool CanConvert(Type typeToConvert) =>
        typeToConvert.IsEnum && typeToConvert.Namespace == typeof(Provenance).Namespace;

    public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options) =>
        (JsonConverter)Activator.CreateInstance(typeof(Inner<>).MakeGenericType(typeToConvert))!;

    private sealed class Inner<T> : JsonConverter<T> where T : struct, Enum
    {
        public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            var s = reader.GetString();
            return (T)WireNames.ParseWire(typeof(T), s);
        }

        public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options) =>
            writer.WriteStringValue(WireNames.WireOf(value));
    }
}

/// <summary>
/// Shared JSON settings. The API serialises with these and the Blazor client deserialises with
/// them, so there is one definition of the wire format rather than two that drift.
/// </summary>
public static class WireJson
{
    public static JsonSerializerOptions Options { get; } = Build();

    private static JsonSerializerOptions Build()
    {
        var o = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            // Nulls are meaningful in this domain - "no tag on this feed" is a statement, not an
            // absence worth saving bytes on. Omitting them would make the receiver unable to tell
            // a null reading from a field the sender simply does not know about.
            DefaultIgnoreCondition = JsonIgnoreCondition.Never,
            NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,
        };
        o.Converters.Add(new WireEnumConverter());
        return o;
    }
}
