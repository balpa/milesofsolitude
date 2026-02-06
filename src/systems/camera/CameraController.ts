import * as THREE from 'three';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import { FirstPersonCamera } from './FirstPersonCamera';

export type CameraMode = 'third-person' | 'first-person';

export class CameraController {
  private mode: CameraMode = 'third-person';
  private readonly thirdPerson: ThirdPersonCamera;
  private readonly firstPerson: FirstPersonCamera;

  constructor() {
    this.thirdPerson = new ThirdPersonCamera();
    this.firstPerson = new FirstPersonCamera();
  }

  toggle(): void {
    this.mode = this.mode === 'third-person' ? 'first-person' : 'third-person';
  }

  getMode(): CameraMode {
    return this.mode;
  }

  update(
    camera: THREE.PerspectiveCamera,
    targetPosition: THREE.Vector3,
    targetQuaternion: THREE.Quaternion,
    dt: number,
  ): void {
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
  }
}
