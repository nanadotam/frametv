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
export async function transcodeForDisplay(
  file: File,
  onProgress?: (fraction: number) => void
): Promise<TranscodedVideo> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('This browser can’t compress video. Try Chrome, Edge or Safari 17+.');
  }

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error('No video track found in this file.');

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
  const poster = await grabPoster(track, Math.min(1, durationSec / 2), width, height);

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });

  const conversion = await Conversion.init({
    input,
    output,
    tracks: 'primary',
    video: { width, height, fit: 'fill', codec: 'avc', quality: QUALITY_MEDIUM, forceTranscode: true },
    audio: { discard: true },
    tags: {},
  });

  if (!conversion.isValid) {
    const reason = conversion.discardedTracks.map((t) => t.reason).join(', ');
    throw new Error(`Can’t convert this video${reason ? ` (${reason})` : ''}.`);
  }

  if (onProgress) conversion.onProgress = (p) => onProgress(p);
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

async function grabPoster(
  track: NonNullable<Awaited<ReturnType<Input['getPrimaryVideoTrack']>>>,
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
