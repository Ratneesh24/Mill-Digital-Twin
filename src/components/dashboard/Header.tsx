/**
 * HEADER — machine identity, mode banner, connection state, navigation.
 *
 * Sticky command bar for the modern workspace. The mode banner remains the most
 * important element: simulated values are never presented as plant data.
 */

import { Activity, Box, LayoutDashboard, Moon, Sun } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { NavLink } from 'react-router-dom'
import { millConfig } from '../../config/millConfig'
import { ROUTES } from '../../app/routes'
import { STATUS_LABEL } from '../../machine/machineStateMachine'
import { useMachineStore } from '../../store/machineStore'
import { useAlarmStore, selectWorstSeverity } from '../../store/alarmStore'
import { useUiStore } from '../../store/uiStore'
import { cn } from '../ui/cn'
import { Hint } from '../ui/Hint'
import { ConnectionStatus } from './ConnectionStatus'

/** Exactly three pages. Everything else lives behind MODEL / DATA STATUS. */
const NAV = [
  { to: ROUTES.dashboard, label: 'DASHBOARD', icon: LayoutDashboard },
  { to: ROUTES.trends, label: 'REAL-TIME TRENDS', icon: Activity },
  { to: ROUTES.twin, label: '3D DIGITAL TWIN', icon: Box },
]

export function Header() {
  const mode = useMachineStore((s) => s.state.operatingMode)
  const coilId = useMachineStore((s) => s.state.coil.id)
  const status = useMachineStore((s) => s.state.machineStatus)
  const pass = useMachineStore((s) => s.state.pass)
  const direction = useMachineStore((s) => s.state.rollingDirection)
  const speed = useMachineStore((s) => s.state.speed.actual)
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  const worst = useAlarmStore(selectWorstSeverity)
  const alarmCount = useAlarmStore((s) => s.active.length)
  const still = useReducedMotion()

  const simulated = mode !== 'LIVE'

  return (
    <header className="brand-header border-line bg-base-900/95 shrink-0 border-b backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex flex-col leading-none">
            <span className="brand-wordmark" aria-label="Tata Steel">
              TATA STEEL
            </span>
            <span className="text-text-faint mt-1 text-micro font-semibold tracking-[0.22em]">
              CRM SAHIBABAD · NARROW COMPLEX
            </span>
          </div>
          <span aria-hidden="true" className="bg-line hidden h-10 w-px sm:block" />
          {/* Bounded so it TRUNCATES rather than wraps. The row is
              `flex-wrap`, and a wrapping flex line pushes items to a new row
              instead of shrinking them — without a max-width the alarm pill
              alone knocks the clock onto a second line. */}
          <div className="hidden min-w-0 max-w-[380px] min-[1700px]:block">
            <div className="text-text truncate text-body font-semibold tracking-wide">
              {millConfig.identity.mill} · 4HI REVERSING COLD ROLLING MILL
            </div>
            <div className="text-text-faint mt-0.5 truncate text-meta tracking-wide">
              {millConfig.identity.plant} · DIGITAL TWIN · COIL {coilId}
            </div>
          </div>
        </div>

        <div className="flex-1" />

        {alarmCount > 0 && (
          <div
            role="status"
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-meta font-semibold tracking-wide',
              worst === 'TRIP'
                ? 'border-trip/60 text-trip bg-trip/10 alarm-pulse'
                : worst === 'ALARM'
                  ? 'border-alarm/60 text-alarm bg-alarm/10'
                  : 'border-warning/50 text-warning bg-warning/10',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-2 w-2 rounded-full',
                worst === 'TRIP' || worst === 'ALARM' ? 'bg-alarm' : 'bg-warning',
              )}
            />
            {alarmCount} ACTIVE {alarmCount === 1 ? 'ALARM' : 'ALARMS'}
          </div>
        )}

        <ConnectionStatus />
        <Hint label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-pressed={theme === 'dark'}
            className="border-line text-text-dim hover:text-text hover:bg-base-800 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-meta font-semibold"
          >
            {theme === 'dark' ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
            <span className="hidden sm:inline">{theme === 'dark' ? 'LIGHT' : 'DARK'}</span>
          </button>
        </Hint>
        <Clock />
      </div>

      <div className="border-line bg-base-850 flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-2 lg:px-6">
        <nav
          aria-label="Workspace pages"
          className="workspace-nav flex max-w-full flex-wrap items-center gap-1"
        >
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'text-meta relative inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 font-semibold tracking-[0.08em] transition-colors',
                    isActive
                      ? 'text-brand'
                      : 'text-text-dim hover:text-text hover:bg-base-800',
                  )
                }
                /* NavLink sets aria-current="page" itself, which is what the
                   `.workspace-nav [aria-current]` underline in index.css keys
                   on — do not replace this with a Radix Tabs trigger. */
              >
                {({ isActive }) => (
                  <>
                    {isActive &&
                      (still ? (
                        <span aria-hidden className="nav-pill" />
                      ) : (
                        <motion.span
                          aria-hidden
                          layoutId="workspace-nav-pill"
                          className="nav-pill"
                          transition={{ duration: 0.25, ease: 'easeOut' }}
                        />
                      ))}
                    <Icon size={14} aria-hidden />
                    {item.label}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Operating context the spec wants visible at all times, on every
            page. Deliberately NOT frame counts or solver stats — those are
            engineering data and live in the MODEL / DATA dialog. */}
        <div className="text-meta ml-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <HeaderStat label="STATE" value={STATUS_LABEL[status]} tone={statusTone(status)} />
          <HeaderStat label="PASS" value={`${pass.current} / ${pass.total}`} />
          <HeaderStat label="DIR" value={direction} />
          <HeaderStat label="SPEED" value={`${speed.toFixed(0)} m/min`} />
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {simulated ? (
            <div className="border-prov-simulated/50 bg-prov-simulated/10 text-prov-simulated text-micro mode-glow-sim max-w-full rounded-full border px-3 py-1.5 font-semibold tracking-[0.08em]">
              {mode === 'SIM_46TAG'
                ? 'SIMULATED DATA · CRM04 46-TAG PROVENANCE PREVIEW'
                : 'SIMULATED DATA · NOT PLANT DATA'}
            </div>
          ) : (
            <div className="border-healthy/50 bg-healthy/10 text-healthy text-micro mode-glow-live rounded-full border px-3 py-1.5 font-semibold tracking-[0.08em]">
              LIVE PLANT DATA · READ ONLY
            </div>
          )}
          <span className="text-text-faint num text-meta hidden xl:inline">COIL {coilId}</span>
        </div>
      </div>
    </header>
  )
}

function statusTone(status: string): string {
  if (status === 'ROLLING') return 'text-healthy'
  if (status === 'FAST_STOP' || status === 'FAULT') return 'text-trip alarm-pulse'
  if (status === 'REVERSING' || status === 'DECELERATING') return 'text-warning'
  return 'text-text'
}

/** One compact label/value pair in the header context strip. */
function HeaderStat({
  label,
  value,
  tone = 'text-text',
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-text-faint text-micro tracking-[0.08em]">{label}</span>
      <span className={cn('num text-meta font-semibold', tone)}>{value}</span>
    </span>
  )
}

function Clock() {
  const timestamp = useMachineStore((s) => s.state.communication.lastFrameTimestamp)
  return (
    <div
      className="num text-text-dim bg-base-950 border-line shrink-0 rounded-md border px-2.5 py-1.5 text-meta"
      aria-label="Last update time"
    >
      {timestamp ? new Date(timestamp).toLocaleTimeString() : '--:--:--'}
    </div>
  )
}
