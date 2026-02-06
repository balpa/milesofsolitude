import type { VehicleConfig } from '../../types';

export class Transmission {
  private currentGear = 1; // 1-indexed for forward, 0 = neutral, -1 = reverse
  private shiftTimer = 0;
  private shifting = false;
  private readonly config: VehicleConfig['transmission'];

  constructor(config: VehicleConfig['transmission']) {
    this.config = config;
  }

  update(rpm: number, throttle: number, dt: number): void {
    if (this.shifting) {
      this.shiftTimer -= dt;
      if (this.shiftTimer <= 0) {
        this.shifting = false;
      }
      return;
    }

    // Auto-shift logic (only for forward gears)
    if (this.currentGear >= 1 && throttle > 0.1) {
      if (rpm >= this.config.shiftUpRpm && this.currentGear < this.config.gearRatios.length) {
        this.shiftTo(this.currentGear + 1);
      } else if (rpm <= this.config.shiftDownRpm && this.currentGear > 1) {
        this.shiftTo(this.currentGear - 1);
      }
    }
  }

  private shiftTo(gear: number): void {
    this.currentGear = gear;
    this.shifting = true;
    this.shiftTimer = this.config.shiftDelay;
  }

  getCurrentGearRatio(): number {
    if (this.shifting) return 0; // Neutral during shift
    if (this.currentGear === 0) return 0;
    if (this.currentGear === -1) return this.config.reverseRatio;
    return this.config.gearRatios[this.currentGear - 1] ?? 0;
  }

  getFinalDriveRatio(): number {
    return this.config.finalDriveRatio;
  }

  getEfficiency(): number {
    return this.config.efficiency;
  }

  getGear(): number {
    return this.currentGear;
  }

  isShifting(): boolean {
    return this.shifting;
  }

  getGearDisplay(): string {
    if (this.currentGear === -1) return 'R';
    if (this.currentGear === 0) return 'N';
    return this.currentGear.toString();
  }

  setReverse(): void {
    if (!this.shifting) {
      this.currentGear = -1;
    }
  }

  setForward(): void {
    if (!this.shifting && this.currentGear <= 0) {
      this.currentGear = 1;
    }
  }

  setNeutral(): void {
    this.currentGear = 0;
  }
}
