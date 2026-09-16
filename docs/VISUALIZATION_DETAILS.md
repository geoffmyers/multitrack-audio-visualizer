# Visualization Technical Details

## Real-Time Rolling Waveform Display

### Overview

The visualizer now displays a **1-second rolling window** of audio waveforms that updates at 60 frames per second, creating a dynamic oscilloscope-style visualization.

### How It Works

#### 1. Time Window Extraction

The visualizer displays a **1-second window** of audio that adapts based on the current playback position:

**During normal playback (currentTime >= 1.0s):**

```
Current Time: 45.5 seconds
Window Start: 44.5 seconds
Window End:   45.5 seconds
Display:      [==========waveform==========|]
                ↑                           ↑
            44.5 sec                    45.5 sec
                                    (current position)
```

**At the beginning (currentTime < 1.0s):**

```
Current Time: 0.5 seconds
Window Start: 0.0 seconds
Window End:   1.0 seconds
Display:      [=====waveform=====|=========]
                ↑               ↑
            0.0 sec         0.5 sec
                        (current position)
```

This adaptive behavior ensures the visualization always shows audio data, even when seeking to the very beginning of a track.

#### 2. Frame-by-Frame Updates

At 60 FPS, the visualization updates every ~16.67ms:

- **Frame 1** (time: 45.500s): Display samples from 44.500s to 45.500s
- **Frame 2** (time: 45.517s): Display samples from 44.517s to 45.517s
- **Frame 3** (time: 45.534s): Display samples from 44.534s to 45.534s
- ... and so on

This creates a smooth "scrolling" effect where the waveform appears to move from left to right.

#### 3. Sample Extraction Process

For each frame, the system:

1. **Calculate Time Window**
   - End time = current playback time
   - Start time = current time - 1.0 second

2. **Convert to Samples**
   ```typescript
   const sampleRate = 44100; // Hz (CD quality)
   const startSample = Math.floor(startTime * sampleRate);
   const endSample = Math.floor(endTime * sampleRate);
   // Total samples = 44,100 samples (for 1 second)
   ```

3. **Downsample to Canvas Width**
   ```typescript
   const canvasWidth = 1920; // pixels
   const samplesPerPixel = totalSamples / canvasWidth;
   // = 44,100 / 1920 ≈ 23 samples per pixel
   ```

4. **Extract Peak Values**
   - For each pixel, find the maximum amplitude within its sample range
   - Store as normalized value (-1.0 to 1.0)
   - This becomes one vertical line in the waveform

### Implementation Details

#### AudioTrack.getWaveformDataForTimeWindow()

**Location**: [src/core/AudioTrack.ts:67-109](src/core/AudioTrack.ts)

```typescript
getWaveformDataForTimeWindow(
  currentTime: number,
  windowDuration: number = 1.0,
  targetWidth: number = 1920
): Float32Array
```

**Parameters**:
- `currentTime`: Current playback position in seconds
- `windowDuration`: Size of time window (default: 1.0 second)
- `targetWidth`: Canvas width in pixels (default: 1920)

**Returns**: Float32Array of peak amplitudes (one per pixel)

**Algorithm**:
1. Calculate time range: [currentTime - windowDuration, currentTime]
2. Convert times to sample indices using sample rate
3. Divide sample range into `targetWidth` buckets
4. For each bucket, find peak (maximum absolute) amplitude
5. Return array of peak values

#### WaveformRenderer.renderTrackRealtime()

**Location**: [src/rendering/WaveformRenderer.ts:73-99](src/rendering/WaveformRenderer.ts)

```typescript
renderTrackRealtime(track: AudioTrack, currentTime: number): void
```

**Process**:
1. Extract waveform data for last 1 second
2. Set track color and opacity
3. Draw vertical lines for each pixel position
4. Line height = amplitude × maxAmplitude (scaled to canvas height)

### Visual Design

#### Layout

```
Canvas (1920 x 1080 pixels)
┌────────────────────────────────────────────────┐
│                                               ║│
│          Waveform Area (80% height)          ║│
│    ╱╲    ╱╲╱╲              ╱╲╱╲             ║│
│ ──────────────────────────────────────────── ║│  ← Center line
│    ╲╱    ╲╱╲╱              ╲╱╲╱             ║│
│                                               ║│
│                                         45:12 ║│  ← Time display
└────────────────────────────────────────────────┘
 ↑                                             ↑
Left edge                               Right edge
(1 sec ago)                           (current time)
                                      White indicator
```

#### Time Indicator

- **Position**: Right edge of canvas (x = 1919)
- **Style**: 3px white vertical line
- **Label**: Current time (MM:SS) at bottom right
- **Purpose**: Marks the current playback position

### Performance Characteristics

#### Per-Frame Cost

For each track, each frame (60 fps):

1. **Sample Extraction**: ~0.3ms
   - Read ~44,100 samples from audio buffer
   - Calculate peak values for 1920 pixels

2. **Canvas Drawing**: ~0.2ms
   - Draw 1920 vertical lines
   - Apply color and opacity

**Total per track**: ~0.5ms
**With 8 tracks**: ~4ms per frame (well under 16.67ms budget)

#### Memory Usage

- **Audio Buffer**: Stored once (no duplication)
- **Waveform Data**: Computed per-frame (no caching)
- **Canvas**: 1920×1080×4 bytes = ~8MB

### Comparison: Static vs Rolling Display

#### Old Behavior (Static Full-Duration)

```
[====entire song waveform (3 minutes)====]
                    ↑
              playhead moves
```

- Pre-computed once on load
- Playhead indicator shows current position
- Entire duration visible at once
- Less CPU per frame (just draw playhead)

#### New Behavior (Rolling 1-Second Window)

```
Time: 0.0s  [waveform|]
Time: 1.0s    [waveform|]
Time: 2.0s      [waveform|]
Time: 3.0s        [waveform|]
               (scrolls right →)
```

- Computed every frame
- Shows detail of current moment
- More CPU per frame (extract + draw)
- More dynamic and engaging

### Advantages of Rolling Display

1. **Detail**: Full resolution view of current audio
2. **Real-time**: True oscilloscope-style visualization
3. **Focus**: Emphasizes what's happening "now"
4. **Dynamic**: Visually engaging as waveform scrolls
5. **Analysis**: Easy to see transients, peaks, dynamics

### Video Export Behavior

During video export, the same real-time extraction occurs:

```typescript
// For each frame in video (at target FPS)
for (let frameNum = 0; frameNum < totalFrames; frameNum++) {
  const currentTime = frameNum / fps;

  // Extract 1-second window ending at currentTime
  const waveformData = track.getWaveformDataForTimeWindow(currentTime, 1.0);

  // Render and capture frame
  renderer.render(tracks, currentTime, duration);
  captureFrame();
}
```

This ensures the exported video has the same rolling visualization as real-time playback.

### Customization Options

The visualization can be customized by modifying:

#### Window Duration

Change `1.0` to another value in [WaveformRenderer.ts:78](src/rendering/WaveformRenderer.ts):

```typescript
// Show last 2 seconds instead of 1
const waveformData = track.getWaveformDataForTimeWindow(currentTime, 2.0, this.width);
```

#### Line Thickness

Change in [WaveformRenderer.ts:84](src/rendering/WaveformRenderer.ts):

```typescript
this.ctx.lineWidth = 2; // Change to 1 for thinner, 3 for thicker
```

#### Amplitude Scale

Change in [WaveformRenderer.ts:75](src/rendering/WaveformRenderer.ts):

```typescript
const maxAmplitude = this.height * 0.4; // Use 80% of height
// Change to 0.5 for taller waveforms (100% height)
```

### Technical Specifications

- **Sample Rate**: 44,100 Hz (CD quality)
- **Window Duration**: 1000 ms (1 second)
- **Samples per Window**: 44,100 samples
- **Canvas Width**: 1920 pixels
- **Samples per Pixel**: ~23 samples
- **Update Rate**: 60 Hz (60 frames per second)
- **Update Interval**: ~16.67 ms per frame

### Browser Compatibility

The rolling visualization requires:
- Web Audio API (AudioBuffer)
- High-performance Canvas 2D rendering
- Consistent 60fps capability

Supported browsers:
- Chrome 90+ ✓
- Firefox 90+ ✓
- Safari 14+ ✓
- Edge 90+ ✓

### Future Enhancements

Potential improvements:

1. **Dual-channel Display**: Show left/right channels separately
2. **Frequency Spectrum**: Add FFT visualization alongside waveform
3. **Zoom Control**: User-adjustable window duration (0.5s to 5s)
4. **Waveform Styles**: Filled area, line, dots, bars
5. **Grid Overlay**: Time/amplitude reference lines
6. **Peak Meters**: RMS and peak level indicators
7. **Stereo Width**: Visualize stereo field
