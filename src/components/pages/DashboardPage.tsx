/**
 * DASHBOARD — the primary operator screen.
 *
 * "What is happening RIGHT NOW?"
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ COIL · GRADE · WIDTH · PASS · DIRECTION · MILL STATE          │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ MILL STATUS HERO — state · live line schematic · drive load   │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ PRIMARY KPI RIBBON — thickness / rolling / shape / tension /  │
 *   │ drive / energy, each with actual, setpoint, deviation, status │
 *   ├───────────────────────────────────┬──────────────────────────┤
 *   │ PROCESS PARAMETERS (full set)     │ SYSTEM STATUS            │
 *   │                                   │ ALARMS                   │
 *   ├───────────────────────────────────┴──────────────────────────┤
 *   │ PASS SCHEDULE                 │ COIL INFORMATION             │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * No 3D model, no trend chart and no event log. The twin has its own page
 * (top nav), trends have theirs, and the event log lives with the alarms
 * workflow — keeping them off this screen is what leaves room for the
 * parameter depth an operator actually needs here.
 *
 * NO TAG IS EXPECTED. On the CRM04 46-tag extract the entire Work Roll & Shape
 * group, all hydraulics and most of System Status read NO TAG, because the
 * plant does not publish those values. Showing them greyed and labelled is the
 * §7.4 contract — a plausible-looking number would be worse than nothing.
 */

import { engineeringConfig } from '../../config/engineeringConfig'
import { millConfig } from '../../config/millConfig'
import {
  ArrowDownWideNarrow,
  Droplets,
  Flame,
  Gauge,
  Layers,
  Ruler,
  Settings2,
  Snowflake,
  UnfoldVertical,
  Zap,
} from 'lucide-react'
import { specificEnergy, throughput } from '../../machine/rollingEngine'
import { useMachineStore } from '../../store/machineStore'
import { AlarmPanel } from '../panels/AlarmPanel'
import { CoilDetails } from '../panels/CoilDetails'
import { ParameterGroup } from '../panels/ParameterGroup'
import { PassSchedulePanel } from '../panels/PassSchedulePanel'
import { SystemStatusBoard } from '../panels/SystemStatusBoard'
import { KpiTile, KpiSlot } from '../dashboard/KpiTile'
import { MillStatusHero } from '../dashboard/MillStatusHero'
import { OperatingContext } from '../dashboard/OperatingContext'

const ACCENT = {
  thickness: 'var(--accent-thickness)',
  rolling: 'var(--accent-rolling)',
  workroll: 'var(--accent-workroll)',
  tension: 'var(--accent-tension)',
  drive: 'var(--accent-drive)',
  hydraulic: 'var(--accent-hydraulic)',
  energy: 'var(--accent-energy)',
  coil: 'var(--accent-coil)',
} as const

export function DashboardPage() {
  return (
    <>
      <OperatingContext />

      {/* Visual-executive hero: state + live line schematic + drive load. */}
      <MillStatusHero />

      <KpiRibbon />

      <div className="dashboard-main grid min-h-0">
        <ProcessParameters />

        {/* Alarms sit directly under system status: an operator who sees a red
            row wants the alarm text without moving their eyes elsewhere. */}
        <div className="grid min-h-0 min-w-0 content-start gap-[14px]">
          <SystemStatusBoard />
          <AlarmPanel />
        </div>
      </div>

      <div className="dashboard-lower grid">
        <PassSchedulePanel />
        <CoilDetails />
      </div>
    </>
  )
}

/* ── Primary KPIs ───────────────────────────────────────────────────────── */

function KpiRibbon() {
  return (
    <div className="kpi-ribbon">
      <KpiGroup title="PRODUCT / THICKNESS" accent={ACCENT.thickness} icon={<Ruler size={12} aria-hidden />}>
        <KpiTile label="EXIT THICKNESS" tagName="STRIP.THICKNESS" decimals={3} accent={ACCENT.thickness} setpointTag="STRIP.THICKNESS.REF" deviationTag="STRIP.THICKNESS.DEVIATION" deviationDecimals={1} deviationUnit="µm" icon={<Ruler size={15} aria-hidden />} spark="thickness" />
        <KpiTile label="ENTRY THICKNESS" tagName="STRIP.THICKNESS.ENTRY" decimals={3} accent={ACCENT.thickness} icon={<Ruler size={15} aria-hidden />} spark="thicknessEntry" />
        <KpiTile label="REDUCTION" tagName="STRIP.REDUCTION" decimals={2} accent={ACCENT.thickness} icon={<Layers size={15} aria-hidden />} spark="reduction" />
        <KpiTile label="STRIP WIDTH" tagName="STRIP.WIDTH" decimals={0} accent={ACCENT.thickness} icon={<Ruler size={15} aria-hidden />} />
      </KpiGroup>

      <KpiGroup title="ROLLING" accent={ACCENT.rolling} icon={<ArrowDownWideNarrow size={12} aria-hidden />}>
        <KpiTile label="ROLL FORCE" tagName="ROLL.FORCE.ACTUAL" decimals={0} accent={ACCENT.rolling} setpointTag="ROLL.FORCE.REF" icon={<ArrowDownWideNarrow size={15} aria-hidden />} spark="rollingForce" />
        <KpiTile label="MILL SPEED" tagName="MILL.SPEED.ACTUAL" decimals={0} accent={ACCENT.rolling} setpointTag="MILL.SPEED.REF" icon={<Gauge size={15} aria-hidden />} spark="speed" />
        <KpiTile label="ROLL GAP" tagName="ROLL.GAP.ACTUAL" decimals={3} accent={ACCENT.rolling} setpointTag="ROLL.GAP.REF" icon={<Settings2 size={15} aria-hidden />} spark="rollGap" />
        <KpiTile label="WORK ROLL RPM" tagName="WR.TOP.RPM" decimals={0} accent={ACCENT.rolling} icon={<Gauge size={15} aria-hidden />} spark="rollRpm" />
      </KpiGroup>

      <KpiGroup title="WORK ROLL & SHAPE CONTROL" accent={ACCENT.workroll} icon={<Settings2 size={12} aria-hidden />}>
        <KpiTile label="WR BENDING (TOP)" tagName="WR.TOP.BENDING" decimals={0} accent={ACCENT.workroll} icon={<Settings2 size={15} aria-hidden />} spark="wrTopBending" />
        <KpiTile label="WR BENDING (BOTTOM)" tagName="WR.BOTTOM.BENDING" decimals={0} accent={ACCENT.workroll} icon={<Settings2 size={15} aria-hidden />} spark="wrBottomBending" />
        <KpiTile label="DRF SETPOINT" tagName="ROLL.FORCE.DIFF_REF" decimals={1} accent={ACCENT.workroll} icon={<ArrowDownWideNarrow size={15} aria-hidden />} />
        <KpiTile label="TILTING (OS−DS)" tagName="ROLL.GAP.TILT" decimals={1} accent={ACCENT.workroll} signed icon={<Settings2 size={15} aria-hidden />} spark="rollGapTilt" />
      </KpiGroup>

      <KpiGroup title="TENSION" accent={ACCENT.tension} icon={<UnfoldVertical size={12} aria-hidden />}>
        <KpiTile label="ENTRY TENSION" tagName="TENSION.ENTRY" decimals={1} accent={ACCENT.tension} setpointTag="TENSION.ENTRY.REF" icon={<UnfoldVertical size={15} aria-hidden />} spark="entryTension" />
        <KpiTile label="EXIT TENSION" tagName="TENSION.EXIT" decimals={1} accent={ACCENT.tension} setpointTag="TENSION.EXIT.REF" icon={<UnfoldVertical size={15} aria-hidden />} spark="exitTension" />
      </KpiGroup>

      <KpiGroup title="DRIVE" accent={ACCENT.drive} icon={<Zap size={12} aria-hidden />}>
        <KpiTile label="DRIVE TORQUE" tagName="DRIVE.TORQUE" decimals={1} accent={ACCENT.drive} icon={<Zap size={15} aria-hidden />} spark="torque" />
        <KpiTile label="DRIVE CURRENT" tagName="DRIVE.CURRENT" decimals={0} accent={ACCENT.drive} icon={<Zap size={15} aria-hidden />} spark="current" />
        <KpiTile label="DRIVE RPM" tagName="DRIVE.RPM" decimals={0} accent={ACCENT.drive} icon={<Gauge size={15} aria-hidden />} spark="driveRpm" />
        <MotorLoadTile />
      </KpiGroup>

      <KpiGroup title="ENERGY" accent={ACCENT.energy} icon={<Flame size={12} aria-hidden />}>
        <KpiTile label="CURRENT POWER" tagName="DRIVE.POWER" decimals={0} accent={ACCENT.energy} icon={<Zap size={15} aria-hidden />} spark="power" />
        <CoilEnergyTiles />
      </KpiGroup>
    </div>
  )
}

function KpiGroup({
  title,
  accent,
  icon,
  children,
}: {
  title: string
  accent: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      className="kpi-group"
      aria-label={title}
      style={{ '--group-accent': accent } as React.CSSProperties}
    >
      <h2 className="kpi-group-title">
        {icon && (
          <span aria-hidden className="inline-flex items-center">
            {icon}
          </span>
        )}
        <span className="truncate">{title}</span>
      </h2>
      <div className="kpi-group-grid">{children}</div>
    </section>
  )
}

/** Motor load is a derived percentage, not a tag — so it gets the dim treatment. */
function MotorLoadTile() {
  const pct = useMachineStore((s) => s.state.drive.torquePercentage)
  const over = pct >= 100
  const warn = pct >= 80

  return (
    <KpiSlot label="MOTOR LOAD" accent={ACCENT.drive}>
      <div className="mt-1">
        <span className="num text-text text-value-lg font-semibold tracking-tight">
          {pct.toFixed(1)}
        </span>
        <span className="text-text-faint text-micro ml-1">%</span>
      </div>
      <div className="text-text-faint text-micro mt-1.5">
        OF {millConfig.ratings.mainDriveRatedTorque} kNm RATING
      </div>
      <div className="mt-2">
        <span
          className={`status-pill ${over ? 'status-pill-trip text-trip' : warn ? 'status-pill-warning text-warning' : 'status-pill-normal text-healthy'}`}
        >
          <span
            aria-hidden
            className={`dot-glow h-1.5 w-1.5 shrink-0 rounded-full ${over ? 'bg-alarm' : warn ? 'bg-warning' : 'bg-healthy'}`}
          />
          {over ? 'OVERLOAD' : warn ? 'WARNING' : 'NORMAL'}
        </span>
      </div>
    </KpiSlot>
  )
}

/**
 * Energy totals. Specific energy is honestly derivable from power and
 * throughput; the cumulative figures are not — integrating power in the browser
 * would only measure how long this tab has been open, which is not what
 * "today's energy" means. Those stay NO TAG until the historian supplies them.
 */
function CoilEnergyTiles() {
  const state = useMachineStore((s) => s.state)

  // Both from `rollingEngine`, so "throughput" and "specific energy" mean the
  // same thing here as everywhere else in the app (§18).
  const throughputTph = throughput(state)
  const specific = throughputTph > 0.01 ? specificEnergy(state) : null

  return (
    <>
      <KpiSlot label="SPECIFIC ENERGY" accent={ACCENT.energy}>
        <div className="mt-1">
          {specific === null ? (
            <span className="num text-text-faint text-value-lg">—</span>
          ) : (
            <span className="num text-text text-value-lg font-semibold tracking-tight">
              {specific.toFixed(1)}
            </span>
          )}
          <span className="text-text-faint text-micro ml-1">kWh/t</span>
        </div>
        <div className="text-text-faint text-micro mt-1.5">
          {specific === null ? 'MILL AT STANDSTILL' : `${throughputTph.toFixed(1)} t/h THROUGHPUT`}
        </div>
        <div className="text-text-faint text-micro mt-2">DERIVED</div>
      </KpiSlot>

      <KpiTile label="COIL ENERGY" tagName="MILL.ENERGY.COIL" decimals={1} accent={ACCENT.energy} />
      <KpiTile label="ENERGY TODAY" tagName="MILL.ENERGY.TODAY" decimals={0} accent={ACCENT.energy} />
    </>
  )
}

/* ── Process parameters ─────────────────────────────────────────────────── */

function ProcessParameters() {
  return (
    <div className="param-grid grid min-h-0 content-start">
      <ParameterGroup
        title="ROLLING"
        accent={ACCENT.rolling}
        icon={<ArrowDownWideNarrow size={13} aria-hidden />}
        rows={[
          { label: 'Roll force', tagName: 'ROLL.FORCE.ACTUAL', decimals: 0 },
          { label: 'Roll force setpoint', tagName: 'ROLL.FORCE.REF', decimals: 0 },
          { label: 'Roll gap', tagName: 'ROLL.GAP.ACTUAL', decimals: 3 },
          { label: 'Gap setpoint S0', tagName: 'ROLL.GAP.REF', decimals: 3 },
          { label: 'Mill speed', tagName: 'MILL.SPEED.ACTUAL', decimals: 0 },
          { label: 'Speed setpoint', tagName: 'MILL.SPEED.REF', decimals: 0 },
          { label: 'Entry speed', tagName: 'MILL.SPEED.ENTRY', decimals: 0 },
          { label: 'Reduction', tagName: 'STRIP.REDUCTION', decimals: 2 },
          { label: 'Work roll RPM (top)', tagName: 'WR.TOP.RPM', decimals: 0 },
          { label: 'Backup roll RPM (top)', tagName: 'BUR.TOP.RPM', decimals: 0 },
        ]}
      />

      <ParameterGroup
        title="WORK ROLL CONTROL"
        accent={ACCENT.workroll}
        icon={<Settings2 size={13} aria-hidden />}
        rows={[
          { label: 'WR bending (top)', tagName: 'WR.TOP.BENDING', decimals: 0 },
          { label: 'WR bending (bottom)', tagName: 'WR.BOTTOM.BENDING', decimals: 0 },
          { label: 'DRF setpoint', tagName: 'ROLL.FORCE.DIFF_REF', decimals: 1 },
          { label: 'Roll force OS', tagName: 'ROLL.FORCE.OS', decimals: 0 },
          { label: 'Roll force DS', tagName: 'ROLL.FORCE.DS', decimals: 0 },
          { label: 'Tilting (OS−DS)', tagName: 'ROLL.GAP.TILT', decimals: 1, signed: true },
          { label: 'Roll gap OS', tagName: 'ROLL.GAP.OS', decimals: 3 },
          { label: 'Roll gap DS', tagName: 'ROLL.GAP.DS', decimals: 3 },
        ]}
      />

      <ParameterGroup
        title="THICKNESS CONTROL"
        accent={ACCENT.thickness}
        icon={<Ruler size={13} aria-hidden />}
        rows={[
          { label: 'Entry thickness', tagName: 'STRIP.THICKNESS.ENTRY', decimals: 3 },
          { label: 'Exit thickness', tagName: 'STRIP.THICKNESS', decimals: 3 },
          { label: 'Target thickness', tagName: 'STRIP.THICKNESS.REF', decimals: 3 },
          { label: 'Thickness deviation', tagName: 'STRIP.THICKNESS.DEVIATION', decimals: 1, signed: true },
          { label: 'DTR gauge', tagName: 'GAUGE.DTR.THICKNESS', decimals: 3 },
          { label: 'ETR gauge', tagName: 'GAUGE.ETR.THICKNESS', decimals: 3 },
          { label: 'AGC error', tagName: 'AGC.ERROR', decimals: 1 },
          { label: 'AGC output', tagName: 'AGC.OUTPUT', decimals: 3 },
          { label: 'Gap correction', tagName: 'AGC.GAP.CORRECTION', decimals: 3 },
          { label: 'Mass flow closure', tagName: 'MILL.MASSFLOW.ERROR', decimals: 2, signed: true },
        ]}
      />

      <ParameterGroup
        title="TENSION"
        accent={ACCENT.tension}
        icon={<UnfoldVertical size={13} aria-hidden />}
        rows={[
          { label: 'Entry tension', tagName: 'TENSION.ENTRY', decimals: 1 },
          { label: 'Entry setpoint', tagName: 'TENSION.ENTRY.REF', decimals: 1 },
          { label: 'Exit tension', tagName: 'TENSION.EXIT', decimals: 1 },
          { label: 'Exit setpoint', tagName: 'TENSION.EXIT.REF', decimals: 1 },
          { label: 'DTR tension', tagName: 'DTR.TENSION', decimals: 1 },
          { label: 'ETR tension', tagName: 'ETR.TENSION', decimals: 1 },
          { label: 'POR tension', tagName: 'POR.TENSION', decimals: 1 },
        ]}
      />

      <ParameterGroup
        title="DRIVE"
        accent={ACCENT.drive}
        icon={<Zap size={13} aria-hidden />}
        rows={[
          { label: 'Torque', tagName: 'DRIVE.TORQUE', decimals: 1 },
          { label: 'Current', tagName: 'DRIVE.CURRENT', decimals: 0 },
          { label: 'Power', tagName: 'DRIVE.POWER', decimals: 0 },
          { label: 'RPM', tagName: 'DRIVE.RPM', decimals: 0 },
        ]}
        footer={<DriveRatings />}
      />

      <ParameterGroup
        title="HYDRAULIC"
        accent={ACCENT.hydraulic}
        icon={<Droplets size={13} aria-hidden />}
        rows={[
          { label: 'Loading pressure', tagName: 'HYD.LOADING.PRESSURE', decimals: 0 },
          { label: 'Bending pressure', tagName: 'HYD.BENDING.PRESSURE', decimals: 0 },
          { label: 'Capsule position', tagName: 'HYD.GAP.POSITION', decimals: 3 },
          { label: 'LP system pressure', tagName: 'LP.PRESSURE', decimals: 1 },
          { label: 'Hydraulic flow', tagName: 'HYD.FLOW', decimals: 0 },
          { label: 'Oil temperature', tagName: 'HYD.TEMPERATURE', decimals: 1 },
        ]}
      />

      <ParameterGroup
        title="COOLING"
        accent={ACCENT.coil}
        icon={<Snowflake size={13} aria-hidden />}
        rows={[
          { label: 'Coolant temperature', tagName: 'COOLANT.TEMPERATURE', decimals: 1 },
          { label: 'Coolant flow', tagName: 'COOLANT.FLOW', decimals: 0 },
          { label: 'Coolant pressure', tagName: 'COOLANT.PRESSURE', decimals: 1 },
          { label: 'Tank level', tagName: 'COOLANT.TANK.LEVEL', decimals: 0 },
        ]}
        footer={
          <p className="text-text-faint text-micro border-line mt-2 border-t pt-2 leading-snug">
            Design flow {millConfig.ratings.coolantFlowLpm} LPM. The extract carries a coolant
            health word only — no instrumented values.
          </p>
        }
      />

      <ParameterGroup
        title="LUBRICATION"
        accent={ACCENT.energy}
        icon={<Droplets size={13} aria-hidden />}
        rows={[
          { label: 'LP system pressure', tagName: 'LP.PRESSURE', decimals: 1 },
          { label: 'Lube flow', tagName: 'LUBRICATION.FLOW', decimals: 0 },
          { label: 'Lube temperature', tagName: 'LUBRICATION.TEMPERATURE', decimals: 1 },
        ]}
      />
    </div>
  )
}

function DriveRatings() {
  return (
    <p className="text-text-faint text-micro border-line mt-2 border-t pt-2 leading-snug">
      Rated {millConfig.ratings.mainDriveRating} kW ·{' '}
      {millConfig.ratings.mainDriveRatedTorque} kNm · {engineeringConfig.motorLimits.currentMax} A
    </p>
  )
}
