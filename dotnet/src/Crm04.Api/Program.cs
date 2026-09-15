using Crm04.Api.Hubs;
using Crm04.Api.Services;
using Crm04.Api.Sources;
using Crm04.Domain.Machine;
using Crm04.Domain.Serialization;
using Crm04.Domain.Tags;
using Crm04.Domain.Telemetry;
using Crm04.Persistence;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------------------------
// Serialisation. The wire format is the screaming-snake one the TypeScript app, the Oracle CHECK
// constraints and docs/INTEGRATION.md all already speak - not .NET's default member names.
// ---------------------------------------------------------------------------------------------
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.PropertyNamingPolicy = WireJson.Options.PropertyNamingPolicy;
    foreach (var c in WireJson.Options.Converters) o.SerializerOptions.Converters.Add(c);
});

builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.PropertyNamingPolicy = WireJson.Options.PropertyNamingPolicy;
    foreach (var c in WireJson.Options.Converters) o.JsonSerializerOptions.Converters.Add(c);
});

builder.Services.AddSignalR().AddJsonProtocol(o =>
{
    o.PayloadSerializerOptions.PropertyNamingPolicy = WireJson.Options.PropertyNamingPolicy;
    foreach (var c in WireJson.Options.Converters) o.PayloadSerializerOptions.Converters.Add(c);
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ---------------------------------------------------------------------------------------------
// The frame source, chosen by configuration - and FAIL-FAST about it.
//
//   Oracle  the production path - reads the real plant frames Crm04.Feeder writes.
//   Replay  the exported simulator dataset. DEVELOPMENT ONLY: it exists so the UI and the browser
//           regression suites can run on a machine with no plant connection.
//
// There is no default. This used to read `?? "Replay"` with an else-branch, which meant a dropped
// config key, a typo or a missing environment variable booted a control-room screen into looping
// simulated data without a word. On a display operators are meant to trust, that is the worst
// possible fallback, so an unset or unrecognised value now refuses to start.
//
// Replay is refused outside Development for the same reason. The plant server runs Production,
// so no configuration mistake there can put simulator output on screen.
// ---------------------------------------------------------------------------------------------
var sourceKind = builder.Configuration["Source:Kind"]
    ?? throw new InvalidOperationException(
        "Source:Kind is not configured. Set it to 'Oracle' for the plant feed.");

switch (sourceKind.Trim().ToUpperInvariant())
{
    case "ORACLE":
        builder.Services.AddSingleton(new OracleConnectionFactory(
            builder.Configuration.GetConnectionString("Crm04") ?? string.Empty));

        builder.Services.AddSingleton(sp =>
        {
            var options = new OracleSourceOptions();
            sp.GetRequiredService<IConfiguration>().GetSection("Source:Oracle").Bind(options);
            return options;
        });

        builder.Services.AddSingleton<IFrameSource, OracleFrameSource>();
        break;

    case "REPLAY":
        if (!builder.Environment.IsDevelopment())
        {
            throw new InvalidOperationException(
                $"Source:Kind 'Replay' is refused in the '{builder.Environment.EnvironmentName}' " +
                "environment. The replay is simulator output and may only run in Development. " +
                "Set Source:Kind to 'Oracle' for the plant feed.");
        }

        builder.Services.AddSingleton(sp =>
        {
            var options = new ReplayOptions();
            sp.GetRequiredService<IConfiguration>().GetSection("Replay").Bind(options);
            return options;
        });

        builder.Services.AddSingleton<IFrameSource, ReplayFrameSource>();
        break;

    default:
        throw new InvalidOperationException(
            $"Source:Kind '{sourceKind}' is not recognised. Expected 'Oracle' (or 'Replay' in Development).");
}

builder.Services.AddSingleton<LiveStateService>();

// Trend history lives in the API, not the browser: one history serves every viewer, so a client
// that connects now sees the same last hour as one that connected an hour ago.
builder.Services.AddSingleton<TrendStore>();
builder.Services.AddSingleton<SignalSampler>();

// The 3D scene's socket registry. Singleton because it holds the connected scenes.
builder.Services.AddSingleton<TwinFeed>();

builder.Services.AddSingleton<FramePublisherService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<FramePublisherService>());

// The Blazor app is a separate origin in development, so it needs to be allowed to open the hub.
// AllowCredentials is required for SignalR's WebSocket handshake, which is why the origins are
// listed explicitly rather than using AllowAnyOrigin - the two are mutually exclusive.
const string WebCors = "crm04-web";
builder.Services.AddCors(o => o.AddPolicy(WebCors, p => p
    .WithOrigins(
        builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
        ?? ["http://localhost:5240", "https://localhost:7120"])
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors(WebCors);
app.MapControllers();
app.MapHub<TelemetryHub>("/hubs/telemetry");

// ---------------------------------------------------------------------------------------------
// The 3D scene's own feed, opened by browser JavaScript rather than by Blazor. See TwinFeed for
// why the scene deliberately bypasses the circuit and why this is a raw socket rather than a hub.
// ---------------------------------------------------------------------------------------------
app.UseWebSockets(new WebSocketOptions
{
    // Well inside any proxy's idle timeout, and cheap: a ping is a couple of bytes against a feed
    // already sending ten frames a second.
    KeepAliveInterval = TimeSpan.FromSeconds(30),
});

app.Map("/ws/twin", async context =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsync("This endpoint speaks WebSocket only.");
        return;
    }

    var feed = context.RequestServices.GetRequiredService<TwinFeed>();
    var live = context.RequestServices.GetRequiredService<LiveStateService>();

    using var socket = await context.WebSockets.AcceptWebSocketAsync();
    await feed.HandleAsync(socket, TwinEngine.Derive(live.State), context.RequestAborted);
});

app.MapGet("/", () => Results.Redirect("/swagger"));

app.Logger.LogInformation(
    "CRM04 API starting. Catalogue: {Tags} tags ({Measured} MEASURED, {Unavailable} NO TAG on a live feed).",
    TagCatalog.Count,
    TagCatalog.Inventory.MeasuredOnLiveFeed,
    TagCatalog.Inventory.UnavailableOnLiveFeed);

if (app.Services.GetRequiredService<IFrameSource>() is ReplayFrameSource)
{
    app.Logger.LogWarning(
        "REPLAY SOURCE SELECTED - every value on screen is SIMULATOR OUTPUT, not plant data. " +
        "Development only; set Source:Kind to 'Oracle' for the plant feed.");
}

app.Run();

/// <summary>Exposed so Crm04.Api.Tests can spin the API up with WebApplicationFactory.</summary>
public partial class Program;
