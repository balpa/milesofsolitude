import type { VehicleConfig } from '../../types';

export class Transmission {
  private currentGear = 0; // 0 = neutral at start
  private shiftTimer = 0;
  private shifting = false;
  private readonly config: VehicleConfig['transmission'];
  private readonly maxGear: number;

  constructor(config: VehicleConfig['transmission']) {
    this.config = config;
    this.maxGear = config.gearRatios.length;
  }

  update(dt: number): void {
    if (this.shifting) {
      this.shiftTimer -= dt;
      if (this.shiftTimer <= 0) {
        this.shifting = false;
      }
    }
  }

  shiftUp(): void {
    if (this.shifting) return;
    if (this.currentGear < this.maxGear) {
      this.currentGear++;
      this.startShift();
    }
  }

  shiftDown(): void {
    if (this.shifting) return;
    if (this.currentGear > -1) {
      this.currentGear--;
      this.startShift();
    }
  }

  private startShift(): void {
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
    if (this.shifting) return '-';
    if (this.currentGear === -1) return 'R';
    if (this.currentGear === 0) return 'N';
    return this.currentGear.toString();
  }

  getMaxGear(): number {
    return this.maxGear;
  }

  resetToNeutral(): void {
    this.currentGear = 0;
    this.shifting = false;
    this.shiftTimer = 0;
  }
}
