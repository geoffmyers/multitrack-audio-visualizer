import type { Preset, PresetSettings, PresetCollection, PresetEvent } from '../types/preset.types';

/**
 * Manages user presets: save, load, rename, delete, import, export
 * Uses localStorage for persistence
 */
export class PresetManager extends EventTarget {
  private static readonly STORAGE_KEY = 'multitrack-audio-visualizer-presets';
  private static readonly VERSION = 1;
  private collection: PresetCollection;

  constructor() {
    super();
    this.collection = this.loadFromStorage();
    console.log('[PresetManager] Initialized with', this.collection.presets.length, 'presets');
  }

  /**
   * Get all presets
   */
  public getPresets(): Preset[] {
    return [...this.collection.presets];
  }

  /**
   * Get active preset ID
   */
  public getActivePresetId(): string | null {
    return this.collection.activePresetId;
  }

  /**
   * Get active preset
   */
  public getActivePreset(): Preset | null {
    if (!this.collection.activePresetId) {
      return null;
    }
    return this.collection.presets.find(p => p.id === this.collection.activePresetId) || null;
  }

  /**
   * Create a new preset
   */
  public createPreset(name: string, settings: PresetSettings): Preset {
    const preset: Preset = {
      id: this.generateId(),
      name,
      settings,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.collection.presets.push(preset);
    this.saveToStorage();
    this.dispatchPresetEvent({ type: 'preset-created', preset });
    console.log('[PresetManager] Created preset:', preset.name);

    return preset;
  }

  /**
   * Update an existing preset's settings
   */
  public updatePreset(presetId: string, settings: PresetSettings): void {
    const preset = this.collection.presets.find(p => p.id === presetId);
    if (!preset) {
      throw new Error(`Preset not found: ${presetId}`);
    }

    preset.settings = settings;
    preset.updatedAt = Date.now();
    this.saveToStorage();
    this.dispatchPresetEvent({ type: 'preset-updated', preset });
    console.log('[PresetManager] Updated preset:', preset.name);
  }

  /**
   * Rename a preset
   */
  public renamePreset(presetId: string, newName: string): void {
    const preset = this.collection.presets.find(p => p.id === presetId);
    if (!preset) {
      throw new Error(`Preset not found: ${presetId}`);
    }

    const oldName = preset.name;
    preset.name = newName;
    preset.updatedAt = Date.now();
    this.saveToStorage();
    this.dispatchPresetEvent({ type: 'preset-updated', preset });
    console.log('[PresetManager] Renamed preset from', oldName, 'to', newName);
  }

  /**
   * Delete a preset
   */
  public deletePreset(presetId: string): void {
    const index = this.collection.presets.findIndex(p => p.id === presetId);
    if (index === -1) {
      throw new Error(`Preset not found: ${presetId}`);
    }

    const preset = this.collection.presets[index];
    this.collection.presets.splice(index, 1);

    // Clear active preset if it was deleted
    if (this.collection.activePresetId === presetId) {
      this.collection.activePresetId = null;
    }

    this.saveToStorage();
    this.dispatchPresetEvent({ type: 'preset-deleted', presetId });
    console.log('[PresetManager] Deleted preset:', preset.name);
  }

  /**
   * Load a preset (sets it as active and returns its settings)
   */
  public loadPreset(presetId: string): PresetSettings {
    const preset = this.collection.presets.find(p => p.id === presetId);
    if (!preset) {
      throw new Error(`Preset not found: ${presetId}`);
    }

    this.collection.activePresetId = presetId;
    this.saveToStorage();
    this.dispatchPresetEvent({ type: 'preset-loaded', preset });
    console.log('[PresetManager] Loaded preset:', preset.name);

    return { ...preset.settings };
  }

  /**
   * Export a preset to JSON
   */
  public exportPreset(presetId: string): string {
    const preset = this.collection.presets.find(p => p.id === presetId);
    if (!preset) {
      throw new Error(`Preset not found: ${presetId}`);
    }

    return JSON.stringify(preset, null, 2);
  }

  /**
   * Export all presets to JSON
   */
  public exportAllPresets(): string {
    return JSON.stringify(this.collection.presets, null, 2);
  }

  /**
   * Import presets from JSON (merges with existing presets)
   */
  public importPresets(jsonString: string): Preset[] {
    try {
      const data = JSON.parse(jsonString);

      // Handle both single preset and array of presets
      const presetsToImport: Preset[] = Array.isArray(data) ? data : [data];

      // Validate preset structure
      for (const preset of presetsToImport) {
        if (!this.isValidPreset(preset)) {
          throw new Error('Invalid preset structure');
        }
      }

      // Generate new IDs to avoid conflicts and add to collection
      const importedPresets: Preset[] = [];
      for (const preset of presetsToImport) {
        const newPreset: Preset = {
          ...preset,
          id: this.generateId(),
          name: this.getUniquePresetName(preset.name),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.collection.presets.push(newPreset);
        importedPresets.push(newPreset);
      }

      this.saveToStorage();
      this.dispatchPresetEvent({ type: 'preset-imported', presets: importedPresets });
      console.log('[PresetManager] Imported', importedPresets.length, 'preset(s)');

      return importedPresets;
    } catch (error) {
      throw new Error(`Failed to import presets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear active preset
   */
  public clearActivePreset(): void {
    this.collection.activePresetId = null;
    this.saveToStorage();
  }

  /**
   * Load presets from localStorage
   */
  private loadFromStorage(): PresetCollection {
    try {
      const stored = localStorage.getItem(PresetManager.STORAGE_KEY);
      if (stored) {
        const collection = JSON.parse(stored) as PresetCollection;
        // Validate version compatibility
        if (collection.version === PresetManager.VERSION) {
          return collection;
        }
        console.warn('[PresetManager] Version mismatch, starting fresh');
      }
    } catch (error) {
      console.error('[PresetManager] Failed to load from storage:', error);
    }

    // Return empty collection
    return {
      presets: [],
      activePresetId: null,
      version: PresetManager.VERSION,
    };
  }

  /**
   * Save presets to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(PresetManager.STORAGE_KEY, JSON.stringify(this.collection));
      this.dispatchPresetEvent({ type: 'presets-changed' });
    } catch (error) {
      console.error('[PresetManager] Failed to save to storage:', error);
      throw new Error('Failed to save presets');
    }
  }

  /**
   * Generate unique preset ID
   */
  private generateId(): string {
    return `preset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get unique preset name (adds number suffix if name exists)
   */
  private getUniquePresetName(baseName: string): string {
    const existingNames = new Set(this.collection.presets.map(p => p.name));

    if (!existingNames.has(baseName)) {
      return baseName;
    }

    let counter = 1;
    let newName: string;
    do {
      newName = `${baseName} (${counter})`;
      counter++;
    } while (existingNames.has(newName));

    return newName;
  }

  /**
   * Validate preset structure
   */
  private isValidPreset(preset: any): preset is Preset {
    return (
      preset &&
      typeof preset === 'object' &&
      typeof preset.name === 'string' &&
      preset.settings &&
      typeof preset.settings === 'object' &&
      typeof preset.settings.layout === 'string' &&
      typeof preset.settings.amplitudeMode === 'string' &&
      typeof preset.settings.heightPercent === 'number' &&
      typeof preset.settings.smoothingLevel === 'number' &&
      typeof preset.settings.fpsCap === 'number' &&
      typeof preset.settings.windowDuration === 'number'
    );
  }

  /**
   * Dispatch preset event
   */
  private dispatchPresetEvent(event: PresetEvent): void {
    this.dispatchEvent(new CustomEvent('preset-event', { detail: event }));
  }
}
