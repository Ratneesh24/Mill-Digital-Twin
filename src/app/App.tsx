/**
 * Application root.
 *
 * Owns exactly one thing beyond rendering: connecting the data source on mount
 * and releasing it on unmount. The twin starts in SIMULATION — never in LIVE —
 * so it can never come up claiming a plant connection it does not have.
 */

import { useEffect } from 'react'
import { Dashboard } from '../components/dashboard/Dashboard'
import { useMachineStore } from '../store/machineStore'
import { ErrorBoundary } from './ErrorBoundary'

export function App() {
  const connect = useMachineStore((s) => s.connect)
  const disconnect = useMachineStore((s) => s.disconnect)

  useEffect(() => {
    void connect('SIMULATION')
    return () => {
      void disconnect()
    }
  }, [connect, disconnect])

  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  )
}
