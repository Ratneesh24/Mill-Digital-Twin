import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { ValueReadout } from '../common/ValueReadout'
import { SCENE, SCENE_COLORS } from './twinMaterials'

const EQUIPMENT = {
  STAND: { name: 'Mill stand', note: 'Loaded roll gap and separating force. Selection is view-only.', tags: ['ROLL.GAP.ACTUAL', 'ROLL.FORCE.ACTUAL', 'DRIVE.TORQUE'], labels: ['Loaded gap', 'Separating force', 'Drive torque'], x: 0, z: 0 },
  WORK_ROLLS: { name: 'Work rolls', note: 'Upper and lower roll speed, with bending instrumentation where available.', tags: ['WR.TOP.RPM', 'WR.BOTTOM.RPM', 'WR.TOP.BENDING'], labels: ['Upper speed', 'Lower speed', 'Upper bending'], x: 0, z: 0 },
  BACKUP_ROLLS: { name: 'Backup rolls', note: 'Roll-stack support. Dimensions retain the source tag provenance.', tags: ['BUR.TOP.RPM', 'BUR.BOTTOM.RPM', 'BUR.TOP.DIAMETER'], labels: ['Upper speed', 'Lower speed', 'Upper diameter'], x: 0, z: 0 },
  HYDRAULICS: { name: 'Hydraulic AGC', note: 'Loading and gap-position instrumentation. Missing feed tags stay unavailable.', tags: ['HYD.LOADING.PRESSURE', 'HYD.GAP.POSITION', 'HYD.BENDING.PRESSURE'], labels: ['Loading pressure', 'Gap position', 'Bending pressure'], x: 0, z: 0 },
  DTR: { name: 'DTR reel', note: 'Physical reel identity is fixed; its entry/exit role changes with direction.', tags: ['DTR.ROLE', 'DTR.DIAMETER', 'DTR.TENSION'], labels: ['Current role', 'Coil diameter', 'Tension'], x: -SCENE.reelX, z: 0 },
  ETR: { name: 'ETR reel', note: 'Physical reel identity is fixed; its entry/exit role changes with direction.', tags: ['ETR.ROLE', 'ETR.DIAMETER', 'ETR.TENSION'], labels: ['Current role', 'Coil diameter', 'Tension'], x: SCENE.reelX, z: 0 },
  POR: { name: 'POR payoff reel', note: 'Payoff reel. The scene keeps this reel parked with its brake applied.', tags: ['POR.DIAMETER', 'POR.LENGTH', 'POR.BRAKE'], labels: ['Coil diameter', 'Wound length', 'Brake applied'], x: -SCENE.reelX, z: SCENE.porZ },
  DTR_GAUGE: { name: 'DTR thickness gauge', note: 'Physical DTR-side X-ray gauge, independent of rolling direction.', tags: ['GAUGE.DTR.THICKNESS', 'GAUGE.DTR.READY'], labels: ['Thickness', 'Gauge ready'], x: -SCENE.gaugeX, z: 0 },
  ETR_GAUGE: { name: 'ETR thickness gauge', note: 'Physical ETR-side X-ray gauge, independent of rolling direction.', tags: ['GAUGE.ETR.THICKNESS', 'GAUGE.ETR.READY'], labels: ['Thickness', 'Gauge ready'], x: SCENE.gaugeX, z: 0 },
  STRIP: { name: 'Steel strip', note: 'True process values; displayed strip thickness is exaggerated for legibility.', tags: ['STRIP.THICKNESS.ENTRY', 'STRIP.THICKNESS', 'STRIP.WIDTH'], labels: ['Entry thickness', 'Delivered thickness', 'Strip width'], x: 0, z: 0 },
} as const

type EquipmentId = keyof typeof EQUIPMENT
const EquipmentContext = createContext<{
  selected: EquipmentId | ''
  select: (id: EquipmentId | '') => void
}>({ selected: '', select: () => {} })

export function TwinEquipmentProvider({ children }: { children: ReactNode }) {
  const [selected, select] = useState<EquipmentId | ''>('')
  return <EquipmentContext.Provider value={{ selected, select }}>{children}</EquipmentContext.Provider>
}

/** Mesh picking and the native selector share view-only state, never process state. */
export function SelectableEquipment({ id, children }: { id: EquipmentId; children: ReactNode }) {
  const { select } = useContext(EquipmentContext)
  const gl = useThree((s) => s.gl)
  return (
    <group
      onClick={(event) => {
        event.stopPropagation()
        if (event.delta <= 4) select(id)
      }}
      onPointerOver={(event) => { event.stopPropagation(); gl.domElement.style.cursor = 'pointer' }}
      onPointerOut={() => { gl.domElement.style.cursor = 'auto' }}
    >
      {children}
    </group>
  )
}

export function EquipmentMarker() {
  const { selected } = useContext(EquipmentContext)
  if (!selected) return null
  const item = EQUIPMENT[selected]
  return (
    <mesh position={[item.x, SCENE.floorY + 0.012, item.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
      <ringGeometry args={[0.68, 0.75, 64]} />
      <meshBasicMaterial color={SCENE_COLORS.normal} transparent opacity={0.8} depthWrite={false} />
    </mesh>
  )
}

export function EquipmentInspector() {
  const { selected, select } = useContext(EquipmentContext)
  const id = useId()
  const item = selected ? EQUIPMENT[selected] : null
  return (
    <section aria-label="Equipment inspection" className="border-line bg-base-900 shrink-0 border-t px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <label htmlFor={id} className="text-text text-xs font-semibold">Inspect equipment</label>
        <select
          id={id}
          value={selected}
          onChange={(event) => select(event.target.value as EquipmentId | '')}
          className="border-line bg-base-950 text-text focus-visible:outline-normal min-h-10 min-w-0 max-w-full rounded-md border px-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <option value="">Choose equipment</option>
          {Object.entries(EQUIPMENT).map(([key, entry]) => <option key={key} value={key}>{entry.name}</option>)}
        </select>
        <span className="text-text-dim text-[11px]">{item ? 'Blue floor ring marks the selected location.' : 'Or click a part in the 3D view.'}</span>
      </div>
      {item && (
        <div className="mt-2" aria-label={`${item.name} machine data`}>
          <p className="text-text-dim mb-2 text-[11px]">{item.note}</p>
          <dl className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))' }}>
            {item.tags.map((tag, index) => (
              <div key={tag} className="border-line border-l-2 pl-2">
                <dt className="text-text-dim text-[10px]">{item.labels[index]}</dt>
                <dd><ValueReadout tagName={tag} size="sm" /></dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  )
}
