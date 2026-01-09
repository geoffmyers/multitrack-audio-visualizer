import { AudioEngine } from './core/AudioEngine';
import { WaveformRenderer } from './rendering/WaveformRenderer';
import { RenderContext } from './rendering/RenderContext';
import { RenderLoop } from './rendering/RenderLoop';
import { Controls } from './ui/Controls';
import { TrackControls } from './ui/TrackControls';
import { ExportUI } from './ui/ExportUI';
import { PresetManager } from './core/PresetManager';
import { PresetUI } from './ui/PresetUI';
import type { LayoutMode, AmplitudeMode } from './types/visualizer.types';
import type { PresetSettings } from './types/preset.types';

class MultitrackAudioVisualizer {
  private audioEngine: AudioEngine;
  private renderer!: WaveformRenderer;
  private renderLoop: RenderLoop;
  private controls: Controls;
  private trackControls: TrackControls;
  private exportUI: ExportUI;
  private presetManager: PresetManager;
  private presetUI: PresetUI;
  private canvas: HTMLCanvasElement;
  private layoutSelect: HTMLSelectElement;
  private amplitudeSelect: HTMLSelectElement;
  private heightSlider: HTMLInputElement;
  private smoothingSlider: HTMLInputElement;
  private fpsSlider: HTMLInputElement;
  private windowDurationSlider: HTMLInputElement;
  private currentLayout: LayoutMode = 'overlay';
  private currentAmplitudeMode: AmplitudeMode = 'individual';
  private currentHeightPercent: number = 50;
  private currentSmoothingLevel: number = 0;
  private currentFPSCap: number = 60;
  private currentWindowDuration: number = 1.0;

  constructor() {
    // Get canvas
    this.canvas = document.getElementById('visualizer-canvas') as HTMLCanvasElement;

    // Get selectors
    this.layoutSelect = document.getElementById('layout-select') as HTMLSelectElement;
    this.amplitudeSelect = document.getElementById('amplitude-select') as HTMLSelectElement;
    this.heightSlider = document.getElementById('height-slider') as HTMLInputElement;
    this.smoothingSlider = document.getElementById('smoothing-slider') as HTMLInputElement;
    this.fpsSlider = document.getElementById('fps-slider') as HTMLInputElement;
    this.windowDurationSlider = document.getElementById(
      'window-duration-slider'
    ) as HTMLInputElement;

    // Initialize components
    this.audioEngine = new AudioEngine();

    // Initialize canvas with responsive sizing
    this.initializeCanvas();

    // Initialize preset manager
    this.presetManager = new PresetManager();

    // Load built-in presets (async, but don't block initialization)
    this.loadBuiltInPresets();

    // Initialize UI
    this.controls = new Controls(this.audioEngine);
    this.trackControls = new TrackControls(this.audioEngine, () => {
      this.render();
    });
    this.exportUI = new ExportUI(
      this.audioEngine,
      () => this.currentLayout,
      () => this.currentAmplitudeMode,
      () => this.currentHeightPercent,
      () => this.currentSmoothingLevel,
      () => this.currentWindowDuration
    );
    this.presetUI = new PresetUI(
      this.presetManager,
      () => this.getCurrentSettings(),
      (settings) => {
        this.applySettings(settings);
      }
    );

    // Setup selectors
    this.setupLayoutSelector();
    this.setupAmplitudeSelector();
    this.setupHeightSlider();
    this.setupSmoothingSlider();
    this.setupFPSSlider();
    this.setupWindowDurationSlider();

    // Setup window resize handler
    window.addEventListener('resize', () => {
      this.handleResize();
    });

    // Setup render loop (must be initialized before loading presets)
    this.renderLoop = new RenderLoop();

    // Load active preset if one exists (after renderLoop is initialized)
    this.loadActivePreset();

    // Start render loop
    this.startRenderLoop();

    console.log('Multi-Track Audio Visualizer initialized');
    console.log('Add WAV files to begin visualizing');
  }

  private initializeCanvas(): void {
    const container = this.canvas.parentElement!;
    const rect = container.getBoundingClientRect();

    // Maintain 16:9 aspect ratio
    const containerAspect = rect.width / rect.height;
    const targetAspect = 16 / 9;

    let canvasWidth: number;
    let canvasHeight: number;

    if (containerAspect > targetAspect) {
      // Container is wider - fit to height
      canvasHeight = Math.floor(rect.height);
      canvasWidth = Math.floor(canvasHeight * targetAspect);
    } else {
      // Container is taller - fit to width
      canvasWidth = Math.floor(rect.width);
      canvasHeight = Math.floor(canvasWidth / targetAspect);
    }

    // Set canvas dimensions (internal resolution)
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;

    // Create render context and renderer
    const renderContext = RenderContext.fromCanvas(this.canvas);
    this.renderer = new WaveformRenderer(this.canvas, renderContext);
  }

  private handleResize(): void {
    this.initializeCanvas();
    this.render();
  }

  private setupLayoutSelector(): void {
    this.layoutSelect.addEventListener('change', () => {
      this.currentLayout = this.layoutSelect.value as LayoutMode;
      this.render();
    });
  }

  private setupAmplitudeSelector(): void {
    this.amplitudeSelect.addEventListener('change', () => {
      this.currentAmplitudeMode = this.amplitudeSelect.value as AmplitudeMode;
      this.render();
    });
  }

  private setupHeightSlider(): void {
    const heightValueDisplay = document.getElementById('height-value')!;
    this.heightSlider.value = this.currentHeightPercent.toString();
    heightValueDisplay.textContent = `${this.currentHeightPercent}%`;

    this.heightSlider.addEventListener('input', () => {
      this.currentHeightPercent = parseFloat(this.heightSlider.value);
      heightValueDisplay.textContent = `${this.currentHeightPercent}%`;
      this.render();
    });
  }

  private setupSmoothingSlider(): void {
    const smoothingValueDisplay = document.getElementById('smoothing-value')!;
    this.smoothingSlider.value = this.currentSmoothingLevel.toString();
    smoothingValueDisplay.textContent = this.currentSmoothingLevel.toString();

    this.smoothingSlider.addEventListener('input', () => {
      this.currentSmoothingLevel = parseInt(this.smoothingSlider.value, 10);
      smoothingValueDisplay.textContent = this.currentSmoothingLevel.toString();
      this.render();
    });
  }

  private setupFPSSlider(): void {
    const fpsValueDisplay = document.getElementById('fps-value')!;
    this.fpsSlider.value = this.currentFPSCap.toString();
    fpsValueDisplay.textContent = this.currentFPSCap.toString();

    this.fpsSlider.addEventListener('input', () => {
      this.currentFPSCap = parseInt(this.fpsSlider.value, 10);
      fpsValueDisplay.textContent = this.currentFPSCap.toString();
      this.renderLoop.setTargetFPS(this.currentFPSCap);
    });
  }

  private setupWindowDurationSlider(): void {
    const windowDurationValueDisplay = document.getElementById('window-duration-value')!;
    this.windowDurationSlider.value = this.currentWindowDuration.toString();
    windowDurationValueDisplay.textContent = `${this.currentWindowDuration.toFixed(2)}s`;

    this.windowDurationSlider.addEventListener('input', () => {
      this.currentWindowDuration = parseFloat(this.windowDurationSlider.value);
      windowDurationValueDisplay.textContent = `${this.currentWindowDuration.toFixed(2)}s`;
      this.render();
    });
  }

  private startRenderLoop(): void {
    this.renderLoop.start(() => {
      this.render();
    });
  }

  private render(): void {
    const state = this.audioEngine.getPlaybackState();
    const tracks = this.audioEngine.getTracks();

    this.renderer.render(
      tracks,
      state.currentTime,
      state.duration,
      this.currentLayout,
      this.currentAmplitudeMode,
      this.currentHeightPercent,
      this.currentSmoothingLevel,
      this.currentWindowDuration
    );
  }

  /**
   * Get current settings as PresetSettings object
   */
  private getCurrentSettings(): PresetSettings {
    return {
      layout: this.currentLayout,
      amplitudeMode: this.currentAmplitudeMode,
      heightPercent: this.currentHeightPercent,
      smoothingLevel: this.currentSmoothingLevel,
      fpsCap: this.currentFPSCap,
      windowDuration: this.currentWindowDuration,
    };
  }

  /**
   * Apply preset settings to the application
   */
  private applySettings(settings: PresetSettings): void {
    // Update internal state
    this.currentLayout = settings.layout;
    this.currentAmplitudeMode = settings.amplitudeMode;
    this.currentHeightPercent = settings.heightPercent;
    this.currentSmoothingLevel = settings.smoothingLevel;
    this.currentFPSCap = settings.fpsCap;
    this.currentWindowDuration = settings.windowDuration;

    // Update UI controls
    this.layoutSelect.value = settings.layout;
    this.amplitudeSelect.value = settings.amplitudeMode;
    this.heightSlider.value = settings.heightPercent.toString();
    this.smoothingSlider.value = settings.smoothingLevel.toString();
    this.fpsSlider.value = settings.fpsCap.toString();
    this.windowDurationSlider.value = settings.windowDuration.toString();

    // Update display labels
    document.getElementById('height-value')!.textContent = `${settings.heightPercent}%`;
    document.getElementById('smoothing-value')!.textContent = settings.smoothingLevel.toString();
    document.getElementById('fps-value')!.textContent = settings.fpsCap.toString();
    document.getElementById('window-duration-value')!.textContent =
      `${settings.windowDuration.toFixed(2)}s`;

    // Apply FPS cap
    this.renderLoop.setTargetFPS(settings.fpsCap);

    // Re-render with new settings
    this.render();

    console.log('[MultitrackAudioVisualizer] Applied preset settings');
  }

  /**
   * Load active preset on startup
   */
  private loadActivePreset(): void {
    const activePreset = this.presetManager.getActivePreset();
    if (activePreset) {
      console.log('[MultitrackAudioVisualizer] Loading active preset:', activePreset.name);
      this.applySettings(activePreset.settings);
    }
  }

  /**
   * Load built-in presets from JSON file
   */
  private async loadBuiltInPresets(): Promise<void> {
    await this.presetManager.loadBuiltInPresets();
  }
}

// Initialize application
new MultitrackAudioVisualizer();
