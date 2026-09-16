# Quick Start Guide

## Getting Started in 3 Steps

### 1. Start the Development Server

```bash
npm run dev
```

The app will open at `http://localhost:3000`

### 2. Add Your Audio Tracks

- Click **"Add Track(s)"** button
- Or drag and drop WAV files onto the drop zone
- Multiple files can be loaded at once

### 3. Visualize and Export

**To visualize in real-time:**
- Click **Play** (or press Spacebar)
- Watch the 1-second rolling waveform display (updates at 60fps)
- The waveform scrolls from left to right, showing the last 1 second of audio
- White line at right edge marks current playback position
- Use the timeline slider to scrub through the audio
- Adjust individual track colors and opacity in the sidebar

**To export video:**
- Click **"Export Video (MP4/H.265)"**
- Wait for the export to complete (progress shown)
- Video will download automatically

## Example Workflow

1. Load 3 WAV files (drums, bass, melody)
2. Customize colors:
   - Drums: Red
   - Bass: Blue
   - Melody: Yellow
3. Adjust opacity for better visual blend
4. Play to preview
5. Export to MP4

## Tips

- **Performance**: The visualizer can handle 8+ tracks at 60fps
- **Colors**: Darker colors in back, brighter in front for best visual effect
- **Opacity**: 60-80% opacity works well for overlaid tracks
- **Export**: Longer songs take more time to export (1-2x realtime)

## Controls

- **Spacebar**: Play/Pause
- **Timeline Slider**: Seek to any position
- **Color Picker**: Change track color
- **Opacity Slider**: Adjust track transparency
- **× Button**: Remove track

## Troubleshooting

**Files won't load?**
- Only WAV format is supported
- Check console for errors

**Export fails?**
- Try Chrome or Firefox (best compatibility)
- Check that SharedArrayBuffer is enabled

**Low FPS?**
- Reduce number of tracks
- Close other browser tabs

## Next Steps

- See [README.md](README.md) for complete documentation
- Check `src/` folder for code implementation
- Customize colors in `src/visualization/ColorManager.ts`
