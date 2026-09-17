/**
 * Gated debug logging for the browser app and its export Web Worker.
 *
 * AudioEngine, PresetManager, VideoExporter and the export worker used to
 * print ~90 unconditional `console.log` calls (play/pause/seek tracing,
 * preset load/save, FFmpeg frame-by-frame progress) into every visitor's
 * console. `debugLog()` only prints when debugging is turned on, which can
 * happen three ways:
 *   - `localStorage.setItem('debug', 'true')` (persists across reloads)
 *   - `?debug=1` in the page URL (this load only; `?debug=0` forces it off)
 *   - `setDebugEnabled(true)`, for a context with neither `localStorage` nor
 *     the page's URL -- the export Web Worker has its own global scope, so
 *     `VideoExporter` reads `isDebugEnabled()` on the main thread and passes
 *     it in the `init` message; `export.worker.ts` applies it once with
 *     `setDebugEnabled()`.
 *
 * `console.warn`/`console.error` are untouched everywhere: those mark an
 * actual problem and should always be visible, debug flag or not.
 */

let overrideEnabled: boolean | null = null;

/** Force the flag on or off, bypassing the URL/localStorage checks. */
export function setDebugEnabled(enabled: boolean): void {
  overrideEnabled = enabled;
}

export function isDebugEnabled(): boolean {
  if (overrideEnabled !== null) {
    return overrideEnabled;
  }

  try {
    if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      const fromUrl = new URLSearchParams(location.search).get('debug');
      if (fromUrl !== null) {
        return fromUrl !== '0' && fromUrl !== 'false';
      }
    }
  } catch {
    // `location` can be restricted in some embedding contexts; fall through
    // to the localStorage check instead of throwing.
  }

  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('debug') === 'true';
    }
  } catch {
    // localStorage can throw (private browsing with storage disabled, or a
    // Worker global scope that has no localStorage at all); default to
    // quiet rather than crash the caller.
  }

  return false;
}

/** console.log, but only when debugging is enabled. */
export function debugLog(...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.log(...args);
  }
}
