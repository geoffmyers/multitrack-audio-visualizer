export class FileLoader {
  /**
   * Validate if file is a WAV file
   */
  static isWavFile(file: File): boolean {
    return (
      file.type === 'audio/wav' ||
      file.type === 'audio/wave' ||
      file.name.toLowerCase().endsWith('.wav')
    );
  }

  /**
   * Filter WAV files from a FileList
   */
  static filterWavFiles(files: FileList | File[]): File[] {
    const fileArray = Array.from(files);
    return fileArray.filter((file) => this.isWavFile(file));
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  }

  /**
   * Setup drag and drop handlers
   */
  static setupDragAndDrop(element: HTMLElement, onFiles: (files: File[]) => void): void {
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      element.classList.add('drag-over');
    });

    element.addEventListener('dragleave', (e) => {
      e.preventDefault();
      element.classList.remove('drag-over');
    });

    element.addEventListener('drop', (e) => {
      e.preventDefault();
      element.classList.remove('drag-over');

      const files = e.dataTransfer?.files;
      if (files) {
        const wavFiles = this.filterWavFiles(files);
        if (wavFiles.length > 0) {
          onFiles(wavFiles);
        }
      }
    });
  }
}
