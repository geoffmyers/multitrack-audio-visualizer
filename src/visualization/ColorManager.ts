export class ColorManager {
  private static defaultPalette: string[] = [
    '#FF6B6B', // Red
    '#4ECDC4', // Turquoise
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#F8B195', // Peach
    '#85E085', // Light Green
    '#FF99CC'  // Pink
  ];

  /**
   * Get color for track by index
   */
  static getColorForIndex(index: number): string {
    return this.defaultPalette[index % this.defaultPalette.length];
  }

  /**
   * Get all default colors
   */
  static getDefaultPalette(): string[] {
    return [...this.defaultPalette];
  }

  /**
   * Parse color string to RGBA
   */
  static hexToRgba(hex: string, alpha: number = 1): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(255, 255, 255, ${alpha})`;

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Validate hex color
   */
  static isValidHex(hex: string): boolean {
    return /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.test(hex);
  }
}
