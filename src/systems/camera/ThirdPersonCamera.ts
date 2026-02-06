import * as THREE from 'three';
import { smoothDamp } from '../../utils/math';

export class ThirdPersonCamera {
  private readonly offset = new THREE.Vector3(0, 4, -9);
  private readonly lookAtOffset = new THREE.Vector3(0, 1, 5);
  private currentPosition = new THREE.Vector3();
  private velocityX = { value: 0 };
  private velocityY = { value: 0 };
  private velocityZ = { value: 0 };
  private smoothTime = 0.15;

  update(
    camera: THREE.PerspectiveCamera,
    targetPosition: THREE.Vector3,
    targetQuaternion: THREE.Quaternion,
    _dt: number,
  ): void {
    // Calculate desired camera position in world space
    const desiredPosition = this.offset.clone().applyQuaternion(targetQuaternion).add(targetPosition);

    // Smooth damp camera position
    this.currentPosition.x = smoothDamp(
      this.currentPosition.x, desiredPosition.x, this.velocityX, this.smoothTime, _dt,
    );
    this.currentPosition.y = smoothDamp(
      this.currentPosition.y, desiredPosition.y, this.velocityY, this.smoothTime, _dt,
    );
    this.currentPosition.z = smoothDamp(
      this.currentPosition.z, desiredPosition.z, this.velocityZ, this.smoothTime, _dt,
    );

    camera.position.copy(this.currentPosition);

    // Look at point ahead of vehicle
    const lookAtPoint = this.lookAtOffset
      .clone()
      .applyQuaternion(targetQuaternion)
      .add(targetPosition);
    camera.lookAt(lookAtPoint);
  }

  initialize(position: THREE.Vector3, quaternion: THREE.Quaternion): void {
    this.currentPosition = this.offset.clone().applyQuaternion(quaternion).add(position);
  }
}
