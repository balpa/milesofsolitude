import { clamp, lerp } from '../../utils/math';
import type { VehicleConfig } from '../../types';

export class EngineSimulation {
  private rpm = 0;
  private running = true;
  private readonly config: VehicleConfig['engine'];

  constructor(config: VehicleConfig['engine']) {
    this.config = config;
    this.rpm = config.idleRpm;
  }

  update(
    throttle: number,
    wheelRpm: number,
    gearRatio: number,
    finalDrive: number,
    dt: number,
  ): number {
    if (!this.running) {
      this.rpm = lerp(this.rpm, 0, dt * 5);
      return 0;
    }

    const inGear = gearRatio !== 0;

    // Compute engine RPM from wheel RPM through drivetrain
    const drivetrainRpm = Math.abs(wheelRpm) * Math.abs(gearRatio) * finalDrive;

    // Target RPM calculation with clutch slip model
    let targetRpm: number;
    if (inGear) {
      // Clutch slip: allows engine to rev above drivetrain at low speeds,
      // but clutch grips progressively as speed builds.
      // slipCeiling = how high the engine can free-rev beyond drivetrain RPM
      const slipCeiling = this.config.idleRpm
        + throttle * (this.config.idleRpm * 2); // max ~2400 RPM from slip alone

      // Clutch grip: 0 = full slip (standing), 1 = fully gripped (high speed)
      const gripThreshold = 2000; // drivetrain RPM where clutch is mostly gripped
      const clutchGrip = clamp(drivetrainRpm / gripThreshold, 0, 1);

      // Blend: at low speed, engine can float above drivetrain by slipCeiling.
      // At high speed, engine follows drivetrain directly.
      const slipBoost = slipCeiling * (1 - clutchGrip);
      targetRpm = Math.max(this.config.idleRpm, drivetrainRpm + slipBoost);
    } else {
      // In neutral: free rev
      targetRpm = this.config.idleRpm
        + throttle * (this.config.redlineRpm - this.config.idleRpm) * 0.85;
    }

    // Smooth RPM transition
    const rpmSpeed = throttle > 0.1 ? 8 : 15;
    this.rpm = lerp(this.rpm, targetRpm, dt * rpmSpeed);
    this.rpm = clamp(this.rpm, 0, this.config.maxRpm);

    // Rev limiter - cut torque above redline
    if (this.rpm >= this.config.redlineRpm) {
      return this.lookupTorque(this.rpm) * 0.05;
    }

    // Engine braking when no throttle and in gear
    if (throttle < 0.01 && inGear) {
      return -this.config.engineBrakingFactor * this.lookupTorque(this.rpm) * 0.3;
    }

    // Engine output torque
    return this.lookupTorque(this.rpm) * throttle;
  }

  private lookupTorque(rpm: number): number {
    const curve = this.config.torqueCurve;
    if (rpm <= curve[0][0]) return curve[0][1];
    if (rpm >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];

    for (let i = 0; i < curve.length - 1; i++) {
      const [rpm0, torque0] = curve[i];
      const [rpm1, torque1] = curve[i + 1];
      if (rpm >= rpm0 && rpm <= rpm1) {
        const t = (rpm - rpm0) / (rpm1 - rpm0);
        return lerp(torque0, torque1, t);
      }
    }

    return 0;
  }

  getRpm(): number {
    return this.rpm;
  }

  isRunning(): boolean {
    return this.running;
  }

  setRunning(running: boolean): void {
    this.running = running;
    if (running) this.rpm = this.config.idleRpm;
  }
}
