import * as THREE from 'three';
import type { VehicleController } from '../vehicle/VehicleController';

export class SettingsManager {
  private nightMode = false;
  private scene: THREE.Scene;
  private vehicle: VehicleController;

  // Store original day values
  private readonly dayBg = new THREE.Color(0x87ceeb);
  private readonly nightBg = new THREE.Color(0x0a0a1a);
  private readonly dayFog = new THREE.Color(0x87ceeb);
  private readonly nightFog = new THREE.Color(0x0a0a1a);

  constructor(scene: THREE.Scene, vehicle: VehicleController) {
    this.scene = scene;
    this.vehicle = vehicle;
    this.setupDOM();
  }

  private setupDOM(): void {
    const toggleBtn = document.getElementById('config-toggle');
    const panel = document.getElementById('config-panel');
    const nightToggle = document.getElementById('toggle-night') as HTMLInputElement | null;

    if (toggleBtn && panel) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('open');
      });

      // Close panel when clicking elsewhere
      document.addEventListener('click', (e) => {
        if (!panel.contains(e.target as Node) && e.target !== toggleBtn) {
          panel.classList.remove('open');
        }
      });
    }

    if (nightToggle) {
      nightToggle.addEventListener('change', () => {
        this.setNightMode(nightToggle.checked);
      });
    }
  }

  setNightMode(enabled: boolean): void {
    this.nightMode = enabled;

    // Scene background and fog
    const bg = enabled ? this.nightBg : this.dayBg;
    const fogColor = enabled ? this.nightFog : this.dayFog;
    (this.scene.background as THREE.Color).copy(bg);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(fogColor);
      this.scene.fog.near = enabled ? 30 : 200;
      this.scene.fog.far = enabled ? 200 : 800;
    }

    // Adjust scene lights
    this.scene.traverse((child) => {
      if (child instanceof THREE.AmbientLight) {
        child.intensity = enabled ? 0.05 : 0.6;
      }
      if (child instanceof THREE.DirectionalLight) {
        child.intensity = enabled ? 0.08 : 1.5;
        child.color.setHex(enabled ? 0x4466aa : 0xfff4e6);
      }
      if (child instanceof THREE.HemisphereLight) {
        child.intensity = enabled ? 0.03 : 0.4;
      }
    });

    // Toggle vehicle headlights
    this.vehicle.setHeadlights(enabled);

    // Toggle pole lights
    this.refreshPoleLights();
  }

  /** Re-apply pole light state (call after new chunks load) */
  refreshPoleLights(): void {
    const on = this.nightMode;
    this.scene.traverse((child) => {
      if (!child.userData.poleLight) return;

      if (child instanceof THREE.PointLight) {
        child.intensity = on ? 3 : 0;
      }
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = on ? 1.5 : 0;
        mat.color.setHex(on ? 0xffcc66 : 0x332200);
      }
    });
  }

  isNightMode(): boolean {
    return this.nightMode;
  }
}
