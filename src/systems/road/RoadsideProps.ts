import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { RoadSpline } from './RoadSpline';
import type { World } from '../../core/World';

const PROP_DENSITY = 0.005;
const MIN_ROAD_OFFSET = 8;
const MAX_ROAD_OFFSET = 50;
const BUILDING_MIN_OFFSET = 15;
const BUILDING_MAX_OFFSET = 35;
const MOUNTAIN_OFFSET = 120;

export class RoadsideProps {
  readonly group: THREE.Group;
  private readonly colliders: RAPIER.Collider[] = [];
  private readonly world: World | null;

  constructor(spline: RoadSpline, tStart: number, tEnd: number, world: World | null = null) {
    this.world = world;
    this.group = new THREE.Group();
    this.generate(spline, tStart, tEnd);
  }

  private addPropCollider(
    pos: THREE.Vector3, hx: number, hy: number, hz: number, yOffset: number, rotY = 0,
  ): void {
    if (!this.world) return;
    const desc = this.world.rapier.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(pos.x, pos.y + yOffset, pos.z);
    if (rotY !== 0) {
      desc.setRotation(
        new this.world.rapier.Quaternion(0, Math.sin(rotY / 2), 0, Math.cos(rotY / 2)),
      );
    }
    const collider = this.world.physicsWorld.createCollider(desc);
    this.colliders.push(collider);
  }

  private generate(spline: RoadSpline, tStart: number, tEnd: number): void {
    const seed = Math.floor(tStart * 10000);
    let rng = seed;
    const random = () => {
      rng = (rng * 16807 + 0) % 2147483647;
      return rng / 2147483647;
    };

    const chunkLength = spline.totalLength * (tEnd - tStart);

    // --- Natural props (cacti, rocks, bushes, dead trees, tumbleweeds) ---
    const naturalCount = Math.floor(chunkLength * PROP_DENSITY);
    for (let i = 0; i < naturalCount; i++) {
      const t = tStart + (tEnd - tStart) * random();
      const frame = spline.getFrenetFrame(Math.min(t, 1));
      const side = random() > 0.5 ? 1 : -1;
      const offset = MIN_ROAD_OFFSET + random() * (MAX_ROAD_OFFSET - MIN_ROAD_OFFSET);
      const position = frame.position.clone().add(
        frame.binormal.clone().multiplyScalar(side * offset),
      );

      const roll = random();
      let prop: THREE.Object3D;
      if (roll < 0.2) {
        prop = this.createCactus(random);
      } else if (roll < 0.35) {
        prop = this.createRock(random);
      } else if (roll < 0.5) {
        prop = this.createBush(random);
      } else if (roll < 0.7) {
        prop = this.createDeadTree(random);
      } else if (roll < 0.85) {
        prop = this.createJoshuaTree(random);
      } else {
        prop = this.createTumbleweed(random);
      }

      prop.position.copy(position);
      prop.rotation.y = random() * Math.PI * 2;
      this.group.add(prop);

      const cs = prop.userData.colliderSize as
        { hx: number; hy: number; hz: number; yOffset: number } | undefined;
      if (cs) this.addPropCollider(position, cs.hx, cs.hy, cs.hz, cs.yOffset);
    }

    // --- Buildings (gas stations, motels, diners, abandoned structures) ---
    const buildingInterval = 0.015 + random() * 0.01;
    for (let t = tStart + random() * buildingInterval; t < tEnd; t += buildingInterval + random() * 0.02) {
      if (t > 1) break;
      const frame = spline.getFrenetFrame(Math.min(t, 1));
      const side = random() > 0.5 ? 1 : -1;
      const offset = BUILDING_MIN_OFFSET + random() * (BUILDING_MAX_OFFSET - BUILDING_MIN_OFFSET);
      const position = frame.position.clone().add(
        frame.binormal.clone().multiplyScalar(side * offset),
      );

      const buildRoll = random();
      let building: THREE.Object3D;
      if (buildRoll < 0.3) {
        building = this.createGasStation(random);
      } else if (buildRoll < 0.55) {
        building = this.createMotel(random);
      } else if (buildRoll < 0.75) {
        building = this.createDiner(random);
      } else {
        building = this.createAbandonedHouse(random);
      }

      building.position.copy(position);
      building.lookAt(frame.position);
      building.rotation.y += (random() - 0.5) * 0.3;
      this.group.add(building);

      const bcs = building.userData.colliderSize as
        { hx: number; hy: number; hz: number; yOffset: number } | undefined;
      if (bcs) this.addPropCollider(position, bcs.hx, bcs.hy, bcs.hz, bcs.yOffset, building.rotation.y);
    }

    // --- Mountains/hills in the distance ---
    const mountainCount = 3 + Math.floor(random() * 3);
    for (let i = 0; i < mountainCount; i++) {
      const t = tStart + (tEnd - tStart) * (i / mountainCount + random() * 0.1);
      if (t > 1) break;
      const frame = spline.getFrenetFrame(Math.min(t, 1));
      const side = random() > 0.5 ? 1 : -1;
      const dist = MOUNTAIN_OFFSET + random() * 180;
      const position = frame.position.clone().add(
        frame.binormal.clone().multiplyScalar(side * dist),
      );

      const mountain = this.createMountain(random);
      mountain.position.copy(position);
      this.group.add(mountain);
    }

    // --- Mile markers ---
    const markerInterval = 0.02;
    for (let t = tStart; t < tEnd; t += markerInterval) {
      if (t < 0 || t > 1) continue;
      const frame = spline.getFrenetFrame(Math.min(t, 1));
      const marker = this.createMileMarker();
      const pos = frame.position.clone().add(
        frame.binormal.clone().multiplyScalar(6),
      );
      marker.position.copy(pos);
      marker.lookAt(frame.position);
      this.group.add(marker);
    }

    // --- Telephone poles ---
    const poleInterval = 0.008;
    let poleIndex = 0;
    for (let t = tStart; t < tEnd; t += poleInterval) {
      if (t < 0 || t > 1) continue;
      const frame = spline.getFrenetFrame(Math.min(t, 1));
      const addLight = poleIndex % 3 === 0;
      const pole = this.createTelephonePole(addLight);
      const pos = frame.position.clone().add(
        frame.binormal.clone().multiplyScalar(-7),
      );
      pole.position.copy(pos);
      pole.lookAt(
        frame.position.clone().add(frame.tangent.clone().multiplyScalar(10)),
      );
      pole.rotation.x = 0;
      pole.rotation.z = 0;
      this.group.add(pole);
      this.addPropCollider(pos, 0.15, 3.5, 0.15, 3.5);
      poleIndex++;
    }
  }

  // ===== Natural Props =====

  private createCactus(random: () => number): THREE.Group {
    const cactus = new THREE.Group();
    const height = 1.5 + random() * 2.5;
    const mat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.9 });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, height, 6), mat);
    trunk.position.y = height / 2;
    trunk.castShadow = true;
    cactus.add(trunk);

    if (random() > 0.3) {
      const armH = height * (0.3 + random() * 0.4);
      const armL = 0.4 + random() * 0.6;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, armL, 5), mat);
      arm.position.set(0.3, armH, 0);
      arm.rotation.z = -Math.PI / 3;
      arm.castShadow = true;
      cactus.add(arm);

      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, armL * 0.7, 5), mat);
      tip.position.set(0.55, armH + armL * 0.3, 0);
      tip.castShadow = true;
      cactus.add(tip);
    }
    if (random() > 0.5) {
      const armH = height * (0.5 + random() * 0.3);
      const armL = 0.3 + random() * 0.5;
      const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, armL, 5), mat);
      arm2.position.set(-0.25, armH, 0);
      arm2.rotation.z = Math.PI / 3;
      arm2.castShadow = true;
      cactus.add(arm2);
    }
    cactus.userData.colliderSize = { hx: 0.3, hy: height / 2, hz: 0.3, yOffset: height / 2 };
    return cactus;
  }

  private createRock(random: () => number): THREE.Mesh {
    const scale = 0.3 + random() * 1.5;
    const geo = new THREE.DodecahedronGeometry(scale, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.45 + random() * 0.1, 0.38 + random() * 0.1, 0.3 + random() * 0.1),
      roughness: 1.0,
    });
    const rock = new THREE.Mesh(geo, mat);
    rock.scale.set(1 + random() * 0.4, 0.4 + random() * 0.5, 1 + random() * 0.3);
    rock.position.y = scale * 0.25;
    rock.castShadow = true;
    rock.receiveShadow = true;
    rock.userData.colliderSize = { hx: scale * 0.6, hy: scale * 0.35, hz: scale * 0.6, yOffset: scale * 0.25 };
    return rock;
  }

  private createBush(random: () => number): THREE.Group {
    const bush = new THREE.Group();
    const count = 2 + Math.floor(random() * 3);
    for (let i = 0; i < count; i++) {
      const s = 0.3 + random() * 0.7;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.15 + random() * 0.2, 0.25 + random() * 0.2, 0.05 + random() * 0.1),
        roughness: 1.0,
      });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(s, 6, 4), mat);
      sphere.scale.set(1, 0.6, 1);
      sphere.position.set((random() - 0.5) * 0.8, s * 0.35, (random() - 0.5) * 0.8);
      sphere.castShadow = true;
      bush.add(sphere);
    }
    bush.userData.colliderSize = { hx: 0.6, hy: 0.4, hz: 0.6, yOffset: 0.3 };
    return bush;
  }

  private createDeadTree(random: () => number): THREE.Group {
    const tree = new THREE.Group();
    const height = 3 + random() * 4;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 1.0 });

    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.2, height, 5),
      trunkMat,
    );
    trunk.position.y = height / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    // Bare branches
    const branchCount = 3 + Math.floor(random() * 3);
    for (let i = 0; i < branchCount; i++) {
      const bLen = 0.8 + random() * 1.5;
      const bY = height * (0.4 + random() * 0.5);
      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.06, bLen, 4),
        trunkMat,
      );
      const angle = random() * Math.PI * 2;
      branch.position.set(
        Math.cos(angle) * 0.3,
        bY,
        Math.sin(angle) * 0.3,
      );
      branch.rotation.z = (random() - 0.5) * 1.2;
      branch.rotation.x = (random() - 0.5) * 0.5;
      branch.castShadow = true;
      tree.add(branch);
    }
    tree.userData.colliderSize = { hx: 0.25, hy: height / 2, hz: 0.25, yOffset: height / 2 };
    return tree;
  }

  private createJoshuaTree(random: () => number): THREE.Group {
    const tree = new THREE.Group();
    const height = 3 + random() * 3;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b5b3a, roughness: 1.0 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a6b2a, roughness: 0.9 });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, height, 5), trunkMat);
    trunk.position.y = height / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    // Spiky leaf clusters at top and branch ends
    const clusterCount = 2 + Math.floor(random() * 3);
    for (let i = 0; i < clusterCount; i++) {
      const cluster = new THREE.Mesh(
        new THREE.SphereGeometry(0.5 + random() * 0.4, 6, 4),
        leafMat,
      );
      cluster.scale.set(1, 0.7, 1);
      const bAngle = random() * Math.PI * 2;
      const bDist = i === 0 ? 0 : 0.4 + random() * 0.5;
      cluster.position.set(
        Math.cos(bAngle) * bDist,
        height * (0.75 + random() * 0.2),
        Math.sin(bAngle) * bDist,
      );
      cluster.castShadow = true;
      tree.add(cluster);
    }
    tree.userData.colliderSize = { hx: 0.3, hy: height / 2, hz: 0.3, yOffset: height / 2 };
    return tree;
  }

  private createTumbleweed(_random: () => number): THREE.Mesh {
    const size = 0.3 + Math.random() * 0.5;
    const geo = new THREE.IcosahedronGeometry(size, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8b7355,
      roughness: 1.0,
      wireframe: true,
    });
    const tw = new THREE.Mesh(geo, mat);
    tw.position.y = size;
    return tw;
  }

  // ===== Buildings =====

  private createGasStation(random: () => number): THREE.Group {
    const station = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.85, 0.82, 0.75),
      roughness: 0.9,
    });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.8 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 });

    // Main building
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), wallMat);
    body.position.y = 1.5;
    body.castShadow = true;
    body.receiveShadow = true;
    station.add(body);

    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.3, 4.4), roofMat);
    roof.position.y = 3.15;
    roof.castShadow = true;
    station.add(roof);

    // Canopy over pumps
    const canopyPosts: [number, number][] = [[-3, -2.5], [-3, 2.5], [3, -2.5], [3, 2.5]];
    for (const [px, pz] of canopyPosts) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 3.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x888888 }),
      );
      post.position.set(px, 1.75, pz);
      station.add(post);
    }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(7, 0.15, 6), canopyMat);
    canopy.position.set(0, 3.5, 0);
    canopy.castShadow = true;
    station.add(canopy);

    // Gas pumps
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 });
    for (let i = -1; i <= 1; i += 2) {
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.5, 0.4), pumpMat);
      pump.position.set(0, 0.75, i * 1.5);
      pump.castShadow = true;
      station.add(pump);
    }

    // Sign pole
    if (random() > 0.3) {
      const signPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 5, 6),
        new THREE.MeshStandardMaterial({ color: 0x666666 }),
      );
      signPole.position.set(4, 2.5, 0);
      station.add(signPole);

      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(2, 1, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x224488, emissive: 0x112244, emissiveIntensity: 0.2 }),
      );
      sign.position.set(4, 5, 0);
      station.add(sign);
    }

    station.userData.colliderSize = { hx: 3.5, hy: 2, hz: 3, yOffset: 2 };
    return station;
  }

  private createMotel(random: () => number): THREE.Group {
    const motel = new THREE.Group();
    const roomCount = 3 + Math.floor(random() * 4);
    const wallColor = new THREE.Color(
      0.75 + random() * 0.15,
      0.65 + random() * 0.15,
      0.55 + random() * 0.15,
    );
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x553322, roughness: 0.9 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 });

    const totalWidth = roomCount * 3.5;

    // Building body
    const body = new THREE.Mesh(new THREE.BoxGeometry(totalWidth, 3, 5), wallMat);
    body.position.y = 1.5;
    body.castShadow = true;
    body.receiveShadow = true;
    motel.add(body);

    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(totalWidth + 0.5, 0.3, 5.6), roofMat);
    roof.position.y = 3.15;
    roof.castShadow = true;
    motel.add(roof);

    // Doors
    for (let i = 0; i < roomCount; i++) {
      const x = -totalWidth / 2 + 1.75 + i * 3.5;
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.1), doorMat);
      door.position.set(x, 0.9, 2.55);
      motel.add(door);

      // Window next to door
      const window_ = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.7, 0.1),
        new THREE.MeshStandardMaterial({
          color: 0x88aacc,
          emissive: 0x445566,
          emissiveIntensity: random() > 0.5 ? 0.3 : 0,
        }),
      );
      window_.position.set(x + 1.2, 1.6, 2.55);
      motel.add(window_);
    }

    // Overhang walkway
    const overhang = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth + 1, 0.1, 2),
      new THREE.MeshStandardMaterial({ color: 0x888888 }),
    );
    overhang.position.set(0, 2.8, 3.5);
    motel.add(overhang);

    // Overhang posts
    for (let i = 0; i <= roomCount; i++) {
      const x = -totalWidth / 2 + i * 3.5;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6),
        new THREE.MeshStandardMaterial({ color: 0x666666 }),
      );
      post.position.set(x, 1.4, 4.5);
      motel.add(post);
    }

    motel.userData.colliderSize = { hx: totalWidth / 2 + 0.5, hy: 1.5, hz: 3, yOffset: 1.5 };
    return motel;
  }

  private createDiner(random: () => number): THREE.Group {
    const diner = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.9, 0.85, 0.8),
      roughness: 0.7,
      metalness: 0.1,
    });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.5 });

    // Main body (rounded diner shape approximated with boxes)
    const body = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 5), wallMat);
    body.position.y = 1.5;
    body.castShadow = true;
    body.receiveShadow = true;
    diner.add(body);

    // Curved roof
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 8.5, 12, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.4, roughness: 0.3 }),
    );
    roof.rotation.z = Math.PI / 2;
    roof.position.y = 3;
    roof.castShadow = true;
    diner.add(roof);

    // Accent stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.3, 5.1), accentMat);
    stripe.position.y = 1.0;
    diner.add(stripe);

    // Large windows
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x88ccee,
      emissive: 0x446688,
      emissiveIntensity: 0.2,
      metalness: 0.3,
    });
    for (let i = -2; i <= 2; i++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.1), windowMat);
      win.position.set(i * 1.5, 1.8, 2.55);
      diner.add(win);
    }

    // Neon sign
    if (random() > 0.2) {
      const signMat = new THREE.MeshStandardMaterial({
        color: 0xff4444,
        emissive: 0xff2222,
        emissiveIntensity: 0.5,
      });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.1), signMat);
      sign.position.set(0, 4.5, 2.5);
      diner.add(sign);
    }

    diner.userData.colliderSize = { hx: 4.5, hy: 2, hz: 3, yOffset: 2 };
    return diner;
  }

  private createAbandonedHouse(random: () => number): THREE.Group {
    const house = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.5 + random() * 0.15, 0.45 + random() * 0.1, 0.35 + random() * 0.1),
      roughness: 1.0,
    });

    // Walls
    const width = 4 + random() * 3;
    const height = 2.5 + random() * 1.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, 4), wallMat);
    body.position.y = height / 2;
    body.rotation.y = (random() - 0.5) * 0.1; // Slight lean
    body.castShadow = true;
    body.receiveShadow = true;
    house.add(body);

    // Roof (angled)
    const roofGeo = new THREE.BoxGeometry(width + 0.5, 0.2, 5);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1.0 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = height + 0.1;
    roof.rotation.x = (random() - 0.5) * 0.1;
    roof.castShadow = true;
    house.add(roof);

    // Boarded windows
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1.0 });
    for (let i = -1; i <= 1; i += 2) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.08), boardMat);
      board.position.set(i * width * 0.3, height * 0.6, 2.05);
      board.rotation.z = (random() - 0.5) * 0.3;
      house.add(board);
    }

    house.userData.colliderSize = { hx: width / 2 + 0.5, hy: height / 2, hz: 2.5, yOffset: height / 2 };
    return house;
  }

  // ===== Mountains =====

  private createMountain(random: () => number): THREE.Group {
    const mountain = new THREE.Group();

    // Main peak
    const height = 30 + random() * 60;
    const radius = 40 + random() * 50;
    const peakGeo = new THREE.ConeGeometry(radius, height, 8 + Math.floor(random() * 6), 1);
    const peakMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(
        0.45 + random() * 0.15,
        0.35 + random() * 0.1,
        0.25 + random() * 0.1,
      ),
      roughness: 1.0,
      flatShading: true,
    });

    // Displace vertices for natural look
    const positions = peakGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      if (y < height / 2 - 1) { // Don't displace tip
        const noise = (random() - 0.5) * radius * 0.25;
        positions.setX(i, x + noise);
        positions.setZ(i, z + noise);
      }
    }
    peakGeo.computeVertexNormals();

    const peak = new THREE.Mesh(peakGeo, peakMat);
    peak.position.y = height / 2;
    peak.receiveShadow = true;
    mountain.add(peak);

    // Secondary smaller peaks
    const secondaryCount = 1 + Math.floor(random() * 3);
    for (let i = 0; i < secondaryCount; i++) {
      const sH = height * (0.3 + random() * 0.4);
      const sR = radius * (0.3 + random() * 0.4);
      const sMat = new THREE.MeshStandardMaterial({
        color: peakMat.color.clone().offsetHSL(0, 0, (random() - 0.5) * 0.1),
        roughness: 1.0,
        flatShading: true,
      });
      const sPeak = new THREE.Mesh(new THREE.ConeGeometry(sR, sH, 6, 1), sMat);
      sPeak.position.set(
        (random() - 0.5) * radius * 1.2,
        sH / 2,
        (random() - 0.5) * radius * 0.8,
      );
      sPeak.receiveShadow = true;
      mountain.add(sPeak);
    }

    return mountain;
  }

  // ===== Infrastructure =====

  private createMileMarker(): THREE.Group {
    const marker = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.2, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x8b4513 }),
    );
    post.position.y = 0.6;
    marker.add(post);

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.4, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x336633 }),
    );
    sign.position.y = 1.1;
    marker.add(sign);
    return marker;
  }

  private createTelephonePole(addLight = false): THREE.Group {
    const pole = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b5b3a, roughness: 1.0 });

    // Main pole
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 6), woodMat);
    post.position.y = 3.5;
    post.castShadow = true;
    pole.add(post);

    // Crossbar
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.08), woodMat);
    crossbar.position.y = 6.8;
    pole.add(crossbar);

    // Insulators
    const insulator = new THREE.MeshStandardMaterial({ color: 0x557788 });
    for (const x of [-0.8, -0.4, 0, 0.4, 0.8]) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.15, 5), insulator);
      ins.position.set(x, 6.9, 0);
      pole.add(ins);
    }

    // Light bulb on pole (emissive sphere, off by default)
    const bulbGeo = new THREE.SphereGeometry(0.1, 6, 6);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0x332200,
      emissive: 0xffcc66,
      emissiveIntensity: 0,
    });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(0, 6.5, 0.3);
    bulb.userData.poleLight = true;
    pole.add(bulb);

    // Actual PointLight on every 3rd pole (off by default)
    if (addLight) {
      const pointLight = new THREE.PointLight(0xffcc66, 0, 18, 2);
      pointLight.position.set(0, 6.5, 0.3);
      pointLight.userData.poleLight = true;
      pole.add(pointLight);
    }

    pole.userData.colliderSize = { hx: 0.15, hy: 3.5, hz: 0.15, yOffset: 3.5 };
    return pole;
  }

  dispose(): void {
    if (this.world) {
      for (const collider of this.colliders) {
        this.world.physicsWorld.removeCollider(collider, false);
      }
    }
    this.colliders.length = 0;
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
