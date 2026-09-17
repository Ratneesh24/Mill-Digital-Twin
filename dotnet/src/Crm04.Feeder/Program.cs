using Crm04.Domain.Tags;
using Crm04.Feeder.Sources;
using Crm04.Persistence;
using Crm04.Persistence.Maintenance;
using Crm04.Persistence.Seed;

namespace Crm04.Feeder;

/// <summary>
/// CRM04 FEEDER — the only process that writes into Oracle.
///
///   source -> FeederService (10 Hz) -> RawFrameWriter -> FRAME + TAG_SAMPLE + CURRENT_*
///                                   -> MaintenanceService -> TREND_SAMPLE, retention
///
/// Commands:
///   --check-db    ask the database what it is and what it will let us do, then exit
///   --apply-ddl   create the schema from db/ddl, then exit
///   --seed-only   put the tag catalogue into TAG_DEF, then exit
///   --drop-all    destroy the schema (development only), then exit
///   (none)        run the feeder
/// </summary>
public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        var builder = Host.CreateApplicationBuilder(args);

        var connectionString = builder.Configuration.GetConnectionString("Crm04") ?? string.Empty;
        var ddlDirectory = builder.Configuration["Database:DdlDirectory"] ?? DefaultPath("db", "ddl");

        // One-shot commands run before the host starts: they are administrative, they exit with a
        // status, and none of them wants a 10 Hz timer running underneath.
        if (args.Contains("--check-db")) return await RunCommandAsync(connectionString, CheckDatabaseAsync);
        if (args.Contains("--apply-ddl")) return await RunCommandAsync(connectionString, f => ApplyDdlAsync(f, ddlDirectory));
        if (args.Contains("--seed-only")) return await RunCommandAsync(connectionString, SeedAsync);
        if (args.Contains("--drop-all")) return await RunCommandAsync(connectionString, f => DropAsync(f, ddlDirectory, args));

        builder.Services.AddSingleton(new OracleConnectionFactory(connectionString));

        // The frame source - FAIL-FAST, with no default. The Feeder is the only process that writes
        // into Oracle, and FRAME.OP_MODE decides how every value is badged for the rest of its life,
        // so a silent fallback to the simulator here would put fabricated readings in the plant's
        // own history. Replay is refused outside Development for the same reason.
        var sourceKind = builder.Configuration["Source:Kind"]
            ?? throw new InvalidOperationException(
                "Source:Kind is not configured. Set it to 'OpcUa' for the plant feed.");

        switch (sourceKind.Trim().ToUpperInvariant())
        {
            case "OPCUA":
                builder.Services.AddSingleton(sp =>
                {
                    var options = new OpcUaSourceOptions();
                    sp.GetRequiredService<IConfiguration>().GetSection("OpcUa").Bind(options);
                    return options;
                });
                builder.Services.AddSingleton<IFrameSource, OpcUaFrameSource>();
                break;

            case "REPLAY":
                if (!builder.Environment.IsDevelopment())
                {
                    throw new InvalidOperationException(
                        $"Source:Kind 'Replay' is refused in the '{builder.Environment.EnvironmentName}' " +
                        "environment: it would write simulator output into the plant database. " +
                        "Set Source:Kind to 'OpcUa'.");
                }

                builder.Services.AddSingleton(sp =>
                {
                    var options = new ReplaySourceOptions();
                    sp.GetRequiredService<IConfiguration>().GetSection("Replay").Bind(options);
                    return options;
                });
                builder.Services.AddSingleton<IFrameSource, JsonlReplayFrameSource>();
                break;

            default:
                throw new InvalidOperationException(
                    $"Source:Kind '{sourceKind}' is not recognised. Expected 'OpcUa' (or 'Replay' in Development).");
        }

        builder.Services.AddSingleton<TrendRollupService>();
        builder.Services.AddSingleton<RetentionService>();

        builder.Services.AddSingleton<FeederService>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<FeederService>());
        builder.Services.AddHostedService<MaintenanceService>();

        await builder.Build().RunAsync();
        return 0;
    }

    // -------------------------------------------------------------------------------------
    // Commands
    // -------------------------------------------------------------------------------------

    private static async Task<int> RunCommandAsync(string connectionString, Func<OracleConnectionFactory, Task<int>> command)
    {
        OracleConnectionFactory factory;
        try
        {
            factory = new OracleConnectionFactory(connectionString);
        }
        catch (InvalidOperationException ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }

        try
        {
            return await command(factory);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"\n{ex.GetType().Name}: {ex.Message}\n");
            return 1;
        }
    }

    private static async Task<int> CheckDatabaseAsync(OracleConnectionFactory factory)
    {
        Console.WriteLine($"\n  target      : {factory.Redacted}");

        DatabaseFacts facts;
        try
        {
            facts = await DatabaseProbe.RunAsync(factory);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"\n  CANNOT CONNECT: {ex.Message}\n");
            return 1;
        }

        Console.WriteLine($"  banner      : {facts.Banner}");
        Console.WriteLine($"  schema      : {facts.SchemaName}");
        Console.WriteLine($"  partitioning: not required by this schema{(facts.HasPartitioning ? " (licensed here, unused)" : "")}");
        Console.WriteLine($"  privileges  : {(facts.Privileges.Count == 0 ? "(session_privs not readable)" : string.Join(", ", facts.Privileges))}");
        Console.WriteLine($"  free space  : {(facts.DefaultTablespaceFreeMb is { } mb ? mb + " MB" : "unknown")}");
        Console.WriteLine($"  tables      : {(facts.ExistingCrm04Tables.Count == 0 ? "(none)" : string.Join(", ", facts.ExistingCrm04Tables))}");
        Console.WriteLine();

        if (facts.MissingPrivileges.Count > 0)
        {
            Console.Error.WriteLine(
                $"  MISSING PRIVILEGES: {string.Join(", ", facts.MissingPrivileges)}\n" +
                $"  Grant them to {facts.SchemaName} and re-run.\n");
            return 1;
        }

        // There was a NOTE here about Partitioning that ended with the words "ignore this".
        // It was printed on the plant server, it was ignored exactly as instructed, and
        // --apply-ddl then failed with ORA-00439 and left the schema half-built. A check that
        // cannot distinguish "unlicensed" from "no privilege to ask" has no business issuing a
        // warning, so it no longer does - and the schema no longer needs the option either.

        Console.WriteLine("  database check passed.\n");
        return 0;
    }

    private static async Task<int> ApplyDdlAsync(OracleConnectionFactory factory, string ddlDirectory)
    {
        Console.WriteLine($"\n  applying DDL from {ddlDirectory}");
        Console.WriteLine($"  target {factory.Redacted}\n");

        var results = await SchemaInstaller.ApplyAsync(factory, ddlDirectory, continueOnError: false);
        var failed = false;

        foreach (var r in results)
        {
            Console.WriteLine($"  {r.Script,-20} {r.StatementsRun,3} statement(s)" +
                              (r.Errors.Count == 0 ? "" : $"   {r.Errors.Count} ERROR(S)"));

            foreach (var e in r.Errors)
            {
                failed = true;
                Console.Error.WriteLine($"      {e}");
            }
        }

        if (failed)
        {
            Console.Error.WriteLine("\n  DDL FAILED. Nothing further will work until the schema is created.\n");
            return 1;
        }

        Console.WriteLine("\n  schema created. Seeding the tag catalogue...");
        var map = await TagDefinitionSeeder.EnsureSeededAsync(factory);
        Console.WriteLine($"  TAG_DEF: {map.Count} tags seeded and ordinals verified.\n");
        return 0;
    }

    private static async Task<int> SeedAsync(OracleConnectionFactory factory)
    {
        var map = await TagDefinitionSeeder.EnsureSeededAsync(factory);
        Console.WriteLine($"\n  TAG_DEF: {map.Count} tags seeded and ordinals verified " +
                          $"(catalogue holds {TagCatalog.Count}).\n");
        return 0;
    }

    private static async Task<int> DropAsync(OracleConnectionFactory factory, string ddlDirectory, string[] args)
    {
        // Dropping the schema destroys every recorded frame. Requiring a second flag means it
        // cannot happen because --drop-all was left in a shell history or a script.
        if (!args.Contains("--yes"))
        {
            Console.Error.WriteLine(
                "\n  --drop-all destroys every table and all recorded history.\n" +
                "  Re-run with --drop-all --yes if that is genuinely what you want.\n");
            return 1;
        }

        await SchemaInstaller.DropAllAsync(factory, ddlDirectory);
        Console.WriteLine("\n  schema dropped.\n");
        return 0;
    }

    /// <summary>Resolve a path relative to the repository's <c>dotnet/</c> folder.</summary>
    private static string DefaultPath(params string[] parts)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Crm04.sln")))
        {
            dir = dir.Parent;
        }

        return Path.Combine(new[] { dir?.FullName ?? "." }.Concat(parts).ToArray());
    }
}
