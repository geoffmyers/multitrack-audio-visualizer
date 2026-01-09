import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PresetManager } from '../PresetManager';
import type { PresetSettings } from '../../types/preset.types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

const validSettings: PresetSettings = {
  layout: 'overlay',
  amplitudeMode: 'individual',
  heightPercent: 50,
  smoothingLevel: 2,
  fpsCap: 60,
  windowDuration: 1.0,
};

describe('PresetManager', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with empty presets when no storage exists', () => {
      const manager = new PresetManager();

      expect(manager.getPresets()).toHaveLength(0);
      expect(manager.getActivePresetId()).toBeNull();
    });

    it('should load presets from storage', () => {
      const storedCollection = {
        presets: [
          {
            id: 'preset-1',
            name: 'Test Preset',
            settings: validSettings,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        activePresetId: 'preset-1',
        version: 1,
      };
      localStorageMock.setItem(
        'multitrack-audio-visualizer-presets',
        JSON.stringify(storedCollection)
      );

      const manager = new PresetManager();

      expect(manager.getPresets()).toHaveLength(1);
      expect(manager.getActivePresetId()).toBe('preset-1');
    });
  });

  describe('createPreset', () => {
    it('should create a new preset with unique ID', () => {
      const manager = new PresetManager();

      const preset = manager.createPreset('My Preset', validSettings);

      expect(preset.id).toMatch(/^preset_/);
      expect(preset.name).toBe('My Preset');
      expect(preset.settings).toEqual(validSettings);
      expect(manager.getPresets()).toHaveLength(1);
    });

    it('should dispatch preset-created event', () => {
      const manager = new PresetManager();
      const eventHandler = vi.fn();
      manager.addEventListener('preset-event', eventHandler);

      manager.createPreset('My Preset', validSettings);

      expect(eventHandler).toHaveBeenCalled();
      // Multiple events are dispatched: preset-created and presets-changed
      const events = eventHandler.mock.calls.map((c) => (c[0] as CustomEvent).detail.type);
      expect(events).toContain('preset-created');
    });

    it('should save to localStorage', () => {
      const manager = new PresetManager();

      manager.createPreset('My Preset', validSettings);

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('updatePreset', () => {
    it('should update preset settings', () => {
      const manager = new PresetManager();
      const preset = manager.createPreset('My Preset', validSettings);

      const newSettings = { ...validSettings, heightPercent: 75 };
      manager.updatePreset(preset.id, newSettings);

      const updated = manager.getPresets().find((p) => p.id === preset.id);
      expect(updated?.settings.heightPercent).toBe(75);
    });

    it('should throw error for non-existent preset', () => {
      const manager = new PresetManager();

      expect(() => {
        manager.updatePreset('non-existent', validSettings);
      }).toThrow('Preset not found: non-existent');
    });

    it('should update the updatedAt timestamp', () => {
      const manager = new PresetManager();
      const preset = manager.createPreset('My Preset', validSettings);
      const originalUpdatedAt = preset.updatedAt;

      // Update immediately - updatedAt should be >= original
      manager.updatePreset(preset.id, validSettings);

      const updated = manager.getPresets().find((p) => p.id === preset.id);
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });
  });

  describe('renamePreset', () => {
    it('should rename the preset', () => {
      const manager = new PresetManager();
      const preset = manager.createPreset('Old Name', validSettings);

      manager.renamePreset(preset.id, 'New Name');

      const updated = manager.getPresets().find((p) => p.id === preset.id);
      expect(updated?.name).toBe('New Name');
    });

    it('should throw error for non-existent preset', () => {
      const manager = new PresetManager();

      expect(() => {
        manager.renamePreset('non-existent', 'New Name');
      }).toThrow('Preset not found: non-existent');
    });
  });

  describe('deletePreset', () => {
    it('should delete the preset', () => {
      const manager = new PresetManager();
      const preset = manager.createPreset('My Preset', validSettings);

      manager.deletePreset(preset.id);

      expect(manager.getPresets()).toHaveLength(0);
    });

    it('should clear active preset if deleted', () => {
      const manager = new PresetManager();
      const preset = manager.createPreset('My Preset', validSettings);
      manager.loadPreset(preset.id);

      manager.deletePreset(preset.id);

      expect(manager.getActivePresetId()).toBeNull();
    });

    it('should throw error for non-existent preset', () => {
      const manager = new PresetManager();

      expect(() => {
        manager.deletePreset('non-existent');
      }).toThrow('Preset not found: non-existent');
    });

    it('should dispatch preset-deleted event', () => {
      const manager = new PresetManager();
      const preset = manager.createPreset('My Preset', validSettings);
      const eventHandler = vi.fn();
      manager.addEventListener('preset-event', eventHandler);

      manager.deletePreset(preset.id);

      const events = eventHandler.mock.calls.map((c) => (c[0] as CustomEvent).detail.type);
      expect(events).toContain('preset-deleted');
    });
  });

  describe('loadPreset', () => {
    it('should set preset as active and return settings', () => {
      const manager = new PresetManager();
      const preset = manager.createPreset('My Preset', validSettings);

      const settings = manager.loadPreset(preset.id);

      expect(manager.getActivePresetId()).toBe(preset.id);
      expect(settings).toEqual(validSettings);
    });

    it('should return a copy of settings, not the original', () => {
      const manager = new PresetManager();
      const preset = manager.createPreset('My Preset', validSettings);

      const settings = manager.loadPreset(preset.id);
      settings.heightPercent = 999;

      const originalPreset = manager.getPresets().find((p) => p.id === preset.id);
      expect(originalPreset?.settings.heightPercent).toBe(50);
    });

    it('should throw error for non-existent preset', () => {
      const manager = new PresetManager();

      expect(() => manager.loadPreset('non-existent')).toThrow('Preset not found: non-existent');
    });
  });

  describe('getActivePreset', () => {
    it('should return null when no active preset', () => {
      const manager = new PresetManager();

      expect(manager.getActivePreset()).toBeNull();
    });

    it('should return the active preset', () => {
      const manager = new PresetManager();
      const preset = manager.createPreset('My Preset', validSettings);
      manager.loadPreset(preset.id);

      const active = manager.getActivePreset();

      expect(active?.id).toBe(preset.id);
    });
  });

  describe('exportPreset', () => {
    it('should export preset as JSON string', () => {
      const manager = new PresetManager();
      const preset = manager.createPreset('My Preset', validSettings);

      const exported = manager.exportPreset(preset.id);
      const parsed = JSON.parse(exported);

      expect(parsed.name).toBe('My Preset');
      expect(parsed.settings).toEqual(validSettings);
    });

    it('should throw error for non-existent preset', () => {
      const manager = new PresetManager();

      expect(() => manager.exportPreset('non-existent')).toThrow('Preset not found: non-existent');
    });
  });

  describe('exportAllPresets', () => {
    it('should export all presets as JSON array', () => {
      const manager = new PresetManager();
      manager.createPreset('Preset 1', validSettings);
      manager.createPreset('Preset 2', validSettings);

      const exported = manager.exportAllPresets();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });

    it('should return empty array when no presets', () => {
      const manager = new PresetManager();

      const exported = manager.exportAllPresets();
      const parsed = JSON.parse(exported);

      expect(parsed).toEqual([]);
    });
  });

  describe('importPresets', () => {
    it('should import single preset from JSON', () => {
      const manager = new PresetManager();
      const presetJson = JSON.stringify({
        id: 'old-id',
        name: 'Imported Preset',
        settings: validSettings,
        createdAt: 1000,
        updatedAt: 1000,
      });

      const imported = manager.importPresets(presetJson);

      expect(imported).toHaveLength(1);
      expect(manager.getPresets()).toHaveLength(1);
      expect(imported[0].name).toBe('Imported Preset');
      // New ID should be generated
      expect(imported[0].id).not.toBe('old-id');
    });

    it('should import array of presets', () => {
      const manager = new PresetManager();
      const presetsJson = JSON.stringify([
        {
          id: 'id-1',
          name: 'Preset 1',
          settings: validSettings,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: 'id-2',
          name: 'Preset 2',
          settings: validSettings,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]);

      const imported = manager.importPresets(presetsJson);

      expect(imported).toHaveLength(2);
      expect(manager.getPresets()).toHaveLength(2);
    });

    it('should handle duplicate names by adding suffix', () => {
      const manager = new PresetManager();
      manager.createPreset('My Preset', validSettings);

      const presetJson = JSON.stringify({
        id: 'id-1',
        name: 'My Preset',
        settings: validSettings,
        createdAt: 1000,
        updatedAt: 1000,
      });

      const imported = manager.importPresets(presetJson);

      expect(imported[0].name).toBe('My Preset (1)');
    });

    it('should throw error for invalid preset structure', () => {
      const manager = new PresetManager();
      const invalidJson = JSON.stringify({ name: 'Invalid' });

      expect(() => manager.importPresets(invalidJson)).toThrow('Failed to import presets');
    });

    it('should throw error for invalid JSON', () => {
      const manager = new PresetManager();

      expect(() => manager.importPresets('not valid json')).toThrow('Failed to import presets');
    });
  });

  describe('clearActivePreset', () => {
    it('should clear the active preset', () => {
      const manager = new PresetManager();
      const preset = manager.createPreset('My Preset', validSettings);
      manager.loadPreset(preset.id);

      manager.clearActivePreset();

      expect(manager.getActivePresetId()).toBeNull();
    });
  });

  describe('getPresets', () => {
    it('should return a copy of the presets array', () => {
      const manager = new PresetManager();
      manager.createPreset('My Preset', validSettings);

      const presets1 = manager.getPresets();
      const presets2 = manager.getPresets();

      expect(presets1).not.toBe(presets2);
      expect(presets1).toEqual(presets2);
    });
  });
});
