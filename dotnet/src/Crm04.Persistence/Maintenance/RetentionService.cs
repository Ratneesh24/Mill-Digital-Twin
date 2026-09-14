using System.Data;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;

namespace Crm04.Persistence.Maintenance;

public sealed record RetentionResult(long CutoffFrameId, int FramePartitionsDropped, int SamplePartitionsDropped);

/// <summary>
/// Keeps TAG_SAMPLE from filling the tablespace.
///
/// At 1,080 rows/second the table grows by ~155 MB an hour and ~93M rows a day. With the
/// Partitioning option licensed — confirmed for this database — retention is a metadata
/// operation: DROP PARTITION returns instantly, generates no redo storm, and never blocks the
/// writer. The alternative on an unlicensed database is a chunked DELETE loop, which works but
/// spends real I/O doing it.
///
/// Both FRAME and TAG_SAMPLE are interval-partitioned on FRAME_ID with the same 36,000-frame
/// boundaries (one hour at 10 Hz), so one cutoff drops matching partitions from both. That
/// shared key is also why there is no enforced foreign key between them: an enabled FK would
/// refuse to let the parent partition go.
/// </summary>
public sealed class RetentionService
{
    private readonly OracleConnectionFactory _factory;

    public RetentionService(OracleConnectionFactory factory) => _factory = factory;

    /// <summary>
    /// Drop every partition holding frames older than <paramref name="retention"/>.
    ///
    /// The cutoff is found in FRAME by EPOCH_MS and then applied as a FRAME_ID, because that is
    /// the partition key. A partition is dropped only when its entire range is below the cutoff -
    /// the high-value bound is exclusive, so a partition whose bound is at or below the cutoff
    /// frame contains nothing newer.
    /// </summary>
    public async Task<RetentionResult> ApplyAsync(TimeSpan retention, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);

        var cutoffMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - (long)retention.TotalMilliseconds;

        var cutoffFrameId = await ScalarAsync(connection,
            "SELECT NVL(MAX(FRAME_ID), 0) FROM FRAME WHERE EPOCH_MS < :cutoff",
            ("cutoff", OracleDbType.Int64, cutoffMs), ct);

        if (cutoffFrameId <= 0) return new RetentionResult(0, 0, 0);

        var framesDropped = await DropPartitionsBelowAsync(connection, "FRAME", cutoffFrameId, ct);
        var samplesDropped = await DropPartitionsBelowAsync(connection, "TAG_SAMPLE", cutoffFrameId, ct);

        return new RetentionResult(cutoffFrameId, framesDropped, samplesDropped);
    }

    /// <summary>
    /// Trend retention, which is a delete rather than a partition drop: TREND_SAMPLE is small
    /// (a few million rows at most) and its rows are addressed by bucket size, not by time range,
    /// so partitioning it would buy nothing.
    ///
    /// The finer buckets expire first. A one-second bucket is only interesting while someone is
    /// watching the last few minutes; after an hour the fifteen-second series says everything the
    /// chart can draw at 240 points.
    /// </summary>
    public async Task<int> TrimTrendsAsync(CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        var deleted = 0;
        foreach (var (bucketSec, keep) in new[]
                 {
                     (1, TimeSpan.FromHours(1)),
                     (5, TimeSpan.FromHours(6)),
                     (15, TimeSpan.FromDays(7)),
                 })
        {
            await using var cmd = new OracleCommand(
                "DELETE FROM TREND_SAMPLE WHERE BUCKET_SEC = :b AND BUCKET_MS < :cutoff", connection)
            { BindByName = true };

            cmd.Parameters.Add(":b", OracleDbType.Int32, bucketSec, ParameterDirection.Input);
            cmd.Parameters.Add(":cutoff", OracleDbType.Int64,
                now - (long)keep.TotalMilliseconds, ParameterDirection.Input);

            deleted += await cmd.ExecuteNonQueryAsync(ct);
        }

        return deleted;
    }

    /// <summary>
    /// Drop the partitions of one interval-partitioned table whose whole range sits below the
    /// cutoff. The first partition is never dropped - Oracle requires an interval-partitioned
    /// table to keep at least one range partition, and P_*_INIT is the anchor the intervals are
    /// measured from.
    /// </summary>
    private static async Task<int> DropPartitionsBelowAsync(
        OracleConnection connection, string tableName, long cutoffFrameId, CancellationToken ct)
    {
        var toDrop = new List<string>();

        await using (var cmd = new OracleCommand(
            """
            SELECT partition_name, high_value_json
              FROM user_tab_partitions
             WHERE table_name = :t
               AND partition_position > 1
             ORDER BY partition_position
            """,
            connection)
        { BindByName = true })
        {
            cmd.Parameters.Add(":t", OracleDbType.Varchar2, tableName, ParameterDirection.Input);

            try
            {
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    var name = reader.GetString(0);
                    var highValue = reader.IsDBNull(1) ? null : reader.GetString(1);
                    if (TryParseHighValue(highValue, out var bound) && bound <= cutoffFrameId)
                    {
                        toDrop.Add(name);
                    }
                }
            }
            catch (OracleException ex) when (ex.Number == 904)
            {
                // HIGH_VALUE_JSON is 21c+. On an older release fall back to the LONG column,
                // which cannot be read through a normal reader - handled below.
                toDrop.AddRange(await LegacyHighValueScanAsync(connection, tableName, cutoffFrameId, ct));
            }
        }

        foreach (var partition in toDrop)
        {
            await using var drop = new OracleCommand(
                $"ALTER TABLE {tableName} DROP PARTITION {partition} UPDATE INDEXES", connection);
            await drop.ExecuteNonQueryAsync(ct);
        }

        return toDrop.Count;
    }

    /// <summary>
    /// Pre-21c fallback. USER_TAB_PARTITIONS.HIGH_VALUE is a LONG, which ODP.NET cannot read
    /// through an ordinary reader, so a small PL/SQL block converts it to a string first.
    /// </summary>
    private static async Task<List<string>> LegacyHighValueScanAsync(
        OracleConnection connection, string tableName, long cutoffFrameId, CancellationToken ct)
    {
        var names = new List<string>();

        await using var cmd = new OracleCommand(
            """
            DECLARE
              CURSOR c IS
                SELECT partition_name, high_value
                  FROM user_tab_partitions
                 WHERE table_name = :t AND partition_position > 1
                 ORDER BY partition_position;
              v_names SYS.ODCIVARCHAR2LIST := SYS.ODCIVARCHAR2LIST();
              v_bound NUMBER;
            BEGIN
              FOR r IN c LOOP
                BEGIN
                  v_bound := TO_NUMBER(r.high_value);
                  IF v_bound <= :cutoff THEN
                    v_names.EXTEND;
                    v_names(v_names.COUNT) := r.partition_name;
                  END IF;
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
              END LOOP;
              OPEN :result FOR SELECT column_value FROM TABLE(v_names);
            END;
            """,
            connection)
        { BindByName = true };

        cmd.Parameters.Add(":t", OracleDbType.Varchar2, tableName, ParameterDirection.Input);
        cmd.Parameters.Add(":cutoff", OracleDbType.Int64, cutoffFrameId, ParameterDirection.Input);
        var cursor = cmd.Parameters.Add(":result", OracleDbType.RefCursor);
        cursor.Direction = ParameterDirection.Output;

        await cmd.ExecuteNonQueryAsync(ct);

        await using var reader = ((OracleRefCursor)cursor.Value).GetDataReader();
        while (await reader.ReadAsync(ct)) names.Add(reader.GetString(0));

        return names;
    }

    /// <summary>
    /// An interval partition's high value is a bare number for a NUMBER partition key, sometimes
    /// wrapped in JSON on 21c+. Anything unparseable is left alone - refusing to drop a partition
    /// we do not understand is the safe direction.
    /// </summary>
    internal static bool TryParseHighValue(string? highValue, out long bound)
    {
        bound = 0;
        if (string.IsNullOrWhiteSpace(highValue)) return false;

        var digits = new string(highValue.Where(char.IsAsciiDigit).ToArray());
        return digits.Length > 0 && long.TryParse(digits, out bound);
    }

    private static async Task<long> ScalarAsync(
        OracleConnection connection,
        string sql,
        (string Name, OracleDbType Type, object Value) parameter,
        CancellationToken ct)
    {
        await using var cmd = new OracleCommand(sql, connection) { BindByName = true };
        cmd.Parameters.Add(":" + parameter.Name, parameter.Type, parameter.Value, ParameterDirection.Input);

        var value = await cmd.ExecuteScalarAsync(ct);
        return value is null or DBNull ? 0L : Convert.ToInt64(value);
    }
}
