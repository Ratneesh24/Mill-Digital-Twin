/**
 * INTERLOCK PANEL — §13.2.
 *
 *   DRIVE ✓ → HYDRAULIC ✓ → TENSION ✓ → GAUGE ✓ → MILL READY ✓
 *
 * "On failure, NAME THE CAUSE:
 *      MILL NOT READY
 *      Reason: ETR GAUGE NOT READY
 *  Never display a bare 'MILL NOT READY'."
 *
 * The reason line is not optional in this component — `interlockReadout` always
 * returns one when the chain is broken, and the chain always identifies its
 * first failing link.
 */

import { interlockReadout } from '../../machine/interlockEngine'
import { useMachineStore, selectInterlockChain } from '../../store/machineStore'
import { Panel } from '../common/Panel'

export function InterlockStatus() {
  const chain = useMachineStore(selectInterlockChain)
  const readout = interlockReadout(chain)

  return (
    <Panel title="Mill interlock">
      {/*
        Three outcomes, not two. "MILL READY UNVERIFIED" is amber rather than
        red: the mill may well be ready, the feed simply cannot show it. Claiming
        a fault we cannot see would be as dishonest as claiming a value we do not
        measure (§7.4).
      */}
      <div
        className={`mb-2 border px-2.5 py-2 ${
          chain.millReady
            ? 'border-healthy/45 bg-healthy/10'
            : readout.unverified
              ? 'border-warning/55 bg-warning/10'
              : 'border-alarm/60 bg-alarm/10'
        }`}
      >
        <div
          className={`text-[14px] font-semibold tracking-[0.12em] ${
            chain.millReady
              ? 'text-healthy'
              : readout.unverified
                ? 'text-warning'
                : 'text-alarm alarm-pulse'
          }`}
        >
          {readout.title}
        </div>
        {readout.reason && (
          <div
            className={`mt-0.5 text-[11px] tracking-wide ${
              readout.unverified ? 'text-warning' : 'text-alarm'
            }`}
          >
            {readout.reason}
          </div>
        )}
      </div>

      {/* The chain in order. The first broken link is the one that matters. */}
      <div className="space-y-[3px]">
        {chain.nodes.map((node) => {
          const noTag = node.reason.endsWith('NO TAG ON THIS FEED')
          const isBlocking = node.reason !== '' && node.reason === chain.blockingReason
          return (
            <div
              key={node.id}
              title={node.reason || undefined}
              className={`flex items-center justify-between gap-2 border-l-2 pl-2 ${
                node.ok
                  ? 'border-l-healthy/50'
                  : noTag
                    ? 'border-l-prov-notag'
                    : isBlocking
                      ? 'border-l-alarm'
                      : 'border-l-line'
              }`}
            >
              <span
                className={`label truncate ${isBlocking && !noTag ? 'text-alarm' : ''}`}
              >
                {node.label}
              </span>
              <span
                className={`text-[10px] tracking-wider ${
                  node.ok
                    ? 'text-healthy'
                    : noTag
                      ? 'text-prov-notag'
                      : isBlocking
                        ? 'text-alarm'
                        : 'text-text-faint'
                }`}
              >
                {node.ok ? 'OK' : noTag ? 'NO TAG' : 'BLOCKED'}
              </span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
