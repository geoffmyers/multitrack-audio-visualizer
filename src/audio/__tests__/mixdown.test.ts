import { describe, it, expect } from 'vitest';
import { normalizeStereoPeak, floatSampleToInt16 } from '../mixdown';

describe('normalizeStereoPeak', () => {
  it('leaves a mix within full scale unchanged', () => {
    const left = new Float32Array([0.1, -0.5, 0.9]);
    const right = new Float32Array([0.2, -0.4, 1.0]);

    const result = normalizeStereoPeak({ left, right });

    expect(result.wasNormalized).toBe(false);
    expect(result.peak).toBe(1.0);
    expect(result.normalized.left).toBe(left); // same array, not a copy
    expect(result.normalized.right).toBe(right);
  });

  it('scales a mix down so its peak lands at exactly 1.0', () => {
    const left = new Float32Array([0.5, -2.0, 1.0]);
    const right = new Float32Array([1.5, 0.5, -0.25]);

    const result = normalizeStereoPeak({ left, right });

    expect(result.wasNormalized).toBe(true);
    expect(result.peak).toBe(2.0);

    let newPeak = 0;
    for (const sample of result.normalized.left) {
      newPeak = Math.max(newPeak, Math.abs(sample));
    }
    for (const sample of result.normalized.right) {
      newPeak = Math.max(newPeak, Math.abs(sample));
    }
    expect(newPeak).toBeCloseTo(1.0, 10);
  });

  it('preserves relative levels between channels and samples', () => {
    // A mix at exactly 2x full scale on the loudest sample: every other
    // sample should end up at exactly half its original value.
    const left = new Float32Array([2.0, 1.0, 0.0]);
    const right = new Float32Array([0.0, -1.0, -2.0]);

    const { normalized } = normalizeStereoPeak({ left, right });

    expect(Array.from(normalized.left)).toEqual([1.0, 0.5, 0.0]);
    expect(Array.from(normalized.right)).toEqual([0.0, -0.5, -1.0]);
  });

  it('never scales a quiet mix up', () => {
    const left = new Float32Array([0.01, -0.02]);
    const right = new Float32Array([0.015, -0.005]);

    const result = normalizeStereoPeak({ left, right });

    expect(result.wasNormalized).toBe(false);
    // Same array, not a copy or a rescaled one -- so this is exact even
    // though a Float32Array can't represent 0.01 precisely (it rounds to
    // ~0.009999999776482582, which is why the expectation is built the same
    // way rather than compared against the JS double literal).
    expect(result.normalized.left).toBe(left);
    expect(Array.from(result.normalized.left)).toEqual(Array.from(new Float32Array([0.01, -0.02])));
  });

  it('treats a silent mix (peak 0) as already normalized', () => {
    const left = new Float32Array([0, 0, 0]);
    const right = new Float32Array([0, 0, 0]);

    const result = normalizeStereoPeak({ left, right });

    expect(result.wasNormalized).toBe(false);
    expect(result.peak).toBe(0);
  });

  it('does not mutate its input arrays', () => {
    const left = new Float32Array([2.0]);
    const right = new Float32Array([2.0]);
    const originalLeft = Array.from(left);
    const originalRight = Array.from(right);

    normalizeStereoPeak({ left, right });

    expect(Array.from(left)).toEqual(originalLeft);
    expect(Array.from(right)).toEqual(originalRight);
  });
});

describe('floatSampleToInt16', () => {
  it('maps 0 to 0', () => {
    expect(floatSampleToInt16(0)).toBe(0);
  });

  it('maps 1.0 to the maximum positive 16-bit value', () => {
    expect(floatSampleToInt16(1.0)).toBe(32767);
  });

  it('maps -1.0 to the maximum negative 16-bit value', () => {
    expect(floatSampleToInt16(-1.0)).toBe(-32768);
  });

  it('clamps values above 1.0 (a safety net, not the primary limiter)', () => {
    expect(floatSampleToInt16(1.5)).toBe(32767);
  });

  it('clamps values below -1.0', () => {
    expect(floatSampleToInt16(-1.5)).toBe(-32768);
  });
});
