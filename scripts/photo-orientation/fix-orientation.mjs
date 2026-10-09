#!/usr/bin/env node
// Finds photos that are stored sideways or upside down and sets their
// rotation so they display upright. macOS only (uses Apple's Vision).
//
//   pnpm fix-orientation             # check new photos, apply fixes
//   pnpm fix-orientation --dry-run   # report only
//   pnpm fix-orientation --recheck   # also re-check photos checked before
//   pnpm fix-orientation --user=<id> # only one account's photos
//
// Why: Drive renders each photo exactly as Finder/Preview would, so when one
// shows up upside down it's because the phone recorded the wrong
// orientation at capture time (shooting angled up/down). Only the content
// can tell which way is up — so we find faces with Vision and read each
// face's roll (≈0° upright, ≈±180° upside down, ≈±90° sideways). When the
// faces in a photo clearly agree on a non-zero roll, that's the fix.
//
// Writes photos.metadata.rotation (the same field as the admin "Rotate"
// button) with rotationSource: 'auto', and marks every checked photo with
// orientationChecked so re-runs only look at new ones. Photos with no
// faces, and photos someone already rotated by hand, are left alone.

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const RECHECK = args.has('--recheck');
const USER = process.argv.find((a) => a.startsWith('--user='))?.slice('--user='.length);

// A photo is fixed when faces holding ≥70% of the face weight (confidence ×
// size) agree on the same non-upright direction.
const AGREEMENT = 0.7;

const here = path.dirname(fileURLToPath(import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'frametv-orientation-'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run via `pnpm fix-orientation`).');
  process.exit(1);
}
if (process.platform !== 'darwin') {
  console.error('This uses Apple Vision — run it on a Mac.');
  process.exit(1);
}
const supabase = createClient(url, key);

function thumbUrl(p) {
  if (p.source_type === 'drive' && p.source_id) {
    return `https://drive.google.com/thumbnail?id=${p.source_id}&sz=w800`;
  }
  const raw = p.thumbnail_path ?? p.storage_path;
  if (!raw) return null;
  return /^https?:/.test(raw) ? raw : supabase.storage.from('photos').getPublicUrl(raw).data.publicUrl;
}

/** Nearest quarter turn, as the clockwise rotation that makes it upright. */
function quarterTurn(rollDeg) {
  const q = ((Math.round(rollDeg / 90) % 4) + 4) % 4;
  return q * 90; // roll +90 → rotate 90° clockwise, ±180 → 180, −90 → 270
}

async function loadPhotos() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase
      .from('photos')
      .select('id, source_type, source_id, thumbnail_path, storage_path, metadata')
      .eq('media_type', 'image')
      .order('id')
      .range(from, from + 999);
    if (USER) query = query.eq('user_id', USER);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows.filter((p) => RECHECK || !p.metadata?.orientationChecked);
}

async function download(photos) {
  const queue = [...photos];
  const ok = [];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const p = queue.shift();
        const src = thumbUrl(p);
        if (!src) continue;
        try {
          const res = await fetch(src);
          const buf = Buffer.from(await res.arrayBuffer());
          if (!res.ok || buf[0] === 0x3c) continue; // HTML error page
          fs.writeFileSync(path.join(work, `${p.id}.jpg`), buf);
          ok.push(p);
        } catch {
          // skipped; retried on the next run
        }
      }
    })
  );
  return ok;
}

function detect(files) {
  const bin = path.join(work, 'upright');
  execFileSync('swiftc', ['-O', path.join(here, 'upright.swift'), '-o', bin], { stdio: 'inherit' });
  const out = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const chunk = files.slice(i, i + 50);
    const lines = execFileSync(bin, chunk, { maxBuffer: 64 * 1024 * 1024 }).toString().trim().split('\n');
    for (const line of lines) {
      const r = JSON.parse(line);
      out.set(path.basename(r.file, '.jpg'), r.faces ?? null);
    }
  }
  return out;
}

function decide(faces) {
  if (!faces?.length) return null;
  const weight = new Map();
  let total = 0;
  for (const f of faces) {
    const w = f.conf * f.size;
    const turn = quarterTurn(f.roll);
    weight.set(turn, (weight.get(turn) ?? 0) + w);
    total += w;
  }
  const [turn, w] = [...weight].sort((a, b) => b[1] - a[1])[0];
  return turn !== 0 && w / total >= AGREEMENT ? turn : null;
}

const photos = await loadPhotos();
console.log(`${photos.length} photo(s) to check${DRY_RUN ? ' (dry run)' : ''}`);
const fetched = await download(photos);
const faces = detect(fetched.map((p) => path.join(work, `${p.id}.jpg`)));

let fixed = 0;
let kept = 0;
const queue = [...fetched];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      const meta = { ...(p.metadata ?? {}) };
      const turn = decide(faces.get(p.id));
      // A non-zero rotation set by hand (not by this script) is respected
      const manual = typeof meta.rotation === 'number' && meta.rotation % 360 !== 0 && meta.rotationSource !== 'auto';
      if (turn !== null && !manual) {
        meta.rotation = turn;
        meta.rotationSource = 'auto';
        fixed++;
        console.log(`  ↻ ${turn}°  ${meta.originalName ?? p.id}`);
      } else if (turn !== null && manual && meta.rotation !== turn) {
        kept++;
        console.log(`  · kept manual ${meta.rotation}° (faces suggest ${turn}°)  ${meta.originalName ?? p.id}`);
      }
      meta.orientationChecked = true;
      if (!DRY_RUN) {
        const { error } = await supabase.from('photos').update({ metadata: meta }).eq('id', p.id);
        if (error) console.error(`  ! ${p.id}: ${error.message}`);
      }
    }
  })
);

fs.rmSync(work, { recursive: true, force: true });
console.log(
  `${fetched.length} checked · ${fixed} rotated · ${kept} manual kept · ${photos.length - fetched.length} couldn't download`
);
