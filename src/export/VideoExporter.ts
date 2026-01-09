import { type AudioEngine } from '../core/AudioEngine';
import { WaveformRenderer } from '../rendering/WaveformRenderer';
import { RenderContext } from '../rendering/RenderContext';
import { FrameCapture } from './FrameCapture';
import type { ExportOptions } from '../types/audio.types';
import type { LayoutMode, AmplitudeMode } from '../types/visualizer.types';

export class VideoExporter {
  private audioEngine: AudioEngine;
  private exportCanvas: HTMLCanvasElement;
  private exportRenderer: WaveformRenderer;
  private exportFrameCapture: FrameCapture;
  private worker: Worker | null = null;

  constructor(audioEngine: AudioEngine) {
    this.audioEngine = audioEngine;

    // Create offscreen canvas at fixed 1920x1080
    this.exportCanvas = document.createElement('canvas');
    this.exportCanvas.width = 1920;
    this.exportCanvas.height = 1080;

    // Create export render context
    const exportContext = RenderContext.forExport();

    // Create export renderer
    this.exportRenderer = new WaveformRenderer(this.exportCanvas, exportContext);
    this.exportFrameCapture = new FrameCapture(this.exportCanvas);
  }

  /**
   * Export video with visualization
   */
  async export(
    options: ExportOptions,
    onProgress: (progress: number, message: string) => void,
    onComplete: (blob: Blob) => void,
    onError: (error: string) => void
  ): Promise<void> {
    const startTime = Date.now();
    let lastLogTime = startTime;
    let lastProgress = 0;

    const logProgress = (currentProgress: number, force = false) => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000; // seconds
      const timeSinceLastLog = (now - lastLogTime) / 1000;

      // Log every 5 seconds or when forced
      if (force || timeSinceLastLog >= 5) {
        lastLogTime = now;

        // Calculate time estimate
        let estimate = '';
        if (currentProgress > 0 && currentProgress < 100) {
          const totalEstimatedTime = (elapsed / currentProgress) * 100;
          const remainingTime = totalEstimatedTime - elapsed;
          const mins = Math.floor(remainingTime / 60);
          const secs = Math.floor(remainingTime % 60);
          estimate = ` | ETA: ${mins}m ${secs}s`;
        }

        console.log(
          `[Export] Progress: ${currentProgress.toFixed(2)}% | Elapsed: ${Math.floor(elapsed)}s${estimate}`
        );
        lastProgress = currentProgress;
      }
    };

    try {
      // Check if SharedArrayBuffer is available (required for FFmpeg)
      if (typeof SharedArrayBuffer === 'undefined') {
        throw new Error(
          'Video export requires SharedArrayBuffer support. ' +
            'Please serve the application with these headers:\n' +
            'Cross-Origin-Opener-Policy: same-origin\n' +
            'Cross-Origin-Embedder-Policy: require-corp\n\n' +
            'For production deployment, configure your web server to send these headers.'
        );
      }

      console.log('[Export] Starting video export...');
      logProgress(0, true);

      // Initialize worker
      onProgress(0, 'Initializing...');
      await this.initWorker();
      logProgress(5, true);

      // Capture frames
      onProgress(5, 'Rendering frames...');
      const frames = await this.captureFrames(
        options.fps,
        options.layout,
        options.amplitudeMode,
        options.heightPercent,
        options.smoothingLevel,
        options.windowDuration,
        (p) => {
          const progress = 5 + p * 30;
          onProgress(progress, 'Rendering frames...');
          logProgress(progress);
        }
      );
      logProgress(35, true);

      // Mix audio
      onProgress(35, 'Mixing audio...');
      const audioData = await this.mixAudio();
      logProgress(40, true);

      // Send to worker for encoding
      onProgress(40, 'Encoding video...');
      const videoBlob = await this.encodeVideo(frames, audioData, options, (p, msg) => {
        const progress = 40 + p * 0.6;
        onProgress(progress, msg);
        logProgress(progress);
      });

      logProgress(100, true);
      const totalTime = (Date.now() - startTime) / 1000;
      console.log(`[Export] Export completed successfully in ${Math.floor(totalTime)}s`);

      onComplete(videoBlob);
    } catch (error) {
      console.error('[Export] Export failed:', error);
      onError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.cleanupWorker();
    }
  }

  /**
   * Initialize FFmpeg worker
   */
  private async initWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.worker = new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' });

      this.worker.onmessage = (e) => {
        if (e.data.type === 'ready') {
          resolve();
        } else if (e.data.type === 'error') {
          reject(new Error(e.data.error));
        }
      };

      this.worker.onerror = (error) => {
        reject(error);
      };

      this.worker.postMessage({ type: 'init' });
    });
  }

  /**
   * Capture frames for entire duration
   */
  private async captureFrames(
    fps: number,
    layout: LayoutMode,
    amplitudeMode: AmplitudeMode,
    heightPercent: number,
    smoothingLevel: number,
    windowDuration: number,
    onProgress: (progress: number) => void
  ): Promise<string[]> {
    const duration = this.audioEngine.getDuration();
    const totalFrames = Math.ceil(duration * fps);
    const frames: string[] = [];

    const tracks = this.audioEngine.getTracks();

    for (let i = 0; i < totalFrames; i++) {
      const time = i / fps;

      // Render using EXPORT renderer (always 1920x1080)
      this.exportRenderer.render(
        tracks,
        time,
        duration,
        layout,
        amplitudeMode,
        heightPercent,
        smoothingLevel,
        windowDuration
      );

      // Capture frame from export canvas
      const dataURL = this.exportFrameCapture.captureFrameAsDataURL();
      frames.push(dataURL);

      // Report progress and yield to browser every 10 frames
      if (i % 10 === 0) {
        onProgress(i / totalFrames);
        // Yield control back to the browser to prevent UI freezing
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return frames;
  }

  /**
   * Mix all audio tracks to single stereo buffer
   */
  private async mixAudio(): Promise<ArrayBuffer> {
    const tracks = this.audioEngine.getTracks();
    if (tracks.length === 0) {
      throw new Error('No audio tracks to export');
    }

    const duration = this.audioEngine.getDuration();
    const sampleRate = tracks[0].sampleRate;

    // Create offline context for mixing
    const offlineContext = new OfflineAudioContext(
      2, // Stereo
      Math.ceil(duration * sampleRate),
      sampleRate
    );

    // Create sources and connect to destination
    tracks.forEach((track) => {
      const source = offlineContext.createBufferSource();
      source.buffer = track.buffer;
      source.connect(offlineContext.destination);
      source.start(0);
    });

    // Render mixed audio
    const renderedBuffer = await offlineContext.startRendering();

    // Convert to WAV
    return this.audioBufferToWav(renderedBuffer);
  }

  /**
   * Convert AudioBuffer to WAV format
   */
  private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numberOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numberOfChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true); // 16-bit
    writeString(36, 'data');
    view.setUint32(40, length, true);

    // Write interleaved audio data
    const channels: Float32Array[] = [];
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return arrayBuffer;
  }

  /**
   * Encode video using FFmpeg worker
   */
  private async encodeVideo(
    frames: string[],
    audioData: ArrayBuffer,
    options: ExportOptions,
    onProgress: (progress: number, message: string) => void
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      this.worker.onmessage = (e) => {
        const { type, data, progress, message, error } = e.data;

        switch (type) {
          case 'progress':
            onProgress(progress, message || 'Processing...');
            break;

          case 'status':
            onProgress(progress || 0, message);
            break;

          case 'complete':
            const blob = new Blob([data], { type: 'video/mp4' });
            resolve(blob);
            break;

          case 'error':
            reject(new Error(error));
            break;
        }
      };

      this.worker.postMessage({
        type: 'export',
        data: {
          frames,
          audioData,
          fps: options.fps,
          codec: options.codec,
          quality: options.quality,
          audioBitrate: options.audioBitrate,
        },
      });
    });
  }

  /**
   * Cleanup worker
   */
  private cleanupWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
