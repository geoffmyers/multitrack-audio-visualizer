import * as fs from 'fs/promises';
import * as path from 'path';
import { decode } from 'wav-decoder';
import { CLIAudioTrack, type CLIAudioBuffer } from './CLIAudioTrack.js';
import { Logger } from '../utils/Logger.js';

export class CLIAudioEngine {
  private tracks: CLIAudioTrack[] = [];
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Load a WAV file and create an audio track
   */
  async loadTrack(
    filePath: string,
    color: string,
    opacity: number = 0.7
  ): Promise<CLIAudioTrack> {
    const startTime = Date.now();

    try {
      // Read WAV file
      const buffer = await fs.readFile(filePath);
      const fileSize = buffer.length;

      // Decode WAV data
      const audioData = await decode(buffer);

      // Create AudioBuffer-compatible interface
      const cliBuffer: CLIAudioBuffer = {
        duration: audioData.channelData[0].length / audioData.sampleRate,
        sampleRate: audioData.sampleRate,
        numberOfChannels: audioData.channelData.length,
        length: audioData.channelData[0].length,
        getChannelData: (channel: number) => {
          if (channel < 0 || channel >= audioData.channelData.length) {
            throw new Error(`Channel ${channel} out of range`);
          }
          return audioData.channelData[channel];
        }
      };

      // Create track
      const trackId = `track_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const trackName = path.basename(filePath);
      const track = new CLIAudioTrack(trackId, trackName, cliBuffer, color, opacity);

      this.tracks.push(track);

      const loadTime = Date.now() - startTime;

      this.logger.success(
        `${trackName} (${this.logger.formatFileSize(fileSize)}, ` +
        `${audioData.sampleRate} Hz, ${audioData.channelData.length}ch, ` +
        `${this.formatDuration(cliBuffer.duration)}, loaded in ${loadTime}ms)`
      );

      return track;
    } catch (error) {
      throw new Error(
        `Failed to load audio file "${filePath}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load multiple tracks
   */
  async loadTracks(
    files: Array<{ path: string; color: string; opacity: number }>
  ): Promise<CLIAudioTrack[]> {
    const tracks: CLIAudioTrack[] = [];

    for (const file of files) {
      const track = await this.loadTrack(file.path, file.color, file.opacity);
      tracks.push(track);
    }

    return tracks;
  }

  /**
   * Get all loaded tracks
   */
  getTracks(): CLIAudioTrack[] {
    return this.tracks;
  }

  /**
   * Get total duration (maximum of all tracks)
   */
  getDuration(): number {
    if (this.tracks.length === 0) {
      return 0;
    }
    return Math.max(...this.tracks.map(t => t.duration));
  }

  /**
   * Mix all tracks into a single stereo audio buffer
   * Returns raw PCM data as Float32Array for left and right channels
   */
  mixTracks(): { left: Float32Array; right: Float32Array; sampleRate: number } {
    if (this.tracks.length === 0) {
      throw new Error('No tracks to mix');
    }

    const duration = this.getDuration();
    const sampleRate = this.tracks[0].sampleRate;
    const numSamples = Math.ceil(duration * sampleRate);

    // Create output buffers
    const left = new Float32Array(numSamples);
    const right = new Float32Array(numSamples);

    // Mix all tracks
    for (const track of this.tracks) {
      const trackSamples = track.buffer.length;
      const numChannels = track.numberOfChannels;

      // Get channel data
      const channel0 = track.buffer.getChannelData(0);
      const channel1 = numChannels > 1 ? track.buffer.getChannelData(1) : channel0;

      // Add to mix (with opacity/volume control)
      const gain = track.opacity;
      for (let i = 0; i < trackSamples && i < numSamples; i++) {
        left[i] += channel0[i] * gain;
        right[i] += channel1[i] * gain;
      }
    }

    // Normalize to prevent clipping
    let maxAmplitude = 0;
    for (let i = 0; i < numSamples; i++) {
      maxAmplitude = Math.max(maxAmplitude, Math.abs(left[i]), Math.abs(right[i]));
    }

    if (maxAmplitude > 1.0) {
      const normalizeGain = 1.0 / maxAmplitude;
      for (let i = 0; i < numSamples; i++) {
        left[i] *= normalizeGain;
        right[i] *= normalizeGain;
      }
      this.logger.verbose(`Normalized audio mix (peak: ${maxAmplitude.toFixed(2)})`);
    }

    return { left, right, sampleRate };
  }

  /**
   * Encode mixed audio as WAV file
   */
  encodeWAV(mixed: { left: Float32Array; right: Float32Array; sampleRate: number }): Buffer {
    const numChannels = 2;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const numSamples = mixed.left.length;
    const dataSize = numSamples * blockAlign;
    const fileSize = 44 + dataSize; // WAV header is 44 bytes

    const buffer = Buffer.alloc(fileSize);
    let offset = 0;

    // RIFF chunk descriptor
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;

    // fmt sub-chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, offset); offset += 2; // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(numChannels, offset); offset += 2;
    buffer.writeUInt32LE(mixed.sampleRate, offset); offset += 4;
    buffer.writeUInt32LE(mixed.sampleRate * blockAlign, offset); offset += 4; // ByteRate
    buffer.writeUInt16LE(blockAlign, offset); offset += 2;
    buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

    // data sub-chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;

    // Write interleaved PCM data (convert float32 to int16)
    for (let i = 0; i < numSamples; i++) {
      // Clamp and convert to 16-bit signed integer
      const leftSample = Math.max(-1, Math.min(1, mixed.left[i])) * 32767;
      const rightSample = Math.max(-1, Math.min(1, mixed.right[i])) * 32767;

      buffer.writeInt16LE(Math.round(leftSample), offset); offset += 2;
      buffer.writeInt16LE(Math.round(rightSample), offset); offset += 2;
    }

    return buffer;
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
