/**
 * PASS SCHEDULE — §11.4.
 *
 * "All passes; current pass visually dominant; `2.800 → 2.110, 24.6%`"
 *
 * The predicted force column is computed by the SAME force model that produces
 * the live reading, so REF and actual are directly comparable and a divergence
 * means something real rather than two different formulas disagreeing.
 */

import { demoPassSchedule } from '../../data/demoPassSchedule'
import { useMachineStore } from '../../store/machineStore'
import { Panel } from '../common/Panel'

export function PassSchedulePanel({ dense = false }: { dense?: boolean }) {
  const currentPass = useMachineStore((s) => s.state.pass.current)
  const direction = useMachineStore((s) => s.state.rollingDirection)
  const progress = useMachineStore((s) => s.state.pass.progress)

  return (
    <Panel
      title="Pass schedule"
      right={
        <span className="text-text-faint truncate text-micro normal-case">
          {demoPassSchedule.source}
        </span>
      }
      bodyClassName="p-0"
    >
      <table className="w-full border-collapse">
        {/* Sticky: the panel body is the scroll container and a long schedule
            scrolls the column labels away otherwise. */}
        <thead className="bg-base-850 sticky top-0 z-10">
          <tr className="text-text-faint border-line border-b text-micro tracking-wider">
            <th className="px-2 py-1 text-left font-normal">PASS</th>
            <th className="px-2 py-1 text-left font-normal">DIR</th>
            <th className="px-2 py-1 text-right font-normal">IN → OUT (mm)</th>
            <th className="px-2 py-1 text-right font-normal">RED %</th>
            <th className="px-2 py-1 text-right font-normal">SPEED</th>
            {!dense && (
              <>
                <th className="px-2 py-1 text-right font-normal">σ ENTRY</th>
                <th className="px-2 py-1 text-right font-normal">σ EXIT</th>
              </>
            )}
            <th className="px-2 py-1 text-right font-normal">FORCE REF</th>
          </tr>
        </thead>
        <tbody>
          {demoPassSchedule.passes.map((p) => {
            const isCurrent = p.pass === currentPass
            const isDone = p.pass < currentPass
            return (
              <tr
                key={p.pass}
                className={`border-line border-b text-meta ${
                  isCurrent
                    ? 'pass-current text-text'
                    : isDone
                      ? 'text-text-faint'
                      : 'text-text-dim'
                }`}
              >
                <td className="px-2 py-1">
                  <span className="flex items-center gap-1.5">
                    {isCurrent && <span className="dot-glow bg-normal h-3 w-[3px]" />}
                    <span className={`num ${isCurrent ? 'font-semibold' : ''}`}>{p.pass}</span>
                  </span>
                </td>
                <td className="px-2 py-1 text-micro tracking-wider">
                  {p.direction === 'FORWARD' ? 'FWD →' : '← REV'}
                </td>
                <td className="num px-2 py-1 text-right">
                  {p.inputThickness.toFixed(3)} → {p.outputThickness.toFixed(3)}
                </td>
                <td className="num px-2 py-1 text-right">{p.reduction.toFixed(1)}</td>
                <td className="num px-2 py-1 text-right">{p.speedReference.toFixed(0)}</td>
                {!dense && (
                  <>
                    <td className="num px-2 py-1 text-right">{p.entrySpecificTension}</td>
                    <td className="num px-2 py-1 text-right">{p.exitSpecificTension}</td>
                  </>
                )}
                <td className="num px-2 py-1 text-right">{p.predictedForce.toFixed(0)} t</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="border-line border-t px-2 py-1.5">
        <div className="flex items-center justify-between">
          <span className="label">
            PASS {currentPass} · {direction === 'FORWARD' ? 'FORWARD' : 'REVERSE'}
          </span>
          <span className="num text-text-dim text-micro">
            {(progress * 100).toFixed(0)}%
          </span>
        </div>
        <div className="bg-base-800 border-line mt-1 h-[5px] overflow-hidden rounded-full border">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-deep via-brand to-normal transition-[width] duration-300"
            style={{ width: `${Math.min(progress * 100, 100)}%` }}
          />
        </div>
      </div>
    </Panel>
  )
}
