export type LayoutMode = 'overlay' | 'overlay-additive' | 'stacked' | 'spectrum-overlay' | 'spectrum-stacked';

export type AmplitudeMode = 'individual' | 'normalized';

export interface VisualizerConfig {
  width: number;
  height: number;
  backgroundColor: string;
  waveformStyle: 'line' | 'filled';
  layout: LayoutMode;
  amplitudeMode: AmplitudeMode;
  heightFactor: number; // 0.1 to 1.0 - percentage of canvas height used for visualization
}

export interface WaveformData {
  samples: Float32Array;
  min: Float32Array;
  max: Float32Array;
}

export interface SpectrumData {
  magnitudes: Float32Array;
  frequencies: Float32Array;
}

export interface RenderDimensions {
  width: number;      // Physical canvas width in pixels
  height: number;     // Physical canvas height in pixels
  centerY: number;    // Vertical center point in pixels
  aspectRatio: number; // Always 16/9
}

export interface CoordinateConverter {
  toPixelsX(normalizedX: number): number;
  toPixelsY(normalizedY: number): number;
  fromPixelsX(pixelX: number): number;
  fromPixelsY(pixelY: number): number;
  heightPercentToPixels(percent: number): number;
}
