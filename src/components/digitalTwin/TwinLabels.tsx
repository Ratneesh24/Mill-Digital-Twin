/**
 * IN-SCENE LABELS — §10.6.
 *
 * "ENTRY · EXIT · DTR · ETR · POR · UPPER BACKUP ROLL · UPPER WORK ROLL ·
 *  LOWER WORK ROLL · LOWER BACKUP ROLL · ROLL GAP (with value) · ROLL FORCE ·
 *  ENTRY TENSION · EXIT TENSION. Only important values live in the 3D scene."
 *
 * The value-bearing labels use the SAME `ValueReadout` component as the KPI bar
 * and the detail panels. That is not a convenience — it is the §18 requirement
 * that "the value beside the machine == MachineState == the trend chart" made
 * structurally impossible to violate: there is one component that prints a
 * process value, and it takes a tag name.
 *
 * ENTRY and EXIT are positioned from the rolling direction every frame, so they
 * swap sides on a reversal exactly when the strip does (§1).
 */

import { useRef } from 'react'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { Group } from 'three'
import { millConfig } from '../../config/millConfig'
import { useUiStore } from '../../store/uiStore'
import { ValueReadout } from '../common/ValueReadout'
import { useTwinFrame } from './TwinContext'
import { rollGapToScene } from '../../config/unitConversion'
import { backupRollCentreY, LINE, SCENE, workRollCentreY } from './twinMaterials'

/** Shared chrome for every scene label. */
function LabelChip({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: 'default' | 'entry' | 'exit'
}) {
  const toneClass =
    tone === 'entry'
      ? 'border-normal/50 text-normal'
      : tone === 'exit'
        ? 'border-warning/50 text-warning'
        : 'border-line-bright text-text-dim'
  return (
    <div
      className={`pointer-events-none rounded border bg-base-900/95 px-2 py-1 text-micro leading-[13px] font-medium tracking-wide whitespace-nowrap shadow-sm ${toneClass}`}
    >
      {children}
    </div>
  )
}

function StaticLabel({
  position,
  text,
  tone,
}: {
  position: [number, number, number]
  text: string
  tone?: 'default' | 'entry' | 'exit'
}) {
  return (
    <Html position={position} center distanceFactor={undefined} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <LabelChip tone={tone}>{text}</LabelChip>
    </Html>
  )
}

/** A label carrying a live value from a tag, badge and all. */
function ValueLabel({
  position,
  title,
  tagName,
  decimals,
}: {
  position: [number, number, number]
  title: string
  tagName: string
  decimals?: number
}) {
  return (
    <Html position={position} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <div className="border-line-bright bg-base-900/95 pointer-events-none rounded-md border px-2 py-1 shadow-sm">
        <div className="text-text-dim text-micro leading-[12px] tracking-wide">{title}</div>
        <ValueReadout tagName={tagName} size="sm" decimals={decimals} />
      </div>
    </Html>
  )
}

/**
 * Label rows along the line, kept below the pass line and on the camera's side of
 * the barrel so they read in front of the equipment rather than through it.
 */
const STATION_LABEL_Y = SCENE.floorY + 0.34
const AUX_LABEL_Y = SCENE.floorY + 0.06
const STATION_LABEL_Z = (SCENE.housingZ + 0.5) * SCENE.cameraSideZ
/** Nearer offset for chips that sit on the pass line rather than on the floor. */
const PASS_LINE_LABEL_Z = 0.7 * SCENE.cameraSideZ

export function TwinLabels() {
  const show = useUiStore((s) => s.showSceneLabels)
  const view = useUiStore((s) => s.cameraView)
  const compact = useThree((s) => s.size.width < 620 || s.size.height < 300)
  if (!show) return null

  return (
    <group>
      {view === 'STAND' && !compact && <RollStackLabels />}
      <EntryExitLabels />

      {/*
        Station identities are physical and do not move with direction. They are
        laid out along the pass line in the §3 centre-line order, which with the
        default camera reads POR on the right through to DTR on the left — the
        mill's own right-to-left hand.
      */}
      <StaticLabel position={[LINE.porX, STATION_LABEL_Y, STATION_LABEL_Z]} text="POR" />
      <StaticLabel position={[LINE.etrX, STATION_LABEL_Y, STATION_LABEL_Z]} text="ETR" />
      <StaticLabel position={[LINE.dtrX, STATION_LABEL_Y, STATION_LABEL_Z]} text="DTR" />

      {/*
        Auxiliary line equipment. Dropped a row lower than the reels so a
        crowded entry end still reads, and suppressed on a small viewport where
        they would overlap into noise.
      */}
      {!compact && (
        <>
          <StaticLabel position={[LINE.flattenerX, AUX_LABEL_Y, STATION_LABEL_Z]} text="PINCH ROLL / FLATTENER" />
          <StaticLabel position={[LINE.entryDeflectorX, AUX_LABEL_Y, STATION_LABEL_Z]} text="ENTRY DEFLECTOR" />
          <StaticLabel position={[LINE.deliveryDeflectorX, AUX_LABEL_Y, STATION_LABEL_Z]} text="DELIVERY DEFLECTOR" />
          <StaticLabel position={[LINE.cropShearX, AUX_LABEL_Y, STATION_LABEL_Z]} text="CROP SHEAR" />
        </>
      )}

      {/*
        The values §10.6 allows into the scene, and no others.

        ROLL GAP is pulled well forward of the label rows in Z so it separates
        from the deflector and shear chips by parallax rather than landing on top
        of them: they share the middle of the line, and at line zoom a few metres
        of X is not much screen distance.
      */}
      {!compact && <ValueLabel
        position={[0, SCENE.floorY + 0.42, (SCENE.housingZ + 1.9) * SCENE.cameraSideZ]}
        title={`ROLL GAP · GEOMETRY ×${millConfig.visual.rollGapExaggeration} FOR LEGIBILITY`}
        tagName="ROLL.GAP.ACTUAL"
        decimals={3}
      />}
      {!compact && <ValueLabel
        position={[0, SCENE.housingTop + 0.42, 0]}
        title="ROLL FORCE"
        tagName="ROLL.FORCE.ACTUAL"
        decimals={0}
      />}
      {!compact && <TensionLabels />}
    </group>
  )
}

/** Roll-stack labels follow the stack as the gap opens and closes. */
function RollStackLabels() {
  const upperWr = useRef<Group>(null)
  const lowerWr = useRef<Group>(null)
  const upperBur = useRef<Group>(null)
  const lowerBur = useRef<Group>(null)

  useTwinFrame((v) => {
    const gap = rollGapToScene(v.rollGap)
    if (upperWr.current) upperWr.current.position.y = workRollCentreY(gap, 'UPPER')
    if (lowerWr.current) lowerWr.current.position.y = workRollCentreY(gap, 'LOWER')
    if (upperBur.current) upperBur.current.position.y = backupRollCentreY(gap, 'UPPER')
    if (lowerBur.current) lowerBur.current.position.y = backupRollCentreY(gap, 'LOWER')
  })

  // Stacked out past the housing on the delivery side, clear of the gauge and
  // the deflector roll, and pulled towards the camera in Z so they read in front
  // of the stand rather than through it. Only shown in the STAND view, where the
  // camera is close enough for four stacked chips to separate.
  const x = SCENE.housingPostX + SCENE.burRadius * 2.4
  const z = (SCENE.housingZ + 0.8) * SCENE.cameraSideZ

  return (
    <group>
      <group ref={upperBur}>
        <StaticLabel position={[x, 0, z]} text="UPPER BACKUP ROLL" />
      </group>
      <group ref={upperWr}>
        <StaticLabel position={[x, 0, z]} text="UPPER WORK ROLL" />
      </group>
      <group ref={lowerWr}>
        <StaticLabel position={[x, 0, z]} text="LOWER WORK ROLL" />
      </group>
      <group ref={lowerBur}>
        <StaticLabel position={[x, 0, z]} text="LOWER BACKUP ROLL" />
      </group>
    </group>
  )
}

/**
 * ENTRY and EXIT are LOGICAL ROLES (§1). These two labels are the most visible
 * expression of that rule: on a reversal they cross the mill.
 */
function EntryExitLabels() {
  const entryRef = useRef<Group>(null)
  const exitRef = useRef<Group>(null)

  useTwinFrame((v) => {
    // directionSign is damped, so the labels slide across rather than teleport.
    const x = Math.abs(LINE.deliveryDeflectorX) * 1.4
    if (entryRef.current) entryRef.current.position.x = -x * v.directionSign
    if (exitRef.current) exitRef.current.position.x = x * v.directionSign
  })

  const y = SCENE.housingTop * 0.42

  return (
    <group>
      <group ref={entryRef}>
        <StaticLabel position={[0, y, PASS_LINE_LABEL_Z]} text="ENTRY" tone="entry" />
      </group>
      <group ref={exitRef}>
        <StaticLabel position={[0, y, PASS_LINE_LABEL_Z]} text="EXIT" tone="exit" />
      </group>
    </group>
  )
}

function TensionLabels() {
  const entryRef = useRef<Group>(null)
  const exitRef = useRef<Group>(null)

  useTwinFrame((v) => {
    // Out along the span, between the deflector roll and the reel, so the value
    // sits over the stretch of strip it actually describes.
    const x = Math.abs(LINE.dtrX) * 0.62
    if (entryRef.current) entryRef.current.position.x = -x * v.directionSign
    if (exitRef.current) exitRef.current.position.x = x * v.directionSign
  })

  const y = SCENE.housingTop * 0.55

  return (
    <group>
      <group ref={entryRef}>
        <ValueLabel position={[0, y, PASS_LINE_LABEL_Z]} title="ENTRY TENSION" tagName="TENSION.ENTRY" />
      </group>
      <group ref={exitRef}>
        <ValueLabel position={[0, y, PASS_LINE_LABEL_Z]} title="EXIT TENSION" tagName="TENSION.EXIT" />
      </group>
    </group>
  )
}
