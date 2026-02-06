import { PHYSICS_TIMESTEP, MAX_SUBSTEPS } from '../utils/constants';

export type UpdateCallback = (dt: number) => void;
export type RenderCallback = (dt: number, alpha: number) => void;

export class Engine {
  private running = false;
  private accumulator = 0;
  private lastTime = 0;
  private frameId = 0;

  private fixedUpdateCallbacks: UpdateCallback[] = [];
  private renderCallbacks: RenderCallback[] = [];

  onFixedUpdate(callback: UpdateCallback): void {
    this.fixedUpdateCallbacks.push(callback);
  }

  onRender(callback: RenderCallback): void {
    this.renderCallbacks.push(callback);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  private loop = (): void => {
    if (!this.running) return;

    const now = performance.now();
    let frameDt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Clamp frame delta to avoid spiral of death
    if (frameDt > 0.1) frameDt = 0.1;

    this.accumulator += frameDt;

    // Fixed timestep physics updates
    let steps = 0;
    while (this.accumulator >= PHYSICS_TIMESTEP && steps < MAX_SUBSTEPS) {
      for (const cb of this.fixedUpdateCallbacks) {
        cb(PHYSICS_TIMESTEP);
      }
      this.accumulator -= PHYSICS_TIMESTEP;
      steps++;
    }

    // Interpolation alpha for smooth rendering
    const alpha = this.accumulator / PHYSICS_TIMESTEP;

    // Render
    for (const cb of this.renderCallbacks) {
      cb(frameDt, alpha);
    }

    this.frameId = requestAnimationFrame(this.loop);
  };
}
