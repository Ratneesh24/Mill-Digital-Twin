using System.Data;
using Crm04.Domain.Tags;
using Crm04.Domain.Types;
using Oracle.ManagedDataAccess.Client;

namespace Crm04.Persistence.Seed;

public sealed record TagIdMap(IReadOnlyDictionary<string, int> IdByName)
{
    public int Count => IdByName.Count;
}

/// <summary>
/// Puts the tag catalogue into TAG_DEF and hands back the name-to-id map every other query needs.
///
/// The catalogue is generated from <c>src/data/tagDefinitions.ts</c>, so this seeder reads the
/// generated C# rather than parsing SQL - one source, two consumers, no third copy to drift.
/// (<c>db/seed/tag_definitions.sql</c> exists for DBAs who would rather run a script; it is
/// generated from the same place in the same run.)
///
/// ORDINALS ARE THE POINT OF THE VERIFICATION BELOW. The SignalR frame is an array indexed by
/// ordinal, so if TAG_DEF and the running build disagree about which slot a tag occupies, every
/// value lands on the wrong gauge - plausible numbers, wrong labels, no error anywhere. That is
/// the worst failure mode in the system, so it is checked at startup rather than trusted.
/// </summary>
public static class TagDefinitionSeeder
{
    /// <summary>
    /// Ensure TAG_DEF matches the compiled catalogue, and return the id map.
    ///
    /// Inserts what is missing and updates what has changed. It does NOT delete rows the
    /// catalogue no longer declares: TAG_SAMPLE has a foreign key to TAG_DEF, so a tag with
    /// history cannot be removed without destroying that history. An orphaned definition is
    /// harmless - nothing will write to it again.
    /// </summary>
    public static async Task<TagIdMap> EnsureSeededAsync(
        OracleConnectionFactory factory,
        CancellationToken ct = default)
    {
        await using var connection = await factory.OpenAsync(ct);

        foreach (var def in TagCatalog.All)
        {
            await UpsertAsync(connection, def, ct);
        }

        var map = await LoadMapAsync(connection, ct);
        await VerifyOrdinalsAsync(connection, ct);
        return map;
    }

    /// <summary>Read the name-to-id map without touching the catalogue. Used by readers.</summary>
    public static async Task<TagIdMap> LoadMapAsync(OracleConnectionFactory factory, CancellationToken ct = default)
    {
        await using var connection = await factory.OpenAsync(ct);
        return await LoadMapAsync(connection, ct);
    }

    private static async Task<TagIdMap> LoadMapAsync(OracleConnection connection, CancellationToken ct)
    {
        var map = new Dictionary<string, int>(StringComparer.Ordinal);

        await using var cmd = new OracleCommand("SELECT TAG_NAME, TAG_ID FROM TAG_DEF", connection);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) map[reader.GetString(0)] = reader.GetInt32(1);

        return new TagIdMap(map);
    }

    private static async Task UpsertAsync(OracleConnection connection, TagDefinition def, CancellationToken ct)
    {
        await using var cmd = new OracleCommand(
            """
            MERGE INTO TAG_DEF d
            USING (SELECT :name AS TAG_NAME FROM dual) s
               ON (d.TAG_NAME = s.TAG_NAME)
             WHEN MATCHED THEN UPDATE SET
                   d.DESCRIPTION = :descr, d.UNIT = :unit,
                   d.SIM_PROVENANCE = :simprov, d.LIVE_AVAILABILITY = :liveavail,
                   d.LIVE_NOTE = :note, d.DECIMALS = :decimals,
                   d.LIM_LOW = :lo, d.LIM_HIGH = :hi,
                   d.LIM_WARN_LOW = :wlo, d.LIM_WARN_HIGH = :whi,
                   d.LIM_ALARM_LOW = :alo, d.LIM_ALARM_HIGH = :ahi,
                   d.LIM_TRIP_HIGH = :trip, d.ORDINAL = :ordinal
             WHEN NOT MATCHED THEN
                   INSERT (TAG_NAME, DESCRIPTION, UNIT, SIM_PROVENANCE, LIVE_AVAILABILITY,
                           LIVE_NOTE, DECIMALS, LIM_LOW, LIM_HIGH, LIM_WARN_LOW, LIM_WARN_HIGH,
                           LIM_ALARM_LOW, LIM_ALARM_HIGH, LIM_TRIP_HIGH, ORDINAL)
                   VALUES (:name, :descr, :unit, :simprov, :liveavail,
                           :note, :decimals, :lo, :hi, :wlo, :whi, :alo, :ahi, :trip, :ordinal)
            """,
            connection)
        { BindByName = true };

        var p = cmd.Parameters;
        p.Add(":name", OracleDbType.Varchar2, def.TagName, ParameterDirection.Input);
        p.Add(":descr", OracleDbType.Varchar2, def.Description, ParameterDirection.Input);
        p.Add(":unit", OracleDbType.Varchar2, (object?)def.Unit ?? DBNull.Value, ParameterDirection.Input);
        p.Add(":simprov", OracleDbType.Varchar2, def.SimulationProvenance.ToWire(), ParameterDirection.Input);
        p.Add(":liveavail", OracleDbType.Varchar2, def.LiveAvailability.ToWire(), ParameterDirection.Input);
        p.Add(":note", OracleDbType.Varchar2, (object?)def.LiveNote ?? DBNull.Value, ParameterDirection.Input);
        p.Add(":decimals", OracleDbType.Int32, (object?)def.Decimals ?? DBNull.Value, ParameterDirection.Input);
        p.Add(":lo", OracleDbType.BinaryDouble, Nullable(def.Limits.Low), ParameterDirection.Input);
        p.Add(":hi", OracleDbType.BinaryDouble, Nullable(def.Limits.High), ParameterDirection.Input);
        p.Add(":wlo", OracleDbType.BinaryDouble, Nullable(def.Limits.WarningLow), ParameterDirection.Input);
        p.Add(":whi", OracleDbType.BinaryDouble, Nullable(def.Limits.WarningHigh), ParameterDirection.Input);
        p.Add(":alo", OracleDbType.BinaryDouble, Nullable(def.Limits.AlarmLow), ParameterDirection.Input);
        p.Add(":ahi", OracleDbType.BinaryDouble, Nullable(def.Limits.AlarmHigh), ParameterDirection.Input);
        p.Add(":trip", OracleDbType.BinaryDouble, Nullable(def.Limits.TripHigh), ParameterDirection.Input);
        p.Add(":ordinal", OracleDbType.Int32, def.Ordinal, ParameterDirection.Input);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Fail loudly if TAG_DEF and the compiled catalogue disagree about any ordinal. See the
    /// class comment for why this is worth a startup round trip.
    /// </summary>
    private static async Task VerifyOrdinalsAsync(OracleConnection connection, CancellationToken ct)
    {
        var mismatches = new List<string>();

        await using var cmd = new OracleCommand("SELECT TAG_NAME, ORDINAL FROM TAG_DEF", connection);
        await using var reader = await cmd.ExecuteReaderAsync(ct);

        while (await reader.ReadAsync(ct))
        {
            var name = reader.GetString(0);
            var ordinal = reader.GetInt32(1);
            var def = TagCatalog.TryGet(name);

            if (def is null) continue;   // an orphan from an older catalogue; harmless
            if (def.Ordinal != ordinal) mismatches.Add($"{name}: TAG_DEF={ordinal}, build={def.Ordinal}");
        }

        if (mismatches.Count > 0)
        {
            throw new InvalidOperationException(
                $"TAG_DEF ordinals disagree with the compiled catalogue in {mismatches.Count} place(s). " +
                "Every value on the SignalR wire is indexed by ordinal, so this would put readings " +
                "on the wrong tags with no error anywhere.\n  " +
                string.Join("\n  ", mismatches.Take(10)));
        }
    }

    private static object Nullable(double? v) => v.HasValue ? v.Value : DBNull.Value;
}
