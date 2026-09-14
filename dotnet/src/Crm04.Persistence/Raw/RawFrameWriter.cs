using System.Data;
using Crm04.Domain.Tags;
using Crm04.Domain.Types;
using Oracle.ManagedDataAccess.Client;

namespace Crm04.Persistence.Raw;

/// <summary>
/// Writes one frame into Oracle. The only thing in the system that inserts process values.
///
/// WHY THIS IS NOT EF CORE. At 1,080 rows/second, change tracking would be indefensible — and
/// more decisively, EF has no equivalent of ODP.NET array binding, which is what lets 108 rows
/// go over the wire in ONE round trip instead of 108. EF Core still owns migrations and the
/// low-rate entities; it is simply not on this path.
///
/// THE BATCHING DECISION, stated once: batch the ROWS WITHIN a frame, commit PER frame. Batching
/// across frames would delay visibility, and "the data lands in Oracle and is rendered at the
/// same time" is the requirement. Ten commits a second is nothing to Oracle.
///
/// Budget is 100 ms per frame. Expected cost is 3-6 ms against a local database.
/// </summary>
public sealed class RawFrameWriter : IDisposable
{
    private readonly OracleConnectionFactory _factory;
    private readonly Dictionary<string, int> _tagIdByName;

    private OracleConnection? _connection;

    // Reused across every frame so the hot path allocates nothing in steady state. Sized to the
    // catalogue because a frame can never carry more tags than exist.
    private readonly long[] _frameIds;
    private readonly int[] _tagIds;
    private readonly string[] _kinds;
    private readonly object[] _nums;
    private readonly object[] _strs;

    public RawFrameWriter(OracleConnectionFactory factory, IReadOnlyDictionary<string, int> tagIdByName)
    {
        _factory = factory;
        _tagIdByName = new Dictionary<string, int>(tagIdByName, StringComparer.Ordinal);

        var capacity = Math.Max(TagCatalog.Count, tagIdByName.Count);
        _frameIds = new long[capacity];
        _tagIds = new int[capacity];
        _kinds = new string[capacity];
        _nums = new object[capacity];
        _strs = new object[capacity];
    }

    /// <summary>Tags in the frame that the TAG_DEF table does not know. Reported, then skipped.</summary>
    public HashSet<string> UnknownTagsSeen { get; } = new(StringComparer.Ordinal);

    private async Task<OracleConnection> ConnectionAsync(CancellationToken ct)
    {
        if (_connection is { State: ConnectionState.Open }) return _connection;

        _connection?.Dispose();
        _connection = await _factory.OpenAsync(ct);
        return _connection;
    }

    /// <summary>
    /// Insert one frame: the header, its tag samples, and the current-value cache, in a single
    /// transaction. Either the whole frame is visible or none of it is — a reader must never see
    /// a header whose samples have not landed yet.
    /// </summary>
    /// <returns>The FRAME_ID assigned by the sequence.</returns>
    public async Task<long> WriteFrameAsync(
        IReadOnlyDictionary<string, TagValue> values,
        long epochMs,
        string sourceId,
        OperatingMode mode,
        CancellationToken ct = default)
    {
        var connection = await ConnectionAsync(ct);

        // Flatten the frame into the parameter arrays, resolving names to ids as we go.
        var n = 0;
        foreach (var (name, value) in values)
        {
            if (!_tagIdByName.TryGetValue(name, out var tagId))
            {
                // A tag TAG_DEF does not declare cannot be stored — there is no id for it and the
                // foreign key would reject it. Record it once so the operator learns the catalogue
                // and the feed have diverged, then carry on rather than dropping the whole frame.
                UnknownTagsSeen.Add(name);
                continue;
            }

            _tagIds[n] = tagId;
            _kinds[n] = value.ToValKind().ToString();

            switch (value.Kind)
            {
                case TagValueKind.Number:
                    _nums[n] = value.AsRawNumber!;
                    _strs[n] = DBNull.Value;
                    break;
                case TagValueKind.Boolean:
                    _nums[n] = value.AsBoolean == true ? 1d : 0d;
                    _strs[n] = DBNull.Value;
                    break;
                case TagValueKind.String:
                    _nums[n] = DBNull.Value;
                    _strs[n] = value.AsString!;
                    break;
                default:
                    // 'X' — the tag is on the feed and reads nothing. BOTH columns null, and a row
                    // still written. That row is the difference between "instrument down" and
                    // "not instrumented", and it is why this case is not simply skipped.
                    _nums[n] = DBNull.Value;
                    _strs[n] = DBNull.Value;
                    break;
            }

            n++;
        }

        await using var tx = (OracleTransaction)await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        try
        {
            var frameId = await InsertHeaderAsync(connection, tx, epochMs, sourceId, mode, n, ct);

            for (var i = 0; i < n; i++) _frameIds[i] = frameId;

            await InsertSamplesAsync(connection, tx, n, ct);
            await MergeCurrentTagsAsync(connection, tx, frameId, epochMs, n, ct);
            await UpdateCurrentFrameAsync(connection, tx, frameId, epochMs, sourceId, mode, n, ct);

            await tx.CommitAsync(ct);
            return frameId;
        }
        catch
        {
            await tx.RollbackAsync(CancellationToken.None);
            throw;
        }
    }

    private static async Task<long> InsertHeaderAsync(
        OracleConnection connection,
        OracleTransaction tx,
        long epochMs,
        string sourceId,
        OperatingMode mode,
        int tagCount,
        CancellationToken ct)
    {
        await using var cmd = new OracleCommand(
            """
            INSERT INTO FRAME (FRAME_ID, EPOCH_MS, TS_UTC, SOURCE_ID, OP_MODE, TAG_COUNT)
            VALUES (FRAME_SEQ.NEXTVAL, :ms, :ts, :src, :mode, :n)
            RETURNING FRAME_ID INTO :id
            """,
            connection)
        { Transaction = tx, BindByName = true };

        cmd.Parameters.Add(":ms", OracleDbType.Int64, epochMs, ParameterDirection.Input);
        cmd.Parameters.Add(":ts", OracleDbType.TimeStamp,
            DateTimeOffset.FromUnixTimeMilliseconds(epochMs).UtcDateTime, ParameterDirection.Input);
        cmd.Parameters.Add(":src", OracleDbType.Varchar2, sourceId, ParameterDirection.Input);
        cmd.Parameters.Add(":mode", OracleDbType.Varchar2, mode.ToWire(), ParameterDirection.Input);
        cmd.Parameters.Add(":n", OracleDbType.Int32, tagCount, ParameterDirection.Input);

        var idParam = cmd.Parameters.Add(":id", OracleDbType.Int64);
        idParam.Direction = ParameterDirection.Output;

        await cmd.ExecuteNonQueryAsync(ct);
        return long.Parse(idParam.Value!.ToString()!);
    }

    /// <summary>
    /// All 108 sample rows in ONE round trip, via ODP.NET array binding. This is the single
    /// most important line in the write path: without it the frame costs 108 network round trips
    /// and the 100 ms budget is gone before the physics has been read.
    /// </summary>
    private async Task InsertSamplesAsync(OracleConnection connection, OracleTransaction tx, int n, CancellationToken ct)
    {
        if (n == 0) return;

        await using var cmd = new OracleCommand(
            """
            INSERT INTO TAG_SAMPLE (FRAME_ID, TAG_ID, VAL_KIND, NUM_VALUE, STR_VALUE)
            VALUES (:f, :t, :k, :nv, :sv)
            """,
            connection)
        { Transaction = tx, BindByName = true, ArrayBindCount = n };

        AddArray(cmd, ":f", OracleDbType.Int64, Slice(_frameIds, n));
        AddArray(cmd, ":t", OracleDbType.Int32, Slice(_tagIds, n));
        AddArray(cmd, ":k", OracleDbType.Char, Slice(_kinds, n));
        AddArray(cmd, ":nv", OracleDbType.BinaryDouble, Slice(_nums, n));
        AddArray(cmd, ":sv", OracleDbType.Varchar2, Slice(_strs, n));

        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Keep CURRENT_TAG in step. Also array-bound, so the cache costs one more round trip rather
    /// than 108. MERGE rather than DELETE+INSERT so a reader never sees the table empty.
    /// </summary>
    private async Task MergeCurrentTagsAsync(
        OracleConnection connection,
        OracleTransaction tx,
        long frameId,
        long epochMs,
        int n,
        CancellationToken ct)
    {
        if (n == 0) return;

        await using var cmd = new OracleCommand(
            """
            MERGE INTO CURRENT_TAG c
            USING (SELECT :t AS TAG_ID FROM dual) s
               ON (c.TAG_ID = s.TAG_ID)
             WHEN MATCHED THEN UPDATE SET
                   c.FRAME_ID = :f, c.EPOCH_MS = :ms, c.VAL_KIND = :k,
                   c.NUM_VALUE = :nv, c.STR_VALUE = :sv
             WHEN NOT MATCHED THEN
                   INSERT (TAG_ID, FRAME_ID, EPOCH_MS, VAL_KIND, NUM_VALUE, STR_VALUE)
                   VALUES (:t, :f, :ms, :k, :nv, :sv)
            """,
            connection)
        { Transaction = tx, BindByName = true, ArrayBindCount = n };

        var epochs = new object[n];
        Array.Fill(epochs, epochMs);

        AddArray(cmd, ":t", OracleDbType.Int32, Slice(_tagIds, n));
        AddArray(cmd, ":f", OracleDbType.Int64, Slice(_frameIds, n));
        AddArray(cmd, ":ms", OracleDbType.Int64, epochs);
        AddArray(cmd, ":k", OracleDbType.Char, Slice(_kinds, n));
        AddArray(cmd, ":nv", OracleDbType.BinaryDouble, Slice(_nums, n));
        AddArray(cmd, ":sv", OracleDbType.Varchar2, Slice(_strs, n));

        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task UpdateCurrentFrameAsync(
        OracleConnection connection,
        OracleTransaction tx,
        long frameId,
        long epochMs,
        string sourceId,
        OperatingMode mode,
        int tagCount,
        CancellationToken ct)
    {
        await using var cmd = new OracleCommand(
            """
            MERGE INTO CURRENT_FRAME c
            USING (SELECT 1 AS ONLY_ROW FROM dual) s
               ON (c.ONLY_ROW = s.ONLY_ROW)
             WHEN MATCHED THEN UPDATE SET
                   c.FRAME_ID = :f, c.EPOCH_MS = :ms, c.OP_MODE = :mode,
                   c.SOURCE_ID = :src, c.TAG_COUNT = :n
             WHEN NOT MATCHED THEN
                   INSERT (ONLY_ROW, FRAME_ID, EPOCH_MS, OP_MODE, SOURCE_ID, TAG_COUNT)
                   VALUES (1, :f, :ms, :mode, :src, :n)
            """,
            connection)
        { Transaction = tx, BindByName = true };

        cmd.Parameters.Add(":f", OracleDbType.Int64, frameId, ParameterDirection.Input);
        cmd.Parameters.Add(":ms", OracleDbType.Int64, epochMs, ParameterDirection.Input);
        cmd.Parameters.Add(":mode", OracleDbType.Varchar2, mode.ToWire(), ParameterDirection.Input);
        cmd.Parameters.Add(":src", OracleDbType.Varchar2, sourceId, ParameterDirection.Input);
        cmd.Parameters.Add(":n", OracleDbType.Int32, tagCount, ParameterDirection.Input);

        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static void AddArray(OracleCommand cmd, string name, OracleDbType type, Array values)
    {
        var p = cmd.Parameters.Add(name, type);
        p.Direction = ParameterDirection.Input;
        p.Value = values;
    }

    private static T[] Slice<T>(T[] source, int n)
    {
        // ODP.NET binds the whole array, so a shorter frame needs an exactly-sized copy. n is at
        // most 122, so this is a trivial allocation and not worth pooling.
        var slice = new T[n];
        Array.Copy(source, slice, n);
        return slice;
    }

    public void Dispose() => _connection?.Dispose();
}
