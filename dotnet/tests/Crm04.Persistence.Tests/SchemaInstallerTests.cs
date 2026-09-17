using Crm04.Persistence;
using Crm04.Persistence.Maintenance;
using Shouldly;

namespace Crm04.Persistence.Tests;

/// <summary>
/// The statement splitter, and the guards that keep the DDL runnable on the plant database,
/// tested without a database.
///
/// Both failure modes are expensive to debug against a live Oracle. A mis-split script
/// half-creates a schema. So does a clause the database refuses: this schema shipped with
/// INTERVAL partitioning, and the way we found out mill4db has no Partitioning option was
/// ORA-00439 from --apply-ddl on the plant server, mid-install, with an operator watching.
/// The negative assertions below exist so that class of mistake fails here instead — in a
/// second, on the machine where it was made.
/// </summary>
public class SchemaInstallerTests
{
    [Fact]
    public void SplitsPlainStatementsAndStripsTheTrailingSemicolon()
    {
        // ODP.NET takes one statement per command and rejects a trailing semicolon on plain SQL.
        var statements = SchemaInstaller.Split(
            """
            CREATE TABLE A (X NUMBER);
            CREATE TABLE B (Y NUMBER);
            """).ToList();

        statements.Count.ShouldBe(2);
        statements[0].ShouldBe("CREATE TABLE A (X NUMBER)");
        statements[1].ShouldBe("CREATE TABLE B (Y NUMBER)");
    }

    [Fact]
    public void KeepsAMultiLineStatementTogether()
    {
        var statements = SchemaInstaller.Split(
            """
            CREATE TABLE FRAME (
              FRAME_ID NUMBER(19) NOT NULL,
              EPOCH_MS NUMBER(13) NOT NULL
            );
            """).ToList();

        statements.Count.ShouldBe(1);
        statements[0].ShouldContain("FRAME_ID");
        statements[0].ShouldContain("EPOCH_MS");
        statements[0].ShouldNotEndWith(";");
    }

    [Fact]
    public void DropsWholeLineCommentsButKeepsTheStatement()
    {
        var statements = SchemaInstaller.Split(
            """
            -- This explains the table.
            CREATE TABLE A (X NUMBER);
            """).ToList();

        statements.Count.ShouldBe(1);
        statements[0].ShouldBe("CREATE TABLE A (X NUMBER)");
    }

    [Fact]
    public void TreatsAPlSqlBlockAsOneStatementTerminatedBySlash()
    {
        // The semicolons INSIDE a PL/SQL block are part of it. Splitting on them would send
        // Oracle a series of fragments, which is how a teardown script destroys half a schema
        // and then fails.
        var statements = SchemaInstaller.Split(
            """
            BEGIN
              FOR t IN (SELECT table_name FROM user_tables) LOOP
                EXECUTE IMMEDIATE 'DROP TABLE ' || t.table_name;
              END LOOP;
            END;
            /
            """).ToList();

        statements.Count.ShouldBe(1);
        statements[0].ShouldStartWith("BEGIN");
        statements[0].ShouldEndWith("END;");
        statements[0].ShouldNotContain("/");
    }

    [Fact]
    public void HandlesAStatementWithNoTrailingSemicolonAtEndOfFile()
    {
        var statements = SchemaInstaller.Split("CREATE TABLE A (X NUMBER)").ToList();
        statements.Count.ShouldBe(1);
    }

    [Fact]
    public void TheShippedDdlSplitsIntoRunnableStatements()
    {
        var ddl = DdlDirectory();
        if (ddl is null) return;   // no source tree beside the test binary

        var tables = SchemaInstaller.Split(File.ReadAllText(Path.Combine(ddl, "01_tables.sql"))).ToList();

        // 11 tables + 1 sequence. If this count moves, the schema changed and the migration
        // story needs revisiting - which is exactly when someone should be made to look.
        tables.Count.ShouldBe(12);
        tables.Count(s => s.StartsWith("CREATE TABLE", StringComparison.OrdinalIgnoreCase)).ShouldBe(11);
        tables.Count(s => s.StartsWith("CREATE SEQUENCE", StringComparison.OrdinalIgnoreCase)).ShouldBe(1);

        // No statement may end with a semicolon, or ODP.NET rejects it.
        tables.ShouldAllBe(s => !s.EndsWith(";"));

        var indexes = SchemaInstaller.Split(File.ReadAllText(Path.Combine(ddl, "02_indexes.sql"))).ToList();
        indexes.ShouldAllBe(s => s.StartsWith("CREATE INDEX", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void TheHotTableIsIndexOrganisedAndTheSchemaNeedsNoOracleOptions()
    {
        var ddl = DdlDirectory();
        if (ddl is null) return;

        var sql = File.ReadAllText(Path.Combine(ddl, "01_tables.sql"));

        // The performance story. If this is lost in an edit the schema still works and quietly
        // becomes an order of magnitude slower, which is the kind of regression nobody notices
        // until the tablespace fills.
        sql.ShouldContain("ORGANIZATION INDEX");

        // BINARY_DOUBLE, not NUMBER: IEEE-754 so a value is bit-identical to the C# double and
        // the JavaScript number it came from.
        sql.ShouldContain("NUM_VALUE  BINARY_DOUBLE");
        sql.ShouldNotContain("NUM_VALUE  NUMBER");

        // THE PRODUCTION DATABASE HAS NO PARTITIONING OPTION.
        //
        // This is not a style rule. The schema shipped with INTERVAL partitioning, and the way
        // we found out was ORA-00439 from --apply-ddl on the plant server, with the schema left
        // half-built. Anyone reintroducing it should be stopped by a red test on their own
        // machine, seconds after the edit, not by an operator in a control room.
        sql.ShouldNotContain("PARTITION BY");
        sql.ShouldNotContain("INTERVAL (");
    }

    [Fact]
    public void NoIndexIsDeclaredLocal()
    {
        var ddl = DdlDirectory();
        if (ddl is null) return;

        // The second landmine, and the one nobody saw: --apply-ddl stops on the first error, so
        // ORA-00439 on CREATE TABLE FRAME hid an ORA-14016 waiting in 02_indexes.sql. A LOCAL
        // index requires a partitioned table. Removing the INTERVAL clauses alone would have
        // moved the failure, not fixed it.
        var indexes = SchemaInstaller.Split(File.ReadAllText(Path.Combine(ddl, "02_indexes.sql")));

        indexes.ShouldAllBe(s => !s.TrimEnd().EndsWith("LOCAL", StringComparison.OrdinalIgnoreCase));
    }

    private static string? DdlDirectory()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Crm04.sln"))) dir = dir.Parent;
        if (dir is null) return null;

        var ddl = Path.Combine(dir.FullName, "db", "ddl");
        return Directory.Exists(ddl) ? ddl : null;
    }
}

// RetentionBoundTests lived here and covered RetentionService.TryParseHighValue, which parsed an
// interval partition's high-value bound. Both are gone: with no partitions there are no bounds to
// parse. Retention is now a chunked DELETE whose behaviour needs a live Oracle to verify, so it is
// deliberately NOT faked here — see docs/IT_INTEGRATION_GUIDE.md §3.4 for the check that matters
// (MIN(FRAME_ID) must advance).
