import type { VehicleState } from '../../types';
import { remap, clamp } from '../../utils/math';

export class HudManager {
  private rpmValueEl: HTMLElement;
  private speedValueEl: HTMLElement;
  private gearValueEl: HTMLElement;
  private fuelBarEl: HTMLElement;
  private fuelValueEl: HTMLElement;
  private rpmFillEl: SVGCircleElement;
  private speedFillEl: SVGCircleElement;

  // SVG gauge arc constants
  private readonly circumference = 534; // 2 * PI * 85
  private readonly gaugeArc = 400; // visible arc portion (~270 degrees)

  constructor() {
    this.rpmValueEl = document.getElementById('rpm-value')!;
    this.speedValueEl = document.getElementById('speed-value')!;
    this.gearValueEl = document.getElementById('gear-value')!;
    this.fuelBarEl = document.getElementById('fuel-bar')!;
    this.fuelValueEl = document.getElementById('fuel-value')!;
    this.rpmFillEl = document.querySelector('.rpm-fill')! as SVGCircleElement;
    this.speedFillEl = document.querySelector('.speed-fill')! as SVGCircleElement;
  }

  update(state: VehicleState, gearDisplay: string): void {
    // RPM
    this.rpmValueEl.textContent = state.rpm.toString();
    const rpmPercent = clamp(state.rpm / 7000, 0, 1);
    const rpmOffset = this.circumference - (rpmPercent * this.gaugeArc);
    this.rpmFillEl.style.strokeDashoffset = rpmOffset.toString();

    // Color shift for high RPM
    if (state.rpm > 6000) {
      this.rpmFillEl.style.stroke = '#ff2222';
    } else if (state.rpm > 5000) {
      this.rpmFillEl.style.stroke = '#ff6644';
    } else {
      this.rpmFillEl.style.stroke = '#ff4444';
    }

    // Speed
    this.speedValueEl.textContent = state.speed.toString();
    const speedPercent = clamp(state.speed / 250, 0, 1);
    const speedOffset = this.circumference - (speedPercent * this.gaugeArc);
    this.speedFillEl.style.strokeDashoffset = speedOffset.toString();

    // Gear
    this.gearValueEl.textContent = gearDisplay;
    if (state.isShifting) {
      this.gearValueEl.style.opacity = '0.4';
    } else {
      this.gearValueEl.style.opacity = '1';
    }

    // Fuel
    const fuelPercent = clamp(state.fuelPercent, 0, 100);
    this.fuelBarEl.style.width = `${fuelPercent}%`;
    this.fuelValueEl.textContent = `${Math.round(fuelPercent)}%`;

    // Low fuel warning
    if (fuelPercent < 15) {
      this.fuelBarEl.style.background = '#ff4444';
    } else if (fuelPercent < 30) {
      this.fuelBarEl.style.background = 'linear-gradient(90deg, #ff4444, #ffaa00)';
    } else {
      this.fuelBarEl.style.background = 'linear-gradient(90deg, #ff4444, #ffaa00, #44ff44)';
    }
  }
}
