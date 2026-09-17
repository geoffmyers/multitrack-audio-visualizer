import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioEngine } from '../AudioEngine';

/**
 * happy-dom has no Web Audio API, so the thing most worth testing here --
 * AudioEngine's play/pause/seek/timing logic -- is tested against a fake
 * AudioContext whose `currentTime` the tests advance by hand. There is no
 * real clock to wait on, which makes the assertions exact rather than
 * timing-flaky.
 */
class FakeGainNode {
  gain = { value: 1 };
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeAudioBufferSourceNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  disconnect = vi.fn();
}

class FakeAudioContext {
  state: 'running' | 'suspended' | 'closed' = 'running';
  currentTime = 0;
  destination = {};
  decodeAudioData = vi.fn((_buf: ArrayBuffer): Promise<AudioBuffer> => Promise.resolve(makeAudioBuffer(5)));
  createGain = vi.fn(() => new FakeGainNode());
  createBufferSource = vi.fn(() => new FakeAudioBufferSourceNode());
  resume = vi.fn((): Promise<void> => {
    this.state = 'running';
    return Promise.resolve();
  });
  close = vi.fn((): Promise<void> => {
    this.state = 'closed';
    return Promise.resolve();
  });
}

/** A minimal stand-in for AudioBuffer: only the members AudioEngine reads. */
function makeAudioBuffer(duration: number, sampleRate = 44100, numberOfChannels = 1): AudioBuffer {
  return {
    duration,
    sampleRate,
    numberOfChannels,
    getChannelData: (_channel: number) => new Float32Array(Math.floor(duration * sampleRate)),
  } as unknown as AudioBuffer;
}

function makeFile(name: string, byteLength = 16): File {
  return new File([new Uint8Array(byteLength)], name);
}

describe('AudioEngine', () => {
  let fakeContext: FakeAudioContext;

  beforeEach(() => {
    fakeContext = new FakeAudioContext();
    // A constructor mock: `new AudioContext()` must return the same fake
    // instance every time (AudioEngine only ever calls it once, but the
    // mock still needs to be callable with `new`, which a plain arrow
    // function returning a value cannot be).
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function audioContextMock() {
        return fakeContext;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function loadOneTrack(engine: AudioEngine, duration = 5): Promise<void> {
    fakeContext.decodeAudioData.mockResolvedValueOnce(makeAudioBuffer(duration));
    await engine.loadTrack(makeFile('track.wav'), '#ff0000');
  }

  describe('loadTrack', () => {
    it('creates the AudioContext lazily and a gain node initialised to track.volume', async () => {
      const engine = new AudioEngine();
      await loadOneTrack(engine, 5);

      const track = engine.getTracks()[0];
      expect(track.volume).toBe(1.0);
      expect(track.gainNode).toBeInstanceOf(FakeGainNode);
      expect((track.gainNode as unknown as FakeGainNode).gain.value).toBe(1.0);
    });

    it('dispatches trackadded and appends to getTracks()', async () => {
      const engine = new AudioEngine();
      const handler = vi.fn();
      engine.addEventListener('trackadded', handler);

      await loadOneTrack(engine);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(engine.getTracks()).toHaveLength(1);
    });
  });

  describe('removeTrack', () => {
    it('stops the source, disconnects the gain node, and dispatches trackremoved', async () => {
      const engine = new AudioEngine();
      await loadOneTrack(engine);
      engine.play();
      const track = engine.getTracks()[0];
      const source = track.sourceNode as unknown as FakeAudioBufferSourceNode;
      const gain = track.gainNode as unknown as FakeGainNode;
      const handler = vi.fn();
      engine.addEventListener('trackremoved', handler);

      engine.removeTrack(track.id);

      expect(source.stop).toHaveBeenCalled();
      expect(gain.disconnect).toHaveBeenCalled();
      expect(engine.getTracks()).toHaveLength(0);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does nothing for an unknown id', async () => {
      const engine = new AudioEngine();
      await loadOneTrack(engine);

      expect(() => engine.removeTrack('nope')).not.toThrow();
      expect(engine.getTracks()).toHaveLength(1);
    });
  });

  describe('play / pause / seek / timing', () => {
    it('play() is a no-op with no tracks loaded', () => {
      const engine = new AudioEngine();

      expect(() => engine.play()).not.toThrow();
      expect(engine.getPlaybackState().isPlaying).toBe(false);
    });

    it('play() starts every track at the current pausedAt offset', async () => {
      const engine = new AudioEngine();
      await loadOneTrack(engine, 10);

      engine.play();

      const source = engine.getTracks()[0].sourceNode as unknown as FakeAudioBufferSourceNode;
      expect(source.start).toHaveBeenCalledWith(0, 0);
      expect(engine.getPlaybackState().isPlaying).toBe(true);
    });

    it('getCurrentTime() tracks audioContext.currentTime while playing, clamped to duration', async () => {
      const engine = new AudioEngine();
      await loadOneTrack(engine, 10);

      fakeContext.currentTime = 2;
      engine.play(); // startTime = currentTime(2) - pausedAt(0) = 2

      fakeContext.currentTime = 5;
      expect(engine.getCurrentTime()).toBeCloseTo(3, 10); // 5 - 2

      fakeContext.currentTime = 20; // past the 10s track duration
      expect(engine.getCurrentTime()).toBe(10); // clamped, never overruns
    });

    it('pause() freezes pausedAt at the current position and stops every source', async () => {
      const engine = new AudioEngine();
      await loadOneTrack(engine, 10);
      fakeContext.currentTime = 0;
      engine.play();
      fakeContext.currentTime = 4;

      engine.pause();

      expect(engine.getTracks()[0].sourceNode).toBeNull(); // stopSources() clears it
      expect(engine.getPlaybackState()).toMatchObject({ isPlaying: false, currentTime: 4 });

      // The clock can keep moving; a paused engine must not follow it.
      fakeContext.currentTime = 100;
      expect(engine.getCurrentTime()).toBe(4);
    });

    it('seek() while paused updates pausedAt without starting playback', async () => {
      const engine = new AudioEngine();
      await loadOneTrack(engine, 10);
      const seekHandler = vi.fn();
      engine.addEventListener('seek', seekHandler);

      engine.seek(6);

      expect(engine.getPlaybackState()).toMatchObject({ isPlaying: false, currentTime: 6 });
      expect(seekHandler).toHaveBeenCalledTimes(1);
      expect((seekHandler.mock.calls[0][0] as CustomEvent).detail).toEqual({ time: 6 });
    });

    it('seek() clamps to [0, duration]', async () => {
      const engine = new AudioEngine();
      await loadOneTrack(engine, 10);

      engine.seek(-5);
      expect(engine.getCurrentTime()).toBe(0);

      engine.seek(999);
      expect(engine.getCurrentTime()).toBe(10);
    });

    it('seek() while playing restarts playback from the new offset', async () => {
      const engine = new AudioEngine();
      await loadOneTrack(engine, 10);
      fakeContext.currentTime = 0;
      engine.play();
      fakeContext.currentTime = 3;

      engine.seek(7);

      const source = engine.getTracks()[0].sourceNode as unknown as FakeAudioBufferSourceNode;
      expect(source.start).toHaveBeenCalledWith(0, 7);
      expect(engine.getPlaybackState().isPlaying).toBe(true);
    });
  });

  describe('natural track end (source.onended)', () => {
    it('dispatches "ended" and stops once a source ends at the track duration', async () => {
      const engine = new AudioEngine();
      await loadOneTrack(engine, 10);
      fakeContext.currentTime = 0;
      engine.play();
      const endedHandler = vi.fn();
      engine.addEventListener('ended', endedHandler);

      fakeContext.currentTime = 10; // exactly at duration
      const source = engine.getTracks()[0].sourceNode as unknown as FakeAudioBufferSourceNode;
      source.onended?.();

      expect(endedHandler).toHaveBeenCalledTimes(1);
      expect(engine.getPlaybackState()).toMatchObject({ isPlaying: false, currentTime: 10 });
    });

    it('ignores onended firing well short of the duration (a manual stop, not natural end)', async () => {
      const engine = new AudioEngine();
      await loadOneTrack(engine, 10);
      fakeContext.currentTime = 0;
      engine.play();
      const endedHandler = vi.fn();
      engine.addEventListener('ended', endedHandler);

      fakeContext.currentTime = 3;
      const source = engine.getTracks()[0].sourceNode as unknown as FakeAudioBufferSourceNode;
      source.onended?.();

      expect(endedHandler).not.toHaveBeenCalled();
      expect(engine.getPlaybackState().isPlaying).toBe(true);
    });
  });

  describe('setMasterVolume', () => {
    it('clamps to [0, 1] on the master gain node', async () => {
      const engine = new AudioEngine();
      await loadOneTrack(engine);
      // The master gain is the first createGain() call, made by initialize()
      // before loadTrack() creates the per-track gain node.
      const masterGain = fakeContext.createGain.mock.results[0].value as FakeGainNode;

      engine.setMasterVolume(0.4);
      expect(masterGain.gain.value).toBeCloseTo(0.4);

      engine.setMasterVolume(-1);
      expect(masterGain.gain.value).toBe(0);

      engine.setMasterVolume(5);
      expect(masterGain.gain.value).toBe(1);
    });
  });
});
