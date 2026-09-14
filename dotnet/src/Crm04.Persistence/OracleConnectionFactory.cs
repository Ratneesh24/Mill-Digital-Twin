using Oracle.ManagedDataAccess.Client;

namespace Crm04.Persistence;

/// <summary>
/// Where the Oracle connection string comes from, and the only place it is read.
///
/// It is NEVER in appsettings.json. Development uses user-secrets, deployment uses the
/// <c>ConnectionStrings__Crm04</c> environment variable. Both are read here so there is one
/// answer to "which database am I talking to" and one place to change it.
/// </summary>
public sealed class OracleConnectionFactory
{
    private readonly string _connectionString;

    public OracleConnectionFactory(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "No Oracle connection string configured. Set it with:\n" +
                "  dotnet user-secrets --project src/Crm04.Feeder set \"ConnectionStrings:Crm04\" \"<string>\"\n" +
                "or provide the ConnectionStrings__Crm04 environment variable.");
        }

        _connectionString = connectionString;
    }

    /// <summary>
    /// The connection string with the password masked, for logs and diagnostics. Everything that
    /// wants to name the target database uses this - a credential must not reach a log file
    /// because someone wanted to print which host they were on.
    /// </summary>
    public string Redacted => System.Text.RegularExpressions.Regex.Replace(
        _connectionString, @"(?i)(password\s*=\s*)[^;]*", "$1***");

    /// <summary>A closed connection. The caller opens it and owns its lifetime.</summary>
    public OracleConnection Create() => new(_connectionString);

    public async Task<OracleConnection> OpenAsync(CancellationToken ct = default)
    {
        var connection = Create();
        await connection.OpenAsync(ct);
        return connection;
    }
}
