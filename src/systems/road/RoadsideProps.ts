import * as THREE from 'three';
import type { RoadSpline } from './RoadSpline';

const PROP_DENSITY = 0.003; // Props per meter of road
const MIN_ROAD_OFFSET = 8; // Minimum distance from road center
const MAX_ROAD_OFFSET = 45; // Maximum distance from road center

export class RoadsideProps {
  readonly group: THREE.Group;

  constructor(spline: RoadSpline, tStart: number, tEnd: number) {
    this.group = new THREE.Group();
    this.generateProps(spline, tStart, tEnd);
  }

  private generateProps(spline: RoadSpline, tStart: number, tEnd: number): void {
    const chunkLength = spline.totalLength * (tEnd - tStart);
    const propCount = Math.floor(chunkLength * PROP_DENSITY);

    // Seeded random for consistent prop placement
    const seed = Math.floor(tStart * 10000);
    let rng = seed;
    const random = () => {
      rng = (rng * 16807 + 0) % 2147483647;
      return rng / 2147483647;
    };

    for (let i = 0; i < propCount; i++) {
      const t = tStart + (tEnd - tStart) * random();
      const frame = spline.getFrenetFrame(Math.min(t, 1));

      // Random side (-1 or 1) and distance from road
      const side = random() > 0.5 ? 1 : -1;
      const offset = MIN_ROAD_OFFSET + random() * (MAX_ROAD_OFFSET - MIN_ROAD_OFFSET);

      const position = frame.position.clone().add(
        frame.binormal.clone().multiplyScalar(side * offset),
      );

      const propType = random();
      let prop: THREE.Object3D;

      if (propType < 0.3) {
        prop = this.createCactus(random);
      } else if (propType < 0.6) {
        prop = this.createRock(random);
      } else if (propType < 0.8) {
        prop = this.createBush(random);
      } else {
        prop = this.createGrass(random);
      }

      prop.position.copy(position);
      prop.rotation.y = random() * Math.PI * 2;
      this.group.add(prop);
    }

    // Mile markers
    const markerInterval = 0.02; // Every ~2% of road = ~100m
    for (let t = tStart; t < tEnd; t += markerInterval) {
      if (t < 0 || t > 1) continue;
      const frame = spline.getFrenetFrame(Math.min(t, 1));
      const marker = this.createMileMarker(Math.round(t * spline.totalLength));
      const pos = frame.position.clone().add(
        frame.binormal.clone().multiplyScalar(6),
      );
      marker.position.copy(pos);
      marker.lookAt(frame.position);
      this.group.add(marker);
    }
  }

  private createCactus(random: () => number): THREE.Group {
    const cactus = new THREE.Group();
    const height = 1.5 + random() * 2.5;
    const material = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.9,
    });

    // Main trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, height, 6),
      material,
    );
    trunk.position.y = height / 2;
    trunk.castShadow = true;
    cactus.add(trunk);

    // Arms
    if (random() > 0.3) {
      const armHeight = height * (0.3 + random() * 0.4);
      const armLength = 0.4 + random() * 0.6;
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, armLength, 5),
        material,
      );
      arm.position.set(0.3, armHeight, 0);
      arm.rotation.z = -Math.PI / 3;
      arm.castShadow = true;
      cactus.add(arm);

      // Arm tip going up
      const tip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, armLength * 0.7, 5),
        material,
      );
      tip.position.set(0.55, armHeight + armLength * 0.3, 0);
      tip.castShadow = true;
      cactus.add(tip);
    }

    return cactus;
  }

  private createRock(random: () => number): THREE.Mesh {
    const scale = 0.3 + random() * 1.2;
    const geometry = new THREE.DodecahedronGeometry(scale, 0);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.45 + random() * 0.1, 0.38 + random() * 0.1, 0.3 + random() * 0.1),
      roughness: 1.0,
      metalness: 0.0,
    });
    const rock = new THREE.Mesh(geometry, material);
    rock.scale.set(1, 0.5 + random() * 0.5, 1 + random() * 0.3);
    rock.position.y = scale * 0.3;
    rock.castShadow = true;
    rock.receiveShadow = true;
    return rock;
  }

  private createBush(random: () => number): THREE.Mesh {
    const scale = 0.5 + random() * 1.0;
    const geometry = new THREE.SphereGeometry(scale, 6, 4);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.2 + random() * 0.15, 0.3 + random() * 0.2, 0.1),
      roughness: 1.0,
    });
    const bush = new THREE.Mesh(geometry, material);
    bush.scale.set(1, 0.6, 1);
    bush.position.y = scale * 0.4;
    bush.castShadow = true;
    return bush;
  }

  private createGrass(_random: () => number): THREE.Group {
    const grass = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: 0x8b7d3c,
      roughness: 1.0,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(
        new THREE.PlaneGeometry(0.1, 0.4 + Math.random() * 0.3),
        material,
      );
      blade.position.set(
        (Math.random() - 0.5) * 0.3,
        0.2,
        (Math.random() - 0.5) * 0.3,
      );
      blade.rotation.y = Math.random() * Math.PI;
      grass.add(blade);
    }

    return grass;
  }

  private createMileMarker(distance: number): THREE.Group {
    const marker = new THREE.Group();

    // Post
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.2, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x8b4513 }),
    );
    post.position.y = 0.6;
    marker.add(post);

    // Sign
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.4, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x336633 }),
    );
    sign.position.y = 1.1;
    marker.add(sign);

    return marker;
  }

  dispose(): void {
    this.group.traverse((child) => {
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
