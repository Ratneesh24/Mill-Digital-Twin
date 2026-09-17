using System.Data;
using System.Diagnostics;
using Oracle.ManagedDataAccess.Client;

namespace Crm04.Persistence.Maintenance;

/// <param name="CutoffFrameId">Frames at or below this id are older than the retention window.</param>
/// <param name="FrameRowsDeleted">Rows removed from FRAME this pass.</param>
/// <param name="SampleRowsDeleted">Rows removed from TAG_SAMPLE this pass.</param>
/// <param name="ReachedCutoff">
/// False when the pass ran out of time budget with rows still below the cutoff. The caller MUST
/// surface this: it is the only signal that retention is losing the race against the writer.
/// </param>
public sealed record RetentionResult(
    long CutoffFrameId,
    int FrameRowsDeleted,
    int SampleRowsDeleted,
    bool ReachedCutoff);

/// <summary>
/// Keeps TAG_SAMPLE from filling the tablespace.
///
/// At 1,080 rows/second the table grows by ~155 MB an hour and ~93M rows a day.
///
/// This database does NOT have the Partitioning option (confirmed by ORA-00439 on the first
/// --apply-ddl against mill4db), so retention is a chunked DELETE rather than a DROP PARTITION.
/// That distinction is not academic:
///
///   DROP PARTITION was a metadata operation - instant, no redo, and it COULD NOT FALL BEHIND.
///   A DELETE can. Each minute's pass has to clear roughly 65,000 TAG_SAMPLE rows just to stand
///   still, and if it stops keeping up nothing else in the system notices until the tablespace
///   is full. <see cref="RetentionResult.ReachedCutoff"/> exists solely to make that visible.
///
/// The delete is cheap despite the volume because TAG_SAMPLE is an index-organized table whose
/// primary key is (FRAME_ID, TAG_ID): FRAME_ID leads, so `WHERE FRAME_ID &lt;= :cutoff` is an
/// index range scan over physically contiguous rows, not a full scan.
///
/// Space is reclaimed but not returned to the OS. The segment settles at its high-water mark;
/// because FRAME_ID only ever increases, emptied leaf blocks are reused by new inserts, so the
/// size plateaus (~310 MB at the default 2-hour window) rather than growing without bound.
/// </summary>
public sealed class RetentionService
{
    /// <summary>
    /// Rows per DELETE. ODP.NET auto-commits each statement when no explicit transaction is
    /// open, so this is also the commit interval - small enough to keep undo modest and to
    /// never hold a long lock against the 10 Hz writer.
    /// </summary>
    private const int ChunkRows = 50_000;

    /// <summary>
    /// Wall-clock cap for one pass. Retention runs once a minute and must never monopolise the
    /// connection; whatever is left is picked up on the next tick, and the shortfall is reported.
    /// </summary>
    private static readonly TimeSpan PassBudget = TimeSpan.FromSeconds(30);

    private readonly OracleConnectionFactory _factory;

    public RetentionService(OracleConnectionFactory factory) => _factory = factory;

    /// <summary>
    /// Delete every frame, and every sample of it, older than <paramref name="retention"/>.
    ///
    /// The cutoff is found in FRAME by EPOCH_MS and then applied as a FRAME_ID, because that is
    /// the column both tables are keyed on and the only one indexed in both.
    /// </summary>
    public async Task<RetentionResult> ApplyAsync(TimeSpan retention, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);

        var cutoffMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - (long)retention.TotalMilliseconds;

        var cutoffFrameId = await ScalarAsync(connection,
            "SELECT NVL(MAX(FRAME_ID), 0) FROM FRAME WHERE EPOCH_MS < :cutoff",
            ("cutoff", OracleDbType.Int64, cutoffMs), ct);

        if (cutoffFrameId <= 0) return new RetentionResult(0, 0, 0, ReachedCutoff: true);

        var budget = Stopwatch.StartNew();

        // TAG_SAMPLE FIRST, and FRAME only if it finished. TAG_SAMPLE is ~108x the rows, so it is
        // what actually threatens the tablespace and it gets the budget. Deleting the headers
        // first would also leave samples whose frame is gone, which reads as data that cannot be
        // explained; orphaned FRAME headers are merely invisible and go on the next pass.
        var (sampleRows, samplesDone) =
            await DeleteBelowAsync(connection, "TAG_SAMPLE", cutoffFrameId, budget, ct);

        var frameRows = 0;
        var framesDone = false;
        if (samplesDone)
        {
            (frameRows, framesDone) =
                await DeleteBelowAsync(connection, "FRAME", cutoffFrameId, budget, ct);
        }

        return new RetentionResult(cutoffFrameId, frameRows, sampleRows, samplesDone && framesDone);
    }

    /// <summary>
    /// Trend retention. TREND_SAMPLE is small (a few million rows at most) and its rows are
    /// addressed by bucket size, not by frame, so it gets its own unchunked delete.
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
    /// Delete rows at or below the cutoff in committed chunks until the table is clear or the
    /// pass budget expires.
    /// </summary>
    /// <returns>
    /// Rows deleted, and whether the cutoff was actually reached. A false second element means
    /// there is still old data in the table - the caller is expected to complain about it.
    /// </returns>
    private static async Task<(int Deleted, bool ReachedCutoff)> DeleteBelowAsync(
        OracleConnection connection,
        string tableName,
        long cutoffFrameId,
        Stopwatch budget,
        CancellationToken ct)
    {
        var total = 0;

        while (true)
        {
            if (budget.Elapsed >= PassBudget) return (total, false);

            // tableName is one of two compile-time literals from ApplyAsync, never external input.
            // ChunkRows is a constant rather than a bind variable so the optimiser costs the
            // ROWNUM stop key rather than guessing at it.
            await using var cmd = new OracleCommand(
                $"DELETE FROM {tableName} WHERE FRAME_ID <= :cutoff AND ROWNUM <= {ChunkRows}",
                connection)
            { BindByName = true };

            cmd.Parameters.Add(":cutoff", OracleDbType.Int64, cutoffFrameId, ParameterDirection.Input);

            var rows = await cmd.ExecuteNonQueryAsync(ct);
            total += rows;

            // A short chunk means the WHERE clause ran out of rows, not that the chunk was capped.
            if (rows < ChunkRows) return (total, true);
        }
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
