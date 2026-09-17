import { AudioTrack } from './AudioTrack';
import type { PlaybackState } from '../types/audio.types';
import { debugLog } from '../utils/debug';

export class AudioEngine extends EventTarget {
  private audioContext: AudioContext | null = null;
  private tracks: AudioTrack[] = [];
  private masterGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pausedAt: number = 0;
  private animationFrameId: number | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize the audio context
   */
  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
    }

    // Resume if suspended (required for some browsers)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Load a single audio track from a File
   */
  async loadTrack(
    file: File,
    color: string,
    opacity: number = 0.7,
    volume: number = 1.0
  ): Promise<AudioTrack> {
    debugLog('[AudioEngine] loadTrack() called');
    debugLog('  - File:', file.name);
    debugLog('  - Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    debugLog('  - Color:', color);

    await this.initialize();

    const loadStartTime = performance.now();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    const loadDuration = performance.now() - loadStartTime;

    debugLog('[AudioEngine] Track decoded successfully');
    debugLog('  - Duration:', audioBuffer.duration.toFixed(3), 'seconds');
    debugLog('  - Sample rate:', audioBuffer.sampleRate, 'Hz');
    debugLog('  - Channels:', audioBuffer.numberOfChannels);
    debugLog('  - Load time:', loadDuration.toFixed(0), 'ms');

    const track = new AudioTrack(this.generateTrackId(), file.name, audioBuffer, color, opacity, volume);

    // Create gain node for this track, initialised to the track's volume
    // (opacity never touches this -- see AudioTrack.volume).
    track.gainNode = this.audioContext!.createGain();
    track.gainNode.gain.value = track.volume;
    track.gainNode.connect(this.masterGain!);

    this.tracks.push(track);

    debugLog('[AudioEngine] Track added');
    debugLog('  - Track ID:', track.id);
    debugLog('  - Total tracks:', this.tracks.length);

    this.dispatchEvent(new CustomEvent('trackadded', { detail: track }));

    return track;
  }

  /**
   * Load multiple tracks
   */
  async loadTracks(files: File[], colors: string[]): Promise<AudioTrack[]> {
    const loadPromises = files.map((file, index) =>
      this.loadTrack(file, colors[index % colors.length])
    );
    return Promise.all(loadPromises);
  }

  /**
   * Remove a track
   */
  removeTrack(trackId: string): void {
    const index = this.tracks.findIndex((t) => t.id === trackId);
    if (index !== -1) {
      const track = this.tracks[index];

      // Stop and disconnect
      if (track.sourceNode) {
        track.sourceNode.stop();
        track.sourceNode.disconnect();
        track.sourceNode = null;
      }

      if (track.gainNode) {
        track.gainNode.disconnect();
        track.gainNode = null;
      }

      this.tracks.splice(index, 1);
      this.dispatchEvent(new CustomEvent('trackremoved', { detail: { id: trackId } }));
    }
  }

  /**
   * Play all tracks
   */
  play(): void {
    debugLog('[AudioEngine] play() called');
    debugLog('  - Tracks loaded:', this.tracks.length);
    debugLog('  - AudioContext state:', this.audioContext?.state);

    if (!this.audioContext || this.tracks.length === 0) {
      console.warn('[AudioEngine] play() aborted: no context or tracks');
      return;
    }

    if (this.audioContext.state === 'suspended') {
      debugLog('[AudioEngine] Resuming suspended AudioContext');
      this.audioContext.resume();
    }

    // Stop existing sources
    this.stopSources();

    // Create new source nodes for all tracks
    const offset = this.pausedAt;
    debugLog('[AudioEngine] Starting playback from offset:', offset.toFixed(3), 'seconds');
    debugLog('  - AudioContext.currentTime:', this.audioContext.currentTime.toFixed(3));

    this.tracks.forEach((track, index) => {
      const source = this.audioContext!.createBufferSource();
      source.buffer = track.buffer;
      source.connect(track.gainNode!);
      source.start(0, offset);
      track.sourceNode = source;

      debugLog(
        `  - Track ${index + 1} "${track.name}": started at offset ${offset.toFixed(3)}s`
      );

      // Handle track ending naturally (reaching end of audio)
      source.onended = () => {
        // Only handle natural end of playback, not manual stops
        if (this.isPlaying && track.sourceNode === source) {
          const currentTime = this.getCurrentTime();
          const duration = this.getDuration();

          // Check if we've actually reached the end (within 0.1s tolerance)
          if (currentTime >= duration - 0.1) {
            debugLog(
              `[AudioEngine] Track ${index + 1} reached end naturally, stopping playback`
            );
            this.isPlaying = false;
            this.pausedAt = duration;
            this.dispatchEvent(new Event('ended'));
          } else {
            debugLog(
              `[AudioEngine] Track ${index + 1} ended prematurely at ${currentTime.toFixed(3)}s (expected: ${duration.toFixed(3)}s) - ignoring`
            );
          }
        }
      };
    });

    this.isPlaying = true;
    this.startTime = this.audioContext.currentTime - offset;

    debugLog('[AudioEngine] Playback started');
    debugLog('  - startTime:', this.startTime.toFixed(3));
    debugLog('  - isPlaying:', this.isPlaying);
    debugLog('  - Duration:', this.getDuration().toFixed(3), 'seconds');

    this.dispatchEvent(new Event('play'));
    this.startTimeUpdate();
  }

  /**
   * Pause playback
   */
  pause(): void {
    debugLog('[AudioEngine] pause() called');
    debugLog('  - isPlaying:', this.isPlaying);
    debugLog('  - AudioContext exists:', !!this.audioContext);

    if (!this.audioContext || !this.isPlaying) {
      console.warn('[AudioEngine] pause() aborted: no context or not playing');
      return;
    }

    this.pausedAt = this.audioContext.currentTime - this.startTime;
    debugLog('[AudioEngine] Pausing at position:', this.pausedAt.toFixed(3), 'seconds');
    debugLog('  - AudioContext.currentTime:', this.audioContext.currentTime.toFixed(3));
    debugLog('  - startTime:', this.startTime.toFixed(3));

    this.stopSources();
    this.isPlaying = false;

    debugLog('[AudioEngine] Playback paused');
    debugLog('  - pausedAt:', this.pausedAt.toFixed(3));
    debugLog('  - isPlaying:', this.isPlaying);

    this.dispatchEvent(new Event('pause'));
    this.stopTimeUpdate();
  }

  /**
   * Seek to a specific time
   */
  seek(time: number): void {
    const wasPlaying = this.isPlaying;
    const currentTime = this.getCurrentTime();
    const duration = this.getDuration();

    debugLog('[AudioEngine] seek() called');
    debugLog('  - Requested time:', time.toFixed(3), 'seconds');
    debugLog('  - Current time:', currentTime.toFixed(3), 'seconds');
    debugLog('  - Duration:', duration.toFixed(3), 'seconds');
    debugLog('  - Was playing:', wasPlaying);

    // Stop playback if playing
    if (this.isPlaying) {
      debugLog('[AudioEngine] Stopping playback for seek');
      this.stopSources();
      this.isPlaying = false;
      this.stopTimeUpdate();
    }

    // Set the new position
    const oldPausedAt = this.pausedAt;
    this.pausedAt = Math.max(0, Math.min(time, this.getDuration()));

    debugLog('[AudioEngine] Position updated');
    debugLog('  - Old position:', oldPausedAt.toFixed(3), 'seconds');
    debugLog('  - New position:', this.pausedAt.toFixed(3), 'seconds');
    debugLog('  - Clamped:', this.pausedAt !== time ? 'Yes (to fit duration)' : 'No');

    this.dispatchEvent(new CustomEvent('seek', { detail: { time: this.pausedAt } }));

    // Resume playback if it was playing
    if (wasPlaying) {
      debugLog('[AudioEngine] Resuming playback after seek');
      this.play();
    } else {
      debugLog('[AudioEngine] Seek complete (staying paused)');
    }
  }

  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    if (!this.audioContext) {
      return 0;
    }

    if (this.isPlaying) {
      return Math.min(this.audioContext.currentTime - this.startTime, this.getDuration());
    }

    return this.pausedAt;
  }

  /**
   * Get total duration (longest track)
   */
  getDuration(): number {
    if (this.tracks.length === 0) {
      return 0;
    }
    return Math.max(...this.tracks.map((t) => t.duration));
  }

  /**
   * Get all tracks
   */
  getTracks(): AudioTrack[] {
    return this.tracks;
  }

  /**
   * Get track by ID
   */
  getTrack(id: string): AudioTrack | undefined {
    return this.tracks.find((t) => t.id === id);
  }

  /**
   * Get playback state
   */
  getPlaybackState(): PlaybackState {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
    };
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Stop all source nodes
   */
  private stopSources(): void {
    this.tracks.forEach((track) => {
      if (track.sourceNode) {
        try {
          track.sourceNode.stop();
        } catch (e) {
          // Already stopped
        }
        track.sourceNode.disconnect();
        track.sourceNode = null;
      }
    });
  }

  /**
   * Start time update loop
   */
  private startTimeUpdate(): void {
    const update = () => {
      if (this.isPlaying) {
        this.dispatchEvent(
          new CustomEvent('timeupdate', {
            detail: {
              currentTime: this.getCurrentTime(),
              duration: this.getDuration(),
            },
          })
        );
        this.animationFrameId = requestAnimationFrame(update);
      }
    };
    update();
  }

  /**
   * Stop time update loop
   */
  private stopTimeUpdate(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Generate unique track ID
   */
  private generateTrackId(): string {
    return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.pause();
    this.tracks.forEach((track) => {
      if (track.gainNode) {
        track.gainNode.disconnect();
      }
    });
    this.tracks = [];

    if (this.masterGain) {
      this.masterGain.disconnect();
    }

    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
