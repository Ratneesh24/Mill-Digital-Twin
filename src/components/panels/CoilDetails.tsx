/**
 * COIL PANEL — §11.4.
 *
 * "Coil ID, width, input/current/target/final thickness, length, remaining
 *  length, diameter, pass"
 */

import { formatDuration, passTimeRemaining, throughput } from '../../machine/rollingEngine'
import { useMachineStore } from '../../store/machineStore'
import { DerivedRow, ReadoutRow, ValueReadout } from '../common/ValueReadout'
import { Panel } from '../common/Panel'

export function CoilDetails() {
  const state = useMachineStore((s) => s.state)
  const grade = state.coil.grade

  return (
    <Panel title="Coil / entry">
      <div className="mb-2">
        <div className="label">COIL ID</div>
        <div className="num text-text text-body font-semibold tracking-tight">{state.coil.id}</div>
        <div className="text-text-faint mt-0.5 text-micro">
          {grade ?? (
            <span className="text-prov-notag border-prov-notag/60 rounded-full border border-dashed px-2 py-px">
              GRADE — NO TAG
            </span>
          )}
        </div>
      </div>

      {/* Hero stats — the four numbers an operator reads first. */}
      <div className="border-line grid grid-cols-2 gap-2 border-t pt-2.5">
        <CoilStat label="EXIT THICKNESS" tagName="STRIP.THICKNESS" decimals={3} />
        <CoilStat label="TARGET PASS" tagName="STRIP.THICKNESS.REF" decimals={3} />
        <CoilStat label="STRIP WIDTH" tagName="STRIP.WIDTH" decimals={0} />
        <CoilStat label="REDUCTION" tagName="STRIP.REDUCTION" decimals={2} />
      </div>

      <div className="border-line mt-2 border-t pt-1.5">
        <ReadoutRow label="Entry thickness" tagName="STRIP.THICKNESS.ENTRY" decimals={3} />
        <ReadoutRow label="Coil length" tagName="COIL.LENGTH" decimals={0} />
        <ReadoutRow label="Remaining this pass" tagName="COIL.REMAINING_LENGTH" decimals={0} />
        <ReadoutRow label="Payoff diameter" tagName="COIL.DIAMETER" decimals={0} />
      </div>

      <div className="border-line mt-1.5 border-t pt-1.5">
        {/* Derived indicators — dimmer treatment, never mistakable for a tag. */}
        <DerivedRow
          label="Pass time remaining"
          value={formatDuration(passTimeRemaining(state))}
          title="Remaining length divided by the mass-flow entry speed"
        />
        <DerivedRow
          label="Throughput"
          value={throughput(state).toFixed(1)}
          unit="t/h"
          title="h × w × v × ρ at the delivered section"
        />
        <DerivedRow
          label="Final thickness"
          value={state.coil.finalThickness.toFixed(3)}
          unit="mm"
          tone="dim"
        />
      </div>
    </Panel>
  )
}

/** One hero stat in the 2×2 grid — big tabular value, micro label. */
function CoilStat({
  label,
  tagName,
  decimals,
}: {
  label: string
  tagName: string
  decimals?: number
}) {
  return (
    <div className="bg-base-800/60 border-line min-w-0 rounded-xl border px-3 py-2">
      <div className="label truncate">{label}</div>
      <div className="mt-0.5">
        <ValueReadout tagName={tagName} size="md" decimals={decimals} hideBadge />
      </div>
    </div>
  )
}
