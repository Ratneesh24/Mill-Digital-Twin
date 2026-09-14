using Crm04.Contracts;

namespace Crm04.Web.State;

/// <summary>
/// The structured half of what the API pushes: mill summary, alarms and the interlock chain.
///
/// Deliberately NOT a MachineState. The web app cannot construct one - <c>MachineState</c>'s
/// constructor is internal to Crm04.Domain and Crm04.Web does not reference Crm04.Persistence -
/// so there is no path by which a second, independently-derived view of the mill could appear
/// here. What it holds is the API's projection, transported.
/// </summary>
public sealed class MillStore
{
    private readonly object _gate = new();

    public MillSummaryDto? Summary { get; private set; }

    public IReadOnlyList<AlarmDto> Alarms { get; private set; } = [];

    public InterlockChainDto? Interlocks { get; private set; }

    /// <summary>Bumped when any of the above changes in a way worth repainting.</summary>
    public int Version { get; private set; }

    /// <summary>
    /// True once a frame has actually arrived. Until then the UI must say so rather than render
    /// an inert-looking mill that might be mistaken for a real, idle one.
    /// </summary>
    public bool HasData { get; private set; }

    /// <summary>Set when the hub connection itself is down, which is a different failure from a stale feed.</summary>
    public string? ConnectionError { get; private set; }

    public void Apply(TelemetryEnvelope envelope)
    {
        lock (_gate)
        {
            Summary = envelope.Summary;
            Alarms = envelope.Alarms;
            Interlocks = envelope.Interlocks;
            HasData = true;
            ConnectionError = null;
            Version++;
        }
    }

    public void SetConnectionError(string? message)
    {
        lock (_gate)
        {
            ConnectionError = message;
            Version++;
        }
    }
}

/// <summary>
/// Per-circuit UI preferences. Scoped, not singleton - the mill is shared, a viewer's choice of
/// tab is not. Holds NO process values, exactly as the TypeScript <c>uiStore</c> does not.
/// </summary>
public sealed class UiStore
{
    public string ActiveGroup { get; set; } = "ROLLING";

    /// <summary>
    /// "light" or "dark". The stylesheet defines the full palette on <c>:root</c> and remaps the
    /// surfaces under <c>.dark</c>, so switching is a class on the html element - the same
    /// mechanism the React app's ui store uses.
    /// </summary>
    public string Theme { get; private set; } = "light";

    /// <summary>Raised when the theme changes, so the layout can apply the class.</summary>
    public event Action? ThemeChanged;

    public void SetTheme(string theme)
    {
        if (theme == Theme) return;
        Theme = theme;
        ThemeChanged?.Invoke();
    }

    public void ToggleTheme() => SetTheme(Theme == "dark" ? "light" : "dark");

    /// <summary>Trend window key: "1m" | "5m" | "15m" | "30m" | "1h".</summary>
    public string TrendWindow { get; set; } = "5m";

    /// <summary>
    /// Selected trend signals. Per viewer, because two operators watching the same mill will
    /// reasonably want to watch different things about it.
    /// </summary>
    public HashSet<string> TrendSignals { get; } = new(StringComparer.Ordinal);

    /// <summary>
    /// Pause freezes the plot for inspection. It stops the FETCH, not the feed - the API keeps
    /// recording throughout, so resuming shows the history that accumulated while you were
    /// looking rather than a gap.
    /// </summary>
    public bool TrendPaused { get; set; }

    /// <summary>
    /// Parameter-group collapse state, keyed by group title. Scoped so one viewer's folding does
    /// not refold another's. Survives navigation because the store is per-circuit.
    /// </summary>
    public HashSet<string> CollapsedGroups { get; } = new(StringComparer.Ordinal);

    public void ToggleGroup(string title)
    {
        if (!CollapsedGroups.Remove(title)) CollapsedGroups.Add(title);
    }

    /// <summary>
    /// The tag currently located on the mill schematic, set by clicking a parameter row (or a
    /// schematic region in reverse). Null when nothing is located. Never a process value.
    /// </summary>
    public string? HighlightTag { get; set; }

    /// <summary>Parameter-group title scrolled to / flashed from a schematic region click.</summary>
    public string? HighlightGroup { get; set; }
}
