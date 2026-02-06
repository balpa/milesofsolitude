import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { EventBus } from './EventBus';
import { InputManager } from './InputManager';

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly physicsWorld: RAPIER.World;
  readonly rapier: typeof RAPIER;
  readonly eventBus: EventBus;
  readonly inputManager: InputManager;

  constructor(
    canvas: HTMLCanvasElement,
    rapier: typeof RAPIER,
  ) {
    this.rapier = rapier;
    this.eventBus = new EventBus();
    this.inputManager = new InputManager();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 200, 800);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      2000,
    );

    // Physics
    const gravity = new rapier.Vector3(0.0, -9.81, 0.0);
    this.physicsWorld = new rapier.World(gravity);

    // Handle resize
    window.addEventListener('resize', () => this.onResize());

    this.setupLighting();
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff4e6, 1.5);
    sunLight.position.set(50, 100, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.bias = -0.001;
    this.scene.add(sunLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.4);
    this.scene.add(hemisphereLight);
  }

  private onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  stepPhysics(dt: number): void {
    this.physicsWorld.timestep = dt;
    this.physicsWorld.step();
  }

  dispose(): void {
    this.renderer.dispose();
    this.physicsWorld.free();
    this.eventBus.clear();
  }
}
