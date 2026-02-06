import * as THREE from 'three';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import { FirstPersonCamera } from './FirstPersonCamera';
import { FreeLookCamera } from './FreeLookCamera';

export type CameraMode = 'third-person' | 'first-person';

export class CameraController {
  private mode: CameraMode = 'third-person';
  private freeLookActive = false;
  private readonly thirdPerson: ThirdPersonCamera;
  private readonly firstPerson: FirstPersonCamera;
  private readonly freeLook: FreeLookCamera;

  constructor() {
    this.thirdPerson = new ThirdPersonCamera();
    this.firstPerson = new FirstPersonCamera();
    this.freeLook = new FreeLookCamera();
  }

  /** Toggle between third-person and first-person (C key) */
  toggle(): void {
    if (this.freeLookActive) return; // ignore C while in free-look
    this.mode = this.mode === 'third-person' ? 'first-person' : 'third-person';
  }

  /** Toggle free-look on/off (K key) */
  toggleFreeLook(): void {
    this.freeLookActive = !this.freeLookActive;
  }

  isFreeLook(): boolean {
    return this.freeLookActive;
  }

  getMode(): CameraMode {
    return this.mode;
  }

  update(
    camera: THREE.PerspectiveCamera,
    targetPosition: THREE.Vector3,
    targetQuaternion: THREE.Quaternion,
    dt: number,
    mouseDX = 0,
    mouseDY = 0,
  ): void {
    if (this.freeLookActive) {
      this.freeLook.update(camera, targetPosition, targetQuaternion, dt, mouseDX, mouseDY);
      return;
    }

    switch (this.mode) {
      case 'third-person':
        this.thirdPerson.update(camera, targetPosition, targetQuaternion, dt);
        break;
      case 'first-person':
        this.firstPerson.update(camera, targetPosition, targetQuaternion, dt);
        break;
    }
  }

  initialize(position: THREE.Vector3, quaternion: THREE.Quaternion): void {
    this.thirdPerson.initialize(position, quaternion);
    this.freeLook.initialize(position, quaternion);
  }
}
