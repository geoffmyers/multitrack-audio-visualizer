import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    // Enable COOP/COEP headers for video export (FFmpeg SharedArrayBuffer support)
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  build: {
    target: 'es2020',
    outDir: 'dist'
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  }
});
