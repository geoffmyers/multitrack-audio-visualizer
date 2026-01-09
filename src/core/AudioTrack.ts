import type { TrackMetadata } from '../types/audio.types';

export class AudioTrack {
  public id: string;
  public name: string;
  public buffer: AudioBuffer;
  public color: string;
  public opacity: number;
  public waveformData: Float32Array | null = null;
  public gainNode: GainNode | null = null;
  public sourceNode: AudioBufferSourceNode | null = null;

  constructor(id: string, name: string, buffer: AudioBuffer, color: string, opacity: number = 0.7) {
    this.id = id;
    this.name = name;
    this.buffer = buffer;
    this.color = color;
    this.opacity = opacity;
  }

  get duration(): number {
    return this.buffer.duration;
  }

  get sampleRate(): number {
    return this.buffer.sampleRate;
  }

  get numberOfChannels(): number {
    return this.buffer.numberOfChannels;
  }

  /**
   * Pre-compute downsampled waveform data for efficient rendering
   * @deprecated Use getWaveformDataForTimeWindow instead for real-time rendering
   */
  computeWaveformData(targetWidth: number): void {
    const channelData = this.buffer.getChannelData(0); // Use first channel
    const samplesPerPixel = Math.floor(channelData.length / targetWidth);
    const waveform = new Float32Array(targetWidth);

    for (let i = 0; i < targetWidth; i++) {
      const start = i * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, channelData.length);

      // Find peak amplitude in this window
      let max = 0;
      for (let j = start; j < end; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > max) {
          max = abs;
        }
      }

      waveform[i] = max;
    }

    this.waveformData = waveform;
  }

  /**
   * Extract waveform data for a specific time window (real-time rendering)
   * @param currentTime - Current playback time in seconds
   * @param windowDuration - Duration of the window in seconds (default 1.0)
   * @param targetWidth - Width in pixels (must be provided by caller based on canvas width)
   * @param smoothingLevel - Smoothing level 0-5 (0 = no smoothing, 5 = maximum smoothing)
   * @returns Float32Array of peak amplitudes for the time window
   */
  getWaveformDataForTimeWindow(
    currentTime: number,
    windowDuration: number = 1.0,
    targetWidth: number,
    smoothingLevel: number = 0
  ): Float32Array {
    const channelData = this.buffer.getChannelData(0); // Use first channel
    const sampleRate = this.buffer.sampleRate;

    // Calculate the time window
    // If currentTime < windowDuration, show from 0 to windowDuration
    // Otherwise, show the last windowDuration seconds
    let startTime: number;
    let endTime: number;

    if (currentTime < windowDuration) {
      // At the beginning: show from 0 to windowDuration
      startTime = 0;
      endTime = Math.min(windowDuration, this.duration);
    } else {
      // Normal case: show last windowDuration seconds
      startTime = currentTime - windowDuration;
      endTime = currentTime;
    }

    // Convert time to sample indices
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.min(Math.floor(endTime * sampleRate), channelData.length);
    const totalSamples = endSample - startSample;

    const waveform = new Float32Array(targetWidth);

    if (totalSamples <= 0) {
      return waveform; // Return zeros if no data
    }

    const samplesPerPixel = totalSamples / targetWidth;

    for (let i = 0; i < targetWidth; i++) {
      const start = startSample + Math.floor(i * samplesPerPixel);
      const end = Math.min(startSample + Math.floor((i + 1) * samplesPerPixel), endSample);

      // Find peak amplitude in this window
      let max = 0;
      for (let j = start; j < end; j++) {
        if (j >= 0 && j < channelData.length) {
          const abs = Math.abs(channelData[j]);
          if (abs > max) {
            max = abs;
          }
        }
      }

      waveform[i] = max;
    }

    // Apply smoothing if requested
    if (smoothingLevel > 0) {
      this.applySmoothingFilter(waveform, smoothingLevel);
    }

    return waveform;
  }

  /**
   * Apply smoothing filter to waveform data using moving average
   * @param waveform - Waveform data to smooth (modified in place)
   * @param level - Smoothing level 1-5 (higher = more smoothing)
   */
  private applySmoothingFilter(waveform: Float32Array, level: number): void {
    // Window size increases with smoothing level (1 -> 3 samples, 5 -> 11 samples)
    const windowSize = 1 + level * 2;
    const halfWindow = Math.floor(windowSize / 2);

    // Create a copy for reading from
    const original = new Float32Array(waveform);

    // Apply moving average filter
    for (let i = 0; i < waveform.length; i++) {
      let sum = 0;
      let count = 0;

      // Average samples in window around current position
      for (let j = -halfWindow; j <= halfWindow; j++) {
        const index = i + j;
        if (index >= 0 && index < waveform.length) {
          sum += original[index];
          count++;
        }
      }

      waveform[i] = count > 0 ? sum / count : original[i];
    }
  }

  /**
   * Extract frequency spectrum data for a specific time window
   * @param currentTime - Current playback time in seconds
   * @param windowDuration - Duration of the window in seconds (default 1.0)
   * @param fftSize - FFT size for frequency analysis (default 2048)
   * @returns Float32Array of frequency magnitudes (0 to fftSize/2)
   */
  getFrequencySpectrumForTimeWindow(
    currentTime: number,
    windowDuration: number = 1.0,
    fftSize: number = 2048
  ): Float32Array {
    const channelData = this.buffer.getChannelData(0); // Use first channel
    const sampleRate = this.buffer.sampleRate;

    // Calculate the time window (same logic as waveform)
    let startTime: number;
    let endTime: number;

    if (currentTime < windowDuration) {
      startTime = 0;
      endTime = Math.min(windowDuration, this.duration);
    } else {
      startTime = currentTime - windowDuration;
      endTime = currentTime;
    }

    // Convert time to sample indices
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.min(Math.floor(endTime * sampleRate), channelData.length);
    const totalSamples = endSample - startSample;

    if (totalSamples < fftSize) {
      // Not enough samples, return zeros
      return new Float32Array(fftSize / 2);
    }

    // Extract the audio window
    const audioWindow = new Float32Array(fftSize);
    const samplesPerPixel = totalSamples / fftSize;

    for (let i = 0; i < fftSize; i++) {
      const sampleIndex = startSample + Math.floor(i * samplesPerPixel);
      if (sampleIndex < channelData.length) {
        audioWindow[i] = channelData[sampleIndex];
      }
    }

    // Apply window function (Hann window)
    for (let i = 0; i < fftSize; i++) {
      const windowValue = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
      audioWindow[i] *= windowValue;
    }

    // Perform FFT
    const spectrum = this.fft(audioWindow);

    // Return magnitude spectrum (first half)
    const magnitudes = new Float32Array(fftSize / 2);
    for (let i = 0; i < fftSize / 2; i++) {
      const real = spectrum[i * 2];
      const imag = spectrum[i * 2 + 1];
      magnitudes[i] = Math.sqrt(real * real + imag * imag);
    }

    return magnitudes;
  }

  /**
   * Simple FFT implementation (Cooley-Tukey algorithm)
   * @param input - Real input array
   * @returns Complex output array [real0, imag0, real1, imag1, ...]
   */
  private fft(input: Float32Array): Float32Array {
    const N = input.length;
    if (N <= 1) {
      return new Float32Array([input[0], 0]);
    }

    // Split into even and odd
    const even = new Float32Array(N / 2);
    const odd = new Float32Array(N / 2);

    for (let i = 0; i < N / 2; i++) {
      even[i] = input[i * 2];
      odd[i] = input[i * 2 + 1];
    }

    const evenFFT = this.fft(even);
    const oddFFT = this.fft(odd);

    const output = new Float32Array(N * 2); // real and imaginary parts

    for (let k = 0; k < N / 2; k++) {
      const angle = (-2 * Math.PI * k) / N;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const oddReal = oddFFT[k * 2];
      const oddImag = oddFFT[k * 2 + 1];

      const tReal = cos * oddReal - sin * oddImag;
      const tImag = sin * oddReal + cos * oddImag;

      output[k * 2] = evenFFT[k * 2] + tReal;
      output[k * 2 + 1] = evenFFT[k * 2 + 1] + tImag;
      output[(k + N / 2) * 2] = evenFFT[k * 2] - tReal;
      output[(k + N / 2) * 2 + 1] = evenFFT[k * 2 + 1] - tImag;
    }

    return output;
  }

  setColor(color: string): void {
    this.color = color;
  }

  setOpacity(opacity: number): void {
    this.opacity = Math.max(0, Math.min(1, opacity));
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  getMetadata(): TrackMetadata {
    return {
      id: this.id,
      name: this.name,
      duration: this.duration,
      sampleRate: this.sampleRate,
      numberOfChannels: this.numberOfChannels,
      color: this.color,
      opacity: this.opacity,
    };
  }
}
