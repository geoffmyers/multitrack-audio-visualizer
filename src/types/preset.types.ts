import type { LayoutMode, AmplitudeMode } from './visualizer.types';

/**
 * User settings that can be saved as a preset
 */
export interface PresetSettings {
  layout: LayoutMode;
  amplitudeMode: AmplitudeMode;
  heightPercent: number;
  smoothingLevel: number;
  fpsCap: number;
  windowDuration: number;
}

/**
 * A named preset with unique ID
 */
export interface Preset {
  id: string;
  name: string;
  settings: PresetSettings;
  createdAt: number;
  updatedAt: number;
}

/**
 * Collection of all user presets
 */
export interface PresetCollection {
  presets: Preset[];
  activePresetId: string | null;
  version: number; // For future migration compatibility
}

/**
 * Events emitted by PresetManager
 */
export type PresetEvent =
  | { type: 'preset-created'; preset: Preset }
  | { type: 'preset-updated'; preset: Preset }
  | { type: 'preset-deleted'; presetId: string }
  | { type: 'preset-loaded'; preset: Preset }
  | { type: 'preset-imported'; presets: Preset[] }
  | { type: 'presets-changed' };
