# CLI Video Export - Multi-Track Audio Visualizer

Command-line tool for rendering multi-track audio visualization videos directly in the terminal.

## Features

- **Batch processing** - Automate video exports without browser UI
- **Native FFmpeg** - 10-100x faster than WebAssembly version
- **Hardware acceleration** - Support for NVENC, VideoToolbox, etc.
- **Config files** - Reproducible exports with JSON configuration
- **20 built-in presets** - Quick access to pre-configured visualizations
- **Progress tracking** - Real-time progress bars and timing stats

## Requirements

- Node.js (v18 or higher)
- FFmpeg installed on your system

### Installing FFmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

## Installation

```bash
npm install
```

## Usage

### List Available Presets

```bash
npm run export -- list-presets
```

### Show Preset Details

```bash
npm run export -- show-preset "Waveform Overlay 1"
```

### Export Video

#### Using Config File (Recommended)

```bash
npm run export -- export --config example-export-config.json
```

#### Using Command-Line Arguments

```bash
npm run export -- export \
  --audio "track1.wav,track2.wav,track3.wav" \
  --preset "Waveform Overlay 1" \
  --output output.mp4 \
  --verbose
```

#### With Overrides

```bash
# Load config but override specific settings
npm run export -- export \
  --config example-export-config.json \
  --fps 60 \
  --codec h265 \
  --height 75 \
  --verbose
```

## Config File Format

Create a JSON file with the following structure:

```json
{
  "audioFiles": [
    "path/to/track1.wav",
    "path/to/track2.wav",
    "path/to/track3.wav"
  ],
  "preset": "Waveform Overlay 1",
  "output": "output.mp4",

  "overrides": {
    "heightPercent": 75,
    "smoothingLevel": 2,
    "windowDuration": 1.0
  },

  "export": {
    "fps": 60,
    "codec": "h264",
    "quality": 23,
    "audioBitrate": "192k"
  },

  "verbose": true
}
```

### Config Options

#### Required
- `audioFiles` (string[]): Array of WAV file paths
- `output` (string): Output video file path

#### Optional
- `preset` (string): Name of preset to use (see `npm run export -- list-presets`)
- `overrides` (object): Override preset visualization settings
  - `layout` (string): `overlay`, `overlay-additive`, `stacked`, `spectrum-overlay`, `spectrum-stacked`
  - `amplitudeMode` (string): `individual`, `normalized`
  - `heightPercent` (number): Height as percentage (1-100)
  - `smoothingLevel` (number): Smoothing filter level (0-5)
  - `windowDuration` (number): Time window duration in seconds
- `export` (object): Video encoding settings
  - `fps` (number): Frames per second (1-120, default: 60)
  - `codec` (string): `h264` or `h265` (default: h264)
  - `quality` (number): CRF value (0-51, lower = better quality, default: 23)
  - `audioBitrate` (string): Audio bitrate (default: "192k")
- `verbose` (boolean): Enable verbose logging

## Command-Line Options

### Export Command

```bash
npm run export -- export [options]
```

**Options:**
- `-c, --config <path>` - Path to JSON config file
- `-a, --audio <files>` - Comma-separated list of audio files
- `-p, --preset <name>` - Preset name to use
- `-o, --output <path>` - Output video path (default: output.mp4)
- `--layout <mode>` - Layout mode
- `--amplitude-mode <mode>` - Amplitude mode
- `--height <percent>` - Height percentage (1-100)
- `--smoothing <level>` - Smoothing level (0-5)
- `--window-duration <seconds>` - Window duration in seconds
- `--fps <number>` - Frames per second
- `--codec <codec>` - Video codec (h264 or h265)
- `--quality <crf>` - Quality CRF value (0-51)
- `--audio-bitrate <bitrate>` - Audio bitrate (e.g., 192k)
- `-v, --verbose` - Enable verbose logging

## Examples

### Basic Export with Preset

```bash
npm run export -- export \
  --audio "track1.wav,track2.wav" \
  --preset "Waveform Overlay 1" \
  --output visualization.mp4
```

### Export with Custom Settings

```bash
npm run export -- export \
  --audio "track1.wav,track2.wav,track3.wav" \
  --layout overlay \
  --amplitude-mode normalized \
  --height 50 \
  --smoothing 2 \
  --window-duration 1.0 \
  --fps 60 \
  --codec h264 \
  --quality 20 \
  --output custom-viz.mp4 \
  --verbose
```

### Batch Processing with Config Files

```bash
# Create multiple config files
# config1.json, config2.json, config3.json

# Export all
for config in config*.json; do
  npm run export -- export --config "$config"
done
```

## Presets

The CLI includes 20 built-in presets:

- **Waveform Overlay 1-5** - Overlaid waveforms with transparency
- **Waveform Stacked 1-4** - Vertically stacked waveforms
- **Waveform Additive 1-9** - Overlaid with gradient stacking effect
- **Spectrum Overlay/Stacked 1** - FFT frequency spectrum visualization

Use `npm run export -- list-presets` to see all available presets with their settings.

## Performance

- **Rendering speed:** Typically 30-60 fps (faster than real-time)
- **Encoding speed:** 100-300 fps with hardware acceleration
- **Memory usage:** <4GB for 5-minute videos

### Optimization Tips

1. Use `h264` codec for faster encoding (h265 is slower but smaller files)
2. Lower `quality` (CRF) for faster encoding (18=best, 28=good, higher=faster)
3. Reduce `fps` for faster processing (30 fps is often sufficient)
4. Use `--verbose` to monitor performance metrics

## Troubleshooting

### FFmpeg not found

Ensure FFmpeg is installed and in your PATH:
```bash
which ffmpeg
ffmpeg -version
```

### Out of memory

For very long videos, reduce FPS or split into multiple exports:
```bash
# Use 30 fps instead of 60
npm run export -- export --config config.json --fps 30
```

### Slow rendering

Enable verbose mode to see rendering speed:
```bash
npm run export -- export --config config.json --verbose
```

Expected speeds:
- Rendering: 30-60 fps
- Encoding: 100-300 fps (with hardware acceleration)

## Output Format

- **Video:** MP4 container, H.264 or H.265 codec
- **Resolution:** 1920x1080 (Full HD)
- **Frame rate:** Configurable (default: 60 fps)
- **Audio:** AAC codec at 192kbps (default), stereo
- **Color space:** YUV 4:2:0 (compatible with all players)

## Development

### Project Structure

```
cli/
├── index.ts              # CLI entry point
├── config.ts             # Config parser and preset loader
├── adapters/
│   ├── CLIAudioEngine.ts # WAV loading without Web Audio API
│   └── CLIAudioTrack.ts  # AudioBuffer-compatible wrapper
├── export/
│   └── CLIVideoExporter.ts # Frame rendering + FFmpeg integration
└── utils/
    ├── Logger.ts         # Logging system
    └── ProgressReporter.ts # Progress tracking
```

### Shared Code

The CLI reuses core visualization code from the browser application:
- `src/core/AudioTrack.ts` - Waveform extraction algorithms
- `src/rendering/WaveformRenderer.ts` - Canvas rendering logic
- `src/rendering/RenderContext.ts` - Coordinate transformations
- `src/visualization/ColorManager.ts` - Color utilities

## License

Same as the main Multi-Track Audio Visualizer project.
