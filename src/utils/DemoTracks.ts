/**
 * Optional demo tracks. A deployment that wants a "Load demo tracks" button
 * serves `demo/tracks.json` next to index.html:
 *
 *   { "tracks": [{ "file": "drums.wav", "name": "Drums" }, ...] }
 *
 * File paths are relative to that JSON file. Without it, nothing changes.
 */
export const DEMO_MANIFEST_URL = 'demo/tracks.json';

export interface DemoTrack {
  url: string;
  name: string;
}

/** Validate a demo manifest and resolve each file against the manifest URL. */
export function parseDemoManifest(data: unknown, manifestUrl: string): DemoTrack[] {
  if (typeof data !== 'object' || data === null) {
    return [];
  }
  const tracks = (data as { tracks?: unknown }).tracks;
  if (!Array.isArray(tracks)) {
    return [];
  }
  const result: DemoTrack[] = [];
  for (const entry of tracks) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const { file, name } = entry as { file?: unknown; name?: unknown };
    // Plain .wav file names only: no other origin, no parent directories.
    if (typeof file !== 'string' || !/^[\w.-]+\.wav$/i.test(file) || file.startsWith('.')) {
      continue;
    }
    result.push({
      url: new URL(file, manifestUrl).href,
      name: typeof name === 'string' && name.trim() ? name.trim() : file,
    });
  }
  return result;
}

/** Fetch the demo manifest; an empty list when the deployment has none. */
export async function fetchDemoTracks(baseUrl: string): Promise<DemoTrack[]> {
  const manifestUrl = new URL(DEMO_MANIFEST_URL, baseUrl).href;
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      return [];
    }
    return parseDemoManifest(await response.json(), manifestUrl);
  } catch {
    return [];
  }
}

/** Download the demo tracks as File objects, in manifest order. */
export async function downloadDemoTracks(tracks: DemoTrack[]): Promise<File[]> {
  return Promise.all(
    tracks.map(async (track) => {
      const response = await fetch(track.url);
      if (!response.ok) {
        throw new Error(`${track.name}: HTTP ${response.status}`);
      }
      const blob = await response.blob();
      return new File([blob], `${track.name}.wav`, { type: 'audio/wav' });
    })
  );
}
