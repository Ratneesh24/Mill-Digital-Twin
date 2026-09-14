/**
 * UI STORE — view-only preferences. Deliberately holds NO process values, so
 * there is no chance of a UI-local copy of a machine number drifting from
 * MachineState (§4).
 */
import { create } from 'zustand';
/** Page navigation lives in the URL (react-router), never in this store. */
function readInitialTheme() {
    try {
        const saved = localStorage.getItem('crm04-theme');
        if (saved === 'dark' || saved === 'light')
            return saved;
    }
    catch {
        /* Storage unavailable (private mode) — fall through to the default. */
    }
    return 'light';
}
const TREND_KEY = 'crm04-trend-prefs';
/**
 * The selected trend channels are the one piece of view state worth persisting
 * beyond theme: rebuilding a six-channel selection after every reload is the
 * kind of friction that stops people using the trends page at all.
 */
function readTrendPrefs() {
    try {
        const raw = localStorage.getItem(TREND_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null)
            return null;
        const { window: w, signals } = parsed;
        if (typeof w !== 'string' || !Array.isArray(signals))
            return null;
        if (!signals.every((s) => typeof s === 'string'))
            return null;
        return { window: w, signals: signals };
    }
    catch {
        return null;
    }
}
function persistTrendPrefs(window, signals) {
    try {
        localStorage.setItem(TREND_KEY, JSON.stringify({ window, signals }));
    }
    catch {
        /* Storage unavailable — the selection still holds for this session. */
    }
}
function applyThemeClass(theme) {
    if (typeof document === 'undefined')
        return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
}
const savedTrend = readTrendPrefs();
export const useUiStore = create((set) => ({
    theme: readInitialTheme(),
    trendWindow: savedTrend?.window ?? '5m',
    trendSignals: savedTrend?.signals ?? ['rollingForce', 'speed', 'thicknessDeviation'],
    trendPaused: false,
    cameraView: 'LINE',
    cameraResetToken: 0,
    showSceneLabels: true,
    showForceArrows: true,
    diagnosticsOpen: false,
    setTheme: (theme) => {
        applyThemeClass(theme);
        try {
            localStorage.setItem('crm04-theme', theme);
        }
        catch {
            /* Storage unavailable — the class is still applied for this session. */
        }
        set({ theme });
    },
    toggleTheme: () => set((s) => {
        const theme = s.theme === 'dark' ? 'light' : 'dark';
        applyThemeClass(theme);
        try {
            localStorage.setItem('crm04-theme', theme);
        }
        catch {
            /* Storage unavailable — the class is still applied for this session. */
        }
        return { theme };
    }),
    setTrendWindow: (trendWindow) => set((s) => {
        persistTrendPrefs(trendWindow, s.trendSignals);
        return { trendWindow };
    }),
    toggleTrendSignal: (signal) => set((s) => {
        const trendSignals = s.trendSignals.includes(signal)
            ? s.trendSignals.filter((x) => x !== signal)
            : [...s.trendSignals, signal];
        persistTrendPrefs(s.trendWindow, trendSignals);
        return { trendSignals };
    }),
    setTrendSignals: (trendSignals) => set((s) => {
        persistTrendPrefs(s.trendWindow, trendSignals);
        return { trendSignals };
    }),
    toggleTrendPaused: () => set((s) => ({ trendPaused: !s.trendPaused })),
    setCameraView: (cameraView) => set((s) => ({ cameraView, cameraResetToken: s.cameraResetToken + 1 })),
    resetCamera: () => set((s) => ({ cameraResetToken: s.cameraResetToken + 1 })),
    toggleSceneLabels: () => set((s) => ({ showSceneLabels: !s.showSceneLabels })),
    toggleForceArrows: () => set((s) => ({ showForceArrows: !s.showForceArrows })),
    setDiagnosticsOpen: (diagnosticsOpen) => set({ diagnosticsOpen }),
}));
/** Apply the persisted theme before first paint to avoid a light/dark flash. */
applyThemeClass(useUiStore.getState().theme);
