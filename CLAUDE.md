# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-Track Audio Visualizer - A real-time music visualization tool that displays overlaid waveforms from multiple WAV files and exports to MP4/H.265 video. The visualizer uses a 1-second rolling window (oscilloscope-style) that updates at 60fps.

## Development Commands

```bash
# Start development server (runs on http://localhost:3000)
npm run dev

# Build for production (outputs to dist/)
npm run build

# Preview production build
npm run preview
```

## Critical Configuration Requirements

### Development vs Production

**IMPORTANT**: The CORS headers required for video export (SharedArrayBuffer/FFmpeg.wasm) conflict with local file access in the browser. Therefore:

**Development Mode** (`npm run dev`):

- CORS headers are **disabled** in `vite.config.ts` to allow loading WAV files from file picker
- Video export will **not work** (will show error about SharedArrayBuffer)
- Audio visualization works normally

**Production Mode**:

- Must enable CORS headers for video export to work:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`
- Configure these in your web server (nginx, Apache, etc.)
- Video export will work, but users must load files via drag-and-drop from same origin

**Alternative Solution** (if you need both in development):

- Use a local web server that serves the WAV files with proper CORS headers
- Access files via `fetch()` instead of file picker

## Architecture Overview

### Core System Flow

1. **Audio Loading** → `AudioEngine` loads WAV files via Web Audio API, creates `AudioTrack` objects
2. **Playback** → `AudioEngine` synchronizes multiple tracks using Web Audio's timing system
3. **Rendering** → `RenderLoop` calls `WaveformRenderer` at 60fps, which extracts real-time waveform data from tracks
4. **Export** → `VideoExporter` captures frames and uses `FFmpeg.wasm` (via Web Worker) to encode MP4

### Module Responsibilities

#### Core Layer ([src/core/](src/core/))

- **AudioEngine.ts**: Central audio management

  - Manages Web Audio API context and master gain node
  - Loads and removes tracks
  - Controls synchronized playback across all tracks
  - Handles seeking with state preservation
  - Extends EventTarget for UI event communication
  - **Key timing logic**: `currentTime = AudioContext.currentTime - startTime` (when playing) or `pausedAt` (when paused)

- **AudioTrack.ts**: Individual track representation
  - Wraps AudioBuffer with visualization metadata (color, opacity)
  - **Real-time waveform extraction**: `getWaveformDataForTimeWindow(currentTime, windowDuration, targetWidth)` - extracts and downsamples audio samples for the current 1-second window
  - **Frequency spectrum extraction**: `getFrequencySpectrumForTimeWindow()` with FFT implementation
  - Adaptive window behavior: shows [0, 1s] when currentTime < 1s, otherwise shows [currentTime - 1s, currentTime]

#### Rendering Layer ([src/rendering/](src/rendering/))

- **WaveformRenderer.ts**: Canvas rendering

  - Supports multiple layout modes: 'overlay', 'stacked', 'spectrum-overlay', 'spectrum-stacked'
  - Supports amplitude modes: 'individual' (each track normalized independently), 'normalized' (global normalization across all tracks)
  - **Dynamic canvas sizing**: Adjusts canvas dimensions based on `heightPx` parameter to allow waveforms to extend beyond default 1920x1080 bounds
  - **Time indicator**: White vertical line that moves from left to right (when currentTime < 1s) or stays at right edge (when currentTime >= 1s)
  - Per-frame extraction: calls `track.getWaveformDataForTimeWindow(currentTime)` for each track every frame

- **RenderLoop.ts**: 60fps animation loop using requestAnimationFrame

#### Export Layer ([src/export/](src/export/))

- **VideoExporter.ts**: Orchestrates video export

  - Captures frames by rendering at each timestamp (frameTime = frameNum / fps)
  - Mixes audio tracks using OfflineAudioContext
  - Delegates encoding to Web Worker

- **export.worker.ts**: Web Worker for FFmpeg

  - Runs FFmpeg.wasm in separate thread to avoid blocking UI
  - Converts frames (data URLs) to PNG images
  - Encodes video with H.264 or H.265 codec
  - Muxes video with mixed audio track

- **FrameCapture.ts**: Canvas-to-image conversion

#### UI Layer ([src/ui/](src/ui/))

- **Controls.ts**: Play/pause/seek controls, listens to AudioEngine events
- **TrackControls.ts**: Per-track color/opacity/remove controls
- **ExportUI.ts**: Video export interface with progress tracking

#### Visualization Layer ([src/visualization/](src/visualization/))

- **ColorManager.ts**: Color palette generation and hex-to-RGBA conversion

#### Utilities ([src/utils/](src/utils/))

- **FileLoader.ts**: Drag-and-drop and file picker handling
- **TimeSync.ts**: Time formatting utilities (MM:SS)

## Key Implementation Details

### Real-Time Visualization (Rolling Window)

The visualizer displays a **1-second rolling window** (not the full duration):

```typescript
// In AudioTrack.ts:67-121
getWaveformDataForTimeWindow(currentTime: number, windowDuration: number = 1.0, targetWidth: number = 1920)
```

**How it works**:

1. Calculate time range: `[currentTime - 1.0s, currentTime]` (or `[0, 1.0s]` if at beginning)
2. Convert to sample indices: `startSample = startTime * sampleRate`
3. Downsample ~44,100 samples to 1920 pixels (canvas width)
4. For each pixel, find peak amplitude in its sample range
5. Called **every frame** (60 times per second) during playback and export

**Performance**: ~0.5ms per track per frame, allowing 8+ tracks at 60fps.

### Audio Synchronization

All tracks must start at the same offset to stay synchronized:

```typescript
// In AudioEngine.ts:141-150
const offset = this.pausedAt;
tracks.forEach((track) => {
  const source = this.audioContext!.createBufferSource();
  source.buffer = track.buffer;
  source.connect(track.gainNode!);
  source.start(0, offset); // Same offset for all tracks
});
```

### Seeking Behavior

Seeking while playing requires:

1. Stop all source nodes
2. Update `pausedAt` to new position
3. Restart playback from new offset

See [AudioEngine.ts:218-255](src/core/AudioEngine.ts#L218-L255).

### Track End Detection

The application detects natural track end (to stop playback) vs. manual stop (to ignore):

```typescript
// In AudioEngine.ts:155-171
source.onended = () => {
  if (this.isPlaying && track.sourceNode === source) {
    const currentTime = this.getCurrentTime();
    const duration = this.getDuration();
    if (currentTime >= duration - 0.1) {
      // Natural end - stop playback
      this.isPlaying = false;
      this.pausedAt = duration;
      this.dispatchEvent(new Event("ended"));
    }
  }
};
```

This prevents premature stops when seeking or manually pausing.

### Layout Modes

- **overlay**: All tracks centered at base canvas center (540px on 1080px height), overlaid with transparency. Remains centered even when canvas expands for large heightPx values.
- **stacked**: Tracks vertically distributed, each centered in its allocated space. Waveforms can overlap when heightPx is large (e.g., heightPx=1000 creates ±500px waveforms from center)
- **spectrum-overlay**: FFT frequency spectrum, overlaid and centered at base canvas center (540px). Remains centered even when canvas expands for large heightPx values.
- **spectrum-stacked**: FFT frequency spectrum, stacked

### Amplitude Modes

- **individual**: Each track normalized to its own peak amplitude (default)
- **normalized**: All tracks normalized to the global maximum amplitude across all tracks

Controlled by `WaveformRenderer.render()` parameter and passed through the rendering pipeline.

### Height Configuration

The `heightPx` parameter (default: 400px) controls waveform amplitude:

- **Overlay mode**: `maxAmplitude = heightPx` (waveforms extend ±heightPx from center at y=540px)
- **Stacked mode**: `maxAmplitude = heightPx / 2` (waveforms extend ±(heightPx/2) from each track's center, allowing overlap)
- Canvas dynamically resizes to accommodate waveforms that exceed 1920x1080 bounds
- CSS maintains 1920x1080 display size while allowing internal canvas to grow
- **Centering behavior**: Overlay and spectrum-overlay modes always use base canvas center (y=540px for 1080px height) regardless of expanded canvas size, ensuring waveforms remain visually centered in the viewport

## Console Logging

Extensive logging in `AudioEngine` (prefix: `[AudioEngine]`) tracks:

- Track loading with timing metrics
- Playback state changes (play/pause)
- Seek operations with before/after positions
- Timing calculations for debugging synchronization issues

See [CONSOLE_LOGGING.md](CONSOLE_LOGGING.md) for complete logging reference.

## TypeScript Types

Key type definitions in [src/types/](src/types/):

- **LayoutMode**: `'overlay' | 'stacked' | 'spectrum-overlay' | 'spectrum-stacked'`
- **AmplitudeMode**: `'individual' | 'normalized'`
- **PlaybackState**: `{ isPlaying, currentTime, duration }`
- **ExportOptions**: Video export configuration including codec, fps, quality, layout, amplitudeMode, heightPx

## File Format Constraints

- **Input**: Only WAV files supported (decoded via Web Audio API)
- **Output**: MP4 with H.264 or H.265 video codec, AAC audio at 192kbps
- **Resolution**: 1920x1080 (16:9), 60fps

## Common Patterns

### Adding New Layout Modes

1. Add type to `LayoutMode` in [src/types/visualizer.types.ts](src/types/visualizer.types.ts)
2. Add rendering branch in `WaveformRenderer.render()` in [src/rendering/WaveformRenderer.ts](src/rendering/WaveformRenderer.ts)
3. Update HTML select element in `index.html`
4. Update `ExportUI` to pass layout mode to video export

### Debugging Playback Issues

1. Open browser console and filter by `[AudioEngine]`
2. Check timing values in play/pause/seek logs
3. Verify `offset` matches `pausedAt` when resuming playback
4. Check `getCurrentTime()` calculation: `AudioContext.currentTime - startTime`

### Modifying Visualization Window

To change the 1-second window duration:

- Update `windowDuration` parameter in `track.getWaveformDataForTimeWindow(currentTime, 1.0)` calls
- Update time indicator logic in `renderTimeIndicator()` to match new window

## Technical Details

- **Canvas Resolution**: 1920x1080 pixels (Full HD)
- **Sample Rate**: 44,100 Hz (CD quality)
- **Window Duration**: 1 second (1000ms)
- **Update Rate**: 60 Hz (60 FPS)
- **Samples per Pixel**: ~23 (44,100 samples / 1920 pixels)
- **FFT Size**: 2048 (for spectrum visualization)

## Dependencies

- **Vite**: Build tool and dev server (configured for CORS headers)
- **TypeScript**: Type-safe development
- **@ffmpeg/ffmpeg**: Client-side video encoding (WASM)
- **@ffmpeg/util**: FFmpeg utilities
- **lil-gui**: Debug GUI controls (used in development)
- **Web Audio API**: Native browser audio processing
- **Canvas 2D API**: Native browser rendering

## Important Notes

- **Do not remove console.log statements** in AudioEngine without discussion - they are essential for debugging timing issues
- **Seek logic is fragile** - AudioBufferSourceNode cannot seek once started, must stop and create new source
- **FFmpeg.wasm requires SharedArrayBuffer** - deployment must include COOP/COEP headers
- **Web Audio timing is based on AudioContext.currentTime** - monotonically increasing, unaffected by pause/seek
- **Waveform extraction is real-time** - no pre-computation or caching, computed every frame for rolling window effect
