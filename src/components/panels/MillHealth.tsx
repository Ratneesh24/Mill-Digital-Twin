/**
 * MILL HEALTH — auxiliary media, drive loading and roll data (§11.4).
 *
 *   "LP system, HP loading, HP bending, roll coolant, lubrication, exhaust,
 *    hydraulics → HEALTHY / WARNING / FAULT"
 *
 * On the 46-tag CRM04 feed none of the media status words exist, so this whole
 * panel degrades to NO TAG. That is the honest outcome and it is deliberately
 * visible: it tells the automation team exactly what the twin is missing.
 */

import { engineeringConfig } from '../../config/engineeringConfig'
import { millConfig } from '../../config/millConfig'
import { calculateUtilisation } from '../../machine/rollingEngine'
import { useMachineStore } from '../../store/machineStore'
import type { MachineState } from '../../types/machine'
import { HealthPill, Panel, UtilisationBar } from '../common/Panel'
import { DerivedRow, ReadoutRow } from '../common/ValueReadout'

type MediaKey = keyof MachineState['auxiliarySystems']

const MEDIA: Array<[MediaKey, string]> = [
  ['lpSystem', 'LP system'],
  ['hpLoading', 'HP loading'],
  ['hpBending', 'HP bending'],
  ['coolant', 'Roll coolant'],
  ['lubrication', 'Lubrication'],
  ['exhaust', 'Exhaust'],
]

export function MillHealth() {
  const state = useMachineStore((s) => s.state)
  const utilisation = calculateUtilisation(state)
  const { forceLimits, motorLimits } = engineeringConfig

  // Coolant is per-mill (§2): CRM04 runs Bamerol Aquarol 411B, CRM06 runs
  // Servosteeroll C105. Indexed off the configured mill so it follows the config.
  const coolantName = millConfig.media[millConfig.identity.mill].coolant

  return (
    <Panel title="Mill health">
      {/* Drive and force loading — the two things that decide whether the mill
          can hold the schedule. */}
      <UtilisationBar
        label="Roll force"
        value={utilisation.force}
        warningAt={(forceLimits.warning / millConfig.ratings.maxRollingForce) * 100}
        alarmAt={(forceLimits.alarm / millConfig.ratings.maxRollingForce) * 100}
      />
      <div className="h-1.5" />
      <UtilisationBar label="Drive torque" value={utilisation.torque} warningAt={90} alarmAt={100} />
      <div className="h-1.5" />
      <UtilisationBar label="Drive current" value={utilisation.current} warningAt={90} alarmAt={100} />

      <div className="border-line mt-2 border-t pt-1.5">
        <ReadoutRow label="Drive torque" tagName="DRIVE.TORQUE" decimals={1} />
        <ReadoutRow label="Drive current" tagName="DRIVE.CURRENT" decimals={0} />
        <ReadoutRow label="Drive power" tagName="DRIVE.POWER" decimals={0} />
        <ReadoutRow label="Drive speed" tagName="DRIVE.RPM" decimals={0} />
        <DerivedRow
          label="Drive rating"
          value={millConfig.ratings.mainDriveRating.toFixed(0)}
          unit="kW"
          tone="dim"
          title="UNVERIFIED placeholder — see Plant Config"
        />
        <DerivedRow
          label="Current rating"
          value={motorLimits.currentMax.toFixed(0)}
          unit="A"
          tone="dim"
        />
      </div>

      <div className="border-line mt-2 border-t pt-1.5">
        <div className="label mb-1">HYDRAULICS</div>
        <ReadoutRow label="HAGC loading pressure" tagName="HYD.LOADING.PRESSURE" decimals={0} />
        <ReadoutRow label="Bending pressure" tagName="HYD.BENDING.PRESSURE" decimals={0} />
        <ReadoutRow label="Capsule position" tagName="HYD.GAP.POSITION" decimals={3} />
        <ReadoutRow label="LP pressure" tagName="LP.PRESSURE" decimals={1} />
      </div>

      <div className="border-line mt-2 border-t pt-1.5">
        <div className="label mb-1">MEDIA · {coolantName}</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {MEDIA.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="label truncate">{label}</span>
              <HealthPill health={state.auxiliarySystems[key]} />
            </div>
          ))}
        </div>
      </div>

      <div className="border-line mt-2 border-t pt-1.5">
        <div className="label mb-1">ROLLS</div>
        <DerivedRow
          label="WR diameter (design)"
          value={state.rolls.upperWork.diameter.toFixed(0)}
          unit="mm"
          tone="dim"
          title="From millConfig — UNVERIFIED placeholder, drives both the physics and the 3D scene"
        />
        <ReadoutRow label="WR diameter (roll shop)" tagName="WR.TOP.DIAMETER" decimals={1} />
        <DerivedRow
          label="BUR diameter (design)"
          value={state.rolls.upperBackup.diameter.toFixed(0)}
          unit="mm"
          tone="dim"
        />
        <ReadoutRow label="Upper WR speed" tagName="WR.TOP.RPM" decimals={0} />
        <ReadoutRow label="Upper WR bending" tagName="WR.TOP.BENDING" decimals={0} />
        <div className="flex items-baseline justify-between gap-3 py-[3px]">
          <span className="label">Rolled length since change</span>
          <span className="text-prov-notag border-prov-notag/60 border border-dashed px-1 text-[9px] leading-[14px]">
            NO TAG · PHASE 4
          </span>
        </div>
      </div>
    </Panel>
  )
}
