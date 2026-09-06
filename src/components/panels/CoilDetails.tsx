/**
 * COIL PANEL — §11.4.
 *
 * "Coil ID, width, input/current/target/final thickness, length, remaining
 *  length, diameter, pass"
 */

import { formatDuration, passTimeRemaining, throughput } from '../../machine/rollingEngine'
import { useMachineStore } from '../../store/machineStore'
import { DerivedRow, ReadoutRow } from '../common/ValueReadout'
import { Panel } from '../common/Panel'

export function CoilDetails() {
  const state = useMachineStore((s) => s.state)
  const grade = state.coil.grade

  return (
    <Panel title="Coil / entry">
      <div className="mb-2">
        <div className="label">COIL ID</div>
        <div className="num text-text text-[15px] tracking-tight">{state.coil.id}</div>
        <div className="text-text-faint mt-0.5 text-[10px]">
          {grade ?? (
            <span className="text-prov-notag border-prov-notag/60 border border-dashed px-1">
              GRADE — NO TAG
            </span>
          )}
        </div>
      </div>

      <div className="border-line border-t pt-1.5">
        <ReadoutRow label="Strip width" tagName="STRIP.WIDTH" decimals={0} />
        <ReadoutRow label="Entry thickness" tagName="STRIP.THICKNESS.ENTRY" decimals={3} />
        <ReadoutRow label="Exit thickness" tagName="STRIP.THICKNESS" decimals={3} />
        <ReadoutRow label="Target this pass" tagName="STRIP.THICKNESS.REF" decimals={3} />
        <ReadoutRow label="Reduction" tagName="STRIP.REDUCTION" decimals={2} />
      </div>

      <div className="border-line mt-1.5 border-t pt-1.5">
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
