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
import { backupRollCentreY, SCENE, workRollCentreY } from './twinMaterials'

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
      className={`pointer-events-none rounded border bg-base-900/95 px-2 py-1 text-[10px] leading-[13px] font-medium tracking-wide whitespace-nowrap shadow-sm ${toneClass}`}
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
        <div className="text-text-dim text-[9px] leading-[12px] tracking-wide">{title}</div>
        <ValueReadout tagName={tagName} size="sm" decimals={decimals} />
      </div>
    </Html>
  )
}

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
        Reel identities are physical and do not move with direction. POR sits
        behind DTR, so its label is dropped lower to keep the two apart in
        projection.
      */}
      <StaticLabel position={[-SCENE.reelX, -1.22, 0.9]} text="DTR" />
      <StaticLabel position={[SCENE.reelX, -1.22, 0.9]} text="ETR" />
      <StaticLabel position={[-SCENE.reelX, -1.78, SCENE.porZ]} text="POR" />

      {/* The values §10.6 allows into the scene, and no others. */}
      {!compact && <ValueLabel
        position={[0, SCENE.floorY + 0.35, SCENE.housingZ + 1.15]}
        title={`ROLL GAP · GEOMETRY ×${millConfig.visual.rollGapExaggeration} FOR LEGIBILITY`}
        tagName="ROLL.GAP.ACTUAL"
        decimals={3}
      />}
      {!compact && <ValueLabel
        position={[0, SCENE.housingTop + 0.5, 0]}
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

  // Stacked to the near-left of the housing, clear of both reels (which start
  // at x ≈ ±2.6) and pulled towards the camera in Z so they read in front of
  // the stand rather than through it.
  const x = -SCENE.housingPostX - 1.4
  const z = SCENE.housingZ + 1.0

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
    const x = SCENE.reelX * 0.55
    if (entryRef.current) entryRef.current.position.x = -x * v.directionSign
    if (exitRef.current) exitRef.current.position.x = x * v.directionSign
  })

  return (
    <group>
      <group ref={entryRef}>
        <StaticLabel position={[0, 1.05, 0.9]} text="ENTRY" tone="entry" />
      </group>
      <group ref={exitRef}>
        <StaticLabel position={[0, 1.05, 0.9]} text="EXIT" tone="exit" />
      </group>
    </group>
  )
}

function TensionLabels() {
  const entryRef = useRef<Group>(null)
  const exitRef = useRef<Group>(null)

  useTwinFrame((v) => {
    const x = SCENE.reelX * 0.78
    if (entryRef.current) entryRef.current.position.x = -x * v.directionSign
    if (exitRef.current) exitRef.current.position.x = x * v.directionSign
  })

  return (
    <group>
      <group ref={entryRef}>
        <ValueLabel position={[0, -1.12, 0.9]} title="ENTRY TENSION" tagName="TENSION.ENTRY" />
      </group>
      <group ref={exitRef}>
        <ValueLabel position={[0, -1.12, 0.9]} title="EXIT TENSION" tagName="TENSION.EXIT" />
      </group>
    </group>
  )
}
