'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// ~30 MB wasm build, fetched from the CDN only when a file needs it
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';

let instance: Promise<FFmpeg> | null = null;

function loadFFmpeg(): Promise<FFmpeg> {
  instance ??= (async () => {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      // Served from /public as-is: the bundler mangles the worker's dynamic
      // import of the core. Copied from @ffmpeg/ffmpeg/dist/esm — keep in sync.
      classWorkerURL: new URL('/ffmpeg/worker.js', window.location.origin).href,
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ffmpeg;
  })().catch((err) => {
    instance = null;
    throw err;
  });
  return instance;
}

/**
 * Software fallback for formats the browser's WebCodecs decoder rejects —
 * mainly DSLR / cinema-camera footage (10-bit 4:2:2 H.264 from Canon, Sony,
 * Panasonic). ffmpeg.wasm decodes it on the CPU and writes a standard 8-bit
 * ≤1080p H.264 intermediate that the normal WebCodecs pipeline can take.
 *
 * Much slower than hardware decoding (roughly real-time to a few × real-time
 * for 4K), so it only runs when it has to.
 */
export async function convertWithFFmpeg(
  file: File,
  onProgress?: (fraction: number) => void
): Promise<File> {
  const ffmpeg = await loadFFmpeg();
  const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '.mp4';
  const inName = `in${ext}`;
  const outName = 'out.mp4';

  const handler = ({ progress }: { progress: number }) =>
    onProgress?.(Math.min(1, Math.max(0, progress)));
  ffmpeg.on('progress', handler);

  try {
    await ffmpeg.writeFile(inName, await fetchFile(file));
    const code = await ffmpeg.exec([
      '-i', inName,
      '-an',
      // Short edge to ≤1080 (never upscale), ≤30 fps, 8-bit 4:2:0
      '-vf', "scale='if(gt(iw,ih),-2,min(1080\\,iw))':'if(gt(iw,ih),min(1080\\,ih),-2)',fps=30",
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      outName,
    ]);
    if (code !== 0) throw new Error('ffmpeg could not convert this file.');

    const data = await ffmpeg.readFile(outName);
    if (typeof data === 'string' || data.byteLength === 0) {
      throw new Error('ffmpeg produced no output.');
    }
    return new File([data as Uint8Array<ArrayBuffer>], file.name.replace(/\.[^.]+$/, '') + '.mp4', {
      type: 'video/mp4',
    });
  } finally {
    ffmpeg.off('progress', handler);
    await Promise.allSettled([ffmpeg.deleteFile(inName), ffmpeg.deleteFile(outName)]);
  }
}
