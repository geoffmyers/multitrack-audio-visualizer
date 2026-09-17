import { type AudioEngine } from '../core/AudioEngine';
import { ColorManager } from '../visualization/ColorManager';
import { FileLoader } from '../utils/FileLoader';
import { fetchDemoTracks, downloadDemoTracks } from '../utils/DemoTracks';
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
    void this.setupDemoTracks();
  }

  /** Show "Load demo tracks" when the deployment ships demo/tracks.json. */
  private async setupDemoTracks(): Promise<void> {
    const button = document.getElementById('load-demo-btn') as HTMLButtonElement | null;
    if (!button) {
      return;
    }
    const tracks = await fetchDemoTracks(document.baseURI);
    if (tracks.length === 0) {
      return;
    }
    button.hidden = false;
    button.addEventListener('click', async () => {
      button.disabled = true;
      this.showLoading();
      try {
        const files = await downloadDemoTracks(tracks);
        await this.loadFiles(files);
      } catch (error) {
        console.error('Error loading demo tracks:', error);
        alert('The demo tracks could not be downloaded.');
      } finally {
        this.hideLoading();
        button.disabled = false;
      }
    });
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
    // `track.name` comes straight from the dropped file's name, so it must
    // never be interpolated into an HTML string (innerHTML) -- a file named
    // e.g. `<img src=x onerror=...>.wav` would otherwise run script in the
    // app's origin. Everything below is built with DOM APIs (createElement /
    // textContent / setAttribute), which never parse their input as markup.
    const div = document.createElement('div');
    div.className = 'track-item';
    div.style.borderLeftColor = track.color;

    const header = document.createElement('div');
    header.className = 'track-header';

    const nameEl = document.createElement('div');
    nameEl.className = 'track-name';
    nameEl.title = track.name;
    nameEl.textContent = track.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'track-remove';
    removeBtn.dataset.trackId = track.id;
    removeBtn.textContent = '×';

    header.appendChild(nameEl);
    header.appendChild(removeBtn);

    const controls = document.createElement('div');
    controls.className = 'track-controls';

    const colorControl = document.createElement('div');
    colorControl.className = 'track-control';
    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = track.color;
    colorInput.dataset.trackId = track.id;
    colorInput.dataset.control = 'color';
    colorControl.appendChild(colorLabel);
    colorControl.appendChild(colorInput);

    const opacityControl = document.createElement('div');
    opacityControl.className = 'track-control';
    const opacityLabel = document.createElement('label');
    opacityLabel.textContent = `Opacity: ${Math.round(track.opacity * 100)}%`;
    const opacityInput = document.createElement('input');
    opacityInput.type = 'range';
    opacityInput.min = '0';
    opacityInput.max = '100';
    opacityInput.value = String(track.opacity * 100);
    opacityInput.dataset.trackId = track.id;
    opacityInput.dataset.control = 'opacity';
    opacityControl.appendChild(opacityLabel);
    opacityControl.appendChild(opacityInput);

    controls.appendChild(colorControl);
    controls.appendChild(opacityControl);

    div.appendChild(header);
    div.appendChild(controls);

    // Remove button
    removeBtn.addEventListener('click', () => {
      this.audioEngine.removeTrack(track.id);
      this.onTrackUpdate();
    });

    // Color input
    colorInput.addEventListener('input', () => {
      track.setColor(colorInput.value);
      div.style.borderLeftColor = colorInput.value;
      this.onTrackUpdate();
    });

    // Opacity slider
    opacityInput.addEventListener('input', () => {
      const opacity = parseFloat(opacityInput.value) / 100;
      track.setOpacity(opacity);
      opacityLabel.textContent = `Opacity: ${Math.round(opacity * 100)}%`;
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
