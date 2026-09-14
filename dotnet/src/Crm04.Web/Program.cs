using Crm04.Web.Components;
using Crm04.Web.State;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorComponents().AddInteractiveServerComponents();

// ---------------------------------------------------------------------------------------------
// State. The mill is the same for every viewer, so the stores are SINGLETONS and one hub
// connection serves the whole process - a control room with a dozen screens open costs the API
// nothing extra. Per-viewer preferences are the only scoped state.
// ---------------------------------------------------------------------------------------------
builder.Services.AddSingleton<TagStore>();
builder.Services.AddSingleton<MillStore>();

builder.Services.AddSingleton<TelemetryClient>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<TelemetryClient>());

builder.Services.AddSingleton<UiTickService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<UiTickService>());

builder.Services.AddScoped<UiStore>();

builder.Services.AddScoped<PassHistory>();

// REST client for the pull-shaped requests: the trend catalogue, trend series, diagnostics.
// The live telemetry does not come through here - that is TelemetryClient over SignalR.
builder.Services.AddHttpClient<ApiClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Api:BaseUrl"] ?? "http://localhost:5200/");

    // Short, deliberately. A trend request that has not answered in three seconds has missed its
    // repaint slot; the next one is 500 ms away and a hung request would only queue behind it.
    client.Timeout = TimeSpan.FromSeconds(3);
});

builder.Services.Configure<Microsoft.AspNetCore.Components.Server.CircuitOptions>(o =>
{
    o.DetailedErrors = builder.Environment.IsDevelopment();

    // If this ever saturates, the server is producing render batches faster than the browser
    // acknowledges them - which would mean the 4 Hz tick or the per-tag ShouldRender gate has
    // been broken, not that the number needs raising.
    o.MaxBufferedUnacknowledgedRenderBatches = 10;
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    app.UseHsts();
}

app.UseStaticFiles();
app.UseAntiforgery();

app.MapRazorComponents<App>().AddInteractiveServerRenderMode();

app.Run();
