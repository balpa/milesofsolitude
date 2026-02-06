import type RAPIER from '@dimforge/rapier3d-compat';
import type * as THREE from 'three';

export interface VehicleConfig {
  chassis: {
    mass: number;
    width: number;
    height: number;
    length: number;
  };
  engine: {
    idleRpm: number;
    maxRpm: number;
    redlineRpm: number;
    torqueCurve: [number, number][]; // [rpm, torqueNm]
    engineBrakingFactor: number;
  };
  transmission: {
    gearRatios: number[];
    reverseRatio: number;
    finalDriveRatio: number;
    efficiency: number;
    shiftUpRpm: number;
    shiftDownRpm: number;
    shiftDelay: number; // seconds
  };
  fuel: {
    tankCapacity: number; // liters
    bsfc: number; // brake-specific fuel consumption g/(kW*h)
    fuelDensity: number; // kg/L
  };
  wheels: {
    radius: number;
    suspensionRestLength: number;
    suspensionStiffness: number;
    suspensionDamping: number;
    maxSuspensionTravel: number;
    frictionSlip: number;
    positions: [number, number, number][]; // FL, FR, RL, RR
  };
  steering: {
    maxAngle: number; // radians
    speed: number; // radians per second
    returnSpeed: number; // radians per second
  };
  brakes: {
    maxForce: number;
  };
}

export interface VehicleState {
  rpm: number;
  speed: number; // km/h
  gear: number; // -1 = reverse, 0 = neutral, 1+ = drive
  fuel: number; // liters remaining
  fuelPercent: number;
  throttle: number;
  brake: number;
  steeringAngle: number;
  engineRunning: boolean;
  isShifting: boolean;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
  shiftUp: boolean;
  shiftDown: boolean;
  cameraToggle: boolean;
  reset: boolean;
}

export interface RoadWaypoint {
  position: [number, number, number];
  width?: number;
}

export interface RoadConfig {
  name: string;
  waypoints: RoadWaypoint[];
  defaultWidth: number;
}

export interface GameSystems {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  physicsWorld: RAPIER.World;
  rapier: typeof RAPIER;
}
