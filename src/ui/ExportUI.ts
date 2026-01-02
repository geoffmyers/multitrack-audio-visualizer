import { AudioEngine } from '../core/AudioEngine';
import { VideoExporter } from '../export/VideoExporter';
import type { ExportOptions } from '../types/audio.types';
import type { LayoutMode, AmplitudeMode } from '../types/visualizer.types';

export class ExportUI {
  private audioEngine: AudioEngine;
  private videoExporter: VideoExporter;
  private exportBtn: HTMLButtonElement;
  private progressContainer: HTMLElement;
  private progressFill: HTMLElement;
  private isExporting: boolean = false;
  private getCurrentLayout: () => LayoutMode;
  private getCurrentAmplitudeMode: () => AmplitudeMode;
  private getCurrentHeightPercent: () => number;
  private getCurrentSmoothingLevel: () => number;
  private getCurrentWindowDuration: () => number;

  constructor(
    audioEngine: AudioEngine,
    getCurrentLayout: () => LayoutMode,
    getCurrentAmplitudeMode: () => AmplitudeMode,
    getCurrentHeightPercent: () => number,
    getCurrentSmoothingLevel: () => number,
    getCurrentWindowDuration: () => number
  ) {
    this.audioEngine = audioEngine;
    this.videoExporter = new VideoExporter(audioEngine);
    this.getCurrentLayout = getCurrentLayout;
    this.getCurrentAmplitudeMode = getCurrentAmplitudeMode;
    this.getCurrentHeightPercent = getCurrentHeightPercent;
    this.getCurrentSmoothingLevel = getCurrentSmoothingLevel;
    this.getCurrentWindowDuration = getCurrentWindowDuration;

    this.exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    this.progressContainer = document.getElementById('export-progress')!;
    this.progressFill = document.getElementById('progress-fill')!;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.exportBtn.addEventListener('click', () => {
      this.startExport();
    });

    // Enable/disable export button based on tracks
    this.audioEngine.addEventListener('trackadded', () => {
      this.updateExportButton();
    });

    this.audioEngine.addEventListener('trackremoved', () => {
      this.updateExportButton();
    });
  }

  private updateExportButton(): void {
    const hasTracks = this.audioEngine.getTracks().length > 0;
    this.exportBtn.disabled = !hasTracks || this.isExporting;
  }

  private async startExport(): Promise<void> {
    if (this.isExporting) return;

    // Pause playback if playing
    const wasPlaying = this.audioEngine.getPlaybackState().isPlaying;
    if (wasPlaying) {
      this.audioEngine.pause();
    }

    this.isExporting = true;
    this.exportBtn.disabled = true;
    this.progressContainer.classList.add('active');

    const options: ExportOptions = {
      format: 'mp4',
      codec: 'h265',
      fps: 60,
      quality: 23, // CRF value
      audioBitrate: '192k',
      layout: this.getCurrentLayout(),
      amplitudeMode: this.getCurrentAmplitudeMode(),
      heightPercent: this.getCurrentHeightPercent(),
      smoothingLevel: this.getCurrentSmoothingLevel(),
      windowDuration: this.getCurrentWindowDuration()
    };

    try {
      await this.videoExporter.export(
        options,
        (progress, message) => {
          this.updateProgress(progress, message);
        },
        (blob) => {
          this.downloadVideo(blob);
          this.resetExportUI();
        },
        (error) => {
          alert(`Export failed: ${error}`);
          this.resetExportUI();
        }
      );
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.resetExportUI();
    }
  }

  private updateProgress(progress: number, message: string): void {
    const percent = Math.round(progress);
    this.progressFill.style.width = `${percent}%`;
    this.progressFill.textContent = `${percent}% - ${message}`;
  }

  private downloadVideo(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visualizer_${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private resetExportUI(): void {
    this.isExporting = false;
    this.progressContainer.classList.remove('active');
    this.progressFill.style.width = '0%';
    this.progressFill.textContent = '0%';
    this.updateExportButton();
  }
}
