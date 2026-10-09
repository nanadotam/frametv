'use client';

/** Bytes hashed from each end of the file. */
const CHUNK = 4 * 1024 * 1024;

/**
 * Identifies a source video so re-uploading the same clip can be caught.
 * We can't compare stored files — they're re-encoded — so we hash the
 * original instead: its size plus the first and last 4 MB. That's instant
 * even for multi-GB camera files and, combined with the exact byte size,
 * distinct for any two real clips.
 */
export async function fingerprintFile(file: File): Promise<string> {
  const head = file.slice(0, CHUNK);
  const tail = file.size > CHUNK * 2 ? file.slice(file.size - CHUNK) : new Blob();
  const bytes = await new Blob([`${file.size}:`, head, tail]).arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
