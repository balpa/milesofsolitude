import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { World } from '../../core/World';
import type { RoadConfig } from '../../types';
import { RoadSpline } from './RoadSpline';
import { RoadChunk } from './RoadChunk';

const CHUNK_COUNT = 20; // Total chunks to divide road into
const VISIBLE_AHEAD = 4; // Chunks ahead of vehicle to keep loaded
const VISIBLE_BEHIND = 2; // Chunks behind vehicle to keep loaded

export class RoadManager {
  private readonly world: World;
  private readonly spline: RoadSpline;
  private readonly chunks = new Map<number, RoadChunk>();
  private readonly colliders = new Map<number, RAPIER.Collider>();
  private currentChunkIndex = 0;

  constructor(world: World, config: RoadConfig) {
    this.world = world;
    this.spline = new RoadSpline(config.waypoints, config.defaultWidth);

    // Create road collider for the full length (static ground with road shape)
    this.createGroundCollider();

    // Initial chunk loading
    this.updateChunks(new THREE.Vector3(0, 0, 0));
  }

  private createGroundCollider(): void {
    // Large flat ground plane as base
    const groundDesc = this.world.rapier.ColliderDesc.cuboid(500, 0.1, 5000)
      .setTranslation(0, -0.1, 0)
      .setFriction(0.8);
    this.world.physicsWorld.createCollider(groundDesc);

    // Also create colliders for the road surface with better friction
    // We create a series of box colliders along the spline
    const segments = 200;
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const tNext = (i + 1) / segments;
      const p1 = this.spline.getPointAt(t);
      const p2 = this.spline.getPointAt(Math.min(tNext, 1));
      const width = this.spline.getWidthAt(t);

      const midPoint = p1.clone().add(p2).multiplyScalar(0.5);
      const direction = p2.clone().sub(p1);
      const length = direction.length();

      if (length < 0.01) continue;

      const angle = Math.atan2(direction.x, direction.z);

      const colliderDesc = this.world.rapier.ColliderDesc.cuboid(
        width / 2,
        0.15,
        length / 2,
      )
        .setTranslation(midPoint.x, midPoint.y - 0.05, midPoint.z)
        .setRotation(
          new this.world.rapier.Quaternion(
            0,
            Math.sin(angle / 2),
            0,
            Math.cos(angle / 2),
          ),
        )
        .setFriction(1.0);

      this.world.physicsWorld.createCollider(colliderDesc);
    }
  }

  updateChunks(vehiclePosition: THREE.Vector3): void {
    // Find closest point on spline
    const closestT = this.findClosestT(vehiclePosition);
    const chunkSize = 1 / CHUNK_COUNT;
    this.currentChunkIndex = Math.floor(closestT / chunkSize);

    // Determine which chunks should be visible
    const visibleSet = new Set<number>();
    for (let i = this.currentChunkIndex - VISIBLE_BEHIND; i <= this.currentChunkIndex + VISIBLE_AHEAD; i++) {
      if (i >= 0 && i < CHUNK_COUNT) {
        visibleSet.add(i);
      }
    }

    // Remove chunks that are no longer visible
    for (const [index, chunk] of this.chunks) {
      if (!visibleSet.has(index)) {
        this.world.scene.remove(chunk.mesh);
        chunk.dispose();
        this.chunks.delete(index);
      }
    }

    // Load new chunks
    for (const index of visibleSet) {
      if (!this.chunks.has(index)) {
        const tStart = index / CHUNK_COUNT;
        const tEnd = (index + 1) / CHUNK_COUNT;
        const chunk = new RoadChunk(this.spline, tStart, tEnd);
        this.chunks.set(index, chunk);
        this.world.scene.add(chunk.mesh);
      }
    }
  }

  private findClosestT(position: THREE.Vector3): number {
    // Coarse search
    let bestT = 0;
    let bestDist = Infinity;
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = this.spline.getPointAt(t);
      const dist = position.distanceToSquared(point);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
      }
    }
    return bestT;
  }

  getStartPosition(): THREE.Vector3 {
    const pos = this.spline.getPointAt(0);
    pos.y += 1.5;
    return pos;
  }

  getStartDirection(): THREE.Vector3 {
    return this.spline.getTangentAt(0);
  }

  getSpline(): RoadSpline {
    return this.spline;
  }
}
