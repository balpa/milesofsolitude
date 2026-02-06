import type { InputState } from '../types';

export class InputManager {
  private keys = new Set<string>();
  private justPressed = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private pointerLocked = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);

      // Toggle pointer lock on K (must be in user gesture context)
      if (e.code === 'KeyK') {
        if (this.pointerLocked) {
          document.exitPointerLock();
        } else {
          canvas.requestPointerLock();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });

    // Accumulate mouse movement while pointer is locked
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
  }

  getState(): InputState {
    return {
      forward: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
      backward: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
      left: this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
      right: this.keys.has('KeyD') || this.keys.has('ArrowRight'),
      brake: this.keys.has('Space'),
      shiftUp: this.justPressed.has('KeyE') || this.justPressed.has('ShiftLeft'),
      shiftDown: this.justPressed.has('KeyQ') || this.justPressed.has('ControlLeft'),
      cameraToggle: this.justPressed.has('KeyC'),
      freeLookToggle: this.justPressed.has('KeyK'),
      highBeamToggle: this.justPressed.has('KeyL'),
      reset: this.justPressed.has('KeyR'),
      mouseDeltaX: this.mouseDX,
      mouseDeltaY: this.mouseDY,
    };
  }

  endFrame(): void {
    this.justPressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
