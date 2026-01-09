import { describe, it, expect } from 'vitest';
import { ColorManager } from '../ColorManager';

describe('ColorManager', () => {
  describe('getColorForIndex', () => {
    it('should return a color for valid indices', () => {
      const color0 = ColorManager.getColorForIndex(0);
      const color1 = ColorManager.getColorForIndex(1);

      expect(color0).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(color1).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(color0).not.toBe(color1);
    });

    it('should cycle through colors for indices beyond palette length', () => {
      const palette = ColorManager.getDefaultPalette();
      const paletteLength = palette.length;

      expect(ColorManager.getColorForIndex(0)).toBe(ColorManager.getColorForIndex(paletteLength));
      expect(ColorManager.getColorForIndex(1)).toBe(
        ColorManager.getColorForIndex(paletteLength + 1)
      );
    });

    it('should handle negative indices (returns undefined)', () => {
      // Negative modulo in JS gives negative results, so array access returns undefined
      // This is an edge case that callers should avoid
      const color = ColorManager.getColorForIndex(-1);
      expect(color).toBeUndefined();
    });
  });

  describe('getDefaultPalette', () => {
    it('should return an array of colors', () => {
      const palette = ColorManager.getDefaultPalette();

      expect(Array.isArray(palette)).toBe(true);
      expect(palette.length).toBeGreaterThan(0);
    });

    it('should return valid hex colors', () => {
      const palette = ColorManager.getDefaultPalette();

      palette.forEach((color) => {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('should return a copy of the palette', () => {
      const palette1 = ColorManager.getDefaultPalette();
      const palette2 = ColorManager.getDefaultPalette();

      expect(palette1).not.toBe(palette2);
      expect(palette1).toEqual(palette2);
    });
  });

  describe('hexToRgba', () => {
    it('should convert hex color to rgba with default alpha', () => {
      expect(ColorManager.hexToRgba('#FF0000')).toBe('rgba(255, 0, 0, 1)');
      expect(ColorManager.hexToRgba('#00FF00')).toBe('rgba(0, 255, 0, 1)');
      expect(ColorManager.hexToRgba('#0000FF')).toBe('rgba(0, 0, 255, 1)');
    });

    it('should convert hex color to rgba with custom alpha', () => {
      expect(ColorManager.hexToRgba('#FF0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
      expect(ColorManager.hexToRgba('#FFFFFF', 0)).toBe('rgba(255, 255, 255, 0)');
    });

    it('should handle hex without hash', () => {
      expect(ColorManager.hexToRgba('FF0000')).toBe('rgba(255, 0, 0, 1)');
    });

    it('should return white for invalid hex', () => {
      expect(ColorManager.hexToRgba('invalid')).toBe('rgba(255, 255, 255, 1)');
      expect(ColorManager.hexToRgba('#FFF')).toBe('rgba(255, 255, 255, 1)');
      expect(ColorManager.hexToRgba('')).toBe('rgba(255, 255, 255, 1)');
    });

    it('should be case insensitive', () => {
      expect(ColorManager.hexToRgba('#ff0000')).toBe('rgba(255, 0, 0, 1)');
      expect(ColorManager.hexToRgba('#FF0000')).toBe('rgba(255, 0, 0, 1)');
      expect(ColorManager.hexToRgba('#Ff00Ff')).toBe('rgba(255, 0, 255, 1)');
    });
  });

  describe('isValidHex', () => {
    it('should return true for valid hex colors', () => {
      expect(ColorManager.isValidHex('#FF0000')).toBe(true);
      expect(ColorManager.isValidHex('#00ff00')).toBe(true);
      expect(ColorManager.isValidHex('0000FF')).toBe(true);
    });

    it('should return false for invalid hex colors', () => {
      expect(ColorManager.isValidHex('#FFF')).toBe(false);
      expect(ColorManager.isValidHex('invalid')).toBe(false);
      expect(ColorManager.isValidHex('')).toBe(false);
      expect(ColorManager.isValidHex('#GGGGGG')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(ColorManager.isValidHex('#aabbcc')).toBe(true);
      expect(ColorManager.isValidHex('#AABBCC')).toBe(true);
      expect(ColorManager.isValidHex('#AaBbCc')).toBe(true);
    });
  });
});
