import * as THREE from 'three';
import { clamp } from '../../utils/math';

export class FreeLookCamera {
  private yaw = 0;     // horizontal angle (radians)
  private pitch = 0.3;  // vertical angle (radians), slight downward look
  private distance = 10;
  private readonly sensitivity = 0.003;
  private readonly minPitch = -0.2;   // don't look too far below
  private readonly maxPitch = 1.2;    // don't flip over the top
  private readonly minDistance = 3;
  private readonly maxDistance = 25;

  update(
    camera: THREE.PerspectiveCamera,
    targetPosition: THREE.Vector3,
    _targetQuaternion: THREE.Quaternion,
    _dt: number,
    mouseDX: number,
    mouseDY: number,
  ): void {
    // Apply mouse input to yaw/pitch
    this.yaw -= mouseDX * this.sensitivity;
    this.pitch += mouseDY * this.sensitivity;
    this.pitch = clamp(this.pitch, this.minPitch, this.maxPitch);

    // Convert spherical coordinates to camera offset
    const x = this.distance * Math.sin(this.yaw) * Math.cos(this.pitch);
    const y = this.distance * Math.sin(this.pitch);
    const z = this.distance * Math.cos(this.yaw) * Math.cos(this.pitch);

    camera.position.set(
      targetPosition.x + x,
      targetPosition.y + y + 1.5, // slight elevation above vehicle center
      targetPosition.z + z,
    );

    // Look at the vehicle
    camera.lookAt(
      targetPosition.x,
      targetPosition.y + 0.5,
      targetPosition.z,
    );
  }

  initialize(position: THREE.Vector3, quaternion: THREE.Quaternion): void {
    // Set initial yaw based on vehicle facing (look from behind)
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    this.yaw = Math.atan2(-forward.x, -forward.z);
    this.pitch = 0.3;
  }

  setDistance(distance: number): void {
    this.distance = clamp(distance, this.minDistance, this.maxDistance);
  }
}
