/**
 * Shared, pure stereo-mixdown math used by both the browser export path
 * (VideoExporter.ts, via an OfflineAudioContext render) and the CLI
 * (cli/adapters/CLIAudioEngine.ts, via manual sample-level mixing).
 *
 * Before this module existed the two disagreed: the browser hard-clipped a
 * mix over full scale (audible distortion), while the CLI scaled the whole
 * mix down so its peak sample landed at 1.0 (a clean, quieter render). Both
 * paths now call normalizeStereoPeak() on their finished mix before
 * converting to 16-bit PCM.
 */

export interface StereoBuffer {
  left: Float32Array;
  right: Float32Array;
}

export interface NormalizeResult {
  normalized: StereoBuffer;
  peak: number;
  wasNormalized: boolean;
}

/**
 * Scale a stereo mix down so its peak sample is at most 1.0 (full scale).
 * Never scales up -- a mix that never exceeds 1.0 is returned unchanged, so a
 * quiet mix stays exactly as quiet as it was mixed. Does not mutate the
 * input; when scaling is applied, new arrays are returned.
 */
export function normalizeStereoPeak(mix: StereoBuffer): NormalizeResult {
  const { left, right } = mix;
  const length = Math.max(left.length, right.length);

  let peak = 0;
  for (let i = 0; i < length; i++) {
    const l = i < left.length ? Math.abs(left[i]) : 0;
    const r = i < right.length ? Math.abs(right[i]) : 0;
    if (l > peak) {
      peak = l;
    }
    if (r > peak) {
      peak = r;
    }
  }

  if (peak <= 1.0) {
    return { normalized: mix, peak, wasNormalized: false };
  }

  const gain = 1.0 / peak;
  const normalizedLeft = new Float32Array(left.length);
  const normalizedRight = new Float32Array(right.length);
  for (let i = 0; i < left.length; i++) {
    normalizedLeft[i] = left[i] * gain;
  }
  for (let i = 0; i < right.length; i++) {
    normalizedRight[i] = right[i] * gain;
  }

  return {
    normalized: { left: normalizedLeft, right: normalizedRight },
    peak,
    wasNormalized: true,
  };
}

/**
 * Convert one already-normalized [-1, 1] float sample to a 16-bit signed PCM
 * integer. The `Math.min`/`Math.max` clamp here is a safety net (floating
 * point rounding, or a caller that skipped normalizeStereoPeak), not the
 * primary loudness-limiting step -- that's normalizeStereoPeak()'s job.
 */
export function floatSampleToInt16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return Math.round(clamped * (clamped < 0 ? 0x8000 : 0x7fff));
}
