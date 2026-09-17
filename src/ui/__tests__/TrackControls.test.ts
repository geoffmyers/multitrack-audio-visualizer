import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackControls } from '../TrackControls';
import type { AudioTrack } from '../../core/AudioTrack';
import type { AudioEngine } from '../../core/AudioEngine';

/**
 * A fake AudioEngine: just enough of an EventTarget + track list for
 * TrackControls to render from, without any real Web Audio API.
 */
class FakeAudioEngine extends EventTarget {
  private tracks: AudioTrack[] = [];

  setTracks(tracks: AudioTrack[]): void {
    this.tracks = tracks;
  }

  getTracks(): AudioTrack[] {
    return this.tracks;
  }

  removeTrack = vi.fn();
}

function makeTrack(overrides: Partial<AudioTrack> = {}): AudioTrack {
  return {
    id: 'track-1',
    name: 'song.wav',
    color: '#FF0000',
    opacity: 0.7,
    volume: 1.0,
    setColor: vi.fn(),
    setOpacity: vi.fn(),
    ...overrides,
  } as unknown as AudioTrack;
}

function setupDom(): void {
  document.body.innerHTML = `
    <div id="track-list"></div>
    <button id="add-track-btn"></button>
    <input id="file-input" type="file" />
    <div id="drop-zone"></div>
    <div id="loading-overlay"></div>
  `;
}

describe('TrackControls', () => {
  let engine: FakeAudioEngine;

  beforeEach(() => {
    setupDom();
    engine = new FakeAudioEngine();
  });

  it('renders a track name as text, not markup (XSS regression)', () => {
    // A dropped file can be named anything; before the fix, this went
    // straight into an innerHTML template literal and was parsed as HTML.
    const maliciousName = '<img src=x onerror="alert(1)">.wav';
    engine.setTracks([makeTrack({ name: maliciousName })]);

    new TrackControls(engine as unknown as AudioEngine, vi.fn());
    engine.dispatchEvent(new Event('trackadded'));

    const trackList = document.getElementById('track-list')!;

    // No <img> (or any other element) was parsed out of the name.
    expect(trackList.querySelector('img')).toBeNull();
    // The name is present, verbatim, as text.
    expect(trackList.textContent).toContain(maliciousName);
    // It was placed as an element's textContent/title, not raw HTML.
    const nameEl = trackList.querySelector('.track-name');
    expect(nameEl?.textContent).toBe(maliciousName);
    expect(nameEl?.getAttribute('title')).toBe(maliciousName);
  });

  it('still renders track controls (color input, opacity slider, remove button)', () => {
    engine.setTracks([makeTrack({ id: 'abc', name: 'drums.wav', color: '#00ff00', opacity: 0.5 })]);

    new TrackControls(engine as unknown as AudioEngine, vi.fn());
    engine.dispatchEvent(new Event('trackadded'));

    const trackList = document.getElementById('track-list')!;
    const colorInput = trackList.querySelector('[data-control="color"]') as HTMLInputElement;
    const opacityInput = trackList.querySelector('[data-control="opacity"]') as HTMLInputElement;
    const removeBtn = trackList.querySelector('.track-remove') as HTMLButtonElement;

    expect(colorInput.value.toLowerCase()).toBe('#00ff00');
    expect(opacityInput.value).toBe('50');
    expect(removeBtn.dataset.trackId).toBe('abc');
    expect(trackList.textContent).toContain('Opacity: 50%');
  });

  it('shows a placeholder when there are no tracks', () => {
    engine.setTracks([]);

    new TrackControls(engine as unknown as AudioEngine, vi.fn());
    engine.dispatchEvent(new Event('trackadded'));

    expect(document.getElementById('track-list')!.textContent).toContain('No tracks loaded');
  });
});
