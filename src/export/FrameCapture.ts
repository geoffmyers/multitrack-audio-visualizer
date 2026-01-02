export class FrameCapture {
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /**
   * Capture a single frame as a Blob
   */
  async captureFrame(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to capture frame'));
        }
      }, 'image/png');
    });
  }

  /**
   * Capture a frame as base64 data URL
   */
  captureFrameAsDataURL(): string {
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Capture frame as raw image data
   */
  captureFrameAsImageData(): ImageData {
    const ctx = this.canvas.getContext('2d')!;
    return ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }
}
