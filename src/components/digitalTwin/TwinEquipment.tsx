import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { ValueReadout } from '../common/ValueReadout'
import { LINE, SCENE, SCENE_COLORS } from './twinMaterials'

/**
 * Every selectable part of the line, in the §3 centre-line order.
 *
 * `tags` is OPTIONAL, and that is the point. Most of the auxiliary line — the
 * flattener, the deflector rolls, the shear, the coil cars, the air knives — has
 * no instrumentation on the CRM04 feed at all. The inspector says so rather than
 * finding something plausible to display, which is the same rule the bending
 * actuators follow when their tag is absent.
 */
interface EquipmentEntry {
  name: string
  note: string
  tags?: readonly string[]
  labels?: readonly string[]
  x: number
  z: number
}

const EQUIPMENT = {
  // Entry end, outboard to inboard.
  POR: { name: 'Pay-off reel (POR)', note: 'Charges the line with the next coil. The scene keeps this reel parked with its brake applied, as the manual describes it during normal rolling.', tags: ['POR.DIAMETER', 'POR.LENGTH', 'POR.BRAKE'], labels: ['Coil diameter', 'Wound length', 'Brake applied'], x: LINE.porX, z: 0 },
  PEELER: { name: 'Peeler unit', note: 'Coil opener on the flattener frame. Its knife cuts the coil bands and the table supports the strip nose to the pinch rolls. No instrumentation on this feed — drawn retracted, its position during rolling.', x: LINE.peelerX, z: 0 },
  FLATTENER: { name: 'Pinch roll cum flattener', note: 'Two Ø250 pinch rolls and three Ø200 leveller rolls on a 600 mm barrel, driven at about 30 m/min for threading. No instrumentation on this feed — drawn parked with the top rolls raised and the coupler disengaged.', x: LINE.flattenerX, z: 0 },
  CARRY_OVER_TABLE: { name: 'Carry-over table', note: 'Raised to the pass line for threading and lowered for rolling. No instrumentation on this feed — drawn lowered.', x: LINE.carryOverTableX, z: 0 },
  ETR: { name: 'Entry tension reel (ETR)', note: 'Physical reel identity is fixed; its payoff/tension role changes with direction. On the first pass it is idle and the strip runs over it.', tags: ['ETR.ROLE', 'ETR.DIAMETER', 'ETR.TENSION'], labels: ['Current role', 'Coil diameter', 'Tension'], x: LINE.etrX, z: 0 },
  ENTRY_DEFLECTOR: { name: 'Entry deflector roll', note: 'Ø300 × 600 roll turning the strip onto the pass line. Carries speed encoders on both operator and drive side, feeding the AGC — the only instrumented part of the auxiliary line.', x: LINE.entryDeflectorX, z: 0 },
  ETR_GAUGE: { name: 'ETR-side thickness gauge', note: 'Isotope non-contact gauge, bolted to the ETR side of the stand. Which of the two gauges reads incoming and which reads delivered swaps with rolling direction.', tags: ['GAUGE.ETR.THICKNESS', 'GAUGE.ETR.READY'], labels: ['Thickness', 'Gauge ready'], x: LINE.entryGaugeX, z: 0 },

  // The stand.
  STAND: { name: 'Mill stand', note: 'Separate operator-side and drive-side housings, joined by a top separator and back-up roll change rails. Loaded roll gap and separating force. Selection is view-only.', tags: ['ROLL.GAP.ACTUAL', 'ROLL.FORCE.ACTUAL', 'DRIVE.TORQUE'], labels: ['Loaded gap', 'Separating force', 'Drive torque'], x: 0, z: 0 },
  WORK_ROLLS: { name: 'Work rolls', note: 'Ø215 forged steel on a 600 mm barrel, 92-97 Shore C. Upper and lower roll speed, with bending instrumentation where available.', tags: ['WR.TOP.RPM', 'WR.BOTTOM.RPM', 'WR.TOP.BENDING'], labels: ['Upper speed', 'Lower speed', 'Upper bending'], x: 0, z: 0 },
  BACKUP_ROLLS: { name: 'Back-up rolls', note: 'Ø550 forged steel, 65-70 Shore C, on Timken TQO four-row taper roller bearings. Dimensions retain the source tag provenance.', tags: ['BUR.TOP.RPM', 'BUR.BOTTOM.RPM', 'BUR.TOP.DIAMETER'], labels: ['Upper speed', 'Lower speed', 'Upper diameter'], x: 0, z: 0 },
  HYDRAULICS: { name: 'Roll force and Mae-west blocks', note: 'Ram-type Ø420 roll force cylinder at the top of each housing, 45 mm total stroke, plus four Mae-west blocks carrying the work roll bending and back-up balancing cylinders. Missing feed tags stay unavailable.', tags: ['HYD.LOADING.PRESSURE', 'HYD.GAP.POSITION', 'HYD.BENDING.PRESSURE'], labels: ['Loading pressure', 'Gap position', 'Bending pressure'], x: 0, z: 0 },
  STRIP: { name: 'Steel strip', note: 'True process values; displayed strip thickness is exaggerated for legibility.', tags: ['STRIP.THICKNESS.ENTRY', 'STRIP.THICKNESS', 'STRIP.WIDTH'], labels: ['Entry thickness', 'Delivered thickness', 'Strip width'], x: 0, z: 0 },
  AIR_KNIVES: { name: 'Air knife wipers', note: 'Pneumatic wipers blowing coolant off the strip at entry and delivery. A 0.1-0.3 mm gap to the strip is maintained by turnbuckle — too small to draw at true scale. No instrumentation on this feed.', x: 0, z: 0 },

  // Delivery end, inboard to outboard.
  DTR_GAUGE: { name: 'DTR-side thickness gauge', note: 'Isotope non-contact gauge, bolted to the DTR side of the stand. Which of the two gauges reads incoming and which reads delivered swaps with rolling direction.', tags: ['GAUGE.DTR.THICKNESS', 'GAUGE.DTR.READY'], labels: ['Thickness', 'Gauge ready'], x: LINE.deliveryGaugeX, z: 0 },
  DELIVERY_DEFLECTOR: { name: 'Delivery deflector roll', note: 'Ø300 × 600 roll turning the strip off the pass line to the reel. Carries speed encoders on both operator and drive side, feeding the AGC.', x: LINE.deliveryDeflectorX, z: 0 },
  CROP_SHEAR: { name: 'Crop shear', note: 'Down-cut hydraulic shear on the delivery side, used to square ends and after a strip break. Drawn open — the top knife holder is locked whenever anyone works at the shear. Quantity is an open item: the manual contradicts itself between one and two.', x: LINE.cropShearX, z: 0 },
  DTR: { name: 'Delivery tension reel (DTR)', note: 'Physical reel identity is fixed; its payoff/tension role changes with direction. It takes the coil on the first pass.', tags: ['DTR.ROLE', 'DTR.DIAMETER', 'DTR.TENSION'], labels: ['Current role', 'Coil diameter', 'Tension'], x: LINE.dtrX, z: 0 },

  COIL_HANDLING: { name: 'Coil cars and storage saddles', note: 'Three pit-mounted coil cars with Vee-platten elevators, one per reel, and a storage saddle beside each. Drawn retracted with the elevator down: the manual requires the cars retracted whenever the mill is rolling.', x: LINE.etrX, z: LINE.saddleZ },
} as const satisfies Record<string, EquipmentEntry>

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
  // Sized off the back-up roll so the ring stays legible against the smaller
  // stand without swallowing the equipment it is pointing at.
  const outer = SCENE.burRadius * 1.5
  return (
    <mesh position={[item.x, SCENE.floorY + 0.012, item.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
      <ringGeometry args={[outer - 0.07, outer, 64]} />
      <meshBasicMaterial color={SCENE_COLORS.normal} transparent opacity={0.8} depthWrite={false} />
    </mesh>
  )
}

export function EquipmentInspector() {
  const { selected, select } = useContext(EquipmentContext)
  const id = useId()
  // Widened to the common shape: `satisfies` keeps each entry's literal type, so
  // reading `tags` off the raw union fails for the entries that have none.
  const item: EquipmentEntry | null = selected ? EQUIPMENT[selected] : null
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
        <span className="text-text-dim text-meta">{item ? 'Blue floor ring marks the selected location.' : 'Or click a part in the 3D view.'}</span>
      </div>
      {item && (
        <div className="mt-2" aria-label={`${item.name} machine data`}>
          <p className="text-text-dim mb-2 text-meta">{item.note}</p>
          {item.tags ? (
            <dl className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))' }}>
              {item.tags.map((tag, index) => (
                <div key={tag} className="border-line border-l-2 pl-2">
                  <dt className="text-text-dim text-micro">{item.labels?.[index] ?? tag}</dt>
                  <dd><ValueReadout tagName={tag} size="sm" /></dd>
                </div>
              ))}
            </dl>
          ) : (
            /*
              No tags at all. Say so plainly rather than filling the panel with
              something adjacent — an operator has to be able to tell "this part
              is not instrumented" from "this value is currently unavailable".
            */
            <p className="border-line text-text-dim border-l-2 pl-2 text-meta">
              NOT INSTRUMENTED — no tags for this equipment on the current feed.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
