import * as THREE from 'three';
import type { RoadSpline } from './RoadSpline';
import type { World } from '../../core/World';
import { RoadsideProps } from './RoadsideProps';

const SEGMENTS_PER_CHUNK = 40;
const TERRAIN_WIDTH = 60;

export class RoadChunk {
  readonly mesh: THREE.Group;
  readonly terrainMesh: THREE.Mesh;
  private readonly props: RoadsideProps;
  readonly tStart: number;
  readonly tEnd: number;

  constructor(
    spline: RoadSpline,
    tStart: number,
    tEnd: number,
    world: World,
  ) {
    this.tStart = tStart;
    this.tEnd = tEnd;
    this.mesh = new THREE.Group();

    // Generate road surface
    const roadMesh = this.createRoadMesh(spline);
    this.mesh.add(roadMesh);

    // Generate lane markings
    const markingsMesh = this.createMarkingsMesh(spline);
    this.mesh.add(markingsMesh);

    // Generate terrain strips
    this.terrainMesh = this.createTerrainMesh(spline);
    this.mesh.add(this.terrainMesh);

    // Generate roadside props (with physics colliders)
    this.props = new RoadsideProps(spline, tStart, tEnd, world);
    this.mesh.add(this.props.group);
  }

  private createRoadMesh(spline: RoadSpline): THREE.Mesh {
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= SEGMENTS_PER_CHUNK; i++) {
      const t = this.tStart + (this.tEnd - this.tStart) * (i / SEGMENTS_PER_CHUNK);
      const frame = spline.getFrenetFrame(Math.min(t, 1));
      const halfWidth = spline.getWidthAt(Math.min(t, 1)) / 2;

      // Left and right edge points
      const left = frame.position.clone().add(frame.binormal.clone().multiplyScalar(-halfWidth));
      const right = frame.position.clone().add(frame.binormal.clone().multiplyScalar(halfWidth));

      // Slight elevation above terrain
      left.y += 0.02;
      right.y += 0.02;

      vertices.push(left.x, left.y, left.z);
      vertices.push(right.x, right.y, right.z);

      const u = i / SEGMENTS_PER_CHUNK;
      uvs.push(0, u * 10);
      uvs.push(1, u * 10);

      if (i < SEGMENTS_PER_CHUNK) {
        const idx = i * 2;
        indices.push(idx, idx + 1, idx + 2);
        indices.push(idx + 1, idx + 3, idx + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9,
      metalness: 0.0,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  private createMarkingsMesh(spline: RoadSpline): THREE.Mesh {
    const vertices: number[] = [];
    const indices: number[] = [];

    const MARKING_WIDTH = 0.15;
    const DASH_LENGTH = 3;
    const GAP_LENGTH = 3;

    // Center line (dashed)
    let distAccum = 0;
    for (let i = 0; i <= SEGMENTS_PER_CHUNK; i++) {
      const t = this.tStart + (this.tEnd - this.tStart) * (i / SEGMENTS_PER_CHUNK);
      const frame = spline.getFrenetFrame(Math.min(t, 1));

      const left = frame.position.clone().add(frame.binormal.clone().multiplyScalar(-MARKING_WIDTH / 2));
      const right = frame.position.clone().add(frame.binormal.clone().multiplyScalar(MARKING_WIDTH / 2));
      left.y += 0.04;
      right.y += 0.04;

      vertices.push(left.x, left.y, left.z);
      vertices.push(right.x, right.y, right.z);

      if (i > 0) {
        const segLength = spline.totalLength * (this.tEnd - this.tStart) / SEGMENTS_PER_CHUNK;
        distAccum += segLength;
      }

      if (i < SEGMENTS_PER_CHUNK) {
        const cyclePos = distAccum % (DASH_LENGTH + GAP_LENGTH);
        if (cyclePos < DASH_LENGTH) {
          const idx = i * 2;
          indices.push(idx, idx + 1, idx + 2);
          indices.push(idx + 1, idx + 3, idx + 2);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      roughness: 0.6,
      emissive: 0xffcc00,
      emissiveIntensity: 0.1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  private createTerrainMesh(spline: RoadSpline): THREE.Mesh {
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= SEGMENTS_PER_CHUNK; i++) {
      const t = this.tStart + (this.tEnd - this.tStart) * (i / SEGMENTS_PER_CHUNK);
      const frame = spline.getFrenetFrame(Math.min(t, 1));
      const halfWidth = spline.getWidthAt(Math.min(t, 1)) / 2;

      // Left terrain strip
      const roadLeft = frame.position.clone().add(frame.binormal.clone().multiplyScalar(-halfWidth));
      const terrainLeft = frame.position.clone().add(frame.binormal.clone().multiplyScalar(-halfWidth - TERRAIN_WIDTH));

      // Right terrain strip
      const roadRight = frame.position.clone().add(frame.binormal.clone().multiplyScalar(halfWidth));
      const terrainRight = frame.position.clone().add(frame.binormal.clone().multiplyScalar(halfWidth + TERRAIN_WIDTH));

      // Lower terrain slightly
      terrainLeft.y -= 0.1;
      terrainRight.y -= 0.1;

      vertices.push(terrainLeft.x, terrainLeft.y, terrainLeft.z);
      vertices.push(roadLeft.x, roadLeft.y, roadLeft.z);
      vertices.push(roadRight.x, roadRight.y, roadRight.z);
      vertices.push(terrainRight.x, terrainRight.y, terrainRight.z);

      const u = i / SEGMENTS_PER_CHUNK;
      uvs.push(0, u * 5);
      uvs.push(0.3, u * 5);
      uvs.push(0.7, u * 5);
      uvs.push(1, u * 5);

      if (i < SEGMENTS_PER_CHUNK) {
        const idx = i * 4;
        // Left terrain
        indices.push(idx, idx + 1, idx + 4);
        indices.push(idx + 1, idx + 5, idx + 4);
        // Right terrain
        indices.push(idx + 2, idx + 3, idx + 6);
        indices.push(idx + 3, idx + 7, idx + 6);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0xc2956b,
      roughness: 1.0,
      metalness: 0.0,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  dispose(): void {
    this.props.dispose();
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
