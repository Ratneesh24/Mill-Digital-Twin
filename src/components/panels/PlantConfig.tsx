/**
 * PLANT CONFIGURATION — §2 and the assumptions register (§20.8).
 *
 * "Every ⚠ value must be rendered in the UI config page with an 'UNVERIFIED'
 *  badge until replaced with plant data. Do not silently present placeholders as
 *  mill technology data."
 *
 * The engineering coefficients are shown here too, with their stated
 * limitations. §19.6 is explicit that simulation equations must never be
 * presented as actual mill technology formulas, and the clearest way to honour
 * that is to say so on the page where the coefficients live.
 */

import { engineeringConfig } from '../../config/engineeringConfig'
import {
  millConfig,
  OPEN_ITEMS,
  PLANT_PARAMETERS,
  UNVERIFIED_PARAMETER_COUNT,
} from '../../config/millConfig'
import { Panel } from '../common/Panel'

export function PlantConfig() {
  return (
    <div className="dashboard-page-grid grid h-full min-h-0 grid-cols-[1.1fr_1fr] gap-1.5">
      <div className="flex min-h-0 flex-col gap-1.5 overflow-auto">
        <Panel
          title="Plant reference configuration — §2"
          right={
            UNVERIFIED_PARAMETER_COUNT > 0 ? (
              <span className="border-warning/50 text-warning bg-warning/10 border px-1.5 text-micro leading-[15px] tracking-wider">
                {UNVERIFIED_PARAMETER_COUNT} UNVERIFIED
              </span>
            ) : undefined
          }
          bodyClassName="p-0"
        >
          <table className="w-full border-collapse">
            <tbody>
              {PLANT_PARAMETERS.map((p) => (
                <tr key={p.key} className="border-line border-b align-top">
                  <td className="text-text-dim px-2 py-1.5 text-meta">{p.label}</td>
                  <td className="num text-text px-2 py-1.5 text-meta">
                    {p.value}
                    {p.unit ? ` ${p.unit}` : ''}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {p.verified ? (
                      <span className="border-healthy/40 text-healthy bg-healthy/10 border px-1.5 text-micro leading-[15px] tracking-wider">
                        CONFIRMED
                      </span>
                    ) : (
                      <span
                        className="border-warning/60 text-warning bg-warning/10 border px-1.5 text-micro leading-[15px] tracking-wider"
                        title={`${p.note}${p.owner ? ` — owner: ${p.owner}` : ''}`}
                      >
                        UNVERIFIED
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-text-faint border-line border-t px-2 py-2 text-micro leading-relaxed">
            UNVERIFIED values are placeholders. They drive both the physics and the 3D geometry, so
            replacing one in <span className="num">config/millConfig.ts</span> updates the model and
            the scene together. Until then, no number derived from them should be quoted as mill
            technology data.
          </p>
        </Panel>

        <Panel title="Open items before Phase 1 sign-off — §22" bodyClassName="p-0">
          <table className="w-full border-collapse">
            <tbody>
              {OPEN_ITEMS.map((item) => (
                <tr key={item.id} className="border-line border-b align-top">
                  <td className="num text-text-faint w-6 px-2 py-1.5 text-meta">{item.id}</td>
                  <td className="text-text-dim px-2 py-1.5 text-meta leading-snug">{item.item}</td>
                  <td className="text-text-faint px-2 py-1.5 text-right text-micro whitespace-nowrap">
                    {item.owner}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="flex min-h-0 flex-col gap-1.5 overflow-auto">
        <Panel title="Engineering coefficients — §8">
          <div className="border-warning/40 bg-warning/5 mb-2 border p-2">
            <p className="text-warning text-micro leading-relaxed">
              These are SIMPLIFIED TEXTBOOK RELATIONS chosen so the twin is internally consistent.
              They are NOT the mill technology model. Swapping in the real ABP / mill-technology
              model means replacing the functions in <span className="num">src/simulation/</span> —
              the frontend never sees the difference (§19.6).
            </p>
          </div>

          <Group title="Material & friction">
            <Row
              label="Deformation resistance kf0"
              value={engineeringConfig.materialFactor}
              unit="MPa"
              note="Representative mean flow stress for a low-carbon cold-rolling grade. A single scalar cannot represent a grade family."
            />
            <Row
              label="Hardening coefficient C"
              value={engineeringConfig.hardeningCoefficient}
              note="kf = kf0(1 + Cε)^n, a Ludwik-type fit. Fitted shape only, not a measured curve."
            />
            <Row label="Hardening exponent n" value={engineeringConfig.hardeningExponent} />
            <Row
              label="Friction coefficient µ"
              value={engineeringConfig.frictionFactor}
              note="Typical for cold rolling with a rolling-oil emulsion. Held constant; real friction varies with speed, concentration and roll roughness."
            />
            <Row
              label="Plane-strain factor"
              value={engineeringConfig.planeStrainFactor}
              note="2/√3, von Mises"
            />
          </Group>

          <Group title="Mill & drive">
            <Row
              label="Mill modulus M"
              value={engineeringConfig.millModulus}
              unit="t/mm"
              note="Gaugemeter spring constant. Treated as constant; the real mill spring curve is measured and mildly force-dependent. UNVERIFIED."
            />
            <Row
              label="Mechanical efficiency η"
              value={engineeringConfig.mechanicalEfficiency}
              note="Bearing, seal and spindle losses folded into one constant."
            />
            <Row
              label="Lever arm ratio a/L"
              value={engineeringConfig.leverArmRatio}
              note="0.4–0.5 is the accepted band for cold rolling. Constant here; the true lever arm shifts with the friction hill."
            />
            <Row
              label="Forward slip f"
              value={engineeringConfig.forwardSlip}
              note="Keeps roll surface speed and strip exit speed consistent so mass flow closes. Constant; f actually depends on reduction, friction and tension."
            />
            <Row
              label="Roll Young's modulus E"
              value={engineeringConfig.rollYoungsModulus}
              unit="MPa"
              note="Hitchcock flattening"
            />
          </Group>

          <Group title="Control & instrument">
            <Row
              label="HAGC gain Kp"
              value={engineeringConfig.hagcGainP}
              note="Single PI on delivered thickness. The real HAGC is a cascaded position/pressure loop at 100 Hz+ with MFC, THFF and THFB trims plus a separate tilt loop."
            />
            <Row label="HAGC gain Ki" value={engineeringConfig.hagcGainI} />
            <Row
              label="HAGC slew rate"
              value={engineeringConfig.hagcSlewRate}
              unit="mm/s"
            />
            <Row
              label="Gauge noise σ"
              value={engineeringConfig.gaugeNoise.sigma}
              unit="µm"
              note="Applied at the X-ray gauge only, never to a process value other values depend on. White noise only — real gauges also drift and alias with strip flutter."
            />
            <Row
              label="Tension time constant τ"
              value={engineeringConfig.tensionTimeConstant}
              unit="s"
            />
          </Group>

          <Group title="Limits & rates">
            <Row label="Force warning" value={engineeringConfig.forceLimits.warning} unit="t" />
            <Row label="Force alarm" value={engineeringConfig.forceLimits.alarm} unit="t" />
            <Row label="Force trip" value={engineeringConfig.forceLimits.trip} unit="t" />
            <Row label="Acceleration" value={engineeringConfig.acceleration} unit="m/min/s" />
            <Row label="Deceleration" value={engineeringConfig.deceleration} unit="m/min/s" />
            <Row
              label="Fast stop deceleration"
              value={engineeringConfig.fastStopDeceleration}
              unit="m/min/s"
            />
            <Row
              label="Thickness tolerance"
              value={engineeringConfig.thicknessTolerance}
              unit="µm"
            />
            <Row label="Stale after" value={engineeringConfig.staleAfterMs} unit="ms" />
          </Group>
        </Panel>

        <Panel title="Standing plant issue — §2">
          <p className="text-text-dim text-meta leading-relaxed">
            Mill 4 backup roll barrel taper (DS &gt; OS) compounded by a{' '}
            <span className="num text-warning">
              {millConfig.agc.differentialForceReference} t
            </span>{' '}
            AGC differential force reference is a live known issue. The twin therefore carries an
            OS/DS split for force and gap position in its data model from day one, even though
            Phase 1 renders a single value and the 46-tag feed has no per-side instrumentation.
          </p>
          <p className="text-text-faint mt-2 text-micro leading-relaxed">
            §22 item 5: audit this reference before any force-model baselining.
          </p>
        </Panel>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-line mb-2 border-t pt-1.5 first:border-t-0 first:pt-0">
      <div className="label mb-1">{title}</div>
      {children}
    </div>
  )
}

function Row({
  label,
  value,
  unit,
  note,
}: {
  label: string
  value: number
  unit?: string
  note?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]" title={note}>
      <span className={`label truncate ${note ? 'decoration-line-bright underline decoration-dotted underline-offset-2' : ''}`}>
        {label}
      </span>
      <span className="num text-text shrink-0 text-meta">
        {value}
        {unit ? <span className="text-text-faint"> {unit}</span> : null}
      </span>
    </div>
  )
}
