import { type AudioEngine } from '../core/AudioEngine';
import { ColorManager } from '../visualization/ColorManager';
import { FileLoader } from '../utils/FileLoader';
import type { AudioTrack } from '../core/AudioTrack';

export class TrackControls {
  private audioEngine: AudioEngine;
  private trackListEl: HTMLElement;
  private addTrackBtn: HTMLButtonElement;
  private fileInput: HTMLInputElement;
  private dropZone: HTMLElement;
  private loadingOverlay: HTMLElement;
  private onTrackUpdate: () => void;

  constructor(audioEngine: AudioEngine, onTrackUpdate: () => void) {
    this.audioEngine = audioEngine;
    this.onTrackUpdate = onTrackUpdate;

    this.trackListEl = document.getElementById('track-list')!;
    this.addTrackBtn = document.getElementById('add-track-btn') as HTMLButtonElement;
    this.fileInput = document.getElementById('file-input') as HTMLInputElement;
    this.dropZone = document.getElementById('drop-zone')!;
    this.loadingOverlay = document.getElementById('loading-overlay')!;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Add track button
    this.addTrackBtn.addEventListener('click', () => {
      this.fileInput.click();
    });

    // File input change
    this.fileInput.addEventListener('change', async () => {
      if (this.fileInput.files && this.fileInput.files.length > 0) {
        await this.loadFiles(Array.from(this.fileInput.files));
        this.fileInput.value = ''; // Reset input
      }
    });

    // Drag and drop
    FileLoader.setupDragAndDrop(this.dropZone, async (files) => {
      await this.loadFiles(files);
    });

    // Audio engine events
    this.audioEngine.addEventListener('trackadded', () => {
      this.renderTrackList();
    });

    this.audioEngine.addEventListener('trackremoved', () => {
      this.renderTrackList();
    });
  }

  private async loadFiles(files: File[]): Promise<void> {
    const wavFiles = FileLoader.filterWavFiles(files);

    if (wavFiles.length === 0) {
      alert('Please select WAV files only');
      return;
    }

    this.showLoading();

    try {
      const colors = ColorManager.getDefaultPalette();
      const startIndex = this.audioEngine.getTracks().length;

      for (let i = 0; i < wavFiles.length; i++) {
        const color = colors[(startIndex + i) % colors.length];
        await this.audioEngine.loadTrack(wavFiles[i], color, 0.7);
      }

      this.onTrackUpdate();
    } catch (error) {
      console.error('Error loading tracks:', error);
      alert('Error loading audio files. Please ensure they are valid WAV files.');
    } finally {
      this.hideLoading();
    }
  }

  private renderTrackList(): void {
    const tracks = this.audioEngine.getTracks();

    if (tracks.length === 0) {
      this.trackListEl.innerHTML =
        '<p style="color: #666; font-size: 13px; text-align: center;">No tracks loaded</p>';
      return;
    }

    this.trackListEl.innerHTML = '';

    tracks.forEach((track, index) => {
      const trackEl = this.createTrackElement(track, index);
      this.trackListEl.appendChild(trackEl);
    });
  }

  private createTrackElement(track: AudioTrack, index: number): HTMLElement {
    const div = document.createElement('div');
    div.className = 'track-item';
    div.style.borderLeftColor = track.color;

    div.innerHTML = `
      <div class="track-header">
        <div class="track-name" title="${track.name}">${track.name}</div>
        <button class="track-remove" data-track-id="${track.id}">×</button>
      </div>
      <div class="track-controls">
        <div class="track-control">
          <label>Color</label>
          <input type="color" value="${track.color}" data-track-id="${track.id}" data-control="color">
        </div>
        <div class="track-control">
          <label>Opacity: ${Math.round(track.opacity * 100)}%</label>
          <input type="range" min="0" max="100" value="${track.opacity * 100}"
                 data-track-id="${track.id}" data-control="opacity">
        </div>
      </div>
    `;

    // Remove button
    const removeBtn = div.querySelector('.track-remove')!;
    removeBtn.addEventListener('click', () => {
      this.audioEngine.removeTrack(track.id);
      this.onTrackUpdate();
    });

    // Color input
    const colorInput = div.querySelector('[data-control="color"]') as HTMLInputElement;
    colorInput.addEventListener('input', () => {
      track.setColor(colorInput.value);
      div.style.borderLeftColor = colorInput.value;
      this.onTrackUpdate();
    });

    // Opacity slider
    const opacityInput = div.querySelector('[data-control="opacity"]') as HTMLInputElement;
    opacityInput.addEventListener('input', () => {
      const opacity = parseFloat(opacityInput.value) / 100;
      track.setOpacity(opacity);
      const label = opacityInput.previousElementSibling as HTMLElement;
      label.textContent = `Opacity: ${Math.round(opacity * 100)}%`;
      this.onTrackUpdate();
    });

    return div;
  }

  private showLoading(): void {
    this.loadingOverlay.classList.add('active');
  }

  private hideLoading(): void {
    this.loadingOverlay.classList.remove('active');
  }
}
