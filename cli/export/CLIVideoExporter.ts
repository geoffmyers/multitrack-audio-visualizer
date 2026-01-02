import { createCanvas, Canvas } from 'canvas';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { WaveformRenderer } from '../../src/rendering/WaveformRenderer.js';
import { RenderContext } from '../../src/rendering/RenderContext.js';
import { CLIAudioTrack } from '../adapters/CLIAudioTrack.js';
import { CLIAudioEngine } from '../adapters/CLIAudioEngine.js';
import { Logger } from '../utils/Logger.js';
import { ProgressReporter } from '../utils/ProgressReporter.js';
import type { ExportOptions } from '../../src/types/audio.types.js';

export class CLIVideoExporter {
  private canvas: Canvas;
  private renderer: WaveformRenderer;
  private logger: Logger;
  private audioEngine: CLIAudioEngine;
  private tempDir: string | null = null;

  constructor(audioEngine: CLIAudioEngine, logger: Logger) {
    this.audioEngine = audioEngine;
    this.logger = logger;

    // Create offscreen canvas at fixed 1920x1080
    this.canvas = createCanvas(1920, 1080);

    // Create render context for export
    const context = RenderContext.forExport();

    // Create renderer (cast canvas to any for type compatibility)
    this.renderer = new WaveformRenderer(this.canvas as any, context);
  }

  /**
   * Check if FFmpeg is installed
   */
  async checkFFmpeg(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ['-version']);

      ffmpeg.on('error', () => {
        reject(new Error(
          'FFmpeg not found. Please install FFmpeg:\n' +
          '  macOS:   brew install ffmpeg\n' +
          '  Ubuntu:  sudo apt install ffmpeg\n' +
          '  Windows: https://ffmpeg.org/download.html'
        ));
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg check failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Export video with visualization
   */
  async export(
    options: ExportOptions,
    outputPath: string,
    verbose: boolean = false,
    maxFrames?: number
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Check FFmpeg availability
      await this.checkFFmpeg();

      // Create temporary directory for frames
      this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'visualizer-'));
      this.logger.verbose(`Created temp directory: ${this.tempDir}`);

      const tracks = this.audioEngine.getTracks();
      const duration = this.audioEngine.getDuration();
      let totalFrames = Math.ceil(duration * options.fps);

      // Limit frames for testing if specified
      if (maxFrames !== undefined && maxFrames > 0) {
        totalFrames = Math.min(totalFrames, maxFrames);
        this.logger.warn(`\nLIMITED TEST MODE: Rendering only ${totalFrames} frames`);
      }

      this.logger.header(`Export Configuration:`);
      this.logger.verbose(`  Layout: ${options.layout}`);
      this.logger.verbose(`  Amplitude Mode: ${options.amplitudeMode}`);
      this.logger.verbose(`  Height: ${options.heightPercent}%`);
      this.logger.verbose(`  Smoothing: ${options.smoothingLevel}`);
      this.logger.verbose(`  Window Duration: ${options.windowDuration}s`);
      this.logger.verbose(`  FPS: ${options.fps}`);
      this.logger.verbose(`  Codec: ${options.codec}`);
      this.logger.verbose(`  Quality (CRF): ${options.quality}`);
      this.logger.verbose(`  Total Frames: ${totalFrames}`);
      this.logger.verbose(`  Duration: ${this.formatDuration(duration)}`);

      // Phase 1: Render frames
      const progress = new ProgressReporter(this.logger, verbose);
      progress.start(totalFrames, 'Rendering frames');

      await this.renderFrames(tracks, duration, options, totalFrames, progress);

      progress.finish(`Rendered ${totalFrames} frames`);

      // Phase 2: Mix audio
      this.logger.info('Mixing audio tracks...');
      const audioPath = await this.mixAudio();
      this.logger.success(`Audio mixed: ${path.basename(audioPath)}`);

      // Phase 3: Encode video with FFmpeg
      const encodeProgress = new ProgressReporter(this.logger, verbose);
      encodeProgress.start(totalFrames, 'Encoding video with FFmpeg');

      await this.encodeVideo(options, outputPath, audioPath, totalFrames, encodeProgress);

      encodeProgress.finish('Video encoding complete');

      // Get output file size
      const stats = await fs.stat(outputPath);
      const fileSize = this.logger.formatFileSize(stats.size);
      const totalTime = (Date.now() - startTime) / 1000;

      this.logger.info('');
      this.logger.success(`Export complete!`);
      this.logger.info(`  Output: ${outputPath}`);
      this.logger.info(`  Size: ${fileSize}`);
      this.logger.info(`  Total time: ${this.logger.formatTime(totalTime)}`);

    } finally {
      // Clean up temporary directory
      if (this.tempDir) {
        try {
          await fs.rm(this.tempDir, { recursive: true, force: true });
          this.logger.verbose(`Cleaned up temp directory: ${this.tempDir}`);
        } catch (error) {
          this.logger.warn(`Failed to clean up temp directory: ${this.tempDir}`);
        }
      }
    }
  }

  /**
   * Render all frames to PNG files
   */
  private async renderFrames(
    tracks: CLIAudioTrack[],
    duration: number,
    options: ExportOptions,
    totalFrames: number,
    progress: ProgressReporter
  ): Promise<void> {
    const startTime = Date.now();
    let framesRendered = 0;

    for (let i = 0; i < totalFrames; i++) {
      const time = i / options.fps;

      // Render frame
      this.renderer.render(
        tracks,
        time,
        duration,
        options.layout,
        options.amplitudeMode,
        options.heightPercent,
        options.smoothingLevel,
        options.windowDuration
      );

      // Save frame as PNG
      const framePath = path.join(this.tempDir!, `frame_${String(i).padStart(5, '0')}.png`);
      const buffer = this.canvas.toBuffer('image/png');
      await fs.writeFile(framePath, buffer);

      framesRendered++;

      // Update progress
      if (framesRendered % 10 === 0 || framesRendered === totalFrames) {
        const elapsed = (Date.now() - startTime) / 1000;
        const fps = framesRendered / elapsed;
        progress.update(
          framesRendered,
          totalFrames,
          `Frame ${framesRendered}/${totalFrames} (${fps.toFixed(1)} fps)`
        );
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const avgFps = framesRendered / elapsed;
    this.logger.verbose(`Average rendering speed: ${avgFps.toFixed(1)} fps`);
  }

  /**
   * Mix audio tracks and save to WAV file
   */
  private async mixAudio(): Promise<string> {
    const mixed = this.audioEngine.mixTracks();
    const wavBuffer = this.audioEngine.encodeWAV(mixed);

    const audioPath = path.join(this.tempDir!, 'audio.wav');
    await fs.writeFile(audioPath, wavBuffer);

    this.logger.verbose(`Mixed audio: ${this.logger.formatFileSize(wavBuffer.length)}`);

    return audioPath;
  }

  /**
   * Encode video using FFmpeg CLI
   */
  private async encodeVideo(
    options: ExportOptions,
    outputPath: string,
    audioPath: string,
    totalFrames: number,
    progress: ProgressReporter
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const videoCodec = options.codec === 'h265' ? 'libx265' : 'libx264';

      const args = [
        '-y', // Overwrite output file
        '-framerate', options.fps.toString(),
        '-i', path.join(this.tempDir!, 'frame_%05d.png'),
        '-i', audioPath,
        '-c:v', videoCodec,
        '-preset', 'medium',
        '-crf', options.quality.toString(),
        '-c:a', 'aac',
        '-b:a', options.audioBitrate,
        '-pix_fmt', 'yuv420p',
        '-shortest',
        outputPath
      ];

      this.logger.verbose(`FFmpeg command: ffmpeg ${args.join(' ')}`);

      const ffmpeg = spawn('ffmpeg', args);

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();

        // Parse FFmpeg progress output
        const frameMatch = stderr.match(/frame=\s*(\d+)/);
        if (frameMatch) {
          const currentFrame = parseInt(frameMatch[1], 10);
          progress.update(
            currentFrame,
            totalFrames,
            `Frame ${currentFrame}/${totalFrames}`
          );
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg spawn error: ${error.message}`));
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          // Include last part of stderr for debugging
          const errorLines = stderr.split('\n').slice(-10).join('\n');
          reject(new Error(`FFmpeg encoding failed with code ${code}\n${errorLines}`));
        }
      });
    });
  }

  /**
   * Format duration as MM:SS
   */
  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
