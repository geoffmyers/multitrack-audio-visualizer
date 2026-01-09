import type { AudioTrack } from '../core/AudioTrack';
import { ColorManager } from '../visualization/ColorManager';
import type { LayoutMode, AmplitudeMode } from '../types/visualizer.types';
import { RenderContext } from './RenderContext';

export class WaveformRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderContext: RenderContext;

  constructor(canvas: HTMLCanvasElement, renderContext?: RenderContext) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.renderContext = renderContext || RenderContext.fromCanvas(canvas);
  }

  /**
   * Render all tracks with the specified layout mode (1-second rolling window)
   */
  render(
    tracks: AudioTrack[],
    currentTime: number,
    duration: number,
    layout: LayoutMode = 'overlay',
    amplitudeMode: AmplitudeMode = 'individual',
    heightPercent: number = 50,
    smoothingLevel: number = 0,
    windowDuration: number = 1.0
  ): void {
    const dimensions = this.renderContext.getDimensions();

    // Clear canvas with black background
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (tracks.length === 0) {
      this.renderEmptyState();
      return;
    }

    // Calculate global max amplitude for normalization if needed
    let globalMaxAmplitude = 1.0;
    if (amplitudeMode === 'normalized' && tracks.length > 0) {
      globalMaxAmplitude = this.calculateGlobalMaxAmplitude(tracks, currentTime, windowDuration);
    }

    if (layout === 'stacked') {
      this.renderTracksStacked(
        tracks,
        currentTime,
        amplitudeMode,
        globalMaxAmplitude,
        heightPercent,
        smoothingLevel,
        windowDuration
      );
    } else if (layout === 'overlay-additive') {
      const centerY = dimensions.centerY;
      const maxAmplitude = this.renderContext.heightPercentToPixels(heightPercent);
      this.renderTracksAdditive(
        tracks,
        currentTime,
        centerY,
        maxAmplitude,
        amplitudeMode,
        globalMaxAmplitude,
        smoothingLevel,
        windowDuration
      );
    } else if (layout === 'spectrum-overlay') {
      this.renderTracksSpectrumOverlay(tracks, currentTime, heightPercent, windowDuration);
    } else if (layout === 'spectrum-stacked') {
      this.renderTracksSpectrumStacked(tracks, currentTime, heightPercent, windowDuration);
    } else {
      // Default overlay mode - center at canvas center
      const centerY = dimensions.centerY;
      const maxAmplitude = this.renderContext.heightPercentToPixels(heightPercent);
      tracks.forEach((track) => {
        this.renderTrackRealtimeWithAmplitude(
          track,
          currentTime,
          centerY,
          maxAmplitude,
          amplitudeMode,
          globalMaxAmplitude,
          smoothingLevel,
          windowDuration
        );
      });
    }

    // Render time indicator (shows current playback position)
    this.renderTimeIndicator(currentTime, windowDuration);
  }

  /**
   * Calculate the global maximum amplitude across all tracks for normalization
   */
  private calculateGlobalMaxAmplitude(
    tracks: AudioTrack[],
    currentTime: number,
    windowDuration: number
  ): number {
    const dimensions = this.renderContext.getDimensions();
    let globalMax = 0;

    tracks.forEach((track) => {
      const waveformData = track.getWaveformDataForTimeWindow(
        currentTime,
        windowDuration,
        dimensions.width
      );
      for (let i = 0; i < waveformData.length; i++) {
        if (waveformData[i] > globalMax) {
          globalMax = waveformData[i];
        }
      }
    });

    return globalMax > 0 ? globalMax : 1.0; // Avoid division by zero
  }

  /**
   * Render a single track's waveform in real-time with custom amplitude
   */
  private renderTrackRealtimeWithAmplitude(
    track: AudioTrack,
    currentTime: number,
    centerY: number,
    maxAmplitude: number,
    amplitudeMode: AmplitudeMode = 'individual',
    globalMaxAmplitude: number = 1.0,
    smoothingLevel: number = 0,
    windowDuration: number = 1.0
  ): void {
    const dimensions = this.renderContext.getDimensions();

    // Get waveform data for the last windowDuration seconds
    const waveformData = track.getWaveformDataForTimeWindow(
      currentTime,
      windowDuration,
      dimensions.width,
      smoothingLevel
    );

    // Set color and opacity
    const color = ColorManager.hexToRgba(track.color, track.opacity);
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = 2;

    // Draw waveform
    this.ctx.beginPath();

    // Calculate how much of the waveform to show based on current time
    // When currentTime < windowDuration, only show portion that has been played
    let maxX: number;
    if (currentTime < windowDuration) {
      // Show only the portion from 0 to currentTime
      // Map currentTime (0 to windowDuration) to canvas pixels (0 to width)
      maxX = Math.floor((currentTime / windowDuration) * dimensions.width);
    } else {
      // Show full waveform
      maxX = dimensions.width;
    }

    for (let x = 0; x < maxX && x < waveformData.length; x++) {
      let amplitude = waveformData[x];

      // Apply amplitude normalization if enabled
      if (amplitudeMode === 'normalized' && globalMaxAmplitude > 0) {
        amplitude = amplitude / globalMaxAmplitude;
      }

      const y = amplitude * maxAmplitude;

      // Draw vertical line from center - amplitude to center + amplitude
      this.ctx.moveTo(x, centerY - y);
      this.ctx.lineTo(x, centerY + y);
    }

    this.ctx.stroke();
  }

  /**
   * Render tracks in stacked layout (vertically distributed)
   */
  private renderTracksStacked(
    tracks: AudioTrack[],
    currentTime: number,
    amplitudeMode: AmplitudeMode = 'individual',
    globalMaxAmplitude: number = 1.0,
    heightPercent: number = 50,
    smoothingLevel: number = 0,
    windowDuration: number = 1.0
  ): void {
    const dimensions = this.renderContext.getDimensions();
    const numTracks = tracks.length;
    const trackHeight = dimensions.height / numTracks;

    tracks.forEach((track, index) => {
      // Calculate center Y position for this track (centered within its allocated space)
      const centerY = (index + 0.5) * trackHeight;

      // heightPercent represents the total vertical span
      // Waveforms extend ±(heightPercent/2) above and below center, allowing overlap
      const maxAmplitude = this.renderContext.heightPercentToPixels(heightPercent) / 2;

      this.renderTrackRealtimeWithAmplitude(
        track,
        currentTime,
        centerY,
        maxAmplitude,
        amplitudeMode,
        globalMaxAmplitude,
        smoothingLevel,
        windowDuration
      );
    });
  }

  /**
   * Render tracks in additive overlay layout (stacked gradient effect)
   */
  private renderTracksAdditive(
    tracks: AudioTrack[],
    currentTime: number,
    centerY: number,
    maxAmplitude: number,
    amplitudeMode: AmplitudeMode = 'individual',
    globalMaxAmplitude: number = 1.0,
    smoothingLevel: number = 0,
    windowDuration: number = 1.0
  ): void {
    const dimensions = this.renderContext.getDimensions();

    // Pre-fetch waveform data for all tracks
    const waveformDataArray = tracks.map((track) =>
      track.getWaveformDataForTimeWindow(
        currentTime,
        windowDuration,
        dimensions.width,
        smoothingLevel
      )
    );

    // Calculate maxX for progressive reveal
    let maxX: number;
    if (currentTime < windowDuration) {
      // Show only the portion from 0 to currentTime
      maxX = Math.floor((currentTime / windowDuration) * dimensions.width);
    } else {
      // Show full waveform
      maxX = dimensions.width;
    }

    // Render pixel by pixel
    for (let x = 0; x < maxX && x < dimensions.width; x++) {
      // Collect amplitudes from all tracks at this position
      const amplitudes: number[] = [];
      for (let i = 0; i < tracks.length; i++) {
        let amplitude = waveformDataArray[i][x] || 0;

        // Apply amplitude normalization if enabled
        if (amplitudeMode === 'normalized' && globalMaxAmplitude > 0) {
          amplitude = amplitude / globalMaxAmplitude;
        }

        amplitudes.push(amplitude);
      }

      // Calculate total amplitude
      const totalAmplitude = amplitudes.reduce((sum, a) => sum + a, 0);

      // Clamp and scale if necessary
      let scaleFactor = 1.0;
      if (totalAmplitude > 1.0) {
        scaleFactor = 1.0 / totalAmplitude;
      }

      // Draw positive (upper) half - stack upward from center
      let currentY = centerY;
      for (let i = 0; i < tracks.length; i++) {
        const scaledAmplitude = amplitudes[i] * scaleFactor;
        const segmentHeight = scaledAmplitude * maxAmplitude;

        if (segmentHeight > 0.5) {
          // Skip tiny segments for performance
          const color = ColorManager.hexToRgba(tracks[i].color, tracks[i].opacity);
          this.ctx.strokeStyle = color;
          this.ctx.lineWidth = 1;

          const yStart = currentY;
          const yEnd = currentY - segmentHeight;

          this.ctx.beginPath();
          this.ctx.moveTo(x, yStart);
          this.ctx.lineTo(x, yEnd);
          this.ctx.stroke();

          currentY = yEnd;
        }
      }

      // Draw negative (lower) half - stack downward from center
      currentY = centerY;
      for (let i = 0; i < tracks.length; i++) {
        const scaledAmplitude = amplitudes[i] * scaleFactor;
        const segmentHeight = scaledAmplitude * maxAmplitude;

        if (segmentHeight > 0.5) {
          // Skip tiny segments for performance
          const color = ColorManager.hexToRgba(tracks[i].color, tracks[i].opacity);
          this.ctx.strokeStyle = color;
          this.ctx.lineWidth = 1;

          const yStart = currentY;
          const yEnd = currentY + segmentHeight;

          this.ctx.beginPath();
          this.ctx.moveTo(x, yStart);
          this.ctx.lineTo(x, yEnd);
          this.ctx.stroke();

          currentY = yEnd;
        }
      }
    }
  }

  /**
   * Render tracks in spectrum overlay layout
   */
  private renderTracksSpectrumOverlay(
    tracks: AudioTrack[],
    currentTime: number,
    heightPercent: number = 50,
    windowDuration: number = 1.0
  ): void {
    const dimensions = this.renderContext.getDimensions();
    // Spectrum bars grow upward from the bottom of the canvas
    const baseY = dimensions.height;

    tracks.forEach((track) => {
      this.renderTrackSpectrum(track, currentTime, baseY, heightPercent, windowDuration);
    });
  }

  /**
   * Render tracks in spectrum stacked layout
   */
  private renderTracksSpectrumStacked(
    tracks: AudioTrack[],
    currentTime: number,
    heightPercent: number = 50,
    windowDuration: number = 1.0
  ): void {
    const dimensions = this.renderContext.getDimensions();
    const numTracks = tracks.length;
    const trackHeight = dimensions.height / numTracks;

    tracks.forEach((track, index) => {
      // Spectrum bars grow upward from the bottom of each track's allocated space
      const baseY = (index + 1) * trackHeight;
      this.renderTrackSpectrum(track, currentTime, baseY, heightPercent, windowDuration);
    });
  }

  /**
   * Render a single track's frequency spectrum
   */
  private renderTrackSpectrum(
    track: AudioTrack,
    currentTime: number,
    baseY: number,
    heightPercent: number = 50,
    windowDuration: number = 1.0
  ): void {
    const dimensions = this.renderContext.getDimensions();
    const spectrumData = track.getFrequencySpectrumForTimeWindow(currentTime, windowDuration, 2048);
    const numBins = spectrumData.length;

    // Set color and opacity
    const color = ColorManager.hexToRgba(track.color, track.opacity);
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = 2;

    // Draw spectrum bars
    this.ctx.beginPath();

    const barWidth = dimensions.width / numBins;
    const maxBarHeight = this.renderContext.heightPercentToPixels(heightPercent);

    for (let i = 0; i < numBins; i++) {
      const magnitude = spectrumData[i];
      // Scale magnitude to max bar height (logarithmic scaling for better visualization)
      const barHeight = Math.log10(1 + magnitude * 100) * maxBarHeight;

      const x = i * barWidth;

      // Draw vertical bar from baseY upward
      this.ctx.moveTo(x, baseY);
      this.ctx.lineTo(x, baseY - barHeight);
    }

    this.ctx.stroke();
  }

  /**
   * Render time indicator (current playback position)
   */
  private renderTimeIndicator(currentTime: number, windowDuration: number): void {
    const dimensions = this.renderContext.getDimensions();
    // const windowDuration = 1.0; // Must match the window duration used in waveform extraction

    // Calculate playhead position
    // If currentTime < 1 second: playhead moves from left to right
    // If currentTime >= 1 second: playhead stays at right edge
    let x: number;
    if (currentTime < windowDuration) {
      // Position proportionally within the window (0 to windowDuration)
      x = (currentTime / windowDuration) * dimensions.width;
    } else {
      // Stay at right edge
      x = dimensions.width - 1;
    }

    // Draw vertical line
    // this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    // this.ctx.lineWidth = 3;
    // this.ctx.beginPath();
    // this.ctx.moveTo(x, 0);
    // this.ctx.lineTo(x, dimensions.height);
    // this.ctx.stroke();

    // Draw time label at bottom right
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '14px monospace';
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'bottom';

    const mins = Math.floor(currentTime / 60);
    const secs = Math.floor(currentTime % 60);
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    this.ctx.fillText(timeStr, dimensions.width - 10, dimensions.height - 10);
  }

  /**
   * Render empty state message
   */
  private renderEmptyState(): void {
    const dimensions = this.renderContext.getDimensions();

    this.ctx.fillStyle = '#666666';
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('Add audio tracks to begin', dimensions.width / 2, dimensions.height / 2);
  }

  /**
   * Resize canvas and update render context
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.renderContext = RenderContext.fromCanvas(this.canvas);
  }
}
