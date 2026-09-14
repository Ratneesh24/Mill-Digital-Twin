using Oracle.ManagedDataAccess.Client;

namespace Crm04.Persistence;

public sealed record SchemaScriptResult(string Script, int StatementsRun, IReadOnlyList<string> Errors);

/// <summary>
/// Runs the DDL scripts in <c>db/ddl</c>.
///
/// WHY NOT EF CORE MIGRATIONS FOR THIS. The schema's whole performance story lives in clauses EF
/// Core's Oracle provider will not emit: ORGANIZATION INDEX, INTERVAL partitioning, sequence
/// CACHE. Expressing them would mean wrapping raw SQL in <c>migrationBuilder.Sql(...)</c> and
/// then maintaining a second copy in <c>db/ddl</c> for the DBAs who will actually review this on
/// a plant database. One authored artefact, run by both, is the honest arrangement — and a plant
/// DBA can read the .sql files without a .NET toolchain.
///
/// The splitter is deliberately simple: statements end at a <c>;</c> on its own or at end of
/// line, and a <c>/</c> alone on a line terminates a PL/SQL block. That covers everything the
/// scripts use and nothing more, which is preferable to half a SQL parser.
/// </summary>
public static class SchemaInstaller
{
    public static async Task<IReadOnlyList<SchemaScriptResult>> ApplyAsync(
        OracleConnectionFactory factory,
        string ddlDirectory,
        bool continueOnError,
        CancellationToken ct = default)
    {
        if (!Directory.Exists(ddlDirectory))
        {
            throw new DirectoryNotFoundException($"DDL directory not found: {ddlDirectory}");
        }

        // Ordered by file name, which is why they are numbered: tables before indexes.
        // 99_drop.sql is excluded — destroying the schema is never something a normal run does.
        var scripts = Directory.GetFiles(ddlDirectory, "*.sql")
            .Where(f => !Path.GetFileName(f).StartsWith("99_", StringComparison.Ordinal))
            .OrderBy(f => f, StringComparer.Ordinal)
            .ToList();

        await using var connection = await factory.OpenAsync(ct);
        var results = new List<SchemaScriptResult>();

        foreach (var script in scripts)
        {
            var errors = new List<string>();
            var run = 0;

            foreach (var statement in Split(await File.ReadAllTextAsync(script, ct)))
            {
                try
                {
                    await using var cmd = new OracleCommand(statement, connection);
                    await cmd.ExecuteNonQueryAsync(ct);
                    run++;
                }
                catch (OracleException ex)
                {
                    // ORA-00955 name already used, ORA-01408 column already indexed. Both mean
                    // "this object is already there", which on a re-run is success, not failure.
                    if (ex.Number is 955 or 1408) continue;

                    errors.Add($"{Summarise(statement)}\n      ORA-{ex.Number:00000}: {ex.Message.Trim()}");
                    if (!continueOnError) break;
                }
            }

            results.Add(new SchemaScriptResult(Path.GetFileName(script), run, errors));
            if (errors.Count > 0 && !continueOnError) break;
        }

        return results;
    }

    /// <summary>Run <c>99_drop.sql</c>. Destructive; the caller is responsible for meaning it.</summary>
    public static async Task DropAllAsync(
        OracleConnectionFactory factory,
        string ddlDirectory,
        CancellationToken ct = default)
    {
        var path = Path.Combine(ddlDirectory, "99_drop.sql");
        if (!File.Exists(path)) throw new FileNotFoundException("Teardown script not found.", path);

        await using var connection = await factory.OpenAsync(ct);
        foreach (var statement in Split(await File.ReadAllTextAsync(path, ct)))
        {
            await using var cmd = new OracleCommand(statement, connection);
            await cmd.ExecuteNonQueryAsync(ct);
        }
    }

    /// <summary>
    /// Split a script into executable statements. ODP.NET takes one statement per command and
    /// rejects a trailing semicolon on plain SQL, so both are handled here.
    /// </summary>
    internal static IEnumerable<string> Split(string sql)
    {
        var buffer = new List<string>();
        var inPlSqlBlock = false;

        foreach (var rawLine in sql.Split('\n'))
        {
            var line = rawLine.TrimEnd('\r');
            var trimmed = line.Trim();

            // Whole-line comments never reach the server; inline ones are harmless and kept.
            if (trimmed.StartsWith("--", StringComparison.Ordinal)) continue;

            if (trimmed.StartsWith("BEGIN", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("DECLARE", StringComparison.OrdinalIgnoreCase))
            {
                inPlSqlBlock = true;
            }

            // A lone '/' ends a PL/SQL block and is not part of it.
            if (inPlSqlBlock && trimmed == "/")
            {
                var block = string.Join('\n', buffer).Trim();
                if (block.Length > 0) yield return block;
                buffer.Clear();
                inPlSqlBlock = false;
                continue;
            }

            buffer.Add(line);

            if (!inPlSqlBlock && trimmed.EndsWith(';'))
            {
                var statement = string.Join('\n', buffer).Trim().TrimEnd(';').Trim();
                if (statement.Length > 0) yield return statement;
                buffer.Clear();
            }
        }

        var tail = string.Join('\n', buffer).Trim().TrimEnd(';').Trim();
        if (tail.Length > 0) yield return tail;
    }

    /// <summary>The first meaningful line of a statement, for an error message.</summary>
    private static string Summarise(string statement)
    {
        var line = statement
            .Split('\n')
            .Select(l => l.Trim())
            .FirstOrDefault(l => l.Length > 0 && !l.StartsWith("--", StringComparison.Ordinal))
            ?? statement;

        return line.Length <= 90 ? line : line[..90] + "…";
    }
}
