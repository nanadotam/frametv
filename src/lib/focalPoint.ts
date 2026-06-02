// Focal point detection and caching.
//
// Detection runs once per photo, lazily, using the browser-native FaceDetector
// API (Chrome/Edge only). The result — a normalised {x, y} position — is
// persisted to photos.metadata so every subsequent load (including Safari)
// reads it from the DB instead of re-detecting.
//
// Cache precedence:
//   1. In-memory FOCAL_CACHE (reset on page reload)
//   2. photos.metadata.focal_x / focal_y  (seeded into cache at init)
//   3. Run FaceDetector if API available + not yet detected
//   4. Heuristic fallback (portrait → upper-third)

import type { Photo } from '@/types/db';

// ── Browser API types (not in default TS lib) ─────────────────────────────────
interface FaceDetectorOptions {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}
interface DetectedFace {
  boundingBox: DOMRectReadOnly;
}
declare class FaceDetector {
  constructor(options?: FaceDetectorOptions);
  detect(image: HTMLImageElement): Promise<DetectedFace[]>;
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface FocalPoint {
  x: number; // 0.0–1.0, left to right
  y: number; // 0.0–1.0, top to bottom
}

// ── In-memory cache ────────────────────────────────────────────────────────────
// undefined  = never checked
// null       = checked, no face found (use heuristic)
// FocalPoint = face detected at this position
const FOCAL_CACHE = new Map<string, FocalPoint | null>();

// ── FaceDetector singleton ─────────────────────────────────────────────────────
let _detector: FaceDetector | null | undefined; // undefined = not yet tested

function getDetector(): FaceDetector | null {
  if (_detector !== undefined) return _detector;
  try {
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      _detector = new (window as unknown as { FaceDetector: typeof FaceDetector }).FaceDetector({
        fastMode: true,
        maxDetectedFaces: 1,
      });
      return _detector;
    }
  } catch {
    // API present but failed to construct (permissions, etc.)
  }
  _detector = null;
  return null;
}

// ── Seed cache from already-loaded photo metadata (zero cost) ─────────────────
// Call this once when photos are fetched so subsequent getFocal() calls
// never have to touch the DB.
export function seedFocalCache(photos: Photo[]): void {
  for (const p of photos) {
    if (FOCAL_CACHE.has(p.id)) continue;
    const meta = p.metadata as Record<string, unknown> | null;
    if (!meta) continue;
    if (typeof meta.focal_x === 'number' && typeof meta.focal_y === 'number') {
      FOCAL_CACHE.set(p.id, { x: meta.focal_x, y: meta.focal_y });
    } else if (meta.focal_detected === true) {
      // Detection already ran, no face was found
      FOCAL_CACHE.set(p.id, null);
    }
  }
}

// ── Get cached focal point (sync, no side effects) ────────────────────────────
export function getFocal(photo: Photo): FocalPoint | null {
  const hit = FOCAL_CACHE.get(photo.id);
  if (hit !== undefined) return hit;
  // Try seeding from metadata inline (e.g. for late-arriving photos)
  const meta = photo.metadata as Record<string, unknown> | null;
  if (meta && typeof meta.focal_x === 'number' && typeof meta.focal_y === 'number') {
    const fp: FocalPoint = { x: meta.focal_x, y: meta.focal_y };
    FOCAL_CACHE.set(photo.id, fp);
    return fp;
  }
  return null;
}

// ── Convert focal point to CSS object-position value ─────────────────────────
// Falls back to heuristic: portrait photos → upper-third (faces live there).
export function focalToObjectPosition(focal: FocalPoint | null, photoAR: number): string {
  if (focal) return `${(focal.x * 100).toFixed(1)}% ${(focal.y * 100).toFixed(1)}%`;
  if (photoAR < 0.85) return 'center 30%';
  return 'center center';
}

// ── Detect faces and persist (async, safe to call multiple times) ─────────────
// Skips silently if: already cached, detector unavailable, or photo is null.
// Fires a background PATCH to save the result — never blocks rendering.
export async function detectAndPersistFocal(
  photo: Photo,
  imgEl: HTMLImageElement,
): Promise<void> {
  if (FOCAL_CACHE.has(photo.id)) return;

  const det = getDetector();
  if (!det) {
    // Mark as attempted so we don't retry every render on unsupported browsers
    FOCAL_CACHE.set(photo.id, null);
    return;
  }

  let focal: FocalPoint | null = null;
  try {
    const faces = await det.detect(imgEl);
    if (faces.length > 0) {
      const b = faces[0].boundingBox;
      focal = {
        x: Math.max(0, Math.min(1, (b.x + b.width  / 2) / imgEl.naturalWidth )),
        y: Math.max(0, Math.min(1, (b.y + b.height / 2) / imgEl.naturalHeight)),
      };
    }
  } catch {
    FOCAL_CACHE.set(photo.id, null);
    return;
  }

  FOCAL_CACHE.set(photo.id, focal);

  // Fire-and-forget — failure just means we retry next session
  void persistFocal(photo.id, focal);
}

async function persistFocal(photoId: string, focal: FocalPoint | null): Promise<void> {
  try {
    const body = focal
      ? { focal_x: focal.x, focal_y: focal.y }
      : { focal_detected: true };

    await fetch(`/api/photos/${photoId}/focal`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Network failure — not critical, retries next page load
  }
}
