using Oracle.ManagedDataAccess.Client;

namespace Crm04.Persistence;

/// <param name="Options">Licensed database options, e.g. Partitioning. Empty when none are on.</param>
/// <param name="MissingPrivileges">Privileges the schema needs and does not have.</param>
public sealed record DatabaseFacts(
    string Banner,
    string SchemaName,
    IReadOnlyList<string> Options,
    IReadOnlyList<string> Privileges,
    IReadOnlyList<string> MissingPrivileges,
    IReadOnlyList<string> ExistingCrm04Tables,
    long? DefaultTablespaceFreeMb)
{
    public bool HasPartitioning => Options.Contains("Partitioning", StringComparer.OrdinalIgnoreCase);
}

/// <summary>
/// Asks the database what it is and what it will let us do, before any DDL is written against
/// assumptions.
///
/// This is not ceremony: whether the schema owner can actually CREATE TABLE, and how much free
/// space there is, cannot be guessed from a connection string.
///
/// What it must NOT be trusted for is licensing. Options are read from v$option, which an
/// application schema usually cannot select from, and TryListAsync turns that ORA-00942 into an
/// empty list - so "not licensed" and "not allowed to ask" arrive here as the same answer. This
/// is exactly how an --apply-ddl that later failed with ORA-00439 got a clean bill of health.
/// The schema is now written to need no options at all, which is the only robust fix.
/// </summary>
public static class DatabaseProbe
{
    /// <summary>Privileges the CRM04 schema needs to build and run.</summary>
    private static readonly string[] Required =
        ["CREATE SESSION", "CREATE TABLE", "CREATE SEQUENCE", "CREATE VIEW"];

    public static async Task<DatabaseFacts> RunAsync(OracleConnectionFactory factory, CancellationToken ct = default)
    {
        await using var connection = await factory.OpenAsync(ct);

        var banner = await ScalarAsync<string>(connection,
            "SELECT banner FROM v$version WHERE ROWNUM = 1", ct)
            ?? await ScalarAsync<string>(connection,
                "SELECT product || ' ' || version FROM product_component_version WHERE ROWNUM = 1", ct)
            ?? "unknown";

        var schema = await ScalarAsync<string>(connection, "SELECT USER FROM dual", ct) ?? "unknown";

        // v$version and v$option need SELECT on the dynamic views, which a plain application
        // schema often lacks. Not being able to ask is not a failure - it just means we cannot
        // confirm, and the caller is told that rather than being given a wrong answer.
        //
        // There is deliberately NO Enterprise-vs-Standard probe. The obvious candidate was here
        // and was simply wrong: SYS_CONTEXT('USERENV','EDITION_NAME') returns the Edition-Based
        // Redefinition edition (ORA$BASE on every ordinary database) and says nothing whatever
        // about the licence. It was never printed, so it misled quietly. The schema no longer
        // branches on Partitioning, so nothing needs the answer.
        var options = await TryListAsync(connection,
            "SELECT parameter FROM v$option WHERE value = 'TRUE' ORDER BY parameter", ct);

        var privileges = await TryListAsync(connection,
            "SELECT privilege FROM session_privs ORDER BY privilege", ct);

        var missing = privileges.Count == 0
            ? []   // could not read session_privs; do not claim privileges are missing
            : Required.Where(r => !privileges.Contains(r, StringComparer.OrdinalIgnoreCase)).ToList();

        var existing = await TryListAsync(connection,
            "SELECT table_name FROM user_tables ORDER BY table_name", ct);

        var freeMb = await TryScalarAsync<decimal?>(connection,
            """
            SELECT ROUND(SUM(f.bytes) / 1048576)
              FROM user_free_space f
             WHERE f.tablespace_name = (SELECT default_tablespace FROM user_users WHERE ROWNUM = 1)
            """, ct);

        return new DatabaseFacts(
            Banner: banner,
            SchemaName: schema,
            Options: options,
            Privileges: privileges,
            MissingPrivileges: missing,
            ExistingCrm04Tables: existing,
            DefaultTablespaceFreeMb: freeMb is null ? null : (long)freeMb.Value);
    }

    private static async Task<T?> ScalarAsync<T>(OracleConnection c, string sql, CancellationToken ct)
    {
        try
        {
            return await TryScalarAsync<T>(c, sql, ct);
        }
        catch
        {
            return default;
        }
    }

    private static async Task<T?> TryScalarAsync<T>(OracleConnection c, string sql, CancellationToken ct)
    {
        try
        {
            await using var cmd = new OracleCommand(sql, c);
            var value = await cmd.ExecuteScalarAsync(ct);
            if (value is null || value == DBNull.Value) return default;
            return (T)Convert.ChangeType(value, Nullable.GetUnderlyingType(typeof(T)) ?? typeof(T));
        }
        catch (OracleException)
        {
            // Almost always ORA-00942 (no privilege on the view). Not knowing is a valid answer.
            return default;
        }
    }

    private static async Task<List<string>> TryListAsync(OracleConnection c, string sql, CancellationToken ct)
    {
        var result = new List<string>();
        try
        {
            await using var cmd = new OracleCommand(sql, c);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) result.Add(reader.GetString(0));
        }
        catch (OracleException)
        {
            // Same reasoning as above: return what we could read, which may be nothing.
        }

        return result;
    }
}
