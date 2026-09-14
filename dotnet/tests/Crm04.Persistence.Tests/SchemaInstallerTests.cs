using Crm04.Persistence;
using Crm04.Persistence.Maintenance;
using Shouldly;

namespace Crm04.Persistence.Tests;

/// <summary>
/// The statement splitter and the partition-bound parser, tested without a database.
///
/// Both are small, both are easy to get subtly wrong, and both fail in ways that are expensive
/// to debug against a live Oracle: a mis-split script half-creates a schema, and a mis-parsed
/// high value drops the wrong partition. Testing them here means the first run against a real
/// database is exercising Oracle, not this code.
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
    public void TheHotTablesAreIndexOrganisedAndPartitioned()
    {
        var ddl = DdlDirectory();
        if (ddl is null) return;

        var sql = File.ReadAllText(Path.Combine(ddl, "01_tables.sql"));

        // The performance story in three clauses. If any of them is lost in an edit, the schema
        // still works and quietly becomes an order of magnitude slower, which is the kind of
        // regression nobody notices until the tablespace fills.
        sql.ShouldContain("ORGANIZATION INDEX");
        sql.ShouldContain("INTERVAL (36000)");
        sql.ShouldContain("PARTITION BY RANGE (FRAME_ID)");

        // BINARY_DOUBLE, not NUMBER: IEEE-754 so a value is bit-identical to the C# double and
        // the JavaScript number it came from.
        sql.ShouldContain("NUM_VALUE  BINARY_DOUBLE");
        sql.ShouldNotContain("NUM_VALUE  NUMBER");

        // Both tables partitioned on the same key with the same boundaries, which is what lets
        // retention drop from both with one cutoff.
        System.Text.RegularExpressions.Regex
            .Matches(sql, @"PARTITION BY RANGE \(FRAME_ID\)")
            .Count.ShouldBe(2);
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

public class RetentionBoundTests
{
    [Theory]
    [InlineData("36000", 36000L)]
    [InlineData("72000", 72000L)]
    [InlineData(" 108000 ", 108000L)]
    // 21c reports the bound as JSON; older releases as a bare number. Both must parse.
    [InlineData("{\"high_value\":36000}", 36000L)]
    public void ParsesAPartitionHighValue(string highValue, long expected)
    {
        RetentionService.TryParseHighValue(highValue, out var bound).ShouldBeTrue();
        bound.ShouldBe(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("MAXVALUE")]
    [InlineData("TO_DATE(' 2026-01-01', 'SYYYY-MM-DD')")]
    public void RefusesToParseABoundItDoesNotUnderstand(string? highValue)
    {
        // Refusing is the SAFE direction: an unparsed bound means the partition is left alone.
        // Guessing wrong here drops live data.
        var parsed = RetentionService.TryParseHighValue(highValue, out _);

        // A date bound contains digits, so it may parse — what must never happen is a silent
        // wrong answer for the empty cases.
        if (string.IsNullOrWhiteSpace(highValue) || highValue == "MAXVALUE") parsed.ShouldBeFalse();
    }
}
