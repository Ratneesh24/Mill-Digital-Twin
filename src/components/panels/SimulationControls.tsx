/**
 * SIMULATION CONTROLS — §14.4.
 *
 * "Read-only monitoring is strictly separated from control commands. Phase 1 is
 *  read-only. Simulation controls modify simulated state only. Real machine
 *  commands are out of scope."
 *
 * Every button here reaches the SimulationEngine and nothing else. In LIVE mode
 * the panel disables itself and says why — the UI must never imply that an
 * operator action reached the mill.
 *
 * The controls are also the harness for the §17 validation tests: start, speed,
 * gap, reverse, fast stop, high force, comms loss are all reachable from here.
 */

import { SCENARIOS, type ScenarioId } from '../../simulation/simulationScenarios'
import { useMachineStore } from '../../store/machineStore'
import { Panel } from '../common/Panel'

export function SimulationControls() {
  const mode = useMachineStore((s) => s.state.operatingMode)
  const status = useMachineStore((s) => s.state.machineStatus)
  const agc = useMachineStore((s) => s.state.controls.agc)
  const scenario = useMachineStore((s) => s.scenario)
  const send = useMachineStore((s) => s.sendCommand)
  const setScenario = useMachineStore((s) => s.setScenario)

  const readOnly = mode === 'LIVE'

  return (
    <Panel
      title="Simulation controls"
      right={
        <span
          className={`text-[9px] tracking-wider ${readOnly ? 'text-alarm' : 'text-prov-simulated'}`}
        >
          {readOnly ? 'DISABLED — LIVE IS READ-ONLY' : 'SIMULATED STATE ONLY'}
        </span>
      }
    >
      <fieldset disabled={readOnly} className="min-w-0">
        {/* Machine commands */}
        <div className="grid grid-cols-4 gap-1">
          <Cmd label="START" onClick={() => send({ type: 'START' })} tone="healthy" />
          <Cmd label="STOP" onClick={() => send({ type: 'STOP' })} />
          <Cmd label="FAST STOP" onClick={() => send({ type: 'FAST_STOP' })} tone="trip" />
          <Cmd label="RESET" onClick={() => send({ type: 'RESET' })} />
        </div>

        {/* Setpoint trims — the §17 stimulus set. */}
        <div className="border-line mt-2 border-t pt-2">
          <TrimRow
            label="Speed reference"
            unit="m/min"
            steps={[-25, -5, 5, 25]}
            onTrim={(value) => send({ type: 'TRIM_SPEED_REFERENCE', value })}
          />
          <TrimRow
            label="Roll gap S0"
            unit="mm"
            steps={[-0.05, -0.01, 0.01, 0.05]}
            decimals={2}
            onTrim={(value) => send({ type: 'TRIM_ROLL_GAP', value })}
          />
          <TrimRow
            label="Entry tension"
            unit="kN"
            steps={[-10, -2, 2, 10]}
            onTrim={(value) => send({ type: 'TRIM_ENTRY_TENSION', value })}
          />
          <TrimRow
            label="Exit tension"
            unit="kN"
            steps={[-10, -2, 2, 10]}
            onTrim={(value) => send({ type: 'TRIM_EXIT_TENSION', value })}
          />
        </div>

        <div className="border-line mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
          <button
            type="button"
            aria-pressed={agc === 'ON'}
            onClick={() => send({ type: 'SET_AGC', flag: agc !== 'ON' })}
            className={`border px-2 py-1 text-[10px] tracking-wider transition-colors ${
              agc === 'ON'
                ? 'border-healthy/50 text-healthy bg-healthy/10'
                : 'border-line text-text-faint'
            }`}
          >
            AGC {agc === 'ON' ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => send({ type: 'LOAD_NEXT_COIL' })}
            className="border-line text-text-dim hover:border-normal/50 hover:text-normal border px-2 py-1 text-[10px] tracking-wider transition-colors"
          >
            CHARGE NEXT COIL
          </button>
          <span className="text-text-faint num ml-auto text-[10px]">{status}</span>
        </div>

        {/* Scenarios — physical disturbances, not injected numbers. */}
        <div className="border-line mt-2 border-t pt-2">
          <div className="label mb-1">SCENARIO</div>
          <div className="grid grid-cols-2 gap-1">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                title={`${s.description}${s.validates ? `\n\n${s.validates}` : ''}`}
                aria-pressed={scenario === s.id}
                onClick={() => setScenario(s.id as ScenarioId)}
                className={`border px-1.5 py-1 text-left text-[10px] leading-tight transition-colors ${
                  scenario === s.id
                    ? 'border-prov-simulated/60 bg-prov-simulated/10 text-prov-simulated'
                    : 'border-line text-text-faint hover:text-text-dim'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-text-faint mt-1.5 text-[9px] leading-snug">
            Scenarios change PHYSICAL INPUTS — gap, material, media, link. The resulting force,
            thickness and current come out of the same equations as always; no value is injected.
          </p>
        </div>
      </fieldset>
    </Panel>
  )
}

function Cmd({
  label,
  onClick,
  tone,
}: {
  label: string
  onClick: () => void
  tone?: 'healthy' | 'trip'
}) {
  const toneClass =
    tone === 'healthy'
      ? 'border-healthy/50 text-healthy hover:bg-healthy/10'
      : tone === 'trip'
        ? 'border-trip/60 text-trip hover:bg-trip/10'
        : 'border-line text-text-dim hover:border-line-bright'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-1 py-1.5 text-[10px] tracking-wider transition-colors ${toneClass}`}
    >
      {label}
    </button>
  )
}

function TrimRow({
  label,
  unit,
  steps,
  decimals = 0,
  onTrim,
}: {
  label: string
  unit: string
  steps: number[]
  decimals?: number
  onTrim: (value: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-[3px]">
      <span className="label min-w-[130px] flex-1">
        {label} <span className="text-text-faint">({unit})</span>
      </span>
      <div className="flex shrink-0 gap-1">
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            aria-label={`${step > 0 ? 'Increase' : 'Decrease'} ${label} by ${Math.abs(step).toFixed(decimals)} ${unit}`}
            onClick={() => onTrim(step)}
            className="border-line text-text-dim hover:border-normal/50 hover:text-normal num w-11 border py-0.5 text-[10px] transition-colors"
          >
            {step > 0 ? '+' : ''}
            {step.toFixed(decimals)}
          </button>
        ))}
      </div>
    </div>
  )
}
