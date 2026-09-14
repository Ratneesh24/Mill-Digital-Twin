/**
 * MILL LINE SCHEMATIC — POR → ETR → 4HI MILL → DTR.
 *
 * Top    = what is happening to the material (entry → reduction → exit).
 * Middle = where the material physically is (coil → entry rolls → 4HI bite → delivery rolls).
 * Bottom = how the mill is controlling it (bending / tilt / torque / hyd position).
 *
 * Pure SVG + HTML + CSS animation: no canvas, no recharts, so the dashboard
 * layout probe (which forbids both on /dashboard) keeps passing. All SVG text
 * stays at 11px+ so the legibility probe keeps passing.
 *
 * Values come from ValueReadout / the store — never invented here. Control
 * parameters with no tag on the active feed are omitted (not faked); when the
 * mill starts providing a tag the cell appears with no code change.
 */

import { cn } from '../ui/cn'
import { useMachineStore } from '../../store/machineStore'
import type { Tag } from '../../types/tags'
import { ValueReadout } from '../common/ValueReadout'

/** A tag counts as displayable only with a real value on this feed. */
function isLive(tag: Tag | undefined): boolean {
  return !!tag && tag.value !== null && tag.provenance !== 'UNAVAILABLE'
}

export function MillLineSchematic() {
  const direction = useMachineStore((s) => s.state.rollingDirection)
  const force = useMachineStore((s) => s.state.rollingForce.actual)
  const gap = useMachineStore((s) => s.state.rollGap.actual)
  const status = useMachineStore((s) => s.state.machineStatus)
  const porReel = useMachineStore((s) => s.state.tension.por)
  const etrReel = useMachineStore((s) => s.state.tension.etr)
  const dtrReel = useMachineStore((s) => s.state.tension.dtr)

  const wrTopTag = useMachineStore((s) => s.tags['WR.TOP.BENDING'])
  const wrBtmTag = useMachineStore((s) => s.tags['WR.BOTTOM.BENDING'])
  const tiltTag = useMachineStore((s) => s.tags['ROLL.GAP.TILT'])
  const torqueTag = useMachineStore((s) => s.tags['DRIVE.TORQUE'])
  const hydTag = useMachineStore((s) => s.tags['HYD.GAP.POSITION'])

  const fwd = direction === 'FORWARD'
  const rolling = status === 'ROLLING'
  const flowClass = rolling ? (fwd ? 'strip-flow' : 'strip-flow-rev') : undefined
  // Force 0–360 t maps to arrow length 8–34px.
  const arrow = 8 + Math.min(1, force / 360) * 26
  const steel = rolling ? 'url(#stripSteel)' : 'var(--color-base-600)'

  // Strip thinning: thick on the incoming (entry) side, thin on delivery.
  // Sides swap with rolling direction; the equipment order never moves.
  const entryH = 7
  const exitH = 4.5
  const leftH = fwd ? entryH : exitH
  const rightH = fwd ? exitH : entryH
  const passY = 119
  const leftY = passY - leftH / 2
  const rightY = passY - rightH / 2

  const showWr = isLive(wrTopTag) || isLive(wrBtmTag)
  const showTilt = isLive(tiltTag)
  const showTorque = isLive(torqueTag)
  const showHyd = isLive(hydTag)
  const showControlRow = showWr || showTilt || showTorque || showHyd

  return (
    <div className="mill-line-block">
      {/* ── TOP: what is happening to the material ── */}
      <div
        className="mb-1 flex items-center justify-center gap-3 text-center sm:gap-5"
        aria-label="Pass thickness: entry, reduction, exit"
      >
        <div className="min-w-0">
          <p className="label">Entry thk.</p>
          <ValueReadout tagName="STRIP.THICKNESS.ENTRY" size="md" decimals={3} hideBadge />
        </div>
        <span aria-hidden className="text-text-faint text-body num">
          →
        </span>
        <div className="min-w-0">
          <p className="label">Reduction</p>
          <ValueReadout tagName="STRIP.REDUCTION" size="md" decimals={1} hideBadge />
        </div>
        <span aria-hidden className="text-text-faint text-body num">
          →
        </span>
        <div className="min-w-0">
          <p className="label">Exit thk.</p>
          <ValueReadout tagName="STRIP.THICKNESS" size="md" decimals={3} hideBadge />
        </div>
      </div>

      {/* ── MIDDLE: where the material physically is ── */}
      <svg
        viewBox="0 0 680 232"
        role="img"
        aria-label={`4HI line POR to ETR to mill to DTR, rolling ${direction.toLowerCase()}`}
        className={cn('mill-schematic', rolling && 'schematic-live')}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="stripSteel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8fb8dd" />
            <stop offset="0.5" stopColor="#3d6b9c" />
            <stop offset="1" stopColor="#274a70" />
          </linearGradient>
          <radialGradient id="rollMetal" cx="0.35" cy="0.3" r="1">
            <stop offset="0" stopColor="#d7e5f2" />
            <stop offset="0.55" stopColor="#8ba5ba" />
            <stop offset="1" stopColor="#4e6279" />
          </radialGradient>
          <radialGradient id="coilMetal" cx="0.4" cy="0.35" r="1">
            <stop offset="0" stopColor="#c8d9ea" />
            <stop offset="0.6" stopColor="#6f93b3" />
            <stop offset="1" stopColor="#2c3d5f" />
          </radialGradient>
        </defs>

        {/* ── baseline ── */}
        <line x1="12" y1="168" x2="668" y2="168" stroke="var(--color-line-bright)" strokeWidth="2" />

        {/* ── strip spans (drawn first so rolls sit on top of the bite) ── */}
        <rect
          x="92"
          y={leftY}
          width="236"
          height={leftH}
          rx={leftH / 2}
          fill={steel}
          opacity={rolling ? 1 : 0.5}
        />
        <line
          x1="92"
          y1={passY}
          x2="328"
          y2={passY}
          stroke="#ffffff"
          strokeWidth="1.4"
          opacity={rolling ? 0.85 : 0}
          className={flowClass}
        />
        <rect
          x="352"
          y={rightY}
          width="200"
          height={rightH}
          rx={rightH / 2}
          fill={steel}
          opacity={rolling ? 1 : 0.5}
        />
        <line
          x1="352"
          y1={passY}
          x2="552"
          y2={passY}
          stroke="#ffffff"
          strokeWidth="1.4"
          opacity={rolling ? 0.85 : 0}
          className={flowClass}
        />
        {/* short tail leaving the delivery unit */}
        <rect
          x="552"
          y={rightY}
          width="58"
          height={rightH}
          rx={rightH / 2}
          fill={steel}
          opacity={rolling ? 1 : 0.5}
        />

        {/* ── single flow chevrons on the upstream span ── */}
        <FlowChevrons fwd={fwd} active={rolling} />

        {/* ── POR: payoff coil on mandrel ── */}
        <g>
          <line x1="62" y1="150" x2="62" y2="168" stroke="var(--color-text-faint)" strokeWidth="3" />
          <line
            x1="48"
            y1="168"
            x2="76"
            y2="168"
            stroke="var(--color-text-faint)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="62" cy="120" r="30" fill="url(#coilMetal)" stroke="var(--color-line-bright)" strokeWidth="2" />
          <circle cx="62" cy="120" r="22" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.35" />
          <circle cx="62" cy="120" r="14" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.25" />
          <line
            x1="62"
            y1="120"
            x2="84"
            y2="120"
            stroke="#ffffff"
            strokeWidth="2.5"
            opacity="0.7"
            style={
              rolling
                ? { transformOrigin: '62px 120px', animation: 'coil-spin 3s linear infinite' }
                : undefined
            }
          />
          <circle cx="62" cy="120" r="7" fill="var(--color-base-800)" stroke="var(--color-line-bright)" strokeWidth="2" />
        </g>

        {/* ── ETR: entry pinch rolls ── */}
        <EntryDeliveryUnit cx={180} />
        {/* ── DTR: delivery pinch rolls ── */}
        <EntryDeliveryUnit cx={530} />

        {/* ── 4HI MILL STAND (largest component) ── */}
        <g>
          {/* housings */}
          <rect x="260" y="30" width="26" height="138" rx="6" fill="var(--color-base-800)" stroke="var(--color-line-bright)" strokeWidth="2" />
          <rect x="394" y="30" width="26" height="138" rx="6" fill="var(--color-base-800)" stroke="var(--color-line-bright)" strokeWidth="2" />
          {/* top beam + hydraulic capsule */}
          <rect x="260" y="18" width="160" height="13" rx="5" fill="var(--color-base-700)" stroke="var(--color-line-bright)" strokeWidth="1.5" />
          <rect x="322" y="4" width="36" height="18" rx="4" fill="var(--color-brand)" opacity="0.85" />
          <rect x="322" y="4" width="36" height="6" rx="3" fill="#ffffff" opacity="0.35" />

          {/* load badge — originates from the stand beam */}
          <g>
            <rect x="298" y="36" width="84" height="20" rx="10" fill="var(--color-base-950)" stroke="var(--color-line-bright)" strokeWidth="1" />
            <text x="340" y="50" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-text)" fontFamily="var(--font-mono)">
              {force.toFixed(0)} kN
            </text>
          </g>

          {/* roll stack: UBR / UWR / strip bite / LWR / LBR */}
          <circle cx="340" cy="80" r="24" fill="url(#rollMetal)" stroke="var(--color-text-faint)" strokeWidth="2" />
          <circle cx="340" cy="80" r="6" fill="var(--color-base-800)" stroke="var(--color-text-faint)" strokeWidth="1.5" />
          <circle cx="340" cy="106" r="12" fill="var(--color-brand)" stroke="#ffffff" strokeWidth="1" opacity="0.95" />
          <circle cx="340" cy="132" r="12" fill="var(--color-brand-deep)" stroke="#ffffff" strokeWidth="1" opacity="0.95" />
          <circle cx="340" cy="158" r="24" fill="url(#rollMetal)" stroke="var(--color-text-faint)" strokeWidth="2" />
          <circle cx="340" cy="158" r="6" fill="var(--color-base-800)" stroke="var(--color-text-faint)" strokeWidth="1.5" />

          {/* roll identities */}
          <g fontSize="11" fill="var(--color-text-faint)" fontFamily="var(--font-mono)" textAnchor="end">
            <text x="312" y="84">UBR</text>
            <text x="312" y="110">UWR</text>
            <text x="312" y="136">LWR</text>
            <text x="312" y="162">LBR</text>
          </g>

          {/* roll-gap dimension anchored at the work-roll bite */}
          <g stroke="var(--color-warning)" strokeWidth="1.6">
            <line x1="352" y1={passY} x2="362" y2={passY} strokeDasharray="2 2" />
            <line x1="362" y1="106" x2="362" y2="132" strokeDasharray="3 3" />
            <polyline points="358,110 362,106 366,110" fill="none" />
            <polyline points="358,128 362,132 366,128" fill="none" />
          </g>
          <text x="370" y="110" fontSize="11" fill="var(--color-text-faint)" fontFamily="var(--font-sans)">
            GAP
          </text>
          <text x="370" y="124" fontSize="11" fill="var(--color-text-dim)" fontFamily="var(--font-mono)">
            {gap.toFixed(3)} mm
          </text>

          {/* force arrows squeezing the stack */}
          <g stroke="var(--color-alarm)" strokeWidth="3" strokeLinecap="round" opacity={force > 1 ? 0.9 : 0.25}>
            <line x1="340" y1={80 - 24 - arrow} x2="340" y2={80 - 26} />
            <polyline points="333,60 340,54 347,60" fill="none" />
            <line x1="340" y1={158 + 24 + arrow} x2="340" y2={158 + 26} />
            <polyline points="333,178 340,184 347,178" fill="none" />
          </g>
        </g>

        {/* ── equipment labels ── */}
        <g fontSize="11" fontWeight="700" letterSpacing="1" textAnchor="middle" fontFamily="var(--font-sans)">
          <text x="62" y="190" fill="var(--color-text-dim)">POR</text>
          <text x="180" y="190" fill="var(--color-text-dim)">ETR</text>
          <text x="340" y="204" fill="var(--color-text)">4HI MILL</text>
          <text x="530" y="190" fill="var(--color-text-dim)">DTR</text>
        </g>
      </svg>

      {/* ── equipment status ── */}
      <div
        className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
        aria-label="Equipment status"
      >
        <EquipStatus label="POR" reelStatus={porReel.status} />
        <EquipStatus label="ETR" reelStatus={etrReel.status} />
        <MillStatusWord />
        <EquipStatus label="DTR" reelStatus={dtrReel.status} />
      </div>

      {/* ── BOTTOM: how the mill is controlling it (omitted when no tag) ── */}
      {showControlRow && (
        <div
          className="mt-2 flex flex-wrap items-start justify-center gap-x-6 gap-y-2 border-t border-line pt-2"
          aria-label="Mill control parameters"
        >
          {showWr && (
            <div className="min-w-0 text-center">
              <p className="label">WR bending T/B</p>
              <p className="num text-body text-text inline-flex items-baseline gap-1">
                {isLive(wrTopTag) && (
                  <ValueReadout tagName="WR.TOP.BENDING" size="sm" decimals={0} signed hideBadge hideUnit />
                )}
                {isLive(wrTopTag) && isLive(wrBtmTag) && (
                  <span aria-hidden className="text-text-faint">
                    /
                  </span>
                )}
                {isLive(wrBtmTag) && (
                  <ValueReadout tagName="WR.BOTTOM.BENDING" size="sm" decimals={0} signed hideBadge hideUnit />
                )}
                <span className="text-text-faint text-micro">kN</span>
              </p>
            </div>
          )}
          {showTilt && (
            <div className="min-w-0 text-center">
              <p className="label">DRF / tilt</p>
              <ValueReadout
                tagName="ROLL.GAP.TILT"
                size="sm"
                decimals={2}
                scale={0.001}
                unitOverride="mm"
                hideBadge
              />
            </div>
          )}
          {showTorque && (
            <div className="min-w-0 text-center">
              <p className="label">Roll torque</p>
              <ValueReadout tagName="DRIVE.TORQUE" size="sm" decimals={1} hideBadge />
            </div>
          )}
          {showHyd && (
            <div className="min-w-0 text-center">
              <p className="label">Hyd. position</p>
              <ValueReadout tagName="HYD.GAP.POSITION" size="sm" decimals={1} hideBadge />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Entry / delivery pinch-roll unit: side posts + a roll pair the strip threads. */
function EntryDeliveryUnit({ cx }: { cx: number }) {
  return (
    <g>
      <rect x={cx - 22} y="96" width="8" height="58" rx="3" fill="var(--color-base-800)" stroke="var(--color-line-bright)" strokeWidth="1.5" />
      <rect x={cx + 14} y="96" width="8" height="58" rx="3" fill="var(--color-base-800)" stroke="var(--color-line-bright)" strokeWidth="1.5" />
      <circle cx={cx} cy="108" r="9" fill="url(#rollMetal)" stroke="var(--color-text-faint)" strokeWidth="1.5" />
      <circle cx={cx} cy="132" r="9" fill="url(#rollMetal)" stroke="var(--color-text-faint)" strokeWidth="1.5" />
    </g>
  )
}

/** One clean flow indicator on the upstream span; direction follows rolling. */
function FlowChevrons({ fwd, active }: { fwd: boolean; active: boolean }) {
  const y = 100
  const xs = fwd ? [228, 242, 256] : [452, 438, 424]
  const points = xs.map((x) =>
    fwd ? `${x},${y - 6} ${x + 8},${y} ${x},${y + 6}` : `${x},${y - 6} ${x - 8},${y} ${x},${y + 6}`,
  )
  return (
    <g
      stroke="var(--color-healthy)"
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={active ? 1 : 0.25}
    >
      {points.map((p) => (
        <polyline key={p} points={p} />
      ))}
    </g>
  )
}

function EquipStatus({ label, reelStatus }: { label: string; reelStatus: string }) {
  const fault = reelStatus === 'FAULT'
  const running = reelStatus === 'RUNNING'
  const word = fault ? 'FAULT' : running ? 'ACTIVE' : 'READY'
  const dot = fault ? 'var(--color-trip)' : running ? 'var(--color-healthy)' : 'var(--color-healthy)'
  const wordClass = fault ? 'text-trip' : running ? 'text-healthy' : 'text-healthy'
  return (
    <span className="text-micro inline-flex items-center gap-1.5 font-bold tracking-wider">
      <span className="text-text-faint">{label}</span>
      <span
        aria-hidden
        className="dot-glow inline-block h-2 w-2 rounded-full"
        style={{ background: dot, color: dot }}
      />
      <span className={wordClass}>{word}</span>
    </span>
  )
}

function MillStatusWord() {
  const status = useMachineStore((s) => s.state.machineStatus)
  const rolling = status === 'ROLLING'
  const bad = status === 'FAST_STOP' || status === 'FAULT'
  const warn = status === 'REVERSING' || status === 'DECELERATING'
  const dot = bad ? 'var(--color-trip)' : warn ? 'var(--color-warning)' : 'var(--color-healthy)'
  const wordClass = bad ? 'text-trip' : warn ? 'text-warning' : rolling ? 'text-healthy' : 'text-text'
  return (
    <span className="text-micro inline-flex items-center gap-1.5 font-bold tracking-wider">
      <span className="text-text-faint">MILL</span>
      <span
        aria-hidden
        className="dot-glow inline-block h-2 w-2 rounded-full"
        style={{ background: dot, color: dot }}
      />
      <span className={wordClass}>{status}</span>
    </span>
  )
}
