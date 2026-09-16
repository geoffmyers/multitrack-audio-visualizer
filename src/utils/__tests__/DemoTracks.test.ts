import { describe, it, expect } from 'vitest';
import { parseDemoManifest } from '../DemoTracks';

const MANIFEST = 'https://demo.example.com/demo/tracks.json';

describe('parseDemoManifest', () => {
  it('resolves each file next to the manifest and keeps its name', () => {
    const tracks = parseDemoManifest(
      { tracks: [{ file: 'drums.wav', name: 'Drums' }, { file: 'bass.wav', name: ' Bass ' }] },
      MANIFEST
    );
    expect(tracks).toEqual([
      { url: 'https://demo.example.com/demo/drums.wav', name: 'Drums' },
      { url: 'https://demo.example.com/demo/bass.wav', name: 'Bass' },
    ]);
  });

  it('falls back to the file name when a track has no name', () => {
    expect(parseDemoManifest({ tracks: [{ file: 'pad.wav' }] }, MANIFEST)).toEqual([
      { url: 'https://demo.example.com/demo/pad.wav', name: 'pad.wav' },
    ]);
  });

  it('ignores anything but plain .wav file names', () => {
    const tracks = parseDemoManifest(
      {
        tracks: [
          { file: '../secret.wav' },
          { file: 'https://evil.example.com/x.wav' },
          { file: 'sub/dir.wav' },
          { file: 'notes.txt' },
          { file: '.hidden.wav' },
          { file: 42 },
          null,
        ],
      },
      MANIFEST
    );
    expect(tracks).toEqual([]);
  });

  it('returns nothing for a malformed manifest', () => {
    expect(parseDemoManifest(null, MANIFEST)).toEqual([]);
    expect(parseDemoManifest({}, MANIFEST)).toEqual([]);
    expect(parseDemoManifest({ tracks: 'drums.wav' }, MANIFEST)).toEqual([]);
  });
});
