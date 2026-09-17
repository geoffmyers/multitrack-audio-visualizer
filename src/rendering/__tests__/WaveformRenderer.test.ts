import { describe, it, expect, vi } from 'vitest';
import { WaveformRenderer } from '../WaveformRenderer';
import { RenderContext } from '../RenderContext';
import { ColorManager } from '../../visualization/ColorManager';
import type { AudioTrack } from '../../core/AudioTrack';

/**
 * happy-dom's `HTMLCanvasElement.getContext('2d')` returns null (there is no
 * `canvas` npm package wired in for it here), so WaveformRenderer's own
 * constructor -- `this.ctx = canvas.getContext('2d')!` -- would throw at
 * `fillRect()`. Rather than pull in real pixel rendering, this fake
 * CanvasRenderingContext2D just records every call (and the strokeStyle in
 * effect at the time), which is exactly what "layout" tests need: the x/y
 * coordinates WaveformRenderer computed, not what they look like painted.
 */
class FakeCanvasContext2D {
  calls: Array<{ method: string; args: unknown[]; strokeStyle: string; fillStyle: string }> = [];
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  textAlign = 'start';
  textBaseline = 'alphabetic';

  private record(method: string, args: unknown[]): void {
    this.calls.push({ method, args, strokeStyle: this.strokeStyle, fillStyle: this.fillStyle });
  }

  fillRect(...args: unknown[]): void {
    this.record('fillRect', args);
  }
  beginPath(): void {
    this.record('beginPath', []);
  }
  moveTo(...args: unknown[]): void {
    this.record('moveTo', args);
  }
  lineTo(...args: unknown[]): void {
    this.record('lineTo', args);
  }
  stroke(): void {
    this.record('stroke', []);
  }
  fillText(...args: unknown[]): void {
    this.record('fillText', args);
  }

  callsOf(method: string, strokeStyle?: string): unknown[][] {
    return this.calls
      .filter((c) => c.method === method && (strokeStyle === undefined || c.strokeStyle === strokeStyle))
      .map((c) => c.args);
  }
}

function makeRenderer(width: number, height: number): { renderer: WaveformRenderer; ctx: FakeCanvasContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = new FakeCanvasContext2D();
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);

  const renderer = new WaveformRenderer(canvas, new RenderContext(width, height));
  return { renderer, ctx };
}

/** A track whose waveform/spectrum is a flat, constant amplitude -- makes
 * every y-coordinate WaveformRenderer computes predictable by hand. */
function makeFakeTrack(overrides: { color?: string; opacity?: number; amplitude?: number } = {}): AudioTrack {
  const amplitude = overrides.amplitude ?? 0;
  return {
    color: overrides.color ?? '#ff0000',
    opacity: overrides.opacity ?? 1,
    getWaveformDataForTimeWindow: vi.fn((_currentTime: number, _windowDuration: number, targetWidth: number) =>
      new Float32Array(targetWidth).fill(amplitude)
    ),
    getFrequencySpectrumForTimeWindow: vi.fn((_currentTime: number, _windowDuration: number, fftSize: number) =>
      new Float32Array(fftSize / 2).fill(amplitude)
    ),
  } as unknown as AudioTrack;
}

describe('WaveformRenderer layout', () => {
  describe('overlay (default layout)', () => {
    it('centers a flat waveform on the canvas vertical center', () => {
      const { renderer, ctx } = makeRenderer(100, 100);
      const track = makeFakeTrack({ amplitude: 0 });

      renderer.render([track], 5, 10, 'overlay', 'individual', 50);

      const strokeStyle = ColorManager.hexToRgba('#ff0000', 1);
      const moveTos = ctx.callsOf('moveTo', strokeStyle);
      const lineTos = ctx.callsOf('lineTo', strokeStyle);
      expect(moveTos).toHaveLength(100); // one pair per canvas column
      expect(lineTos).toHaveLength(100);
      // Zero amplitude collapses both the top and bottom of the line to
      // centerY (= height / 2 = 50).
      expect(moveTos.every(([, y]) => y === 50)).toBe(true);
      expect(lineTos.every(([, y]) => y === 50)).toBe(true);
    });

    it('scales the line above/below center by amplitude * heightPercent', () => {
      const { renderer, ctx } = makeRenderer(100, 100);
      const track = makeFakeTrack({ amplitude: 0.5 });

      // heightPercent 50 on a 100px-tall canvas -> maxAmplitude = 50px;
      // amplitude 0.5 -> y = 25px either side of centerY (50).
      renderer.render([track], 5, 10, 'overlay', 'individual', 50);

      const strokeStyle = ColorManager.hexToRgba('#ff0000', 1);
      const [firstMoveTo] = ctx.callsOf('moveTo', strokeStyle);
      const [firstLineTo] = ctx.callsOf('lineTo', strokeStyle);
      expect(firstMoveTo).toEqual([0, 25]); // centerY - y
      expect(firstLineTo).toEqual([0, 75]); // centerY + y
    });

    it('only reveals the waveform up to currentTime before the window fills', () => {
      const { renderer, ctx } = makeRenderer(100, 100);
      const track = makeFakeTrack({ amplitude: 0 });

      // windowDuration defaults to 1.0s; at currentTime 0.3s only the first
      // 30 of 100 columns should have been drawn.
      renderer.render([track], 0.3, 10, 'overlay', 'individual', 50);

      const strokeStyle = ColorManager.hexToRgba('#ff0000', 1);
      expect(ctx.callsOf('moveTo', strokeStyle)).toHaveLength(30);
    });

    it('normalizes each track by the loudest track when amplitudeMode is "normalized"', () => {
      const { renderer, ctx } = makeRenderer(100, 100);
      const quiet = makeFakeTrack({ color: '#ff0000', amplitude: 0.2 });
      const loud = makeFakeTrack({ color: '#00ff00', amplitude: 0.8 });

      renderer.render([quiet, loud], 5, 10, 'overlay', 'normalized', 50);

      const quietStroke = ColorManager.hexToRgba('#ff0000', 1);
      const loudStroke = ColorManager.hexToRgba('#00ff00', 1);
      // Loud track's amplitude divided by itself (the global max) is 1.0,
      // so it fills the full ±50px range.
      expect(ctx.callsOf('moveTo', loudStroke)[0]).toEqual([0, 0]);
      expect(ctx.callsOf('lineTo', loudStroke)[0]).toEqual([0, 100]);
      // Quiet track (0.2) normalized against 0.8 -> 0.25 -> ±12.5px.
      expect(ctx.callsOf('moveTo', quietStroke)[0]).toEqual([0, 37.5]);
      expect(ctx.callsOf('lineTo', quietStroke)[0]).toEqual([0, 62.5]);
    });
  });

  describe('stacked layout', () => {
    it('centers each track within its own equal share of the canvas height', () => {
      const { renderer, ctx } = makeRenderer(100, 100);
      const trackA = makeFakeTrack({ color: '#ff0000', amplitude: 0 });
      const trackB = makeFakeTrack({ color: '#00ff00', amplitude: 0 });

      // 2 tracks over 100px -> each gets a 50px band, centered at 25 and 75.
      renderer.render([trackA, trackB], 5, 10, 'stacked', 'individual', 50);

      const strokeA = ColorManager.hexToRgba('#ff0000', 1);
      const strokeB = ColorManager.hexToRgba('#00ff00', 1);
      expect(ctx.callsOf('moveTo', strokeA).every(([, y]) => y === 25)).toBe(true);
      expect(ctx.callsOf('moveTo', strokeB).every(([, y]) => y === 75)).toBe(true);
    });
  });

  describe('spectrum-overlay layout', () => {
    it('grows every track\'s bars upward from the bottom of the canvas', () => {
      const { renderer, ctx } = makeRenderer(100, 100);
      const track = makeFakeTrack({ amplitude: 0.1 });

      renderer.render([track], 5, 10, 'spectrum-overlay', 'individual', 50);

      const strokeStyle = ColorManager.hexToRgba('#ff0000', 1);
      const moveTos = ctx.callsOf('moveTo', strokeStyle);
      expect(moveTos.length).toBeGreaterThan(0);
      // Every bar starts at baseY = canvas height (100), moving upward.
      expect(moveTos.every(([, y]) => y === 100)).toBe(true);
      const [, firstBarTopY] = ctx.callsOf('lineTo', strokeStyle)[0];
      expect(firstBarTopY as number).toBeLessThan(100); // grew upward, not down
    });
  });

  describe('spectrum-stacked layout', () => {
    it('bases each track\'s bars at the bottom of its own band', () => {
      const { renderer, ctx } = makeRenderer(100, 100);
      const trackA = makeFakeTrack({ color: '#ff0000', amplitude: 0.1 });
      const trackB = makeFakeTrack({ color: '#00ff00', amplitude: 0.1 });

      // 2 tracks over 100px -> bands end at 50 and 100.
      renderer.render([trackA, trackB], 5, 10, 'spectrum-stacked', 'individual', 50);

      const strokeA = ColorManager.hexToRgba('#ff0000', 1);
      const strokeB = ColorManager.hexToRgba('#00ff00', 1);
      expect(ctx.callsOf('moveTo', strokeA).every(([, y]) => y === 50)).toBe(true);
      expect(ctx.callsOf('moveTo', strokeB).every(([, y]) => y === 100)).toBe(true);
    });
  });

  describe('time indicator', () => {
    it('writes the current time as MM:SS at the bottom-right corner', () => {
      const { renderer, ctx } = makeRenderer(100, 100);
      const track = makeFakeTrack();

      renderer.render([track], 125, 200); // 125s = 02:05

      const fillTexts = ctx.callsOf('fillText');
      expect(fillTexts).toContainEqual(['02:05', 90, 90]); // width-10, height-10
    });
  });

  describe('empty state', () => {
    it('shows a centered placeholder and draws nothing else when there are no tracks', () => {
      const { renderer, ctx } = makeRenderer(100, 100);

      renderer.render([], 0, 0);

      expect(ctx.callsOf('fillText')).toEqual([['Add audio tracks to begin', 50, 50]]);
      expect(ctx.callsOf('moveTo')).toHaveLength(0);
      expect(ctx.callsOf('stroke')).toHaveLength(0);
    });
  });

  describe('resize', () => {
    it('re-derives layout from the new canvas dimensions', () => {
      const { renderer, ctx } = makeRenderer(100, 100);

      renderer.resize(50, 50);
      renderer.render([], 0, 0);

      expect(ctx.callsOf('fillText')).toEqual([['Add audio tracks to begin', 25, 25]]);
    });
  });
});
