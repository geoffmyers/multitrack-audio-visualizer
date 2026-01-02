import { AudioTrack } from '../../src/core/AudioTrack.js';

/**
 * AudioBuffer-compatible interface for CLI
 * This mimics the Web Audio API AudioBuffer interface using raw WAV data
 */
export interface CLIAudioBuffer {
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  getChannelData(channel: number): Float32Array;
}

/**
 * CLI version of AudioTrack that accepts CLIAudioBuffer instead of Web Audio API AudioBuffer
 * This allows us to reuse all the waveform extraction logic from AudioTrack
 */
export class CLIAudioTrack extends AudioTrack {
  constructor(
    id: string,
    name: string,
    buffer: CLIAudioBuffer,
    color: string,
    opacity: number = 0.7
  ) {
    // Cast CLIAudioBuffer to AudioBuffer for type compatibility
    // This works because CLIAudioBuffer implements the same interface
    super(id, name, buffer as any, color, opacity);
  }
}
