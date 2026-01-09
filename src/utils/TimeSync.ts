export class TimeSync {
  /**
   * Convert time (seconds) to pixel position on canvas
   */
  static timeToPixel(currentTime: number, duration: number, canvasWidth: number): number {
    if (duration === 0) {
      return 0;
    }
    return (currentTime / duration) * canvasWidth;
  }

  /**
   * Convert pixel position to time (seconds)
   */
  static pixelToTime(pixel: number, canvasWidth: number, duration: number): number {
    if (canvasWidth === 0) {
      return 0;
    }
    return (pixel / canvasWidth) * duration;
  }

  /**
   * Format time in MM:SS format
   */
  static formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) {
      return '00:00';
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Clamp time within valid range
   */
  static clampTime(time: number, duration: number): number {
    return Math.max(0, Math.min(time, duration));
  }
}
