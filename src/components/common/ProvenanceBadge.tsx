/**
 * PROVENANCE BADGE — §7.3.
 *
 * "Never render a CALCULATED, SIMULATED, or ESTIMATED value with the appearance
 *  of a MEASURED one. This is an audit-checked requirement, not styling."
 *
 * The badge is driven by the Tag's own provenance, so a value cannot be shown
 * without its origin. There is no prop that lets a caller override it.
 */

import type { Provenance, TagQuality } from '../../types/tags'
import { PROVENANCE_BADGE, PROVENANCE_MEANING } from '../../data/tagMap'

const STYLES: Record<Provenance, string> = {
  MEASURED: 'text-prov-measured border-prov-measured/45 bg-prov-measured/10',
  REFERENCE: 'text-prov-reference border-prov-reference/45 bg-prov-reference/10',
  CALCULATED: 'text-prov-calculated border-prov-calculated/45 bg-prov-calculated/10',
  SIMULATED: 'text-prov-simulated border-prov-simulated/45 bg-prov-simulated/10',
  ESTIMATED: 'text-prov-estimated border-prov-estimated/45 bg-prov-estimated/10',
  // NO TAG is dashed on purpose: it must not read as a value with a label.
  UNAVAILABLE: 'text-prov-notag border-prov-notag/60 bg-transparent border-dashed',
}

interface Props {
  provenance: Provenance
  quality?: TagQuality
  note?: string
  className?: string
}

export function ProvenanceBadge({ provenance, quality, note, className = '' }: Props) {
  const stale = quality === 'STALE'
  const title = [
    PROVENANCE_MEANING[provenance],
    stale ? 'Value is STALE — the feed has stopped updating' : null,
    note,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <span
      title={title}
      className={`inline-flex items-center border px-1 text-micro leading-[14px] font-medium tracking-wider whitespace-nowrap ${
        stale ? 'text-alarm border-alarm/60 bg-alarm/10' : STYLES[provenance]
      } ${className}`}
    >
      {stale ? 'STALE' : PROVENANCE_BADGE[provenance]}
    </span>
  )
}
