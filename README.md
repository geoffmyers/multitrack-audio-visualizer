# Multi-Track Audio Visualizer

A real-time audio/music visualizer that displays multi-track waveforms with customizable colors and can export high-quality MP4/H.265 videos.

## Features

- **Multi-Track Support**: Load multiple WAV files simultaneously
- **Real-Time Oscilloscope Display**: 60fps rolling 1-second waveform window (updated every frame)
- **Customizable Colors**: Individual color and opacity control per track
- **Overlaid Display**: All tracks displayed on same canvas with transparency
- **Interactive Controls**: Play, pause, seek, and timeline scrubbing
- **Video Export**: Export to MP4/H.265 with composite audio (browser or CLI)
- **CLI Export Tool**: Command-line video rendering for batch processing and automation
- **Drag & Drop**: Easy file loading via drag and drop
- **1920x1080 Resolution**: Full HD 16:9 aspect ratio
- **20 Built-in Presets**: Pre-configured visualization styles

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:3000`

## Usage

### Adding Tracks

1. Click "Add Track(s)" button or drag WAV files onto the drop zone
2. Multiple files can be added at once
3. Each track is assigned a unique color automatically

### Playback Controls

- **Play/Pause**: Click the play button or press `Spacebar`
- **Seek**: Drag the timeline slider to any position
- **Timeline**: Shows current time / total duration

### Track Customization

Each track has individual controls:
- **Color**: Click the color picker to change the track color
- **Opacity**: Adjust transparency with the opacity slider
- **Remove**: Click the × button to remove a track

### Video Export

#### Browser Export

1. Load and configure your tracks
2. Click "Export Video (MP4/H.265)"
3. Wait for the export process (progress shown)
4. Video will automatically download when complete

Export settings:
- Format: MP4 (H.265/HEVC codec)
- Resolution: 1920x1080
- Frame Rate: 60fps
- Audio: AAC 192kbps (mixed from all tracks)

#### Command-Line Export

For batch processing and automation, use the CLI tool:

```bash
# List available presets
npm run export -- list-presets

# Export with config file
npm run export -- export --config example-export-config.json

# Export with command-line arguments
npm run export -- export \
  --audio "track1.wav,track2.wav" \
  --preset "Waveform Overlay 1" \
  --output video.mp4

# Batch export all songs (pre-configured)
./batch-export.sh
```

**Pre-configured exports:** See [export-configs/](export-configs/) for ready-to-use configurations for all songs in the WAV directory.

**See [CLI-README.md](CLI-README.md) for complete CLI documentation.**

## Browser Compatibility

### Required Features
- Web Audio API
- HTML5 Canvas
- SharedArrayBuffer (for FFmpeg.wasm)

### Supported Browsers
- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

### IMPORTANT: CORS Headers

This application requires special HTTP headers for video export:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

These are configured in `vite.config.ts` for the development server.

## Technical Details

### Architecture

- **TypeScript**: Type-safe development
- **Vite**: Fast build tooling and dev server
- **Web Audio API**: Native audio processing and playback
- **HTML5 Canvas**: 2D rendering at 1920x1080
- **FFmpeg.wasm**: Client-side video encoding
- **Web Workers**: Non-blocking video export

### Project Structure

```
src/
├── core/           # Audio engine and track management
├── rendering/      # Canvas rendering and animation loop
├── visualization/  # Waveform analysis and color management
├── export/         # Video export functionality
├── ui/             # User interface controls
├── utils/          # Helper utilities
└── types/          # TypeScript type definitions
```

### Visualization Behavior

The visualizer displays a **1-second rolling window** of audio waveforms, similar to an oscilloscope:

- **Window Duration**: 1000ms (1 second) of audio samples
- **Update Rate**: 60 times per second (60 Hz / 60 FPS)
- **Display**: Shows the most recent 1 second of audio leading up to the current playback position
- **Time Indicator**: White vertical line at the right edge marks the current playback position
- **Real-time**: Waveform data is extracted and rendered every frame for smooth, live visualization

This creates a dynamic, scrolling visualization where you see the audio waveform "rolling" across the screen from left to right as the music plays.

### Performance

- Load time: < 3s per 3-minute track
- Rendering: Consistent 60fps with 8+ tracks
- Real-time waveform extraction: < 1ms per track per frame
- Export speed: 1-2x realtime
- Memory: < 500MB for 4 tracks × 3 minutes

## Keyboard Shortcuts

- `Spacebar`: Play/Pause

## Troubleshooting

### Audio won't play
- Ensure files are valid WAV format
- Check browser console for errors
- Try clicking on the page first (browsers require user interaction)

### Video export fails
- Ensure browser supports SharedArrayBuffer
- Check that COOP/COEP headers are set
- Try with shorter audio duration first
- Check browser console for FFmpeg errors

### Performance issues
- Reduce number of simultaneous tracks
- Lower opacity for better blending performance
- Close other browser tabs

### Files won't load
- Only WAV files are supported
- Ensure files aren't corrupted
- Check file size (very large files may take time)

## Development

### Build for Production

```bash
npm run build
```

Output will be in `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## License

MIT

## Credits

Built with:
- [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [FFmpeg.wasm](https://ffmpegwasm.netlify.app/)
- Web Audio API
- HTML5 Canvas API
