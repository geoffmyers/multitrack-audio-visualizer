import type { PresetManager } from '../core/PresetManager';
import type { PresetSettings } from '../types/preset.types';

/**
 * UI component for managing presets: create, rename, delete, load, import, export
 */
export class PresetUI {
  private presetManager: PresetManager;
  private getSettings: () => PresetSettings;
  private applySettings: (settings: PresetSettings) => void;
  private presetSelect: HTMLSelectElement;
  private savePresetBtn: HTMLButtonElement;
  private deletePresetBtn: HTMLButtonElement;
  private renamePresetBtn: HTMLButtonElement;
  private importPresetBtn: HTMLButtonElement;
  private exportPresetBtn: HTMLButtonElement;
  private exportAllPresetsBtn: HTMLButtonElement;
  private fileInput: HTMLInputElement;

  constructor(
    presetManager: PresetManager,
    getSettings: () => PresetSettings,
    applySettings: (settings: PresetSettings) => void
  ) {
    this.presetManager = presetManager;
    this.getSettings = getSettings;
    this.applySettings = applySettings;

    // Get UI elements
    this.presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
    this.savePresetBtn = document.getElementById('save-preset-btn') as HTMLButtonElement;
    this.deletePresetBtn = document.getElementById('delete-preset-btn') as HTMLButtonElement;
    this.renamePresetBtn = document.getElementById('rename-preset-btn') as HTMLButtonElement;
    this.importPresetBtn = document.getElementById('import-preset-btn') as HTMLButtonElement;
    this.exportPresetBtn = document.getElementById('export-preset-btn') as HTMLButtonElement;
    this.exportAllPresetsBtn = document.getElementById('export-all-presets-btn') as HTMLButtonElement;
    this.fileInput = document.getElementById('preset-file-input') as HTMLInputElement;

    // Setup event listeners
    this.setupEventListeners();

    // Initial UI update
    this.updatePresetList();
    this.updateButtonStates();

    // Listen for preset changes
    this.presetManager.addEventListener('preset-event', () => {
      this.updatePresetList();
      this.updateButtonStates();
    });

    console.log('[PresetUI] Initialized');
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    // Preset selection
    this.presetSelect.addEventListener('change', () => {
      const selectedId = this.presetSelect.value;
      if (selectedId) {
        this.loadPreset(selectedId);
      }
    });

    // Save preset (create or update)
    this.savePresetBtn.addEventListener('click', () => {
      this.savePreset();
    });

    // Delete preset
    this.deletePresetBtn.addEventListener('click', () => {
      this.deletePreset();
    });

    // Rename preset
    this.renamePresetBtn.addEventListener('click', () => {
      this.renamePreset();
    });

    // Import preset
    this.importPresetBtn.addEventListener('click', () => {
      this.fileInput.click();
    });

    this.fileInput.addEventListener('change', () => {
      this.importPreset();
    });

    // Export selected preset
    this.exportPresetBtn.addEventListener('click', () => {
      this.exportPreset();
    });

    // Export all presets
    this.exportAllPresetsBtn.addEventListener('click', () => {
      this.exportAllPresets();
    });
  }

  /**
   * Update preset dropdown list
   */
  private updatePresetList(): void {
    const presets = this.presetManager.getPresets();
    const activeId = this.presetManager.getActivePresetId();

    // Clear existing options
    this.presetSelect.innerHTML = '<option value="">-- Select Preset --</option>';

    // Add preset options
    for (const preset of presets) {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.name;
      if (preset.id === activeId) {
        option.selected = true;
      }
      this.presetSelect.appendChild(option);
    }
  }

  /**
   * Update button enabled/disabled states
   */
  private updateButtonStates(): void {
    const hasPresets = this.presetManager.getPresets().length > 0;
    const hasSelection = this.presetSelect.value !== '';

    this.deletePresetBtn.disabled = !hasSelection;
    this.renamePresetBtn.disabled = !hasSelection;
    this.exportPresetBtn.disabled = !hasSelection;
    this.exportAllPresetsBtn.disabled = !hasPresets;
  }

  /**
   * Save current settings as preset (create new or update existing)
   */
  private savePreset(): void {
    const selectedId = this.presetSelect.value;
    const currentSettings = this.getSettings();

    if (selectedId) {
      // Update existing preset
      const confirmed = confirm('Update existing preset with current settings?');
      if (confirmed) {
        try {
          this.presetManager.updatePreset(selectedId, currentSettings);
          alert('Preset updated successfully!');
        } catch (error) {
          alert(`Failed to update preset: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } else {
      // Create new preset
      const name = prompt('Enter a name for this preset:');
      if (name && name.trim()) {
        try {
          const preset = this.presetManager.createPreset(name.trim(), currentSettings);
          this.presetSelect.value = preset.id;
          alert('Preset created successfully!');
        } catch (error) {
          alert(`Failed to create preset: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
  }

  /**
   * Load selected preset
   */
  private loadPreset(presetId: string): void {
    try {
      const settings = this.presetManager.loadPreset(presetId);
      this.applySettings(settings);
      console.log('[PresetUI] Loaded preset:', presetId);
    } catch (error) {
      alert(`Failed to load preset: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.presetSelect.value = '';
    }
  }

  /**
   * Delete selected preset
   */
  private deletePreset(): void {
    const selectedId = this.presetSelect.value;
    if (!selectedId) {
      return;
    }

    const presets = this.presetManager.getPresets();
    const preset = presets.find(p => p.id === selectedId);
    if (!preset) {
      return;
    }

    const confirmed = confirm(`Delete preset "${preset.name}"?`);
    if (confirmed) {
      try {
        this.presetManager.deletePreset(selectedId);
        this.presetSelect.value = '';
        alert('Preset deleted successfully!');
      } catch (error) {
        alert(`Failed to delete preset: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Rename selected preset
   */
  private renamePreset(): void {
    const selectedId = this.presetSelect.value;
    if (!selectedId) {
      return;
    }

    const presets = this.presetManager.getPresets();
    const preset = presets.find(p => p.id === selectedId);
    if (!preset) {
      return;
    }

    const newName = prompt(`Rename preset "${preset.name}" to:`, preset.name);
    if (newName && newName.trim() && newName.trim() !== preset.name) {
      try {
        this.presetManager.renamePreset(selectedId, newName.trim());
        alert('Preset renamed successfully!');
      } catch (error) {
        alert(`Failed to rename preset: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Import presets from JSON file
   */
  private importPreset(): void {
    const file = this.fileInput.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonString = e.target?.result as string;
        const importedPresets = this.presetManager.importPresets(jsonString);
        alert(`Successfully imported ${importedPresets.length} preset(s)!`);

        // Auto-select first imported preset
        if (importedPresets.length > 0) {
          this.presetSelect.value = importedPresets[0].id;
          this.loadPreset(importedPresets[0].id);
        }
      } catch (error) {
        alert(`Failed to import presets: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Reset file input
      this.fileInput.value = '';
    };

    reader.onerror = () => {
      alert('Failed to read file');
      this.fileInput.value = '';
    };

    reader.readAsText(file);
  }

  /**
   * Export selected preset to JSON file
   */
  private exportPreset(): void {
    const selectedId = this.presetSelect.value;
    if (!selectedId) {
      return;
    }

    try {
      const presets = this.presetManager.getPresets();
      const preset = presets.find(p => p.id === selectedId);
      if (!preset) {
        return;
      }

      const jsonString = this.presetManager.exportPreset(selectedId);
      this.downloadJSON(jsonString, `${preset.name}.json`);
    } catch (error) {
      alert(`Failed to export preset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export all presets to JSON file
   */
  private exportAllPresets(): void {
    try {
      const jsonString = this.presetManager.exportAllPresets();
      this.downloadJSON(jsonString, 'all-presets.json');
    } catch (error) {
      alert(`Failed to export presets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download JSON string as file
   */
  private downloadJSON(jsonString: string, filename: string): void {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
