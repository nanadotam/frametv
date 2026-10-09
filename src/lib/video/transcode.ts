'use client';

import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSink,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_MEDIUM,
  canEncodeVideo,
} from 'mediabunny';

/** Longest edge of the short side we keep — 1080p is plenty for a wall TV. */
const MAX_SHORT_EDGE = 1080;
/** A wall TV gains nothing from 60/120/240 fps; capping also keeps files small. */
const MAX_FRAME_RATE = 30;

export interface TranscodedVideo {
  video: Blob;
  poster: Blob;
  width: number;
  height: number;
  durationMs: number;
}

/**
 * Re-encodes a video in the browser for display playback: ≤1080p H.264,
 * audio dropped, metadata at the front (fast start) so playback begins
 * before the whole file downloads. Also grabs a poster frame ~1 s in.
 *
 * Uses WebCodecs (hardware encoder where available), so nothing large is
 * ever sent to our servers. A 122 MB 20 s 4K export comes out at ~6 MB
 * (~2.4 Mbps) in a few seconds on an M-series Mac.
 */
export type TranscodePhase = 'converting' | 'compressing';

export async function transcodeForDisplay(
  file: File,
  onProgress?: (fraction: number, phase: TranscodePhase) => void
): Promise<TranscodedVideo> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('This browser can’t compress video. Try Chrome, Edge or Safari 17+.');
  }

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error('No video track found in this file.');

  // Check before touching the decoder — otherwise WebCodecs throws its raw
  // "Unsupported configuration" error. Formats the browser can't decode
  // (DSLR 10-bit 4:2:2 etc.) go through ffmpeg.wasm first.
  if (!(await track.canDecode())) {
    const reason = await undecodableReason(track);
    input.dispose();
    let converted: File;
    try {
      const { convertWithFFmpeg } = await import('./ffmpeg-convert');
      converted = await convertWithFFmpeg(file, (p) => onProgress?.(p, 'converting'));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`${reason} In-browser conversion also failed: ${detail}`);
    }
    return transcodeForDisplay(converted, onProgress);
  }

  const srcW = track.displayWidth;
  const srcH = track.displayHeight;
  const scale = Math.min(1, MAX_SHORT_EDGE / Math.min(srcW, srcH));
  // H.264 needs even dimensions
  const width = Math.round((srcW * scale) / 2) * 2;
  const height = Math.round((srcH * scale) / 2) * 2;

  if (!(await canEncodeVideo('avc', { width, height }))) {
    throw new Error('This browser can’t encode H.264 video.');
  }

  const durationSec = await input.computeDuration();
  const { averagePacketRate } = await track.computePacketStats(120);
  const frameRate = averagePacketRate > MAX_FRAME_RATE ? MAX_FRAME_RATE : undefined;
  const poster = await grabPoster(track, Math.min(1, durationSec / 2), width, height);

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });

  const conversion = await Conversion.init({
    input,
    output,
    tracks: 'primary',
    video: { width, height, fit: 'fill', frameRate, codec: 'avc', quality: QUALITY_MEDIUM, forceTranscode: true },
    audio: { discard: true },
    tags: {},
  });

  if (!conversion.isValid) {
    const reason = conversion.discardedTracks.map((t) => t.reason).join(', ');
    throw new Error(`Can’t convert this video${reason ? ` (${reason})` : ''}.`);
  }

  if (onProgress) conversion.onProgress = (p) => onProgress(p, 'compressing');
  await conversion.execute();

  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error('Video conversion produced no output.');

  return {
    video: new Blob([buffer], { type: 'video/mp4' }),
    poster,
    width,
    height,
    durationMs: Math.round(durationSec * 1000),
  };
}

type VideoTrack = NonNullable<Awaited<ReturnType<Input['getPrimaryVideoTrack']>>>;

async function undecodableReason(track: VideoTrack): Promise<string> {
  const codec = (await track.getCodecParameterString()) ?? track.codec ?? 'unknown';
  // avc1.7A… / avc1.F4… = H.264 High 4:2:2 / 4:4:4 — pro camera formats
  // (Canon XF-AVC, Sony XAVC) that no browser decoder handles.
  if (/^avc1\.(7a|f4|6e)/i.test(codec)) {
    return 'Pro-camera format (10-bit 4:2:2 H.264).';
  }
  if (track.codec === 'hevc') {
    return 'This browser can’t decode HEVC (H.265).';
  }
  return `This browser can’t decode this format (${codec}).`;
}

async function grabPoster(
  track: VideoTrack,
  atSec: number,
  width: number,
  height: number
): Promise<Blob> {
  // Posters are small previews — cap at 1280 wide
  const s = Math.min(1, 1280 / width);
  const sink = new CanvasSink(track, {
    width: Math.round(width * s),
    height: Math.round(height * s),
    fit: 'fill',
  });
  const frame = await sink.getCanvas(atSec);
  if (!frame) throw new Error('Could not read a frame from this video.');

  const canvas = frame.canvas;
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Poster encode failed'))),
      'image/jpeg',
      0.82
    )
  );
}
