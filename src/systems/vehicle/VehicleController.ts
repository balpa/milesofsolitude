import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { World } from '../../core/World';
import type { VehicleConfig, VehicleState, InputState } from '../../types';
import { EngineSimulation } from './EngineSimulation';
import { Transmission } from './Transmission';
import { FuelSystem } from './FuelSystem';
import { lerp } from '../../utils/math';
import { MS_TO_KMH, RAD_S_TO_RPM } from '../../utils/constants';

export class VehicleController {
  private readonly world: World;
  private readonly config: VehicleConfig;
  private readonly engine: EngineSimulation;
  private readonly transmission: Transmission;
  private readonly fuel: FuelSystem;

  private chassisBody!: RAPIER.RigidBody;
  private vehicleController!: RAPIER.DynamicRayCastVehicleController;

  readonly chassisMesh: THREE.Group;
  private readonly wheelMeshes: THREE.Mesh[] = [];

  private currentSteering = 0;

  constructor(world: World, config: VehicleConfig) {
    this.world = world;
    this.config = config;
    this.engine = new EngineSimulation(config.engine);
    this.transmission = new Transmission(config.transmission);
    this.fuel = new FuelSystem(config.fuel);
    this.chassisMesh = new THREE.Group();

    this.createPhysicsBody();
    this.createVisuals();
  }

  private createPhysicsBody(): void {
    const rapier = this.world.rapier;
    const physics = this.world.physicsWorld;
    const { chassis, wheels } = this.config;

    // Chassis rigid body
    const bodyDesc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(0, 2, 0)
      .setCanSleep(false);
    this.chassisBody = physics.createRigidBody(bodyDesc);

    // Chassis collider
    const colliderDesc = rapier.ColliderDesc.cuboid(
      chassis.width / 2,
      chassis.height / 2,
      chassis.length / 2,
    ).setMass(chassis.mass)
     .setFriction(0.5);
    physics.createCollider(colliderDesc, this.chassisBody);

    // Vehicle controller
    this.vehicleController = physics.createVehicleController(this.chassisBody);

    // Add wheels
    for (let i = 0; i < wheels.positions.length; i++) {
      const [x, y, z] = wheels.positions[i];

      this.vehicleController.addWheel(
        new this.world.rapier.Vector3(x, y, z),    // position
        new this.world.rapier.Vector3(0, -1, 0),    // suspension direction (down)
        new this.world.rapier.Vector3(-1, 0, 0),    // axle direction
        wheels.suspensionRestLength,
        wheels.radius,
      );

      this.vehicleController.setWheelSuspensionStiffness(i, wheels.suspensionStiffness);
      this.vehicleController.setWheelMaxSuspensionTravel(i, wheels.maxSuspensionTravel);
      this.vehicleController.setWheelFrictionSlip(i, wheels.frictionSlip);

      // Suspension damping
      const dampingRelaxation = wheels.suspensionDamping;
      const dampingCompression = wheels.suspensionDamping * 0.8;
      this.vehicleController.setWheelSuspensionCompression(i, dampingCompression);
      this.vehicleController.setWheelSuspensionRelaxation(i, dampingRelaxation);
    }
  }

  private createVisuals(): void {
    const { chassis, wheels } = this.config;

    // Chassis body
    const bodyGeometry = new THREE.BoxGeometry(chassis.width, chassis.height, chassis.length);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xcc3333,
      metalness: 0.6,
      roughness: 0.4,
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.chassisMesh.add(bodyMesh);

    // Roof/cabin
    const cabinGeometry = new THREE.BoxGeometry(
      chassis.width * 0.85,
      chassis.height * 0.7,
      chassis.length * 0.45,
    );
    const cabinMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.3,
      roughness: 0.6,
    });
    const cabinMesh = new THREE.Mesh(cabinGeometry, cabinMaterial);
    cabinMesh.position.set(0, chassis.height * 0.65, -chassis.length * 0.05);
    cabinMesh.castShadow = true;
    this.chassisMesh.add(cabinMesh);

    // Headlights
    const headlightGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffcc,
      emissive: 0xffffcc,
      emissiveIntensity: 0.5,
    });
    for (const side of [-1, 1]) {
      const headlight = new THREE.Mesh(headlightGeo, headlightMat);
      headlight.position.set(side * chassis.width * 0.35, 0, chassis.length / 2);
      this.chassisMesh.add(headlight);
    }

    // Wheels
    for (let i = 0; i < wheels.positions.length; i++) {
      const wheelGeometry = new THREE.CylinderGeometry(
        wheels.radius,
        wheels.radius,
        0.2,
        16,
      );
      wheelGeometry.rotateZ(Math.PI / 2);
      const wheelMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        metalness: 0.2,
        roughness: 0.8,
      });
      const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheelMesh.castShadow = true;
      this.wheelMeshes.push(wheelMesh);
      this.world.scene.add(wheelMesh);
    }

    this.world.scene.add(this.chassisMesh);
  }

  fixedUpdate(input: InputState, dt: number): void {
    // Determine throttle and direction
    let throttle = 0;
    if (input.forward) {
      this.transmission.setForward();
      throttle = 1;
    } else if (input.backward) {
      // If moving forward at decent speed, treat as brake first
      const speed = this.getSpeed();
      if (speed > 5) {
        throttle = 0;
      } else {
        this.transmission.setReverse();
        throttle = 0.6;
      }
    }

    const brakeInput = input.brake ? 1 : 0;

    // Steering
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerSpeed = steerTarget !== 0
      ? this.config.steering.speed
      : this.config.steering.returnSpeed;
    this.currentSteering = lerp(
      this.currentSteering,
      steerTarget * this.config.steering.maxAngle,
      dt * steerSpeed,
    );

    // Get average wheel RPM for engine calculation
    const wheelRpm = this.getAverageWheelRpm();

    // Update drivetrain
    const gearRatio = this.transmission.getCurrentGearRatio();
    const finalDrive = this.transmission.getFinalDriveRatio();
    this.transmission.update(this.engine.getRpm(), throttle, dt);

    // Engine torque
    const engineTorque = this.engine.update(throttle, wheelRpm, gearRatio, finalDrive, dt);

    // Fuel consumption
    this.fuel.update(this.engine.getRpm(), engineTorque, dt);

    // Stall engine if out of fuel
    if (this.fuel.isEmpty() && this.engine.isRunning()) {
      this.engine.setRunning(false);
    }

    // Calculate wheel force
    let wheelForce = 0;
    if (this.engine.isRunning() && gearRatio !== 0) {
      wheelForce = (engineTorque * gearRatio * finalDrive * this.transmission.getEfficiency())
        / this.config.wheels.radius;
    }

    // Apply to vehicle controller
    this.vehicleController.setWheelSteering(0, this.currentSteering);
    this.vehicleController.setWheelSteering(1, this.currentSteering);

    // Rear-wheel drive
    const brakeForce = brakeInput * this.config.brakes.maxForce;
    for (let i = 0; i < 4; i++) {
      this.vehicleController.setWheelBrake(i, brakeForce);

      // Apply engine force to rear wheels (index 2, 3)
      if (i >= 2) {
        this.vehicleController.setWheelEngineForce(i, wheelForce / 2);
      } else {
        this.vehicleController.setWheelEngineForce(i, 0);
      }
    }

    // Step vehicle controller
    this.vehicleController.updateVehicle(dt);
  }

  updateVisuals(): void {
    // Update chassis mesh from physics
    const pos = this.chassisBody.translation();
    const rot = this.chassisBody.rotation();

    this.chassisMesh.position.set(pos.x, pos.y, pos.z);
    this.chassisMesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    // Update wheel meshes
    for (let i = 0; i < this.wheelMeshes.length; i++) {
      const wheelAxle = this.vehicleController.wheelAxleCs(i);
      const connection = this.config.wheels.positions[i];
      const suspensionLength = this.vehicleController.wheelSuspensionLength(i) ?? this.config.wheels.suspensionRestLength;
      const steering = this.vehicleController.wheelSteering(i) ?? 0;
      const rotation = this.vehicleController.wheelRotation(i) ?? 0;

      // Calculate world-space wheel position
      const wheelPos = new THREE.Vector3(
        connection[0],
        connection[1] - suspensionLength,
        connection[2],
      );
      wheelPos.applyQuaternion(this.chassisMesh.quaternion);
      wheelPos.add(this.chassisMesh.position);

      this.wheelMeshes[i].position.copy(wheelPos);

      // Wheel rotation: combine chassis rotation, steering, and spin
      const wheelQuat = this.chassisMesh.quaternion.clone();
      const steerQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        steering,
      );
      const spinQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        rotation,
      );
      wheelQuat.multiply(steerQuat).multiply(spinQuat);
      this.wheelMeshes[i].quaternion.copy(wheelQuat);
    }
  }

  private getAverageWheelRpm(): number {
    // Compute wheel RPM from chassis linear velocity
    const vel = this.chassisBody.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    const wheelAngularVel = speed / this.config.wheels.radius;
    return wheelAngularVel * RAD_S_TO_RPM;
  }

  getSpeed(): number {
    const vel = this.chassisBody.linvel();
    return Math.sqrt(vel.x * vel.x + vel.z * vel.z) * MS_TO_KMH;
  }

  getState(): VehicleState {
    return {
      rpm: Math.round(this.engine.getRpm()),
      speed: Math.round(this.getSpeed()),
      gear: this.transmission.getGear(),
      fuel: this.fuel.getFuelLevel(),
      fuelPercent: this.fuel.getFuelPercent(),
      throttle: 0,
      brake: 0,
      steeringAngle: this.currentSteering,
      engineRunning: this.engine.isRunning(),
      isShifting: this.transmission.isShifting(),
    };
  }

  getGearDisplay(): string {
    return this.transmission.getGearDisplay();
  }

  getPosition(): THREE.Vector3 {
    const pos = this.chassisBody.translation();
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  getQuaternion(): THREE.Quaternion {
    const rot = this.chassisBody.rotation();
    return new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
  }

  getForwardDirection(): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.getQuaternion());
    return forward;
  }

  reset(position?: THREE.Vector3): void {
    const pos = position ?? new THREE.Vector3(0, 2, 0);
    this.chassisBody.setTranslation(
      new this.world.rapier.Vector3(pos.x, pos.y, pos.z),
      true,
    );
    this.chassisBody.setRotation(
      new this.world.rapier.Quaternion(0, 0, 0, 1),
      true,
    );
    this.chassisBody.setLinvel(new this.world.rapier.Vector3(0, 0, 0), true);
    this.chassisBody.setAngvel(new this.world.rapier.Vector3(0, 0, 0), true);
    this.currentSteering = 0;
    this.engine.setRunning(true);
    this.fuel.refuel();
  }
}
