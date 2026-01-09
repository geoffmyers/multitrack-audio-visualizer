import { type AudioEngine } from '../core/AudioEngine';
import { TimeSync } from '../utils/TimeSync';

export class Controls {
  private audioEngine: AudioEngine;
  private playPauseBtn: HTMLButtonElement;
  private seekBar: HTMLInputElement;
  private currentTimeEl: HTMLElement;
  private totalTimeEl: HTMLElement;
  private isSeeking: boolean = false;

  constructor(audioEngine: AudioEngine) {
    this.audioEngine = audioEngine;

    this.playPauseBtn = document.getElementById('play-pause-btn') as HTMLButtonElement;
    this.seekBar = document.getElementById('seek-bar') as HTMLInputElement;
    this.currentTimeEl = document.getElementById('current-time')!;
    this.totalTimeEl = document.getElementById('total-time')!;

    this.setupEventListeners();
    // this.loadSettings(); // Load settings on initialization
  }

  private setupEventListeners(): void {
    // Play/Pause button
    this.playPauseBtn.addEventListener('click', () => {
      const state = this.audioEngine.getPlaybackState();
      if (state.isPlaying) {
        this.audioEngine.pause();
      } else {
        this.audioEngine.play();
      }
      // this.saveSettings(); // Save settings on play/pause
    });

    // Keyboard shortcut (spacebar)
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        this.playPauseBtn.click();
      }
    });

    // Seek bar
    this.seekBar.addEventListener('mousedown', () => {
      this.isSeeking = true;
    });

    this.seekBar.addEventListener('mouseup', () => {
      this.isSeeking = false;
    });

    this.seekBar.addEventListener('input', () => {
      if (this.isSeeking) {
        const duration = this.audioEngine.getDuration();
        const time = (parseFloat(this.seekBar.value) / 100) * duration;
        this.audioEngine.seek(time);
        // this.saveSettings(); // Save settings on seek bar change
      }
    });

    // Audio engine events
    this.audioEngine.addEventListener('play', () => {
      this.playPauseBtn.textContent = 'Pause';
    });

    this.audioEngine.addEventListener('pause', () => {
      this.playPauseBtn.textContent = 'Play';
    });

    this.audioEngine.addEventListener('ended', () => {
      this.playPauseBtn.textContent = 'Play';
    });

    this.audioEngine.addEventListener('timeupdate', ((e: CustomEvent) => {
      this.updateTimeDisplay(e.detail.currentTime, e.detail.duration);
    }) as EventListener);

    this.audioEngine.addEventListener('trackadded', () => {
      this.updateControls();
    });

    this.audioEngine.addEventListener('trackremoved', () => {
      this.updateControls();
    });
  }

  private updateTimeDisplay(currentTime: number, duration: number): void {
    // Update time text
    this.currentTimeEl.textContent = TimeSync.formatTime(currentTime);
    this.totalTimeEl.textContent = TimeSync.formatTime(duration);

    // Update seek bar (only if not seeking)
    if (!this.isSeeking && duration > 0) {
      const percent = (currentTime / duration) * 100;
      this.seekBar.value = percent.toString();
    }
  }

  private updateControls(): void {
    const hasTracks = this.audioEngine.getTracks().length > 0;
    this.playPauseBtn.disabled = !hasTracks;
    this.seekBar.disabled = !hasTracks;

    if (hasTracks) {
      const duration = this.audioEngine.getDuration();
      this.totalTimeEl.textContent = TimeSync.formatTime(duration);
    } else {
      this.currentTimeEl.textContent = '00:00';
      this.totalTimeEl.textContent = '00:00';
      this.seekBar.value = '0';
    }
  }

  // Disabled: Old auto-save/load feature replaced by preset system
  // private saveSettings(): void {
  //   const settings = {
  //     seekBarValue: this.seekBar.value,
  //     isPlaying: this.audioEngine.getPlaybackState().isPlaying,
  //     playbackPosition: this.audioEngine.getCurrentTime(),
  //     audioTracks: this.audioEngine.getTracks().map(track => ({
  //       file: track.file,
  //       color: track.color,
  //       opacity: track.opacity,
  //     })),
  //     selectedLayout: document.getElementById('layout-select')?.value,
  //     selectedAmplitude: document.getElementById('amplitude-select')?.value,
  //     selectedHeight: document.getElementById('height-select')?.value,
  //     selectedSmoothing: document.getElementById('smoothing-select')?.value,
  //     selectedFPSCap: document.getElementById('fps-cap-select')?.value,
  //     selectedWindowDuration: document.getElementById('window-duration-slider')?.value,
  //   };
  //   localStorage.setItem('userSettings', JSON.stringify(settings));
  // }

  // private loadSettings(): void {
  //   const savedSettings = localStorage.getItem('userSettings');
  //   if (savedSettings) {
  //     const settings = JSON.parse(savedSettings);
  //     if (settings.seekBarValue) {
  //       this.seekBar.value = settings.seekBarValue;
  //       const duration = this.audioEngine.getDuration();
  //       const time = (parseFloat(settings.seekBarValue) / 100) * duration;
  //       this.audioEngine.seek(time);
  //     }
  //     if (settings.isPlaying) {
  //       this.audioEngine.play();
  //     }
  //     if (settings.playbackPosition) {
  //       this.audioEngine.seek(settings.playbackPosition);
  //     }
  //     if (settings.audioTracks) {
  //       this.audioEngine.setTracks(settings.audioTracks);
  //     }
  //     if (settings.selectedLayout) {
  //       const layoutSelect = document.getElementById('layout-select') as HTMLSelectElement;
  //       if (layoutSelect) layoutSelect.value = settings.selectedLayout;
  //     }
  //     if (settings.selectedAmplitude) {
  //       const amplitudeSelect = document.getElementById('amplitude-select') as HTMLSelectElement;
  //       if (amplitudeSelect) amplitudeSelect.value = settings.selectedAmplitude;
  //     }
  //     if (settings.selectedHeight) {
  //       const heightSelect = document.getElementById('height-select') as HTMLSelectElement;
  //       if (heightSelect) heightSelect.value = settings.selectedHeight;
  //     }
  //     if (settings.selectedSmoothing) {
  //       const smoothingSelect = document.getElementById('smoothing-select') as HTMLSelectElement;
  //       if (smoothingSelect) smoothingSelect.value = settings.selectedSmoothing;
  //     }
  //     if (settings.selectedFPSCap) {
  //       const fpsCapSelect = document.getElementById('fps-cap-select') as HTMLSelectElement;
  //       if (fpsCapSelect) fpsCapSelect.value = settings.selectedFPSCap;
  //     }
  //     if (settings.selectedWindowDuration) {
  //       const windowDurationSlider = document.getElementById('window-duration-slider') as HTMLInputElement;
  //       if (windowDurationSlider) windowDurationSlider.value = settings.selectedWindowDuration;
  //     }
  //   }
  // }
}
