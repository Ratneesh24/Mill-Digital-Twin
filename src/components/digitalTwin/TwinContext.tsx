/**
 * TWIN ENGINE CONTEXT.
 *
 * Holds the single TwinEngine instance and keeps it fed from the machine store
 * through an IMPERATIVE subscription — no React state, so a process update does
 * not re-render one React node in the 3D tree (§15).
 */

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { TwinEngine, type TwinVisuals } from '../../machine/twinEngine'
import { readMachineState, useMachineStore } from '../../store/machineStore'

const TwinEngineContext = createContext<TwinEngine | null>(null)

export function TwinEngineProvider({ children }: { children: ReactNode }) {
  const engine = useMemo(() => new TwinEngine(readMachineState()), [])

  useEffect(() => {
    // Prime immediately, then follow every store update.
    engine.setState(readMachineState())
    return useMachineStore.subscribe((s) => engine.setState(s.state))
  }, [engine])

  return <TwinEngineContext.Provider value={engine}>{children}</TwinEngineContext.Provider>
}

export function useTwinEngine(): TwinEngine {
  const engine = useContext(TwinEngineContext)
  if (!engine) throw new Error('useTwinEngine must be used inside <TwinEngineProvider>')
  return engine
}

/**
 * Per-frame hook for scene objects.
 *
 * The callback receives the SMOOTHED visuals. `advanceOnce` makes the first
 * caller of each frame do the smoothing, so callback ordering does not matter.
 */
export function useTwinFrame(callback: (visuals: TwinVisuals, delta: number) => void): void {
  const engine = useTwinEngine()
  useFrame((state, delta) => {
    const visuals = engine.advanceOnce(state.clock.elapsedTime)
    callback(visuals, delta)
  })
}
