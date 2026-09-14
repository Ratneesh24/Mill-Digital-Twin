/**
 * TAG INVENTORY — the §7.4 live-mode reality gap, on screen.
 *
 * This page exists so the gap between what the twin can show and what the plant
 * actually measures is a visible, countable engineering fact rather than a
 * footnote. It is what an automation engineer takes into the OEM conversation
 * (§22 item 3).
 */

import { useId, useMemo, useState } from 'react'
import { OEM_PRIORITY_TAGS } from '../../communication/opcUaAdapter'
import { tagDefinitions, tagInventory } from '../../data/tagDefinitions'
import { PROVENANCE_BADGE } from '../../data/tagMap'
import { useMachineStore } from '../../store/machineStore'
import type { LiveAvailability } from '../../types/tags'
import { EmptyNote, Panel } from '../common/Panel'
import { ProvenanceBadge } from '../common/ProvenanceBadge'

const AVAILABILITY_STYLE: Record<LiveAvailability, string> = {
  MEASURED: 'text-prov-measured',
  REFERENCE: 'text-prov-reference',
  CALCULATED: 'text-prov-calculated',
  ESTIMATED: 'text-prov-estimated',
  UNAVAILABLE: 'text-prov-notag',
}

const AVAILABILITY_LABEL: Record<LiveAvailability, string> = {
  MEASURED: 'MEASURED',
  REFERENCE: 'REFERENCE',
  CALCULATED: 'CALCULATED',
  ESTIMATED: 'ESTIMATED',
  UNAVAILABLE: 'NO TAG',
}

const AVAILABILITY_OPTIONS: Array<LiveAvailability | 'ALL'> = [
  'ALL',
  'MEASURED',
  'REFERENCE',
  'CALCULATED',
  'ESTIMATED',
  'UNAVAILABLE',
]

export function TagInventory() {
  const tags = useMachineStore((s) => s.tags)
  const mode = useMachineStore((s) => s.state.operatingMode)
  const searchId = useId()
  const filterId = useId()
  const [query, setQuery] = useState('')
  const [availability, setAvailability] = useState<LiveAvailability | 'ALL'>('ALL')
  const [priorityOnly, setPriorityOnly] = useState(false)

  const priority = useMemo(() => new Set<string>(OEM_PRIORITY_TAGS), [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return tagDefinitions.filter((def) => {
      if (availability !== 'ALL' && def.liveAvailability !== availability) return false
      if (priorityOnly && !priority.has(def.tagName)) return false
      if (!needle) return true
      return (
        def.tagName.toLowerCase().includes(needle) ||
        def.description.toLowerCase().includes(needle) ||
        (def.unit ?? '').toLowerCase().includes(needle)
      )
    })
  }, [availability, priority, priorityOnly, query])

  const hasFilters = query.trim() !== '' || availability !== 'ALL' || priorityOnly

  function resetFilters() {
    setQuery('')
    setAvailability('ALL')
    setPriorityOnly(false)
  }

  return (
    <div className="dashboard-page-grid grid min-h-0 gap-3.5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col gap-3.5">
        <Panel title="CRM04 feed reality — §7.4">
          <p className="text-text-dim mb-3 text-meta leading-relaxed">
            The available 6-month CRM04 extract is 5 s sampled, coil-linked, and carries about 46 of
            the 74 tags this twin models. Everything below is what that means for the picture on the
            other screen.
          </p>
          <Count label="Tags modelled" value={tagInventory.total} tone="text-text" />
          <Count
            label="Measured on the live feed"
            value={tagInventory.measuredOnLiveFeed}
            tone="text-prov-measured"
          />
          <Count
            label="Reference (MMS setup)"
            value={tagInventory.referenceOnLiveFeed}
            tone="text-prov-reference"
          />
          <Count
            label="Calculated from measured"
            value={tagInventory.calculatedOnLiveFeed}
            tone="text-prov-calculated"
          />
          <Count
            label="Estimated by model"
            value={tagInventory.estimatedOnLiveFeed}
            tone="text-prov-estimated"
          />
          <Count
            label="No tag — shown as NO TAG"
            value={tagInventory.unavailableOnLiveFeed}
            tone="text-prov-notag"
          />

          <p className="text-text-faint mt-3 text-meta leading-relaxed">
            Promotion path: when OEM raises PLC sampling on a tag, change its{' '}
            <span className="num">liveAvailability</span> to <span className="num">MEASURED</span> in{' '}
            <span className="num">data/tagDefinitions.ts</span>. Nothing else changes — no component
            reads an availability flag, they all read the resolved provenance off the Tag.
          </p>
        </Panel>

        <Panel title="Raise with OEM first — §22 item 3">
          <p className="text-text-dim mb-2 text-meta leading-relaxed">
            Without these, roll force, capsule position and roll speed are all model output rather
            than measurement.
          </p>
          <ul className="space-y-1.5">
            {OEM_PRIORITY_TAGS.map((tagName) => (
              <li key={tagName} className="num text-warning bg-warning/10 rounded-md px-2 py-1 text-meta">
                {tagName}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title={`Tag map · ${filtered.length} of ${tagDefinitions.length} tags`}
        right={<span className="text-text-faint text-micro font-medium normal-case">ACTIVE MODE: {mode}</span>}
        bodyClassName="p-0 flex flex-col min-h-0"
      >
        <div className="border-line bg-base-850 flex flex-wrap items-end gap-2.5 border-b px-3.5 py-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor={searchId} className="label mb-1 block">
              Search tags
            </label>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tag, description or unit…"
              className="border-line bg-base-900 text-text placeholder:text-text-faint focus:border-normal min-h-10 w-full rounded-md border px-3 text-meta"
            />
          </div>
          <div>
            <label htmlFor={filterId} className="label mb-1 block">
              Live feed status
            </label>
            <select
              id={filterId}
              value={availability}
              onChange={(e) => setAvailability(e.target.value as LiveAvailability | 'ALL')}
              className="border-line bg-base-900 text-text focus:border-normal min-h-10 rounded-md border px-2.5 text-meta"
            >
              {AVAILABILITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'ALL' ? 'All statuses' : AVAILABILITY_LABEL[option]}
                </option>
              ))}
            </select>
          </div>
          <label className="border-line bg-base-900 text-text-dim flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-meta font-medium has-checked:text-text">
            <input
              type="checkbox"
              checked={priorityOnly}
              onChange={(e) => setPriorityOnly(e.target.checked)}
              className="accent-[#005a9c]"
            />
            OEM priority only
          </label>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="border-line text-text-dim hover:text-text hover:bg-base-800 min-h-10 rounded-md border px-3 text-meta font-medium"
            >
              Reset
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="px-3.5 py-6">
            <EmptyNote>
              No tags match “{query.trim()}”
              {availability !== 'ALL' ? ` with status ${AVAILABILITY_LABEL[availability]}` : ''}
              {priorityOnly ? ' in the OEM priority list' : ''}.
            </EmptyNote>
            <div className="mt-2 text-center">
              <button
                type="button"
                onClick={resetFilters}
                className="bg-brand min-h-10 rounded-md px-4 text-meta font-semibold text-white"
              >
                Clear search and filters
              </button>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse">
              <thead className="bg-base-850 sticky top-0 z-10">
                <tr className="text-text-faint border-line border-b text-micro tracking-wider">
                  <th className="px-2.5 py-2 text-left font-semibold">TAG</th>
                  <th className="px-2.5 py-2 text-left font-semibold">DESCRIPTION</th>
                  <th className="px-2.5 py-2 text-left font-semibold">UNIT</th>
                  <th className="px-2.5 py-2 text-left font-semibold">IN SIM</th>
                  <th className="px-2.5 py-2 text-left font-semibold">ON LIVE FEED</th>
                  <th className="px-2.5 py-2 text-left font-semibold">NOW</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((def) => {
                  const tag = tags[def.tagName]
                  return (
                    <tr
                      key={def.tagName}
                      className={`border-line border-b text-meta ${
                        priority.has(def.tagName) ? 'bg-warning/10' : ''
                      }`}
                      title={def.liveNote}
                    >
                      <td className="num text-text px-2.5 py-1.5 whitespace-nowrap">{def.tagName}</td>
                      <td className="text-text-dim px-2.5 py-1.5">{def.description}</td>
                      <td className="text-text-faint num px-2.5 py-1.5">{def.unit ?? '—'}</td>
                      <td className="text-text-faint px-2.5 py-1.5 whitespace-nowrap">
                        {PROVENANCE_BADGE[def.simulationProvenance]}
                      </td>
                      <td
                        className={`px-2.5 py-1.5 font-medium whitespace-nowrap ${AVAILABILITY_STYLE[def.liveAvailability]}`}
                      >
                        {AVAILABILITY_LABEL[def.liveAvailability]}
                      </td>
                      <td className="px-2.5 py-1.5">
                        {tag ? (
                          <ProvenanceBadge
                            provenance={tag.provenance}
                            quality={tag.quality}
                            note={def.liveNote}
                          />
                        ) : (
                          <span className="text-text-faint">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="border-line flex items-baseline justify-between border-b py-1.5 last:border-b-0">
      <span className="label">{label}</span>
      <span className={`num text-value font-semibold ${tone}`}>{value}</span>
    </div>
  )
}
