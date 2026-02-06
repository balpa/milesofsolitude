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

    // Compute engine RPM from wheel RPM through drivetrain
    const drivetrainRpm = Math.abs(wheelRpm) * Math.abs(gearRatio) * finalDrive;

    // Blend between idle and drivetrain RPM based on clutch engagement
    const clutchEngagement = gearRatio !== 0 ? 1 : 0;
    const targetRpm = clutchEngagement > 0
      ? Math.max(this.config.idleRpm, drivetrainRpm)
      : this.config.idleRpm + throttle * (this.config.maxRpm - this.config.idleRpm) * 0.3;

    // Smooth RPM transition
    const rpmSpeed = throttle > 0 ? 8 : 12;
    this.rpm = lerp(this.rpm, targetRpm, dt * rpmSpeed);
    this.rpm = clamp(this.rpm, 0, this.config.maxRpm);

    // Rev limiter - cut torque above redline
    if (this.rpm >= this.config.redlineRpm) {
      return this.lookupTorque(this.rpm) * 0.1;
    }

    // Engine output torque
    const torque = this.lookupTorque(this.rpm) * throttle;

    // Engine braking when no throttle
    if (throttle < 0.01 && clutchEngagement > 0) {
      return -this.config.engineBrakingFactor * this.lookupTorque(this.rpm) * 0.3;
    }

    return torque;
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
