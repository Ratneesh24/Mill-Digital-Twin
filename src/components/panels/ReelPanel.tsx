/**
 * REEL PANEL — DTR / ETR / POR (§11.4).
 *
 *   DTR / ETR : tension, diameter, length, torque, current, thickness, brake,
 *               gauge ready
 *   POR       : tension, diameter, layers, length, torque, current, brake
 *
 * The ROLE chip is the important part. DTR is not "the entry reel" — it is the
 * entry reel *when the mill is running forward*. The chip is computed from the
 * rolling direction and flips on every reversal (§1).
 */

import { useMachineStore } from '../../store/machineStore'
import { Panel } from '../common/Panel'
import { ReadoutRow } from '../common/ValueReadout'
import type { ReelRole } from '../../types/machine'

const ROLE_STYLE: Record<ReelRole, string> = {
  PAYOFF: 'border-normal/50 text-normal bg-normal/10',
  TENSION: 'border-warning/50 text-warning bg-warning/10',
  IDLE: 'border-line text-text-faint',
}

const ROLE_LABEL: Record<ReelRole, string> = {
  PAYOFF: 'PAYOFF · ENTRY',
  TENSION: 'WINDING · EXIT',
  IDLE: 'IDLE',
}

function ReelBlock({ reel }: { reel: 'DTR' | 'ETR' | 'POR' }) {
  const state = useMachineStore((s) =>
    reel === 'DTR' ? s.state.tension.dtr : reel === 'ETR' ? s.state.tension.etr : s.state.tension.por,
  )
  const gaugeReady = useMachineStore((s) =>
    reel === 'DTR' ? s.state.gauges.dtr.ready : reel === 'ETR' ? s.state.gauges.etr.ready : null,
  )

  const isPor = reel === 'POR'

  return (
    <div className="border-line not-last:mb-2 not-last:border-b not-last:pb-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="num text-text text-[12px] font-semibold tracking-[0.1em]">{reel}</span>
        <span className={`border px-1.5 text-[9px] leading-[15px] tracking-wider ${ROLE_STYLE[state.role]}`}>
          {isPor ? 'PARKED' : ROLE_LABEL[state.role]}
        </span>
      </div>

      <ReadoutRow label="Tension" tagName={`${reel}.TENSION`} decimals={1} />
      <ReadoutRow label="Diameter" tagName={`${reel}.DIAMETER`} decimals={0} />
      <ReadoutRow label="Length" tagName={`${reel}.LENGTH`} decimals={0} />
      <ReadoutRow label="Torque" tagName={`${reel}.TORQUE`} decimals={1} />
      <ReadoutRow label="Current" tagName={`${reel}.CURRENT`} decimals={0} />
      <ReadoutRow label="Speed" tagName={`${reel}.RPM`} decimals={1} />
      {isPor ? (
        <ReadoutRow label="Layers" tagName="POR.LAYERS" decimals={0} />
      ) : (
        <ReadoutRow label="Thickness" tagName={`${reel}.THICKNESS`} decimals={3} />
      )}

      <div className="mt-1 flex items-center gap-2">
        <span className="label">BRAKE</span>
        {state.brake === null ? (
          <span className="text-prov-notag border-prov-notag/60 border border-dashed px-1 text-[9px] leading-[14px]">
            NO TAG
          </span>
        ) : (
          <span
            className={`border px-1 text-[9px] leading-[14px] tracking-wider ${
              state.brake === 'APPLIED'
                ? 'border-warning/50 text-warning bg-warning/10'
                : 'border-healthy/40 text-healthy bg-healthy/10'
            }`}
          >
            {state.brake}
          </span>
        )}

        {!isPor && (
          <>
            <span className="label ml-2">GAUGE</span>
            {gaugeReady === null ? (
              <span className="text-prov-notag border-prov-notag/60 border border-dashed px-1 text-[9px] leading-[14px]">
                NO TAG
              </span>
            ) : (
              <span
                className={`border px-1 text-[9px] leading-[14px] tracking-wider ${
                  gaugeReady
                    ? 'border-healthy/40 text-healthy bg-healthy/10'
                    : 'border-alarm/50 text-alarm bg-alarm/10'
                }`}
              >
                {gaugeReady ? 'READY' : 'NOT READY'}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function ReelPanel() {
  return (
    <Panel title="Reels · DTR / ETR / POR">
      <ReelBlock reel="DTR" />
      <ReelBlock reel="ETR" />
      <ReelBlock reel="POR" />
    </Panel>
  )
}
