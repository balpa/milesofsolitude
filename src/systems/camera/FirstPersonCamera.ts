import * as THREE from 'three';

export class FirstPersonCamera {
  private readonly seatOffset = new THREE.Vector3(0, 1.0, 0.5);

  update(
    camera: THREE.PerspectiveCamera,
    targetPosition: THREE.Vector3,
    targetQuaternion: THREE.Quaternion,
    _dt: number,
  ): void {
    const camPos = this.seatOffset.clone().applyQuaternion(targetQuaternion).add(targetPosition);
    camera.position.copy(camPos);

    // Look forward from vehicle orientation
    const forward = new THREE.Vector3(0, 0.3, 10);
    forward.applyQuaternion(targetQuaternion).add(targetPosition);
    camera.lookAt(forward);
  }
}
