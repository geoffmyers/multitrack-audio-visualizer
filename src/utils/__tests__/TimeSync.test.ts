import { describe, it, expect } from 'vitest';
import { TimeSync } from '../TimeSync';

describe('TimeSync', () => {
  describe('timeToPixel', () => {
    it('should convert time to pixel position correctly', () => {
      expect(TimeSync.timeToPixel(5, 10, 1920)).toBe(960);
      expect(TimeSync.timeToPixel(0, 10, 1920)).toBe(0);
      expect(TimeSync.timeToPixel(10, 10, 1920)).toBe(1920);
    });

    it('should return 0 when duration is 0', () => {
      expect(TimeSync.timeToPixel(5, 0, 1920)).toBe(0);
    });

    it('should handle fractional times', () => {
      expect(TimeSync.timeToPixel(2.5, 10, 1000)).toBe(250);
    });
  });

  describe('pixelToTime', () => {
    it('should convert pixel position to time correctly', () => {
      expect(TimeSync.pixelToTime(960, 1920, 10)).toBe(5);
      expect(TimeSync.pixelToTime(0, 1920, 10)).toBe(0);
      expect(TimeSync.pixelToTime(1920, 1920, 10)).toBe(10);
    });

    it('should return 0 when canvas width is 0', () => {
      expect(TimeSync.pixelToTime(500, 0, 10)).toBe(0);
    });

    it('should handle fractional pixels', () => {
      expect(TimeSync.pixelToTime(250, 1000, 10)).toBe(2.5);
    });
  });

  describe('formatTime', () => {
    it('should format time as MM:SS', () => {
      expect(TimeSync.formatTime(0)).toBe('00:00');
      expect(TimeSync.formatTime(59)).toBe('00:59');
      expect(TimeSync.formatTime(60)).toBe('01:00');
      expect(TimeSync.formatTime(125)).toBe('02:05');
      expect(TimeSync.formatTime(3661)).toBe('61:01');
    });

    it('should handle negative values', () => {
      expect(TimeSync.formatTime(-5)).toBe('00:00');
    });

    it('should handle Infinity', () => {
      expect(TimeSync.formatTime(Infinity)).toBe('00:00');
      expect(TimeSync.formatTime(-Infinity)).toBe('00:00');
    });

    it('should handle NaN', () => {
      expect(TimeSync.formatTime(NaN)).toBe('00:00');
    });

    it('should floor fractional seconds', () => {
      expect(TimeSync.formatTime(5.9)).toBe('00:05');
    });
  });

  describe('clampTime', () => {
    it('should clamp time within valid range', () => {
      expect(TimeSync.clampTime(5, 10)).toBe(5);
      expect(TimeSync.clampTime(15, 10)).toBe(10);
      expect(TimeSync.clampTime(-5, 10)).toBe(0);
    });

    it('should handle edge cases', () => {
      expect(TimeSync.clampTime(0, 10)).toBe(0);
      expect(TimeSync.clampTime(10, 10)).toBe(10);
    });
  });
});
