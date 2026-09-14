using Crm04.Domain.Tags;
using Crm04.Domain.Types;
using Oracle.ManagedDataAccess.Client;

namespace Crm04.Persistence.Raw;

/// <param name="TagCount">
/// What the writer said it wrote. Compared against the rows actually read, so a truncated frame
/// is detectable rather than silently misread as a feed with many absent tags.
/// </param>
public sealed record FrameHeader(long FrameId, long EpochMs, string SourceId, OperatingMode Mode, int TagCount);

/// <summary>Reads frames back out of Oracle. The API's side of the write path.</summary>
public sealed class RawFrameReader
{
    private readonly OracleConnectionFactory _factory;
    private readonly Dictionary<int, string> _tagNameById;

    public RawFrameReader(OracleConnectionFactory factory, IReadOnlyDictionary<string, int> tagIdByName)
    {
        _factory = factory;
        _tagNameById = tagIdByName.ToDictionary(kv => kv.Value, kv => kv.Key);
    }

    /// <summary>
    /// The newest FRAME_ID, or 0 when the table is empty. The API starts its watermark here so a
    /// restart resumes at the live edge instead of replaying hours of history at 10 Hz — which it
    /// could never catch up from, and which nobody wants to watch.
    /// </summary>
    public async Task<long> GetLatestFrameIdAsync(CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await using var cmd = new OracleCommand(
            "SELECT NVL(MAX(FRAME_ID), 0) FROM CURRENT_FRAME", connection);

        var value = await cmd.ExecuteScalarAsync(ct);
        return value is null or DBNull ? 0L : Convert.ToInt64(value);
    }

    /// <summary>
    /// Frame headers newer than the watermark.
    ///
    /// THIS IS THE IDLE-CASE QUERY, run several times a second forever, so its cost matters more
    /// than its throughput: a primary-key range scan that usually returns zero rows, fully
    /// buffer-cached, sub-millisecond. Polling at this cost is invisible load.
    /// </summary>
    public async Task<IReadOnlyList<FrameHeader>> GetHeadersAfterAsync(
        long watermark, int max, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await using var cmd = new OracleCommand(
            """
            SELECT FRAME_ID, EPOCH_MS, SOURCE_ID, OP_MODE, TAG_COUNT
              FROM FRAME
             WHERE FRAME_ID > :watermark
             ORDER BY FRAME_ID
             FETCH FIRST :max ROWS ONLY
            """,
            connection)
        { BindByName = true };

        cmd.Parameters.Add(":watermark", OracleDbType.Int64, watermark, System.Data.ParameterDirection.Input);
        cmd.Parameters.Add(":max", OracleDbType.Int32, max, System.Data.ParameterDirection.Input);

        var headers = new List<FrameHeader>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            headers.Add(new FrameHeader(
                FrameId: reader.GetInt64(0),
                EpochMs: reader.GetInt64(1),
                SourceId: reader.GetString(2),
                Mode: WireNames.ParseOperatingMode(reader.GetString(3)),
                TagCount: reader.GetInt32(4)));
        }

        return headers;
    }

    /// <summary>
    /// One whole frame. On the index-organized TAG_SAMPLE this is a single contiguous range scan
    /// of ~108 rows with no table access at all — which is the entire reason for the IOT.
    /// </summary>
    public async Task<Dictionary<string, TagValue>> ReadFrameAsync(long frameId, CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);
        await using var cmd = new OracleCommand(
            """
            SELECT TAG_ID, VAL_KIND, NUM_VALUE, STR_VALUE
              FROM TAG_SAMPLE
             WHERE FRAME_ID = :id
            """,
            connection)
        { BindByName = true };

        cmd.Parameters.Add(":id", OracleDbType.Int64, frameId, System.Data.ParameterDirection.Input);
        return await ReadValuesAsync(cmd, ct);
    }

    /// <summary>
    /// The current value of every tag, from the cache table. What a newly connected client gets,
    /// so its first render is immediate rather than a wait for the next frame.
    /// </summary>
    public async Task<(long FrameId, long EpochMs, Dictionary<string, TagValue> Values)> ReadCurrentAsync(
        CancellationToken ct = default)
    {
        await using var connection = await _factory.OpenAsync(ct);

        await using var headerCmd = new OracleCommand(
            "SELECT FRAME_ID, EPOCH_MS FROM CURRENT_FRAME WHERE ONLY_ROW = 1", connection);

        long frameId = 0, epochMs = 0;
        await using (var hr = await headerCmd.ExecuteReaderAsync(ct))
        {
            if (await hr.ReadAsync(ct))
            {
                frameId = hr.GetInt64(0);
                epochMs = hr.GetInt64(1);
            }
        }

        await using var cmd = new OracleCommand(
            "SELECT TAG_ID, VAL_KIND, NUM_VALUE, STR_VALUE FROM CURRENT_TAG", connection);

        return (frameId, epochMs, await ReadValuesAsync(cmd, ct));
    }

    private async Task<Dictionary<string, TagValue>> ReadValuesAsync(OracleCommand cmd, CancellationToken ct)
    {
        var values = new Dictionary<string, TagValue>(TagCatalog.Count, StringComparer.Ordinal);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var tagId = reader.GetInt32(0);

            // A row whose TAG_ID is not in our map means TAG_DEF holds a tag this build does not
            // know. Skipping is right: TagFactory would mark it BAD and discard the value anyway,
            // and inventing a name for it would be worse.
            if (!_tagNameById.TryGetValue(tagId, out var tagName)) continue;

            var valKind = reader.GetString(1)[0];
            double? num = reader.IsDBNull(2) ? null : reader.GetDouble(2);
            string? str = reader.IsDBNull(3) ? null : reader.GetString(3);

            values[tagName] = TagValue.FromValKind(valKind, num, str);
        }

        return values;
    }
}
