/**
 * SIMULATION ENGINE — the deterministic mill model.
 *
 * Produces a raw tag frame every tick. It knows nothing about React, nothing
 * about provenance badges and nothing about the 3D scene: it is the "PLC" the
 * rest of the application talks to.
 *
 * THE DEPENDENCY CHAIN (§8.6) is honoured by CONSTRUCTION, not by convention.
 * Each tick evaluates in this order, and each step consumes only the outputs of
 * the steps above it:
 *
 *   1. interlocks        -> mill ready
 *   2. state machine     -> status
 *   3. speed ramp        -> mill speed
 *   4. tension loops     -> entry / exit tension
 *   5. gaugemeter solve  -> delivered thickness AND roll force (coupled)
 *   6. kinematics        -> entry speed, roll rpm, reel rpm
 *   7. drive             -> torque, power, current
 *   8. coil geometry     -> diameters, lengths, remaining length
 *   9. pass / reversal   -> pass number, direction
 *
 * There is no step that invents a value. Nothing is randomised except X-ray
 * gauge noise, which is applied at the instrument only (§19.2).
 */
import { engineeringConfig, SeededRandom } from '../config/engineeringConfig';
import { millConfig } from '../config/millConfig';
import { clamp, kNToTonnes } from '../config/unitConversion';
import { accumulatedStrainBeforePass, demoPassSchedule, getPass } from '../data/demoPassSchedule';
import { beginReversal, isRolling, transition, } from '../machine/machineStateMachine';
import { evaluateInterlocks } from '../machine/interlockEngine';
import { initialReversalState, oppositeDirection, payoffReel, reelRole, startReversal, stepReversal, tensionReel, } from '../machine/reversingEngine';
import { coilLayers, coilRadiusFromLength, lengthAfterReduction, reelCurrent, reelRPM, reelTorque, } from './coilModel';
import { calculateDrive, hydraulicPressureFromForce } from './driveModel';
import { calculateReduction, calculateRollRPM, entrySpeedFromMassFlow, massFlowError, rollSurfaceSpeedFromStripSpeed, specificTension, } from './rollingModel';
import { applyGaugeNoise, gapPositionForTargetThickness, hagcStep, solveGaugemeter, } from './thicknessModel';
import { calculateTensionReferences, stepTension, tensionReferenceForState } from './tensionModel';
import { applyScenario } from './simulationScenarios';
/**
 * Amplitude of the incoming hot-band thickness variation, mm (±).
 *
 * This is a REAL disturbance, not decoration: an as-rolled hot band carries
 * longitudinal gauge variation of roughly ±1% and rejecting it is the entire
 * job of the AGC. Without it the thickness trend would be pure instrument
 * noise and the AGC would have nothing to do, which would make the twin
 * misleading about how the mill actually behaves.
 *
 * Represented as a fixed multi-harmonic profile in coil position — deterministic,
 * so the simulation stays reproducible (§19.2). Attenuated each pass because
 * successive passes progressively iron the variation out.
 */
const ENTRY_PROFILE_AMPLITUDE_MM = 0.028;
const ENTRY_PROFILE_ATTENUATION = 0.55;
/**
 * Longitudinal entry-thickness deviation at a position along the coil, mm.
 * Three incommensurate harmonics so the pattern does not visibly repeat.
 */
function entryThicknessDeviation(positionM, passNumber) {
    const amplitude = ENTRY_PROFILE_AMPLITUDE_MM * Math.pow(ENTRY_PROFILE_ATTENUATION, passNumber - 1);
    const p = positionM;
    return (amplitude *
        (0.55 * Math.sin(p / 41.3) + 0.3 * Math.sin(p / 13.7 + 1.1) + 0.15 * Math.sin(p / 4.9 + 2.3)));
}
export class SimulationEngine {
    state;
    schedule;
    rng = new SeededRandom();
    pendingEvents = [];
    constructor(schedule = demoPassSchedule) {
        this.schedule = schedule;
        this.state = this.buildInitialState();
    }
    buildInitialState() {
        const pass = getPass(this.schedule, 1);
        const coil = this.schedule.coil;
        const totalLength = coilLengthAtThickness(coil.outerDiameter / 2, coil.innerDiameter / 2, coil.entryThickness);
        const tensions = calculateTensionReferences(pass.entrySpecificTension, pass.exitSpecificTension, pass.inputThickness, pass.outputThickness, coil.width);
        // Preposition the capsule so the first pass starts on gauge rather than
        // hunting for it — this is what the AGC position pre-set does.
        const gapPosition = gapPositionForTargetThickness(pass.outputThickness, pass.inputThickness, coil.width, millConfig.geometry.workRollDiameter, tensions.entryKN, tensions.exitKN, 0);
        return {
            timeS: 0,
            status: 'READY',
            statusReason: 'Mill ready — all interlocks healthy',
            direction: pass.direction,
            speed: 0,
            speedReferenceTrim: 0,
            gapPosition,
            gapTrim: 0,
            hagc: { integral: 0 },
            agcEnabled: true,
            entryTension: 0,
            exitTension: 0,
            entryTensionTrim: 0,
            exitTensionTrim: 0,
            passNumber: 1,
            passInputThickness: pass.inputThickness,
            payoffLength: totalLength,
            woundLength: 0,
            passTotalLength: totalLength,
            positionM: 0,
            threaded: true,
            reversal: initialReversalState,
            porLength: totalLength,
            porThickness: coil.entryThickness,
            scenario: 'NORMAL',
            eStop: false,
            fastStopLatched: false,
            auxHealth: {
                lubrication: true,
                coolant: true,
                exhaust: true,
                lpSystem: true,
                hpLoading: true,
                hpBending: true,
            },
            commsHealthy: true,
            deliveredThickness: pass.outputThickness,
            force: 0,
            contactLength: 0,
            solverIterations: 0,
            residualUm: 0,
        };
    }
    // -------------------------------------------------------------------------
    // Commands. These modify SIMULATED state only (§14.4 — Phase 1 is read-only
    // with respect to the real machine).
    // -------------------------------------------------------------------------
    command(cmd) {
        const s = this.state;
        switch (cmd.type) {
            case 'START':
                this.pendingEvents.push('START');
                break;
            case 'STOP':
                this.pendingEvents.push('STOP');
                break;
            case 'FAST_STOP':
                s.fastStopLatched = true;
                this.pendingEvents.push('FAST_STOP');
                break;
            case 'RESET':
                s.fastStopLatched = false;
                s.eStop = false;
                this.pendingEvents.push('RESET');
                break;
            case 'SET_SPEED_REFERENCE':
                s.speedReferenceTrim =
                    (cmd.value ?? 0) - getPass(this.schedule, s.passNumber).speedReference;
                break;
            case 'TRIM_SPEED_REFERENCE':
                s.speedReferenceTrim += cmd.value ?? 0;
                break;
            case 'TRIM_ROLL_GAP':
                s.gapTrim += cmd.value ?? 0;
                break;
            case 'SET_AGC':
                s.agcEnabled = cmd.flag ?? true;
                // Dropping the integrator on handover prevents a step when AGC re-arms.
                s.hagc = { integral: 0 };
                break;
            case 'TRIM_ENTRY_TENSION':
                s.entryTensionTrim += cmd.value ?? 0;
                break;
            case 'TRIM_EXIT_TENSION':
                s.exitTensionTrim += cmd.value ?? 0;
                break;
            case 'LOAD_NEXT_COIL':
                this.state = this.buildInitialState();
                this.state.threaded = false;
                this.state.status = 'READY';
                this.rng.reset();
                break;
            case 'SET_SCENARIO':
                s.scenario = cmd.scenario ?? 'NORMAL';
                if (s.scenario === 'EMERGENCY_STOP') {
                    s.eStop = true;
                    this.pendingEvents.push('FAST_STOP');
                }
                if (s.scenario === 'COMMUNICATION_LOSS')
                    s.commsHealthy = false;
                else if (s.scenario !== 'NORMAL')
                    s.commsHealthy = true;
                else
                    s.commsHealthy = true;
                break;
            case 'SET_AUX_HEALTH':
                if (cmd.system)
                    s.auxHealth[cmd.system] = cmd.flag ?? true;
                break;
        }
    }
    getStatus() {
        return this.state.status;
    }
    /** True while the simulated PLC is deliberately not publishing (§17 test 8). */
    isPublishing() {
        return this.state.commsHealthy;
    }
    // -------------------------------------------------------------------------
    // The tick.
    // -------------------------------------------------------------------------
    tick(dtSeconds) {
        const s = this.state;
        const dt = clamp(dtSeconds, 0, 0.25); // guard against tab-restore time jumps
        s.timeS += dt;
        const coil = this.schedule.coil;
        const mods = applyScenario(s.scenario);
        const wrDiameter = millConfig.geometry.workRollDiameter;
        const mandrelRadius = millConfig.geometry.mandrelDiameter / 2;
        // ---- 1. Interlocks --------------------------------------------------
        const hydraulicReady = s.auxHealth.hpLoading && s.auxHealth.lpSystem && mods.hydraulicPressureFactor > 0.5;
        const chain = evaluateInterlocks({
            driveReady: !s.eStop && s.auxHealth.lubrication,
            hydraulicReady,
            tensionReady: !s.eStop,
            gaugeReady: mods.gaugeReady,
            emergencyStop: s.eStop,
            fastStop: s.fastStopLatched,
            communicationHealthy: s.commsHealthy,
        });
        const ctx = {
            millReady: chain.millReady,
            interlockReason: chain.blockingReason,
            speed: s.speed,
            threaded: s.threaded,
            scheduleComplete: s.passNumber >= this.schedule.passes.length && s.payoffLength <= 0.5,
        };
        // ---- 2. State machine ------------------------------------------------
        // Queued operator commands first, then the signals this tick produces.
        for (const event of this.pendingEvents.splice(0)) {
            this.applyTransition(event, ctx);
        }
        // A broken interlock must take the mill out of READY, not just out of
        // ROLLING. Otherwise a mill sitting at READY with a dead gauge keeps
        // displaying "Mill ready — all interlocks healthy", which is exactly the
        // bare-status failure §13.2 forbids.
        if (!chain.millReady) {
            if (s.status !== 'IDLE' && s.status !== 'FAULT' && s.status !== 'FAST_STOP') {
                this.applyTransition('INTERLOCK_LOST', ctx);
            }
            else if (s.status === 'IDLE') {
                s.statusReason = chain.blockingReason ?? s.statusReason;
            }
        }
        else if (s.status === 'IDLE') {
            this.applyTransition('INTERLOCK_OK', ctx);
        }
        // ---- 3. Pass change & reversal sequencing ----------------------------
        // Done BEFORE the pass entry is read, so every value emitted this tick
        // belongs to the same pass. Running it at the end instead would publish one
        // frame carrying the new pass number alongside the old pass's thickness
        // reference — an internally inconsistent frame, which is the precise thing
        // §18 exists to catch.
        //
        // Safe to run first: the flip only happens during REVERSING, when the strip
        // is already at a standstill, so it acts on last tick's settled state.
        this.stepPassAndReversal(dt);
        const pass = getPass(this.schedule, s.passNumber);
        // ---- 4. Speed ramp ---------------------------------------------------
        const scheduleSpeed = pass.speedReference + s.speedReferenceTrim;
        const speedReference = clamp(scheduleSpeed, 0, engineeringConfig.speedLimits.max);
        const targetSpeed = this.targetSpeedFor(s.status, speedReference);
        const rate = s.status === 'FAST_STOP'
            ? engineeringConfig.fastStopDeceleration
            : targetSpeed < s.speed
                ? engineeringConfig.deceleration
                : engineeringConfig.acceleration;
        s.speed = rampTowards(s.speed, targetSpeed, rate * dt);
        if (s.speed < 0.05 && targetSpeed <= 0)
            s.speed = 0;
        if (s.speed === 0 && (s.status === 'DECELERATING' || s.status === 'FAST_STOP')) {
            this.applyTransition('SPEED_ZERO', ctx);
        }
        if (s.status === 'THREADING' && s.speed >= engineeringConfig.speedLimits.threadingSpeed * 0.98) {
            s.threaded = true;
            this.applyTransition('THREADED', ctx);
        }
        // ---- 4. Tension loops -------------------------------------------------
        // Entry thickness varies along the coil (hot-band profile) — this is the
        // disturbance the AGC exists to reject.
        const entryThickness = Math.max(0.05, s.passInputThickness + entryThicknessDeviation(s.positionM, s.passNumber));
        const tensionRefs = calculateTensionReferences(pass.entrySpecificTension, pass.exitSpecificTension, entryThickness, pass.outputThickness, coil.width);
        const entryRefFull = clamp(tensionRefs.entryKN + s.entryTensionTrim, engineeringConfig.tensionLimits.entryMin, engineeringConfig.tensionLimits.entryMax);
        const exitRefFull = clamp(tensionRefs.exitKN + s.exitTensionTrim, engineeringConfig.tensionLimits.exitMin, engineeringConfig.tensionLimits.exitMax);
        const entryTarget = tensionReferenceForState(entryRefFull, s.speed, s.threaded);
        const exitTarget = tensionReferenceForState(exitRefFull, s.speed, s.threaded);
        s.entryTension = stepTension(s.entryTension, entryTarget, dt);
        s.exitTension = stepTension(s.exitTension, exitTarget, dt);
        // ---- 5. Gaugemeter solve (thickness AND force, coupled) --------------
        const gapCommand = s.gapPosition + s.gapTrim + mods.gapOffsetMm;
        const rolling = isRolling(s.status) && s.threaded;
        const solve = solveGaugemeter({
            gapPosition: gapCommand,
            inputThickness: entryThickness,
            width: coil.width,
            workRollDiameter: wrDiameter,
            entryTension: s.entryTension,
            exitTension: s.exitTension,
            accumulatedStrain: accumulatedStrainBeforePass(s.passNumber),
            flowStressScale: mods.flowStressScale,
        });
        // Force only exists while the rolls are actually working the strip. A
        // stopped-but-threaded mill still carries the set-up load through the
        // capsules, so it is held at a fraction rather than dropped to zero.
        const forceScale = rolling ? 1 : s.threaded ? 0.12 : 0;
        const force = solve.force.forceTonnes * forceScale * mods.forceScale;
        const deliveredThickness = rolling ? solve.outputThickness : s.deliveredThickness;
        s.deliveredThickness = deliveredThickness;
        s.force = force;
        s.contactLength = solve.force.contactLength;
        s.solverIterations = solve.iterations;
        s.residualUm = solve.residualUm;
        // ---- 5b. HAGC --------------------------------------------------------
        // Fed the model thickness, standing in for the real FILTERED gauge signal.
        // Feeding it the noisy displayed value instead would inject instrument noise
        // straight into the capsule position, which is not what the mill does.
        if (rolling) {
            const stepped = hagcStep(s.hagc, s.gapPosition, deliveredThickness, pass.outputThickness, dt, s.agcEnabled && mods.agcEnabled);
            s.gapPosition = stepped.gapPosition;
            s.hagc = stepped.state;
        }
        // ---- 6. Kinematics ---------------------------------------------------
        const exitSpeed = s.speed;
        const entrySpeed = entrySpeedFromMassFlow(exitSpeed, entryThickness, deliveredThickness);
        const rollSurfaceSpeed = rollSurfaceSpeedFromStripSpeed(exitSpeed);
        const wrRpm = calculateRollRPM(rollSurfaceSpeed, wrDiameter);
        // BUR is driven by contact with the WR: equal surface speed, so rpm scales
        // inversely with diameter.
        const burRpm = calculateRollRPM(rollSurfaceSpeed, millConfig.geometry.backupRollDiameter);
        // ---- 7. Drive --------------------------------------------------------
        const drive = calculateDrive({
            forceTonnes: force,
            contactLengthMm: solve.force.contactLength,
            rollRPM: wrRpm,
            workRollDiameter: wrDiameter,
            entryTensionKN: s.entryTension,
            exitTensionKN: s.exitTension,
            rolling,
        });
        // ---- 8. Coil geometry & length bookkeeping ---------------------------
        if (rolling && dt > 0) {
            const paidOff = (entrySpeed / 60) * dt;
            const wound = (exitSpeed / 60) * dt;
            s.payoffLength = Math.max(0, s.payoffLength - paidOff);
            s.woundLength += wound;
            s.positionM += paidOff;
        }
        const payoff = payoffReel(s.direction);
        const winder = tensionReel(s.direction);
        const payoffRadius = coilRadiusFromLength(mandrelRadius, entryThickness, s.payoffLength);
        const winderRadius = coilRadiusFromLength(mandrelRadius, deliveredThickness, s.woundLength);
        const porRadius = coilRadiusFromLength(mandrelRadius, s.porThickness, s.porLength);
        const payoffRpm = reelRPM(entrySpeed, payoffRadius);
        const winderRpm = reelRPM(exitSpeed, winderRadius);
        const payoffTorque = reelTorque(s.entryTension, payoffRadius);
        const winderTorque = reelTorque(s.exitTension, winderRadius);
        // ---- 9. Pass completion ------------------------------------------------
        // Ending a pass starts a deceleration ramp; it does NOT flip anything here.
        // The flip itself is sequenced at the top of the next tick, once the strip
        // has actually come to rest (§9: no instant flip).
        if (rolling && s.payoffLength <= 0.5) {
            this.applyTransition('PASS_COMPLETE', ctx);
        }
        // ---- Instrument signals ----------------------------------------------
        // Noise is added HERE, at the X-ray gauges, and nowhere else.
        const gaugeExit = applyGaugeNoise(deliveredThickness, this.rng);
        const gaugeEntry = applyGaugeNoise(entryThickness, this.rng);
        const thicknessDeviationUm = (gaugeExit - pass.outputThickness) * 1000;
        // ---- OS / DS split (§2 BUR taper + -9 t differential reference) -------
        // First-order representation: the AGC holds a commanded force differential
        // between the sides, and the resulting side-to-side gap difference follows
        // from the mill modulus. Carried in the model from day one even though
        // Phase 1 renders a single value.
        const diffRef = millConfig.agc.differentialForceReference;
        const forceOs = force / 2 - diffRef / 2;
        const forceDs = force / 2 + diffRef / 2;
        const tiltMm = diffRef / engineeringConfig.millModulus;
        const gapOs = deliveredThickness - tiltMm / 2;
        const gapDs = deliveredThickness + tiltMm / 2;
        const auxStatus = (ok) => (ok ? 'HEALTHY' : 'FAULT');
        const ctrl = (on) => (on ? 'ON' : 'OFF');
        const remainingLength = s.payoffLength;
        const passProgress = s.passTotalLength > 0 ? clamp(1 - s.payoffLength / s.passTotalLength, 0, 1) * 100 : 0;
        // ---- Emit the frame ---------------------------------------------------
        const frame = {
            // MILL
            'MILL.SPEED.REF': speedReference,
            'MILL.SPEED.ACTUAL': exitSpeed,
            'MILL.SPEED.ENTRY': entrySpeed,
            'MILL.DIRECTION': s.direction,
            'MILL.STATUS': s.status,
            'MILL.STATUS.REASON': s.statusReason,
            'MILL.INTERLOCK': chain.millReady,
            'MILL.MASSFLOW.ERROR': massFlowError(entryThickness, entrySpeed, deliveredThickness, exitSpeed),
            // ROLL GAP
            'ROLL.GAP.REF': gapCommand,
            'ROLL.GAP.ACTUAL': deliveredThickness,
            'ROLL.GAP.OS': gapOs,
            'ROLL.GAP.DS': gapDs,
            'ROLL.GAP.TILT': tiltMm * 1000,
            // ROLL FORCE
            'ROLL.FORCE.ACTUAL': force,
            'ROLL.FORCE.REF': pass.predictedForce,
            'ROLL.FORCE.OS': forceOs,
            'ROLL.FORCE.DS': forceDs,
            'ROLL.FORCE.DIFF_REF': diffRef,
            // STRIP
            'STRIP.WIDTH': coil.width,
            'STRIP.THICKNESS': gaugeExit,
            'STRIP.THICKNESS.ENTRY': gaugeEntry,
            'STRIP.THICKNESS.REF': pass.outputThickness,
            'STRIP.THICKNESS.DEVIATION': thicknessDeviationUm,
            'STRIP.REDUCTION': calculateReduction(entryThickness, deliveredThickness),
            // TENSION
            'TENSION.ENTRY': s.entryTension,
            'TENSION.EXIT': s.exitTension,
            'TENSION.ENTRY.REF': entryRefFull,
            'TENSION.EXIT.REF': exitRefFull,
            // COIL / PASS
            'COIL.ID': coil.id,
            'COIL.GRADE': coil.grade,
            'COIL.LENGTH': s.passTotalLength,
            'COIL.REMAINING_LENGTH': remainingLength,
            'COIL.DIAMETER': payoffRadius * 2,
            'PASS.NUMBER': s.passNumber,
            'PASS.TOTAL': this.schedule.passes.length,
            'PASS.PROGRESS': passProgress,
            // DRIVE
            'DRIVE.TORQUE': drive.torque,
            'DRIVE.CURRENT': drive.current,
            'DRIVE.POWER': drive.power,
            'DRIVE.RPM': drive.rpm,
            // ROLLS. Upper and lower work rolls counter-rotate, hence the sign flip;
            // the whole set reverses when `direction` flips.
            'WR.TOP.RPM': wrRpm * directionSignOf(s.direction),
            'WR.BOTTOM.RPM': -wrRpm * directionSignOf(s.direction),
            'BUR.TOP.RPM': burRpm * directionSignOf(s.direction),
            'BUR.BOTTOM.RPM': -burRpm * directionSignOf(s.direction),
            'WR.TOP.BENDING': mods.bendingForceKN,
            'WR.BOTTOM.BENDING': mods.bendingForceKN,
            'WR.TOP.DIAMETER': wrDiameter,
            'WR.BOTTOM.DIAMETER': wrDiameter,
            'BUR.TOP.DIAMETER': millConfig.geometry.backupRollDiameter,
            'BUR.BOTTOM.DIAMETER': millConfig.geometry.backupRollDiameter,
            // HYDRAULICS
            'HYD.LOADING.PRESSURE': hydraulicPressureFromForce(force) * mods.hydraulicPressureFactor,
            'HYD.BENDING.PRESSURE': mods.bendingPressureBar,
            'HYD.GAP.POSITION': gapCommand,
            'LP.PRESSURE': s.auxHealth.lpSystem ? engineeringConfig.lpSystemPressure : 0.4,
            // AUXILIARY STATUS
            'LP.STATUS': auxStatus(s.auxHealth.lpSystem),
            'HP.LOADING.STATUS': auxStatus(s.auxHealth.hpLoading),
            'HP.BENDING.STATUS': auxStatus(s.auxHealth.hpBending),
            'COOLANT.STATUS': auxStatus(s.auxHealth.coolant),
            'LUBRICATION.STATUS': auxStatus(s.auxHealth.lubrication),
            'EXHAUST.STATUS': auxStatus(s.auxHealth.exhaust),
            // PROCESS CONTROL
            'AGC.STATUS': ctrl(s.agcEnabled && mods.agcEnabled && rolling),
            'THFB.STATUS': ctrl(s.agcEnabled && rolling),
            'THFF.STATUS': ctrl(s.agcEnabled && rolling),
            'SPFF.STATUS': ctrl(rolling),
            'MFC.STATUS': ctrl(s.agcEnabled && rolling),
            'TRF.STATUS': ctrl(s.threaded),
            'POSITION.MODE.STATUS': ctrl(!s.agcEnabled),
            'ROLLGAP.CLOSED.STATUS': ctrl(gapCommand < entryThickness),
            'BENDING.STATUS': ctrl(s.auxHealth.hpBending),
            // INTERLOCKS
            'DRIVE.READY': !s.eStop && s.auxHealth.lubrication,
            'GAUGE.READY': mods.gaugeReady,
            'HYDRAULIC.READY': hydraulicReady,
            'TENSION.READY': !s.eStop,
            'EMERGENCY.STOP': s.eStop,
            'FAST.STOP': s.fastStopLatched,
            // GAUGES. Each isotope gauge is bolted to one side of the stand and never
            // moves; what it MEASURES swaps with direction. On FORWARD the ETR side is
            // upstream of the bite, so the ETR gauge reads incoming and the DTR gauge
            // reads delivered.
            'GAUGE.ETR.THICKNESS': payoff === 'ETR' ? gaugeEntry : gaugeExit,
            'GAUGE.DTR.THICKNESS': payoff === 'DTR' ? gaugeEntry : gaugeExit,
            'GAUGE.DTR.READY': mods.gaugeReady,
            'GAUGE.ETR.READY': mods.gaugeReady,
        };
        // Reels. Which physical reel gets the payoff numbers is decided ONLY by the
        // direction-derived role — nothing here is hardcoded to a side.
        writeReel(frame, payoff, {
            tension: s.entryTension,
            diameter: payoffRadius * 2,
            length: s.payoffLength,
            torque: payoffTorque,
            current: reelCurrent(payoffTorque, millConfig.ratings.reelRatedTorque, millConfig.ratings.reelRatedCurrent),
            // Both reels turn the SAME way in space — they are two pulleys with the
            // strip running between them. Only their rpm differs, because their
            // diameters and line speeds differ.
            rpm: payoffRpm * directionSignOf(s.direction),
            thickness: entryThickness,
            role: reelRole(payoff, s.direction),
            brake: rolling ? 'RELEASED' : 'APPLIED',
            status: rolling ? 'RUNNING' : 'STOPPED',
        });
        writeReel(frame, winder, {
            tension: s.exitTension,
            diameter: winderRadius * 2,
            length: s.woundLength,
            torque: winderTorque,
            current: reelCurrent(winderTorque, millConfig.ratings.reelRatedTorque, millConfig.ratings.reelRatedCurrent),
            rpm: winderRpm * directionSignOf(s.direction),
            thickness: deliveredThickness,
            role: reelRole(winder, s.direction),
            brake: rolling ? 'RELEASED' : 'APPLIED',
            status: rolling ? 'RUNNING' : 'STOPPED',
        });
        // POR holds the NEXT coil waiting to be charged: braked, no tension, no load.
        frame['POR.TENSION'] = 0;
        frame['POR.DIAMETER'] = porRadius * 2;
        frame['POR.LENGTH'] = s.porLength;
        frame['POR.TORQUE'] = 0;
        frame['POR.CURRENT'] = 0;
        frame['POR.RPM'] = 0;
        frame['POR.LAYERS'] = coilLayers(mandrelRadius, s.porThickness, porRadius);
        frame['POR.BRAKE'] = 'APPLIED';
        frame['POR.STATUS'] = 'STOPPED';
        return frame;
    }
    /** Diagnostics the adapter copies into MachineState.diagnostics. */
    getDiagnostics() {
        return {
            solverIterations: this.state.solverIterations,
            gaugemeterResidualUm: this.state.residualUm,
        };
    }
    /**
     * Advance the pass / reversal sequence (§9).
     *
     * Runs at the TOP of a tick, on the state the previous tick settled into.
     * A reversal only ever begins from a genuine standstill, and `stepReversal`
     * independently refuses to advance while the strip is moving — the "no instant
     * flip" rule is enforced in both places rather than trusted to either.
     */
    stepPassAndReversal(dt) {
        const s = this.state;
        const scheduleComplete = s.passNumber >= this.schedule.passes.length;
        if (s.status === 'STOPPED' &&
            s.payoffLength <= 0.5 &&
            !scheduleComplete &&
            s.reversal.phase === 'NONE') {
            const begun = beginReversal(s.status);
            if (begun.changed) {
                s.status = begun.status;
                s.statusReason = begun.reason;
                s.reversal = startReversal(s.direction, getPass(this.schedule, s.passNumber + 1).direction);
            }
        }
        if (s.reversal.phase === 'NONE')
            return;
        const next = stepReversal(s.reversal, dt, s.speed);
        if (next.phase === 'FLIP' && s.reversal.phase !== 'FLIP') {
            this.applyFlip();
        }
        s.reversal = next;
        if (next.phase === 'COMPLETE') {
            s.reversal = initialReversalState;
            // The reversal is finished, so the mill may roll again. Context here is
            // trivially satisfiable — the mill is stopped, threaded and mid-schedule.
            this.applyTransition('REVERSAL_COMPLETE', {
                millReady: true,
                interlockReason: null,
                speed: s.speed,
                threaded: s.threaded,
                scheduleComplete: false,
            });
        }
    }
    applyTransition(event, ctx) {
        const s = this.state;
        const result = transition(s.status, event, { ...ctx, speed: s.speed, threaded: s.threaded });
        s.status = result.status;
        s.statusReason = result.reason;
    }
    /**
     * The FLIP step of the reversal (§9): direction changes, entry/exit roles
     * swap, and the coil rolls over to the next pass. Everything that defines
     * "which way is the mill going" changes in this one place, on one tick.
     */
    applyFlip() {
        const s = this.state;
        const coil = this.schedule.coil;
        const nextPassNumber = Math.min(s.passNumber + 1, this.schedule.passes.length);
        const nextPass = getPass(this.schedule, nextPassNumber);
        // The reel that was winding becomes the reel that pays off. Its contents —
        // length at the just-delivered thickness — become the next pass's input.
        const newPayoffLength = s.woundLength > 0
            ? s.woundLength
            : lengthAfterReduction(s.passTotalLength, s.passInputThickness, s.deliveredThickness);
        s.direction = nextPass.direction ?? oppositeDirection(s.direction);
        s.passNumber = nextPassNumber;
        s.passInputThickness = nextPass.inputThickness;
        s.payoffLength = newPayoffLength;
        s.passTotalLength = newPayoffLength;
        s.woundLength = 0;
        s.positionM = 0;
        s.hagc = { integral: 0 };
        // Preposition the capsule for the new pass — the AGC position pre-set.
        const tensions = calculateTensionReferences(nextPass.entrySpecificTension, nextPass.exitSpecificTension, nextPass.inputThickness, nextPass.outputThickness, coil.width);
        s.gapPosition = gapPositionForTargetThickness(nextPass.outputThickness, nextPass.inputThickness, coil.width, millConfig.geometry.workRollDiameter, tensions.entryKN, tensions.exitKN, accumulatedStrainBeforePass(nextPassNumber));
        s.gapTrim = 0;
    }
    targetSpeedFor(status, speedReference) {
        switch (status) {
            case 'ROLLING':
            case 'SKIN_PASS':
                return speedReference;
            case 'THREADING':
                return engineeringConfig.speedLimits.threadingSpeed;
            case 'REWIND':
                return speedReference * 0.5;
            default:
                // IDLE, READY, DECELERATING, STOPPED, REVERSING, FAST_STOP, FAULT,
                // WARMUP, ROLL_CHANGE — none of these produce line speed.
                return 0;
        }
    }
}
// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function directionSignOf(direction) {
    return direction === 'FORWARD' ? 1 : -1;
}
function rampTowards(current, target, maxStep) {
    if (current < target)
        return Math.min(current + maxStep, target);
    if (current > target)
        return Math.max(current - maxStep, target);
    return current;
}
function writeReel(frame, reel, v) {
    frame[`${reel}.TENSION`] = v.tension;
    frame[`${reel}.DIAMETER`] = v.diameter;
    frame[`${reel}.LENGTH`] = v.length;
    frame[`${reel}.TORQUE`] = v.torque;
    frame[`${reel}.CURRENT`] = v.current;
    frame[`${reel}.RPM`] = v.rpm;
    frame[`${reel}.THICKNESS`] = v.thickness;
    frame[`${reel}.ROLE`] = v.role;
    frame[`${reel}.BRAKE`] = v.brake;
    frame[`${reel}.STATUS`] = v.status;
}
/** Strip length held between mandrel and outside radius, m. */
function coilLengthAtThickness(outerRadiusMm, mandrelRadiusMm, thicknessMm) {
    if (thicknessMm <= 0)
        return 0;
    const area = Math.PI * (outerRadiusMm * outerRadiusMm - mandrelRadiusMm * mandrelRadiusMm);
    return area / thicknessMm / 1000;
}
/** Exported for the validation harness. */
export const __testing = { entryThicknessDeviation, rampTowards, coilLengthAtThickness };
/** Convenience for panels that want tension as tonnes. */
export { kNToTonnes, specificTension };
