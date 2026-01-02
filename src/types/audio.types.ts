export interface AudioTrackConfig {
  id: string;
  name: string;
  file: File;
  color: string;
  opacity: number;
}

export interface TrackMetadata {
  id: string;
  name: string;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  color: string;
  opacity: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

export interface ExportOptions {
  format: 'mp4';
  codec: 'h264' | 'h265';
  fps: number;
  quality: number; // CRF value (18-28)
  audioBitrate: string; // e.g., '192k'
  layout: 'overlay' | 'overlay-additive' | 'stacked' | 'spectrum-overlay' | 'spectrum-stacked';
  amplitudeMode: 'individual' | 'normalized';
  heightPercent: number; // 1-100%
  smoothingLevel: number; // 0-5 (0 = no smoothing)
  windowDuration: number; // Duration of waveform window in seconds
}
