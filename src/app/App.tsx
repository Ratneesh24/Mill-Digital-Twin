/**
 * Application root.
 *
 * Owns exactly one thing beyond rendering: connecting the data source on mount
 * and releasing it on unmount. The twin starts in SIMULATION — never in LIVE —
 * so it can never come up claiming a plant connection it does not have.
 */

import { useEffect } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { WorkspaceLayout } from '../components/dashboard/WorkspaceLayout'
import { DashboardPage } from '../components/pages/DashboardPage'
import { TrendsPage } from '../components/pages/TrendsPage'
import { TwinPage } from '../components/pages/TwinPage'
import { useMachineStore } from '../store/machineStore'
import { useUiStore } from '../store/uiStore'
import { ErrorBoundary } from './ErrorBoundary'
import { ROUTES } from './routes'

export function App() {
  const connect = useMachineStore((s) => s.connect)
  const disconnect = useMachineStore((s) => s.disconnect)
  const theme = useUiStore((s) => s.theme)

  useEffect(() => {
    void connect('SIMULATION')
    return () => {
      void disconnect()
    }
  }, [connect, disconnect])

  return (
    <ErrorBoundary>
      {/* Tooltips are portalled, which is the point: `.panel { overflow:hidden }`
          clips any hover affordance rendered inside a panel. */}
      <Tooltip.Provider delayDuration={250} skipDelayDuration={400}>
        <BrowserRouter>
          <Routes>
            <Route element={<WorkspaceLayout />}>
              <Route path={ROUTES.dashboard} element={<DashboardPage />} />
              <Route path={ROUTES.trends} element={<TrendsPage />} />
              <Route path={ROUTES.twin} element={<TwinPage />} />
              {/* Any unknown path lands on the dashboard rather than a blank
                  shell — a control room must never show an empty screen. */}
              <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </Tooltip.Provider>
      <Toaster
        theme={theme}
        position="bottom-right"
        closeButton
        toastOptions={{
          style: {
            background: 'var(--color-base-900)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-line)',
          },
        }}
      />
    </ErrorBoundary>
  )
}
