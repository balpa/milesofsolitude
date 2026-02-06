import { clamp } from '../../utils/math';
import type { VehicleConfig } from '../../types';

export class FuelSystem {
  private currentFuel: number;
  private readonly config: VehicleConfig['fuel'];

  constructor(config: VehicleConfig['fuel']) {
    this.config = config;
    this.currentFuel = config.tankCapacity;
  }

  update(rpm: number, torque: number, dt: number): void {
    if (this.currentFuel <= 0) return;

    // BSFC-based fuel consumption
    // Power = torque * angular_velocity = torque * (rpm * 2PI/60)
    const angularVelocity = (rpm * 2 * Math.PI) / 60;
    const powerKw = Math.abs(torque * angularVelocity) / 1000;

    // Fuel consumption: BSFC (g/kWh) -> g/s -> L/s
    const fuelGramsPerSecond = (this.config.bsfc * powerKw) / 3600;
    const fuelLitersPerSecond = fuelGramsPerSecond / (this.config.fuelDensity * 1000);

    // Idle consumption baseline
    const idleConsumption = 0.0002; // ~0.7 L/h at idle
    const totalConsumption = fuelLitersPerSecond + idleConsumption;

    this.currentFuel -= totalConsumption * dt;
    this.currentFuel = clamp(this.currentFuel, 0, this.config.tankCapacity);
  }

  getFuelLevel(): number {
    return this.currentFuel;
  }

  getFuelPercent(): number {
    return (this.currentFuel / this.config.tankCapacity) * 100;
  }

  isEmpty(): boolean {
    return this.currentFuel <= 0;
  }

  refuel(amount?: number): void {
    this.currentFuel = clamp(
      this.currentFuel + (amount ?? this.config.tankCapacity),
      0,
      this.config.tankCapacity,
    );
  }
}
