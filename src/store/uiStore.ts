/**
 * UI STORE — view-only preferences. Deliberately holds NO process values, so
 * there is no chance of a UI-local copy of a machine number drifting from
 * MachineState (§4).
 */

import { create } from 'zustand'
import type { TelemetrySignal, TrendWindowKey } from '../types/telemetry'

export type Theme = 'light' | 'dark'

/**
 * LINE frames the whole pass line; STAND is a close view on the roll stack;
 * ENTRY frames the pay-off end — POR, peeler, flattener, carry-over table and
 * ETR — which is 8 m from the stand and unreadable at line zoom.
 */
export type CameraView = 'LINE' | 'STAND' | 'ENTRY'

export interface UiStoreState {
  theme: Theme
  trendWindow: TrendWindowKey
  trendSignals: TelemetrySignal[]
  /** Freezes the trend view so a transient can be inspected (§12). */
  trendPaused: boolean
  cameraView: CameraView
  /** Bumped to ask the 3D view to re-apply the selected camera preset (§10.7). */
  cameraResetToken: number
  showSceneLabels: boolean
  showForceArrows: boolean
  /** The MODEL / DATA STATUS dialog — feed, model, tags, config, validation. */
  diagnosticsOpen: boolean

  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setTrendWindow: (window: TrendWindowKey) => void
  toggleTrendSignal: (signal: TelemetrySignal) => void
  setTrendSignals: (signals: TelemetrySignal[]) => void
  toggleTrendPaused: () => void
  setCameraView: (view: CameraView) => void
  resetCamera: () => void
  toggleSceneLabels: () => void
  toggleForceArrows: () => void
  setDiagnosticsOpen: (open: boolean) => void
}

/** Page navigation lives in the URL (react-router), never in this store. */

function readInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('crm04-theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    /* Storage unavailable (private mode) — fall through to the default. */
  }
  return 'light'
}

const TREND_KEY = 'crm04-trend-prefs'

/**
 * The selected trend channels are the one piece of view state worth persisting
 * beyond theme: rebuilding a six-channel selection after every reload is the
 * kind of friction that stops people using the trends page at all.
 */
function readTrendPrefs(): { window: TrendWindowKey; signals: TelemetrySignal[] } | null {
  try {
    const raw = localStorage.getItem(TREND_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { window: w, signals } = parsed as Record<string, unknown>
    if (typeof w !== 'string' || !Array.isArray(signals)) return null
    if (!signals.every((s): s is string => typeof s === 'string')) return null
    return { window: w as TrendWindowKey, signals: signals as TelemetrySignal[] }
  } catch {
    return null
  }
}

function persistTrendPrefs(window: TrendWindowKey, signals: TelemetrySignal[]): void {
  try {
    localStorage.setItem(TREND_KEY, JSON.stringify({ window, signals }))
  } catch {
    /* Storage unavailable — the selection still holds for this session. */
  }
}

function applyThemeClass(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

const savedTrend = readTrendPrefs()

export const useUiStore = create<UiStoreState>((set) => ({
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
    applyThemeClass(theme)
    try {
      localStorage.setItem('crm04-theme', theme)
    } catch {
      /* Storage unavailable — the class is still applied for this session. */
    }
    set({ theme })
  },
  toggleTheme: () =>
    set((s) => {
      const theme: Theme = s.theme === 'dark' ? 'light' : 'dark'
      applyThemeClass(theme)
      try {
        localStorage.setItem('crm04-theme', theme)
      } catch {
        /* Storage unavailable — the class is still applied for this session. */
      }
      return { theme }
    }),
  setTrendWindow: (trendWindow) =>
    set((s) => {
      persistTrendPrefs(trendWindow, s.trendSignals)
      return { trendWindow }
    }),
  toggleTrendSignal: (signal) =>
    set((s) => {
      const trendSignals = s.trendSignals.includes(signal)
        ? s.trendSignals.filter((x) => x !== signal)
        : [...s.trendSignals, signal]
      persistTrendPrefs(s.trendWindow, trendSignals)
      return { trendSignals }
    }),
  setTrendSignals: (trendSignals) =>
    set((s) => {
      persistTrendPrefs(s.trendWindow, trendSignals)
      return { trendSignals }
    }),
  toggleTrendPaused: () => set((s) => ({ trendPaused: !s.trendPaused })),
  setCameraView: (cameraView) =>
    set((s) => ({ cameraView, cameraResetToken: s.cameraResetToken + 1 })),
  resetCamera: () => set((s) => ({ cameraResetToken: s.cameraResetToken + 1 })),
  toggleSceneLabels: () => set((s) => ({ showSceneLabels: !s.showSceneLabels })),
  toggleForceArrows: () => set((s) => ({ showForceArrows: !s.showForceArrows })),
  setDiagnosticsOpen: (diagnosticsOpen) => set({ diagnosticsOpen }),
}))

/** Apply the persisted theme before first paint to avoid a light/dark flash. */
applyThemeClass(useUiStore.getState().theme)
