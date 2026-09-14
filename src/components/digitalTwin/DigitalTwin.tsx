/**
 * DIGITAL TWIN — the primary feature (§1: "This is not a KPI dashboard. The 3D
 * twin is the primary feature and must dominate the screen.")
 *
 * Owns the canvas, the camera policy (§10.7) and the lighting (§10.5). The scene
 * graph itself is assembled from the component set in this folder, each of which
 * binds exactly one part of the machine to exactly one part of MachineState.
 */

import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { ACESFilmicToneMapping, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { millConfig } from '../../config/millConfig'
import { useUiStore } from '../../store/uiStore'
import { useMachineStore } from '../../store/machineStore'
import { AirKnife } from './AirKnife'
import { BackupRoll } from './BackupRoll'
import { CarryOverTable } from './CarryOverTable'
import { Coiler } from './Coiler'
import { CoilHandling } from './CoilHandling'
import { CropShear } from './CropShear'
import { DeflectorRoll } from './DeflectorRoll'
import { ForceVisualization } from './ForceVisualization'
import { Gauge } from './Gauge'
import { HydraulicSystem } from './HydraulicSystem'
import { MillEnclosure } from './MillEnclosure'
import { MillStand } from './MillStand'
import { PeelerUnit } from './PeelerUnit'
import { PinchRollFlattener } from './PinchRollFlattener'
import { Snubber } from './Snubber'
import { Strip } from './Strip'
import { TensionSystem } from './TensionSystem'
import { TwinEngineProvider } from './TwinContext'
import { TwinLabels } from './TwinLabels'
import { WorkRoll } from './WorkRoll'
import { TwinOverlay } from './TwinOverlay'
import { LINE, SCENE } from './twinMaterials'
import {
  EquipmentInspector,
  EquipmentMarker,
  SelectableEquipment,
  TwinEquipmentProvider,
} from './TwinEquipment'

export function DigitalTwin() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [fullscreenError, setFullscreenError] = useState('')
  const [zoom, setZoom] = useState(0)
  useEffect(() => {
    const syncFullscreen = () => setExpanded(document.fullscreenElement === viewportRef.current)
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  async function toggleExpanded() {
    try {
      setFullscreenError('')
      if (document.fullscreenElement === viewportRef.current) await document.exitFullscreen()
      else await viewportRef.current?.requestFullscreen()
    } catch {
      setFullscreenError('Expanded view is unavailable in this browser. Use browser fullscreen instead.')
    }
  }

  return (
    <TwinEquipmentProvider>
      <div ref={viewportRef} className="twin-viewport border-line bg-base-950 relative flex h-full min-h-0 w-full flex-col overflow-auto rounded-xl border">
        <TwinOverlay expanded={expanded} onExpand={toggleExpanded} onZoom={(amount) => setZoom((value) => value + amount)} />
        {fullscreenError && <p role="status" className="text-warning px-3 text-xs">{fullscreenError}</p>}
        <div className="relative min-h-[180px] flex-1 overflow-hidden">
          <Canvas
        aria-label="Interactive rolling mill. Drag to orbit, scroll or pinch to zoom. Use controls and equipment selector outside the canvas for keyboard access."
        shadows
        // 24/7 operation: cap the pixel ratio rather than letting a 4K control
        // room monitor render 4x the fragments for no visible benefit (§15).
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = 1.1
        }}
      >
        <Suspense fallback={null}>
          <TwinEngineProvider>
            <SceneCamera zoom={zoom} />
            <Lighting />

            {/*
              Assembled in the manual's §3 centre-line order: POR -> pinch roll
              cum flattener -> ETR -> entry deflector -> MILL -> delivery
              deflector -> DTR. Reading this list top to bottom walks the line.
            */}
            <SelectableEquipment id="POR"><Coiler reel="POR" /><Snubber /></SelectableEquipment>
            <SelectableEquipment id="PEELER"><PeelerUnit /></SelectableEquipment>
            <SelectableEquipment id="FLATTENER"><PinchRollFlattener /></SelectableEquipment>
            <SelectableEquipment id="CARRY_OVER_TABLE"><CarryOverTable /></SelectableEquipment>
            <SelectableEquipment id="ETR"><Coiler reel="ETR" /></SelectableEquipment>
            <SelectableEquipment id="ENTRY_DEFLECTOR"><DeflectorRoll station="ENTRY" /></SelectableEquipment>
            <SelectableEquipment id="ETR_GAUGE"><Gauge gauge="ETR" /></SelectableEquipment>

            <SelectableEquipment id="STAND"><MillStand /></SelectableEquipment>
            <SelectableEquipment id="BACKUP_ROLLS"><BackupRoll side="UPPER" /><BackupRoll side="LOWER" /></SelectableEquipment>
            <SelectableEquipment id="WORK_ROLLS"><WorkRoll side="UPPER" /><WorkRoll side="LOWER" /></SelectableEquipment>
            <SelectableEquipment id="STRIP"><Strip /></SelectableEquipment>
            <SelectableEquipment id="HYDRAULICS"><HydraulicSystem /></SelectableEquipment>
            <SelectableEquipment id="AIR_KNIVES"><AirKnife station="ENTRY" /><AirKnife station="DELIVERY" /></SelectableEquipment>

            <SelectableEquipment id="DTR_GAUGE"><Gauge gauge="DTR" /></SelectableEquipment>
            <SelectableEquipment id="DELIVERY_DEFLECTOR"><DeflectorRoll station="DELIVERY" /></SelectableEquipment>
            <SelectableEquipment id="CROP_SHEAR"><CropShear /></SelectableEquipment>
            <SelectableEquipment id="DTR"><Coiler reel="DTR" /></SelectableEquipment>
            <SelectableEquipment id="COIL_HANDLING"><CoilHandling /></SelectableEquipment>

            <MillEnclosure />
            <EquipmentMarker />
            <TensionSystem />
            <ForceVisualization />
            <TwinLabels />
          </TwinEngineProvider>
        </Suspense>
          </Canvas>
          <TwinFrozenNotice />
        </div>
        <EquipmentInspector />
        <div className="border-line text-text-dim bg-base-900 flex shrink-0 flex-wrap justify-between gap-x-4 gap-y-1 border-t px-3 py-1.5 text-micro">
          <span>Drag to orbit / Scroll or pinch to zoom</span>
          <span>Strip section x{millConfig.visual.stripThicknessExaggeration} / Roll gap x{millConfig.visual.rollGapExaggeration} for legibility. Values are true.</span>
        </div>
      </div>
    </TwinEquipmentProvider>
  )
}

/**
 * Camera policy — §10.7: "Default: engineering 3/4 isometric. Orbit + zoom
 * allowed, clamped so the machine cannot be lost. Persistent RESET VIEW."
 *
 * Panning is disabled rather than clamped: on a mill this wide, a pan is the
 * one gesture that reliably loses the machine off-screen.
 */
function SceneCamera({ zoom }: { zoom: number }) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const previousZoom = useRef(zoom)
  const aspect = useThree((s) => s.size.width / Math.max(s.size.height, 1))
  const resetToken = useUiStore((s) => s.cameraResetToken)
  const view = useUiStore((s) => s.cameraView)
  const {
    cameraHome,
    cameraTarget,
    cameraStand,
    cameraStandTarget,
    cameraEntry,
    cameraEntryTarget,
    cameraFov,
    cameraMinDistance,
    cameraMaxDistance,
  } = millConfig.visual

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const position =
      view === 'STAND' ? cameraStand : view === 'ENTRY' ? cameraEntry : cameraHome
    const target =
      view === 'STAND' ? cameraStandTarget : view === 'ENTRY' ? cameraEntryTarget : cameraTarget
    // Keep the wide pass line in frame when the workspace narrows.
    const offset = new Vector3(...position).sub(new Vector3(...target))
    offset.multiplyScalar(Math.max(1, Math.min(2.4, 1.65 / aspect)))
    offset.clampLength(cameraMinDistance, cameraMaxDistance)
    controls.object.position.copy(new Vector3(...target).add(offset))
    controls.target.set(...target)
    controls.update()
  }, [resetToken, view, aspect, cameraHome, cameraTarget, cameraStand, cameraStandTarget, cameraEntry, cameraEntryTarget, cameraMinDistance, cameraMaxDistance])

  useEffect(() => {
    const delta = zoom - previousZoom.current
    previousZoom.current = zoom
    const controls = controlsRef.current
    if (!controls || !delta) return
    const offset = controls.object.position.clone().sub(controls.target)
    offset.multiplyScalar(Math.pow(0.8, delta)).clampLength(cameraMinDistance, cameraMaxDistance)
    controls.object.position.copy(controls.target).add(offset)
    controls.update()
  }, [zoom, cameraMinDistance, cameraMaxDistance])

  return (
    <>
      <PerspectiveCamera makeDefault fov={cameraFov} near={0.1} far={120} position={cameraHome} />
      <OrbitControls
        ref={controlsRef}
        target={cameraTarget}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={cameraMinDistance}
        maxDistance={cameraMaxDistance}
        // Stay above the floor plane; looking up from underneath a rolling mill
        // is not a view any engineer wants.
        maxPolarAngle={Math.PI * 0.495}
        minPolarAngle={Math.PI * 0.06}
      />
    </>
  )
}

/**
 * Soft studio industrial lighting (§10.5).
 *
 * The important part is the ENVIRONMENT, not the lamps. Polished steel is
 * `metalness: 0.95`, and a metal has no diffuse response — it renders as
 * whatever it reflects. With no environment map a work roll is literally black
 * no matter how many lights are aimed at it, which is what makes naive PBR mill
 * scenes look like dark slabs.
 *
 * The environment here is built from Lightformers rather than an HDRI file:
 * it renders once into a small cube target, costs nothing per frame, and adds
 * no external asset — which matters for a screen that has to run on an isolated
 * plant network.
 */
function Lighting() {
  // The line runs from the pay-off reel to the delivery tension reel. Both the
  // environment and the shadow camera are sized from it, so extending the line in
  // millConfig cannot leave one end of the mill unlit and unshadowed.
  const centreX = (LINE.maxX + LINE.minX) / 2
  const halfSpan = (LINE.maxX - LINE.minX) / 2 + 2
  // A directional light's shadow camera looks at the scene ORIGIN, not at the
  // line centre, so its frustum has to be measured from the origin too —
  // otherwise the far end of an off-centre line falls outside it and silently
  // stops casting.
  const shadowHalf = Math.max(Math.abs(LINE.minX), Math.abs(LINE.maxX)) + 2
  const shadowTop = SCENE.housingTop + 2

  return (
    <>
      <Environment resolution={256} frames={1}>
        {/* Overhead bay lighting — the dominant reflection on the roll barrels. */}
        <Lightformer
          intensity={2.4}
          color="#f2f7fc"
          position={[centreX, 8, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[halfSpan * 2, 12, 1]}
        />
        {/* Cool side wall, operator side. */}
        <Lightformer
          intensity={1.1}
          color="#c4e0f5"
          position={[centreX - halfSpan - 1, 2.5, 3]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[11, 7, 1]}
        />
        {/* Warmer, dimmer drive side, so the two ends of the barrel differ. */}
        <Lightformer
          intensity={0.85}
          color="#dce5ee"
          position={[centreX + halfSpan + 1, 2, -4]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[11, 7, 1]}
        />
        {/* Floor bounce — stops the underside of the lower stack going to pure black. */}
        <Lightformer
          intensity={0.35}
          color="#d4e0eb"
          position={[centreX, -5, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[halfSpan * 2, 12, 1]}
        />
      </Environment>

      <hemisphereLight args={['#edf6ff', '#aebfcd', 1.4]} />
      <directionalLight
        position={[centreX + 7, 11, 7 * millConfig.visual.cameraSideZ]}
        intensity={2.1}
        castShadow
        // A wider shadow frustum over the same map size is a coarser shadow, so
        // the map grows with the line rather than the shadows going soft.
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowHalf}
        shadow-camera-right={shadowHalf}
        shadow-camera-top={shadowTop}
        shadow-camera-bottom={-shadowTop}
        shadow-camera-near={0.5}
        shadow-camera-far={48}
        shadow-bias={-0.0008}
      />
      <directionalLight position={[centreX - 8, 5, 6]} intensity={0.9} color="#d5eaff" />
      {/*
        Low fill on the face the camera actually looks at, so the near side of the
        housing is not a silhouette. It follows the camera side rather than being
        pinned to +Z.
      */}
      <directionalLight
        position={[centreX + 2, 1, 11 * millConfig.visual.cameraSideZ]}
        intensity={0.7}
        color="#edf5fc"
      />
    </>
  )
}

function TwinFrozenNotice() {
  const communication = useMachineStore((s) => s.state.communication)
  if (communication.connected && !communication.stale) return null
  return (
    <div className="stale-hatch pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-3" role="status">
      <div className="border-alarm/70 bg-base-900/95 rounded-lg border px-4 py-3 text-center shadow-sm">
        <div className="text-alarm text-sm font-semibold">{communication.connected ? 'DATA STALE' : 'DATA SOURCE DISCONNECTED'}</div>
        <div className="text-text-dim mt-1 text-meta">TWIN FROZEN - NOT SHOWING LIVE MACHINE STATE</div>
        <div className="text-text-dim num mt-1 text-micro">LAST VALID DATA: {communication.lastValidTimestamp ? new Date(communication.lastValidTimestamp).toLocaleTimeString() : 'NEVER'}</div>
      </div>
    </div>
  )
}

/** Re-exported so the dashboard can show the twin's connection state inline. */
export function useTwinConnected(): boolean {
  return useMachineStore((s) => s.state.communication.connected)
}
