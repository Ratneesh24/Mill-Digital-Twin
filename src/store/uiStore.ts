/**
 * UI STORE — view-only preferences. Deliberately holds NO process values, so
 * there is no chance of a UI-local copy of a machine number drifting from
 * MachineState (§4).
 */

import { create } from 'zustand'
import type { TelemetrySignal, TrendWindowKey } from '../types/telemetry'

export type PanelTab = 'OVERVIEW' | 'PASS_SCHEDULE' | 'TAGS' | 'CONFIG' | 'VALIDATION'

/** LINE frames the whole pass line; STAND is a close view on the roll stack. */
export type CameraView = 'LINE' | 'STAND'

export interface UiStoreState {
  activeTab: PanelTab
  trendWindow: TrendWindowKey
  trendSignals: TelemetrySignal[]
  cameraView: CameraView
  /** Bumped to ask the 3D view to re-apply the selected camera preset (§10.7). */
  cameraResetToken: number
  showSceneLabels: boolean
  showForceArrows: boolean
  showControlDrawer: boolean

  setTab: (tab: PanelTab) => void
  setTrendWindow: (window: TrendWindowKey) => void
  toggleTrendSignal: (signal: TelemetrySignal) => void
  setCameraView: (view: CameraView) => void
  resetCamera: () => void
  toggleSceneLabels: () => void
  toggleForceArrows: () => void
  toggleControlDrawer: () => void
}

export const useUiStore = create<UiStoreState>((set) => ({
  activeTab: 'OVERVIEW',
  trendWindow: '5m',
  trendSignals: ['rollingForce', 'speed', 'thicknessDeviation'],
  cameraView: 'LINE',
  cameraResetToken: 0,
  showSceneLabels: true,
  showForceArrows: true,
  showControlDrawer: false,

  setTab: (activeTab) => set({ activeTab }),
  setTrendWindow: (trendWindow) => set({ trendWindow }),
  toggleTrendSignal: (signal) =>
    set((s) => ({
      trendSignals: s.trendSignals.includes(signal)
        ? s.trendSignals.filter((x) => x !== signal)
        : [...s.trendSignals, signal],
    })),
  setCameraView: (cameraView) =>
    set((s) => ({ cameraView, cameraResetToken: s.cameraResetToken + 1 })),
  resetCamera: () => set((s) => ({ cameraResetToken: s.cameraResetToken + 1 })),
  toggleSceneLabels: () => set((s) => ({ showSceneLabels: !s.showSceneLabels })),
  toggleForceArrows: () => set((s) => ({ showForceArrows: !s.showForceArrows })),
  toggleControlDrawer: () => set((s) => ({ showControlDrawer: !s.showControlDrawer })),
}))
