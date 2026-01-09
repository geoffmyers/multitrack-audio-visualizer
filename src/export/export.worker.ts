import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

self.onmessage = async (e) => {
  const { type, data } = e.data;

  try {
    console.log('[Worker] Received message:', type);
    switch (type) {
      case 'init':
        console.log('[Worker] Initializing FFmpeg...');
        await initFFmpeg();
        console.log('[Worker] FFmpeg initialized successfully');
        self.postMessage({ type: 'ready' });
        break;

      case 'export':
        console.log('[Worker] Starting export with data:', {
          framesCount: data.frames?.length,
          fps: data.fps,
          codec: data.codec,
          quality: data.quality,
          audioBitrate: data.audioBitrate,
        });
        await exportVideo(data);
        console.log('[Worker] Export completed');
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error('[Worker] Error occurred:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[Worker] Error stack:', errorStack);
    self.postMessage({
      type: 'error',
      error: errorMessage,
    });
  }
};

async function initFFmpeg(): Promise<void> {
  if (ffmpeg) {
    return;
  }

  ffmpeg = new FFmpeg();

  // Load FFmpeg from CDN (jsdelivr serves with proper CORS headers for COOP/COEP)
  // Using version 0.12.10 to match our @ffmpeg/ffmpeg package version
  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

  console.log('[Worker] Loading FFmpeg from CDN...');
  const coreURL = `${baseURL}/ffmpeg-core.js`;
  const wasmURL = `${baseURL}/ffmpeg-core.wasm`;

  console.log('[Worker] Core URL:', coreURL);
  console.log('[Worker] WASM URL:', wasmURL);

  await ffmpeg.load({
    coreURL,
    wasmURL,
  });

  console.log('[Worker] FFmpeg loaded and ready!');

  // Listen to progress
  ffmpeg.on('progress', ({ progress }) => {
    self.postMessage({
      type: 'progress',
      progress: progress * 100,
    });
  });

  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg]', message);
  });
}

async function exportVideo(data: {
  frames: string[]; // Base64 data URLs
  audioData: ArrayBuffer;
  fps: number;
  codec: string;
  quality: number;
  audioBitrate: string;
}): Promise<void> {
  if (!ffmpeg) {
    throw new Error('FFmpeg not initialized');
  }

  const { frames, audioData, fps, codec, quality, audioBitrate } = data;

  console.log('[Worker] Export parameters:', {
    framesCount: frames.length,
    audioDataSize: audioData.byteLength,
    fps,
    codec,
    quality,
    audioBitrate,
  });

  self.postMessage({ type: 'status', message: 'Writing frames...' });
  console.log('[Worker] Writing', frames.length, 'frames to FFmpeg filesystem...');

  // Write frames to virtual filesystem
  for (let i = 0; i < frames.length; i++) {
    const frameData = frames[i].split(',')[1]; // Remove data URL prefix
    const blob = await fetch(`data:image/png;base64,${frameData}`).then((r) => r.blob());
    const fileName = `frame${i.toString().padStart(5, '0')}.png`;
    await ffmpeg.writeFile(fileName, await fetchFile(blob));

    if (i % 10 === 0) {
      console.log(`[Worker] Wrote frame ${i + 1}/${frames.length}`);
      self.postMessage({
        type: 'progress',
        progress: (i / frames.length) * 30, // First 30% is writing frames
      });
    }
  }

  console.log('[Worker] All frames written successfully');
  self.postMessage({ type: 'status', message: 'Writing audio...' });

  // Write audio file
  console.log('[Worker] Writing audio file, size:', audioData.byteLength, 'bytes');
  await ffmpeg.writeFile('audio.wav', new Uint8Array(audioData));
  console.log('[Worker] Audio file written successfully');

  self.postMessage({ type: 'status', message: 'Encoding video...' });

  // Encode video
  const videoCodec = codec === 'h265' ? 'libx265' : 'libx264';
  const crf = quality.toString();

  const ffmpegArgs = [
    '-framerate',
    fps.toString(),
    '-i',
    'frame%05d.png',
    '-i',
    'audio.wav',
    '-c:v',
    videoCodec,
    '-preset',
    'medium',
    '-crf',
    crf,
    '-vf',
    'scale=1920:1080',
    '-c:a',
    'aac',
    '-b:a',
    audioBitrate,
    '-pix_fmt',
    'yuv420p',
    '-shortest',
    'output.mp4',
  ];

  console.log('[Worker] Running FFmpeg with args:', ffmpegArgs.join(' '));
  await ffmpeg.exec(ffmpegArgs);
  console.log('[Worker] FFmpeg encoding completed successfully');

  self.postMessage({ type: 'status', message: 'Reading output...' });

  // Read output file
  console.log('[Worker] Reading output.mp4...');
  const outputData = await ffmpeg.readFile('output.mp4');
  const outputSize = outputData instanceof Uint8Array ? outputData.byteLength : outputData.length;
  console.log('[Worker] Output file read, size:', outputSize, 'bytes');

  // Clean up files
  self.postMessage({ type: 'status', message: 'Cleaning up...' });
  console.log('[Worker] Cleaning up temporary files...');

  for (let i = 0; i < frames.length; i++) {
    const fileName = `frame${i.toString().padStart(5, '0')}.png`;
    try {
      await ffmpeg.deleteFile(fileName);
    } catch (e) {
      // Ignore errors
    }
  }

  try {
    await ffmpeg.deleteFile('audio.wav');
    await ffmpeg.deleteFile('output.mp4');
  } catch (e) {
    // Ignore errors
  }

  console.log('[Worker] Cleanup completed');

  // Send result
  const buffer = outputData instanceof Uint8Array ? outputData.buffer : outputData;
  const bufferSize =
    buffer instanceof ArrayBuffer || buffer instanceof SharedArrayBuffer
      ? buffer.byteLength
      : buffer.length;
  console.log('[Worker] Sending complete message with data size:', bufferSize);
  self.postMessage(
    {
      type: 'complete',
      data: outputData,
    },
    { transfer: buffer instanceof ArrayBuffer ? [buffer] : [] } as any
  );
  console.log('[Worker] Complete message sent');
}

export {};
