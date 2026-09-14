/**
 * MAIN DRIVE MODEL — §8.3 of the master spec.
 *
 *   torque  = f(rollingForce, contactLength, workRollRadius)
 *   power   = f(torque, rollRPM) / mechanicalEfficiency
 *   current = f(power, driveConstants)
 *
 * Torque is derived from the force and the geometry, never generated
 * independently — this is the §8.6 chain "reduction ↑ → force ↑ → torque ↑ →
 * current ↑" and it must hold at every tick.
 */
import { engineeringConfig } from '../config/engineeringConfig';
import { millConfig } from '../config/millConfig';
import { rpmToRadPerSec, tonnesToKN } from '../config/unitConversion';
/**
 * Mill torque, power and current.
 *
 *   a  = λ · L                                   lever arm, mm
 *   G_roll  = 2 · F · a                          both work rolls driven, kNm
 *   G_tens  = R_wr · (T_back − T_front)          tension differential, kNm
 *   G       = G_roll + G_tens
 *   P       = G · ω / η                          shaft power, kW
 *   I       = I_rated · G / G_rated              armature current, A
 *
 * The tension term is signed on purpose. Front (exit) tension is applied by the
 * exit reel, which does part of the pulling, so the mill motor needs LESS
 * torque. Back (entry) tension drags against the rolls and costs MORE. Getting
 * this sign right is what makes "raise exit tension → mill current falls" behave
 * the way an operator expects.
 *
 * LIMITATIONS
 *  - Constant lever-arm ratio λ (see engineeringConfig).
 *  - No inertia term: acceleration torque during ramps is not modelled, so
 *    current during a speed change is a steady-state value at the new speed.
 *  - Bearing, seal and spindle losses are folded into one efficiency constant.
 *  - Current is mapped linearly from torque (a DC / field-oriented drive
 *    approximation). No field weakening above base speed.
 */
export function calculateDrive(input) {
    const { forceTonnes, contactLengthMm, rollRPM, workRollDiameter, entryTensionKN, exitTensionKN, rolling, } = input;
    const forceKN = tonnesToKN(forceTonnes);
    const leverArmM = (engineeringConfig.leverArmRatio * contactLengthMm) / 1000;
    const workRollRadiusM = workRollDiameter / 2 / 1000;
    // Deformation torque, both work rolls — only while the bite is working.
    const rollTorque = rolling ? 2 * forceKN * leverArmM : 0;
    // Tension differential torque, kNm. Positive = extra load on the mill motor.
    // This one DOES persist at standstill: the reels hold the strip taut and the
    // mill motor holds against the difference.
    const tensionTorque = workRollRadiusM * (entryTensionKN - exitTensionKN);
    const torque = rollTorque + tensionTorque;
    // P[kW] = G[kNm] · ω[rad/s] / η
    const omega = rpmToRadPerSec(rollRPM);
    const power = (torque * omega) / engineeringConfig.mechanicalEfficiency;
    const ratedTorque = millConfig.ratings.mainDriveRatedTorque;
    const torquePercentage = ratedTorque > 0 ? (torque / ratedTorque) * 100 : 0;
    const current = (millConfig.ratings.mainDriveRatedCurrent * torque) / Math.max(ratedTorque, 1e-6);
    return {
        torque,
        rollTorque,
        tensionTorque,
        power,
        current,
        // The main drive turns the work rolls through the spindles; gear ratio 1:1
        // is assumed pending §22 item 1 (main drive rating / gearbox data).
        rpm: rollRPM,
        torquePercentage,
    };
}
/**
 * HAGC capsule loading pressure from roll separating force, bar.
 *
 *   p = p_max · F / F_max
 *
 * A proportional map: the capsule area is constant, so pressure tracks force.
 * Used to give the hydraulics panel and the 3D cylinders a value that is
 * genuinely tied to the force rather than animated for effect.
 *
 * LIMITATION: ignores the accumulator characteristic, line losses, and the
 * balance/counter-balance circuit.
 */
export function hydraulicPressureFromForce(forceTonnes) {
    const ratio = forceTonnes / millConfig.ratings.maxRollingForce;
    return engineeringConfig.hydraulicPressureAtMaxForce * Math.max(0, Math.min(ratio, 1.2));
}
