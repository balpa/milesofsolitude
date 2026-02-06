import * as THREE from 'three';
import type { RoadWaypoint } from '../../types';

export class RoadSpline {
  private readonly curve: THREE.CatmullRomCurve3;
  private readonly widths: number[];
  private readonly defaultWidth: number;
  readonly totalLength: number;

  constructor(waypoints: RoadWaypoint[], defaultWidth: number) {
    this.defaultWidth = defaultWidth;
    const points = waypoints.map(
      (wp) => new THREE.Vector3(wp.position[0], wp.position[1], wp.position[2]),
    );

    this.curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    this.widths = waypoints.map((wp) => wp.width ?? defaultWidth);
    this.totalLength = this.curve.getLength();
  }

  getPointAt(t: number): THREE.Vector3 {
    return this.curve.getPointAt(t);
  }

  getTangentAt(t: number): THREE.Vector3 {
    return this.curve.getTangentAt(t);
  }

  getWidthAt(t: number): number {
    const index = t * (this.widths.length - 1);
    const i = Math.floor(index);
    const frac = index - i;
    const w0 = this.widths[i] ?? this.defaultWidth;
    const w1 = this.widths[Math.min(i + 1, this.widths.length - 1)] ?? this.defaultWidth;
    return w0 + (w1 - w0) * frac;
  }

  getFrenetFrame(t: number): { position: THREE.Vector3; tangent: THREE.Vector3; normal: THREE.Vector3; binormal: THREE.Vector3 } {
    const position = this.getPointAt(t);
    const tangent = this.getTangentAt(t).normalize();

    // Use world up to compute initial normal
    const worldUp = new THREE.Vector3(0, 1, 0);
    const binormal = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
    const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

    return { position, tangent, normal, binormal };
  }

  getPointsInRange(tStart: number, tEnd: number, segments: number): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = tStart + (tEnd - tStart) * (i / segments);
      points.push(this.getPointAt(Math.min(t, 1)));
    }
    return points;
  }
}
