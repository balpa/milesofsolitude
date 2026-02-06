import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Engine } from './core/Engine';
import { World } from './core/World';
import { VehicleController } from './systems/vehicle/VehicleController';
import { CameraController } from './systems/camera/CameraController';
import { HudManager } from './systems/hud/HudManager';
import { RoadManager } from './systems/road/RoadManager';
import type { VehicleConfig, RoadConfig } from './types';

import vehicleConfig from './config/vehicles/default-car.json';
import roadConfig from './config/roads/route-prototype.json';

async function main(): Promise<void> {
  // Initialize Rapier WASM
  await RAPIER.init();

  // Get canvas
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas not found');

  // Create world
  const world = new World(canvas, RAPIER);

  // Create road
  const roadManager = new RoadManager(world, roadConfig as RoadConfig);

  // Create vehicle
  const vehicle = new VehicleController(world, vehicleConfig as VehicleConfig);

  // Position vehicle at road start
  const startPos = roadManager.getStartPosition();
  vehicle.reset(startPos);

  // Create camera controller
  const cameraController = new CameraController();
  cameraController.initialize(vehicle.getPosition(), vehicle.getQuaternion());

  // Create HUD
  const hud = new HudManager();

  // Create game engine (loop)
  const engine = new Engine();

  // Find the sun light for shadow tracking
  const sunLight = world.scene.children.find(
    (c) => c instanceof THREE.DirectionalLight,
  ) as THREE.DirectionalLight | undefined;

  // Road chunk update counter
  let chunkUpdateTimer = 0;

  // Fixed timestep update (physics)
  engine.onFixedUpdate((dt) => {
    const input = world.inputManager.getState();

    // Reset vehicle
    if (input.reset) {
      vehicle.reset(roadManager.getStartPosition());
    }

    // Camera toggle
    if (input.cameraToggle) {
      cameraController.toggle();
    }

    // Update vehicle
    vehicle.fixedUpdate(input, dt);

    // Step physics
    world.stepPhysics(dt);

    // Clear just-pressed inputs
    world.inputManager.endFrame();

    // Periodically update road chunks
    chunkUpdateTimer += dt;
    if (chunkUpdateTimer > 0.5) {
      roadManager.updateChunks(vehicle.getPosition());
      chunkUpdateTimer = 0;
    }
  });

  // Render update
  engine.onRender((dt, alpha) => {
    // Update vehicle visuals (interpolated)
    vehicle.updateVisuals(alpha);

    // Update camera with interpolated position
    const interpPos = vehicle.getPosition(alpha);
    const interpQuat = vehicle.getQuaternion(alpha);
    cameraController.update(
      world.camera,
      interpPos,
      interpQuat,
      dt,
    );

    // Update HUD
    hud.update(vehicle.getState(), vehicle.getGearDisplay());

    // Update sun shadow to follow vehicle
    if (sunLight) {
      sunLight.position.set(interpPos.x + 50, 100, interpPos.z + 30);
      sunLight.target.position.set(interpPos.x, 0, interpPos.z);
      sunLight.target.updateMatrixWorld();
    }

    // Render
    world.render();
  });

  // Hide controls hint after a delay
  setTimeout(() => {
    const hint = document.getElementById('controls-hint');
    if (hint) hint.style.opacity = '0';
  }, 8000);

  // Start the game loop
  engine.start();

  console.log('Miles of Solitude - Engine started');
}

main().catch(console.error);
