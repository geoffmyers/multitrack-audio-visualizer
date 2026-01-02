import type { RenderDimensions, CoordinateConverter } from '../types/visualizer.types';

/**
 * RenderContext manages coordinate transformations and dimensional information
 * for rendering visualizations. Supports both browser (dynamic) and export (fixed)
 * rendering contexts.
 */
export class RenderContext implements CoordinateConverter {
  private dimensions: RenderDimensions;

  constructor(width: number, height: number) {
    this.dimensions = {
      width,
      height,
      centerY: height / 2,
      aspectRatio: 16 / 9
    };
  }

  /**
   * Get the current render dimensions
   */
  getDimensions(): RenderDimensions {
    return { ...this.dimensions };
  }

  /**
   * Convert height percentage (1-100) to pixel value
   * @param percent - Height as percentage of canvas height (1-100)
   * @returns Height in pixels
   */
  heightPercentToPixels(percent: number): number {
    return (percent / 100) * this.dimensions.height;
  }

  /**
   * Convert normalized X coordinate (0-1) to pixels
   * @param normalizedX - X coordinate in range [0, 1]
   * @returns X coordinate in pixels
   */
  toPixelsX(normalizedX: number): number {
    return normalizedX * this.dimensions.width;
  }

  /**
   * Convert normalized Y coordinate (0-1) to pixels
   * @param normalizedY - Y coordinate in range [0, 1]
   * @returns Y coordinate in pixels
   */
  toPixelsY(normalizedY: number): number {
    return normalizedY * this.dimensions.height;
  }

  /**
   * Convert pixel X coordinate to normalized (0-1)
   * @param pixelX - X coordinate in pixels
   * @returns X coordinate in range [0, 1]
   */
  fromPixelsX(pixelX: number): number {
    return pixelX / this.dimensions.width;
  }

  /**
   * Convert pixel Y coordinate to normalized (0-1)
   * @param pixelY - Y coordinate in pixels
   * @returns Y coordinate in range [0, 1]
   */
  fromPixelsY(pixelY: number): number {
    return pixelY / this.dimensions.height;
  }

  /**
   * Create a RenderContext from a canvas element
   * Uses the canvas's current dimensions
   * @param canvas - HTML canvas element
   * @returns RenderContext configured for the canvas
   */
  static fromCanvas(canvas: HTMLCanvasElement): RenderContext {
    return new RenderContext(canvas.width, canvas.height);
  }

  /**
   * Create a RenderContext for video export
   * Always uses fixed 1920x1080 dimensions
   * @returns RenderContext configured for export at 1920x1080
   */
  static forExport(): RenderContext {
    return new RenderContext(1920, 1080);
  }
}
