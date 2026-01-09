import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioTrack } from '../AudioTrack';

// Mock AudioBuffer
function createMockAudioBuffer(options: {
  duration?: number;
  sampleRate?: number;
  numberOfChannels?: number;
  channelData?: Float32Array;
}): AudioBuffer {
  const duration = options.duration ?? 5;
  const sampleRate = options.sampleRate ?? 44100;
  const numberOfChannels = options.numberOfChannels ?? 1;
  const totalSamples = Math.floor(duration * sampleRate);
  const channelData = options.channelData ?? new Float32Array(totalSamples).fill(0);

  return {
    duration,
    sampleRate,
    numberOfChannels,
    length: totalSamples,
    getChannelData: vi.fn().mockReturnValue(channelData),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

describe('AudioTrack', () => {
  let mockBuffer: AudioBuffer;

  beforeEach(() => {
    mockBuffer = createMockAudioBuffer({
      duration: 5,
      sampleRate: 44100,
      numberOfChannels: 2,
    });
  });

  describe('constructor', () => {
    it('should create a track with all properties', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000', 0.8);

      expect(track.id).toBe('track-1');
      expect(track.name).toBe('Test Track');
      expect(track.buffer).toBe(mockBuffer);
      expect(track.color).toBe('#FF0000');
      expect(track.opacity).toBe(0.8);
    });

    it('should use default opacity of 0.7', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');

      expect(track.opacity).toBe(0.7);
    });

    it('should initialize waveformData, gainNode, and sourceNode as null', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');

      expect(track.waveformData).toBeNull();
      expect(track.gainNode).toBeNull();
      expect(track.sourceNode).toBeNull();
    });
  });

  describe('getters', () => {
    it('should return duration from buffer', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');

      expect(track.duration).toBe(5);
    });

    it('should return sampleRate from buffer', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');

      expect(track.sampleRate).toBe(44100);
    });

    it('should return numberOfChannels from buffer', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');

      expect(track.numberOfChannels).toBe(2);
    });
  });

  describe('setColor', () => {
    it('should update the color', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');

      track.setColor('#00FF00');

      expect(track.color).toBe('#00FF00');
    });
  });

  describe('setOpacity', () => {
    it('should update the opacity', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');

      track.setOpacity(0.5);

      expect(track.opacity).toBe(0.5);
    });

    it('should clamp opacity to min 0', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');

      track.setOpacity(-0.5);

      expect(track.opacity).toBe(0);
    });

    it('should clamp opacity to max 1', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');

      track.setOpacity(1.5);

      expect(track.opacity).toBe(1);
    });
  });

  describe('setVolume', () => {
    it('should not throw when gainNode is null', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');

      expect(() => {
        track.setVolume(0.5);
      }).not.toThrow();
    });

    it('should set gain value when gainNode exists', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');
      const mockGainNode = {
        gain: { value: 1 },
      } as unknown as GainNode;
      track.gainNode = mockGainNode;

      track.setVolume(0.5);

      expect(mockGainNode.gain.value).toBe(0.5);
    });

    it('should clamp volume between 0 and 1', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');
      const mockGainNode = {
        gain: { value: 1 },
      } as unknown as GainNode;
      track.gainNode = mockGainNode;

      track.setVolume(-0.5);
      expect(mockGainNode.gain.value).toBe(0);

      track.setVolume(1.5);
      expect(mockGainNode.gain.value).toBe(1);
    });
  });

  describe('getMetadata', () => {
    it('should return correct metadata object', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000', 0.8);

      const metadata = track.getMetadata();

      expect(metadata).toEqual({
        id: 'track-1',
        name: 'Test Track',
        duration: 5,
        sampleRate: 44100,
        numberOfChannels: 2,
        color: '#FF0000',
        opacity: 0.8,
      });
    });
  });

  describe('getWaveformDataForTimeWindow', () => {
    it('should return Float32Array with correct length', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');

      const waveform = track.getWaveformDataForTimeWindow(2.5, 1.0, 1920);

      expect(waveform).toBeInstanceOf(Float32Array);
      expect(waveform.length).toBe(1920);
    });

    it('should handle start of track (currentTime < windowDuration)', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');

      const waveform = track.getWaveformDataForTimeWindow(0.5, 1.0, 100);

      expect(waveform.length).toBe(100);
    });

    it('should return zeros for empty data', () => {
      const emptyBuffer = createMockAudioBuffer({
        duration: 0,
        sampleRate: 44100,
        channelData: new Float32Array(0),
      });
      const track = new AudioTrack('track-1', 'Test Track', emptyBuffer, '#FF0000');

      const waveform = track.getWaveformDataForTimeWindow(0, 1.0, 100);

      expect(waveform.every((v) => v === 0)).toBe(true);
    });

    it('should extract peak amplitudes correctly', () => {
      // Create buffer with known values
      const sampleRate = 1000;
      const duration = 2;
      const channelData = new Float32Array(sampleRate * duration);
      // Fill with a simple pattern: 0.5 amplitude
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin((i / sampleRate) * Math.PI * 2) * 0.5;
      }

      const buffer = createMockAudioBuffer({
        duration,
        sampleRate,
        channelData,
      });
      const track = new AudioTrack('track-1', 'Test Track', buffer, '#FF0000');

      const waveform = track.getWaveformDataForTimeWindow(1.5, 1.0, 100);

      // All values should be between 0 and 0.5 (peak amplitude)
      expect(waveform.every((v) => v >= 0 && v <= 0.6)).toBe(true);
    });

    it('should apply smoothing when smoothingLevel > 0', () => {
      const sampleRate = 1000;
      const duration = 2;
      const channelData = new Float32Array(sampleRate * duration);
      // Create spiky data
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = i % 2 === 0 ? 1 : 0;
      }

      const buffer = createMockAudioBuffer({
        duration,
        sampleRate,
        channelData,
      });
      const track = new AudioTrack('track-1', 'Test Track', buffer, '#FF0000');

      const unsmoothed = track.getWaveformDataForTimeWindow(1.5, 1.0, 100, 0);
      const smoothed = track.getWaveformDataForTimeWindow(1.5, 1.0, 100, 3);

      // Smoothed data should have less variance
      const unsmoothedVariance = calculateVariance(unsmoothed);
      const smoothedVariance = calculateVariance(smoothed);

      expect(smoothedVariance).toBeLessThanOrEqual(unsmoothedVariance);
    });
  });

  describe('getFrequencySpectrumForTimeWindow', () => {
    it('should return Float32Array with correct length', () => {
      const track = new AudioTrack('track-1', 'Test Track', mockBuffer, '#FF0000');

      const spectrum = track.getFrequencySpectrumForTimeWindow(2.5, 1.0, 2048);

      expect(spectrum).toBeInstanceOf(Float32Array);
      expect(spectrum.length).toBe(1024); // fftSize / 2
    });

    it('should return zeros when not enough samples', () => {
      const shortBuffer = createMockAudioBuffer({
        duration: 0.01, // Very short
        sampleRate: 44100,
      });
      const track = new AudioTrack('track-1', 'Test Track', shortBuffer, '#FF0000');

      const spectrum = track.getFrequencySpectrumForTimeWindow(0.005, 1.0, 2048);

      expect(spectrum.every((v) => v === 0)).toBe(true);
    });

    it('should return non-negative magnitudes', () => {
      const sampleRate = 44100;
      const duration = 2;
      const channelData = new Float32Array(sampleRate * duration);
      // Create a sine wave
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin((i / sampleRate) * Math.PI * 2 * 440); // 440 Hz
      }

      const buffer = createMockAudioBuffer({
        duration,
        sampleRate,
        channelData,
      });
      const track = new AudioTrack('track-1', 'Test Track', buffer, '#FF0000');

      const spectrum = track.getFrequencySpectrumForTimeWindow(1.5, 1.0, 2048);

      expect(spectrum.every((v) => v >= 0)).toBe(true);
    });
  });

  describe('computeWaveformData (deprecated)', () => {
    it('should compute and store waveform data', () => {
      const channelData = new Float32Array(44100);
      channelData.fill(0.5);
      const buffer = createMockAudioBuffer({
        duration: 1,
        sampleRate: 44100,
        channelData,
      });
      const track = new AudioTrack('track-1', 'Test Track', buffer, '#FF0000');

      expect(track.waveformData).toBeNull();

      track.computeWaveformData(100);

      expect(track.waveformData).not.toBeNull();
      expect(track.waveformData!.length).toBe(100);
    });
  });
});

// Helper function
function calculateVariance(data: Float32Array): number {
  const mean = data.reduce((sum, v) => sum + v, 0) / data.length;
  return data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / data.length;
}
