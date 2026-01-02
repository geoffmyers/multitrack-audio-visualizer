export class RenderLoop {
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private callback: ((deltaTime: number) => void) | null = null;
  private lastFrameTime: number = 0;
  private fps: number = 0;
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;
  private targetFPS: number = 60; // Default to 60 FPS
  private frameInterval: number = 1000 / 60; // ms per frame at 60 FPS

  /**
   * Start the render loop
   */
  start(callback: (deltaTime: number) => void): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.callback = callback;
    this.lastFrameTime = performance.now();
    this.fpsUpdateTime = performance.now();
    this.frameCount = 0;

    this.loop();
  }

  /**
   * Stop the render loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return this.fps;
  }

  /**
   * Set target FPS cap
   */
  setTargetFPS(fps: number): void {
    this.targetFPS = Math.max(15, Math.min(60, fps)); // Clamp between 15 and 60
    this.frameInterval = 1000 / this.targetFPS;
  }

  /**
   * Get target FPS
   */
  getTargetFPS(): number {
    return this.targetFPS;
  }

  /**
   * Main render loop
   */
  private loop = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;

    // Only render if enough time has passed for the target FPS
    if (deltaTime >= this.frameInterval) {
      // Update last frame time, accounting for any overshoot
      this.lastFrameTime = now - (deltaTime % this.frameInterval);

      // Update FPS counter
      this.frameCount++;
      if (now - this.fpsUpdateTime >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.fpsUpdateTime = now;
      }

      // Call render callback with delta in seconds
      if (this.callback) {
        this.callback(deltaTime / 1000);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * Check if loop is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
