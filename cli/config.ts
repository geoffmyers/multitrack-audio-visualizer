import * as fs from 'fs/promises';
import * as path from 'path';
import type { Preset, PresetSettings } from '../src/types/preset.types.js';
import type { ExportOptions } from '../src/types/audio.types.js';
import type { LayoutMode, AmplitudeMode } from '../src/types/visualizer.types.js';

export interface CLIExportConfig {
  audioFiles: string[];
  preset?: string;
  output: string;
  overrides?: Partial<PresetSettings>;
  export?: Partial<{
    fps: number;
    codec: 'h264' | 'h265';
    quality: number;
    audioBitrate: string;
  }>;
  verbose?: boolean;
}

export interface CLIAudioFileConfig {
  path: string;
  color?: string;
  opacity?: number;
}

export class ConfigParser {
  private presetsCache: Preset[] | null = null;

  /**
   * Load config from JSON file
   */
  async loadConfigFile(configPath: string): Promise<CLIExportConfig> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      this.validateConfig(config);
      return config;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load config file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load all available presets from presets/all-presets.json
   */
  async loadPresets(): Promise<Preset[]> {
    if (this.presetsCache) {
      return this.presetsCache;
    }

    try {
      const presetsPath = path.join(process.cwd(), 'presets', 'all-presets.json');
      const content = await fs.readFile(presetsPath, 'utf-8');
      this.presetsCache = JSON.parse(content);
      return this.presetsCache!;
    } catch (error) {
      throw new Error(`Failed to load presets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find a preset by name
   */
  async findPresetByName(name: string): Promise<Preset | null> {
    const presets = await this.loadPresets();
    return presets.find(p => p.name === name) || null;
  }

  /**
   * List all available preset names
   */
  async listPresetNames(): Promise<string[]> {
    const presets = await this.loadPresets();
    return presets.map(p => p.name).sort();
  }

  /**
   * Validate config structure
   */
  private validateConfig(config: any): void {
    if (!config.audioFiles || !Array.isArray(config.audioFiles) || config.audioFiles.length === 0) {
      throw new Error('Config must include "audioFiles" array with at least one file');
    }

    if (!config.output || typeof config.output !== 'string') {
      throw new Error('Config must include "output" string');
    }

    if (config.preset && typeof config.preset !== 'string') {
      throw new Error('"preset" must be a string (preset name)');
    }

    if (config.overrides) {
      this.validatePresetSettings(config.overrides);
    }

    if (config.export) {
      this.validateExportSettings(config.export);
    }
  }

  /**
   * Validate preset settings partial
   */
  private validatePresetSettings(settings: Partial<PresetSettings>): void {
    const validLayouts: LayoutMode[] = ['overlay', 'overlay-additive', 'stacked', 'spectrum-overlay', 'spectrum-stacked'];
    const validAmplitudeModes: AmplitudeMode[] = ['individual', 'normalized'];

    if (settings.layout && !validLayouts.includes(settings.layout)) {
      throw new Error(`Invalid layout: "${settings.layout}". Must be one of: ${validLayouts.join(', ')}`);
    }

    if (settings.amplitudeMode && !validAmplitudeModes.includes(settings.amplitudeMode)) {
      throw new Error(`Invalid amplitudeMode: "${settings.amplitudeMode}". Must be one of: ${validAmplitudeModes.join(', ')}`);
    }

    if (settings.heightPercent !== undefined && (settings.heightPercent < 1 || settings.heightPercent > 100)) {
      throw new Error('heightPercent must be between 1 and 100');
    }

    if (settings.smoothingLevel !== undefined && (settings.smoothingLevel < 0 || settings.smoothingLevel > 5)) {
      throw new Error('smoothingLevel must be between 0 and 5');
    }

    if (settings.windowDuration !== undefined && settings.windowDuration <= 0) {
      throw new Error('windowDuration must be greater than 0');
    }
  }

  /**
   * Validate export settings partial
   */
  private validateExportSettings(exportSettings: any): void {
    if (exportSettings.fps && (exportSettings.fps < 1 || exportSettings.fps > 120)) {
      throw new Error('fps must be between 1 and 120');
    }

    if (exportSettings.codec && exportSettings.codec !== 'h264' && exportSettings.codec !== 'h265') {
      throw new Error('codec must be "h264" or "h265"');
    }

    if (exportSettings.quality && (exportSettings.quality < 0 || exportSettings.quality > 51)) {
      throw new Error('quality (CRF) must be between 0 and 51');
    }
  }

  /**
   * Build final export options from config
   */
  async buildExportOptions(config: CLIExportConfig): Promise<ExportOptions> {
    // Default settings
    let settings: PresetSettings = {
      layout: 'overlay',
      amplitudeMode: 'individual',
      heightPercent: 50,
      smoothingLevel: 0,
      fpsCap: 60,
      windowDuration: 1
    };

    // Load preset if specified
    if (config.preset) {
      const preset = await this.findPresetByName(config.preset);
      if (!preset) {
        const available = await this.listPresetNames();
        throw new Error(
          `Preset "${config.preset}" not found. Available presets:\n  - ${available.join('\n  - ')}`
        );
      }
      settings = { ...preset.settings };
    }

    // Apply overrides
    if (config.overrides) {
      settings = { ...settings, ...config.overrides };
    }

    // Build export options
    const exportOptions: ExportOptions = {
      format: 'mp4',
      codec: config.export?.codec || 'h264',
      fps: config.export?.fps || settings.fpsCap || 60,
      quality: config.export?.quality || 23,
      audioBitrate: config.export?.audioBitrate || '192k',
      layout: settings.layout,
      amplitudeMode: settings.amplitudeMode,
      heightPercent: settings.heightPercent,
      smoothingLevel: settings.smoothingLevel,
      windowDuration: settings.windowDuration
    };

    return exportOptions;
  }

  /**
   * Parse audio files with optional color/opacity
   */
  parseAudioFiles(audioFiles: string[] | CLIAudioFileConfig[]): CLIAudioFileConfig[] {
    return audioFiles.map((file, index) => {
      if (typeof file === 'string') {
        return {
          path: file,
          color: this.getDefaultColor(index),
          opacity: 0.7
        };
      }
      return {
        path: file.path,
        color: file.color || this.getDefaultColor(index),
        opacity: file.opacity !== undefined ? file.opacity : 0.7
      };
    });
  }

  /**
   * Get default color for track index
   */
  private getDefaultColor(index: number): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
    ];
    return colors[index % colors.length];
  }

  /**
   * Validate that all audio files exist
   */
  async validateAudioFiles(audioFiles: CLIAudioFileConfig[]): Promise<void> {
    for (const file of audioFiles) {
      try {
        await fs.access(file.path, fs.constants.R_OK);
      } catch (error) {
        throw new Error(`Audio file not found or not readable: ${file.path}`);
      }
    }
  }
}
