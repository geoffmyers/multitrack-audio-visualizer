# Architecture

A TypeScript browser app with a headless CLI that shares its core.

## Layout

| Path | What lives there |
|---|---|
| `src/core/` | `AudioEngine` and `AudioTrack` — loading, decoding and synchronised playback of multiple tracks; `PresetManager` for saved looks. |
| `src/` | Rendering and UI, entered at `main.ts`. |
| `cli/` | A headless path: `CLIAudioEngine` and `CLIAudioTrack` implement the same interfaces without a DOM, and `CLIVideoExporter` drives export. |
| `presets/`, `public/ffmpeg/` | Saved visual presets, and the ffmpeg WebAssembly build used for encoding. |

## Notes

- The browser and CLI share `src/core` by adapting it rather than forking it —
  the CLI adapters exist so the engine never has to know which it is running in.
- Video export runs **ffmpeg compiled to WebAssembly**, so there is no system
  ffmpeg dependency, at the cost of memory and speed on long renders.
