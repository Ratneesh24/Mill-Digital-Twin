using System.Data;
using Oracle.ManagedDataAccess.Client;

namespace Crm04.Persistence.Maintenance;

/// <summary>
/// Aggregates the 10 Hz samples into the pre-bucketed series the trend charts read.
///
/// THIS IS WHY THE TREND PAGE IS FAST. A one-hour chart of one signal is 36,000 rows in
/// TAG_SAMPLE and at most 240 in TREND_SAMPLE. Doing the aggregation once, here, on the writer
/// side, means every chart request afterwards is a single contiguous range scan of a small
/// index-organized table - and the 10 Hz table is never touched by a reader at all.
///
/// It runs in the Feeder rather than the API because it WRITES. The API stays read-only against
/// Oracle apart from alarm acknowledgements.
/// </summary>
public sealed class TrendRollupService
{
    private readonly OracleConnectionFactory _factory;

    /// <summary>
    /// Bucket sizes, matching the windows the UI offers at 240 points each:
    /// 1 s covers 4 min, 5 s covers 20 min, 15 s covers 1 hour.
    /// </summary>
    private static readonly int[] BucketSeconds = [1, 5, 15];

    public TrendRollupService(OracleConnectionFactory factory) => _factory = factory;

    /// <summary>
    /// Roll up the buckets that have closed since the last run.
    ///
    /// Only COMPLETE buckets are aggregated - the current one is still filling, and writing a
    /// partial average would put a point on the chart that changes value as more samples arrive.
    /// Re-running is safe: MERGE recomputes a bucket from its samples rather than accumulating.
    /// </summary>
    /// <param name="lookback">
    /// How far back to recompute. Needs to exceed the interval between runs so a bucket that
    /// closed while the service was busy is not skipped; overlap is harmless because the MERGE
    /// is idempotent.
    /// </param>
    public async Task<int> RollUpAsync(TimeSpan lookback, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var rows = 0;

        foreach (var bucketSec in BucketSeconds)
        {
            var bucketMs = bucketSec * 1000L;

            // The newest bucket boundary that has definitely closed.
            var latestClosed = now / bucketMs * bucketMs;
            var from = latestClosed - (long)lookback.TotalMilliseconds;

            rows += await MergeBucketAsync(connection, bucketSec, bucketMs, from, latestClosed, ct);
        }

        return rows;
    }

    /// <summary>
    /// One MERGE per bucket size, aggregating in the database rather than pulling samples out to
    /// average them in C#. Numeric kinds only: an average of a status string is meaningless, and
    /// 'X' rows carry no value to average.
    /// </summary>
    private static async Task<int> MergeBucketAsync(
        OracleConnection connection,
        int bucketSec,
        long bucketMs,
        long fromMs,
        long toMs,
        CancellationToken ct)
    {
        await using var cmd = new OracleCommand(
            """
            MERGE INTO TREND_SAMPLE t
            USING (
              SELECT s.TAG_ID                                   AS TAG_ID,
                     FLOOR(f.EPOCH_MS / :bucketms) * :bucketms  AS BUCKET_MS,
                     AVG(s.NUM_VALUE)                           AS AVG_V,
                     MIN(s.NUM_VALUE)                           AS MIN_V,
                     MAX(s.NUM_VALUE)                           AS MAX_V,
                     COUNT(s.NUM_VALUE)                         AS N
                FROM TAG_SAMPLE s
                JOIN FRAME f ON f.FRAME_ID = s.FRAME_ID
               WHERE f.EPOCH_MS >= :fromms
                 AND f.EPOCH_MS <  :toms
                 AND s.VAL_KIND IN ('N','B')
                 AND s.NUM_VALUE IS NOT NULL
               GROUP BY s.TAG_ID, FLOOR(f.EPOCH_MS / :bucketms) * :bucketms
            ) src
               ON (t.TAG_ID = src.TAG_ID AND t.BUCKET_SEC = :bucketsec AND t.BUCKET_MS = src.BUCKET_MS)
             WHEN MATCHED THEN UPDATE SET
                   t.AVG_V = src.AVG_V, t.MIN_V = src.MIN_V, t.MAX_V = src.MAX_V, t.N = src.N
             WHEN NOT MATCHED THEN
                   INSERT (TAG_ID, BUCKET_SEC, BUCKET_MS, AVG_V, MIN_V, MAX_V, N)
                   VALUES (src.TAG_ID, :bucketsec, src.BUCKET_MS, src.AVG_V, src.MIN_V, src.MAX_V, src.N)
            """,
            connection)
        { BindByName = true };

        cmd.Parameters.Add(":bucketms", OracleDbType.Int64, bucketMs, ParameterDirection.Input);
        cmd.Parameters.Add(":fromms", OracleDbType.Int64, fromMs, ParameterDirection.Input);
        cmd.Parameters.Add(":toms", OracleDbType.Int64, toMs, ParameterDirection.Input);
        cmd.Parameters.Add(":bucketsec", OracleDbType.Int32, bucketSec, ParameterDirection.Input);

        return await cmd.ExecuteNonQueryAsync(ct);
    }
}
