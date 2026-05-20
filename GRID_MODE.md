# Grid Mode — How It Works

A reference doc for understanding (and changing) grid mode behaviour.  
Source files: `src/modes/slideshow-grid/SlideshowGridMode.tsx` and `src/modes/slideshow-grid/layout.ts`.

---

## Big Picture

Grid mode tiles 3–6 photos across the full screen at once.  
Every `cellIntervalSeconds` (default 300 s / 5 min), all cells change — one at a time, 1 second apart — creating a cascading waterfall effect.  
The layout (how the cells are sized and positioned) is re-chosen every cycle too, so the screen never looks the same twice.

---

## The Grid System

The screen is divided into a **12-column × 6-row** CSS grid with a 2 px gap.

```
+----+----+----+----+----+----+----+----+----+----+----+----+
|  1 |  2 |  3 |  4 |  5 |  6 |  7 |  8 |  9 | 10 | 11 | 12 |  row 1
+----+----+----+----+----+----+----+----+----+----+----+----+
                         ...
+----+----+----+----+----+----+----+----+----+----+----+----+
                                                               row 6
```

Each cell in `layout.ts` is defined by `{ colStart, colEnd, rowStart, rowEnd }`.  
The column and row numbers are CSS grid line numbers (1-based, exclusive end).

**Unit dimensions on a 16:9 screen:**
- One column unit = 16/12 ≈ 1.333 screen-width units
- One row unit    = 9/6  = 1.5   screen-height units
- A cell's display AR = `(colSpan / rowSpan) × (8/9)`

---

## Layout Library (`layout.ts`)

There are **14 named layouts** across 4 cell counts:

| Count | Layouts | Tags |
|---|---|---|
| 3 | 4 | balanced, portrait, landscape |
| 4 | 4 | landscape, portrait, balanced ×2 |
| 5 | 4 | landscape ×2, balanced ×2 |
| 6 | 4 | balanced ×2, landscape, portrait |

### How a layout is picked each cycle

```
1. Measure the average AR of the next N photos (from AR_CACHE).
2. Decide a tag preference:
   - avgRatio < 0.85  → 'portrait'
   - avgRatio > 1.40  → 'landscape'
   - otherwise        → 'balanced'
3. Filter to layouts whose count ≤ available photos.
4. Prefer a different cell COUNT than last cycle (for variety).
5. Within that pool, prefer the matching tag.
6. Pick randomly from the final candidates.
```

The cell count therefore varies cycle to cycle (e.g. 4 → 6 → 3 → 5).  
If only 3 photos are available, only 3-cell layouts are eligible.

---

## Photo Selection Per Cycle

Each cycle selects a **batch** of photos — one per cell — using this process:

### Step 1 — Exclusion
Photos shown in the *previous* cycle are tracked in `recentlyUsedRef`.  
They are excluded from the candidate pool so no photo repeats back-to-back.

### Step 2 — Pool building
A pool of `max(cellCount × 4, 20)` candidate photos is built by walking  
forward from `photoIdxRef` (the rotation cursor) and skipping excluded IDs.  
If the pool runs short (small album), recently-used photos are allowed as fallback.

### Step 3 — AR matching (greedy)
For each cell in the chosen layout, the photo whose aspect ratio is **closest to the cell's display AR** is picked from the remaining pool.  
The distance metric is `|log(photoAR / cellAR)|` — log-scale so the comparison is symmetric (e.g. 2× too wide = 2× too tall).

This means a tall portrait cell tends to get a portrait photo, and a wide landscape cell tends to get a landscape photo.

### Step 4 — Advance cursor
`photoIdxRef` advances by `cellCount` after each cycle, walking through the full library in order (shuffled once at load time).

---

## AR Measurement (`AR_CACHE`)

Before AR matching can work, the code needs to know each photo's aspect ratio.

```ts
const AR_CACHE = new Map<string, number>(); // photoId → width/height
```

- On init: the first 30 photos are measured.
- Before each cycle: the next 12 photos ahead are measured (`preload()`).
- Measurement: a hidden `new Image()` is created at **200 px** (`IMG_SIZES.ar`).  
  For Drive photos this hits Google's CDN directly (no proxy hop).  
  `onload` records `naturalWidth / naturalHeight` in the cache.
- `AR_CACHE` is module-level so it **persists for the page lifetime** — a photo is only ever measured once.
- If a photo hasn't been measured yet when a cycle runs, `getAR()` returns `1.0` as a safe fallback.

---

## Image Loading Per Cell (`PhotoCell`)

Each cell renders through three layers, in this order:

```
Layer 0 (LQIP)    — blurred 200 px, shown immediately (already in cache from AR measurement)
Layer 1 (backdrop)— blurred, darkened version of the thumbnail; fills the cell background
Layer 2 (primary) — the real image; fades in at opacity 0 → 1 once loaded
```

### Size chosen for the thumbnail

```ts
const isSlow = getConnectionSpeed() === 'slow'; // 2G / slow-2G
const thumbSize = isSlow ? IMG_SIZES.thumb_medium  // 600 px
                         : IMG_SIZES.thumb_large;  // 800 px
```

The connection speed is checked once per photo change via the browser's  
[Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/effectiveType)  
(`navigator.connection.effectiveType`).

### Hi-res upgrade

On fast connections only, a full-res image (`IMG_SIZES.full = 2000 px`) is loaded  
in the background via `new Image()`. Once it finishes, the cell src is swapped  
to the full-res URL — no flash, because the transition only upgrades an already-visible image.

On slow connections (2G), the upgrade is **skipped entirely** — the 600 px thumbnail is  
the final image, saving several hundred KB per cell per cycle.

### URL routing

| Photo source | Thumbnail URL | Full-res URL |
|---|---|---|
| Google Drive | `drive.google.com/thumbnail?id={id}&sz=w{size}` | `drive.google.com/thumbnail?id={id}&sz=w2000` |
| Uploaded | `/api/photos/{id}/thumbnail?size={size}` (proxy) | `/api/photos/{id}/thumbnail?size=2000` |

Drive photos go directly to Google's CDN — no server round-trip.

---

## Cascade Animation

Once a new layout + batch is ready, cells don't all flip at once.  
The order is **randomised** and each cell waits `step × 1000 ms` before flipping.

```
cycle starts
  t=0 s  → cell 3 flips
  t=1 s  → cell 1 flips
  t=2 s  → cell 5 flips
  t=3 s  → cell 2 flips
  ...
cascade finishes
  + cellIntervalSeconds wait
next cycle starts
```

Each individual cell flip uses an **Apple-style zoom + fade**:
- Enter: `opacity 0, scale 1.06` → `opacity 1, scale 1` over 0.85 s
- Exit:  `opacity 1, scale 1`    → `opacity 0, scale 0.96` over 0.85 s

When the **layout changes** (cell count or geometry changes), CSS grid areas are  
keyed by position (`colStart-colEnd-rowStart-rowEnd`). A cell that moves to a  
different grid area cross-fades out and back in; a cell that stays in the same  
area persists and just receives a new photo.

---

## Timing Formula

```
Total cycle duration = (cellCount - 1) × 1000 ms   ← cascade
                     + cellIntervalSeconds × 1000 ms ← dwell time
```

With 6 cells and the default 300 s interval:
`= 5 s + 300 s = 305 s ≈ 5 min 5 s` per full cycle.

---

## State & Refs

| Name | Type | Purpose |
|---|---|---|
| `layout` | state | Current `Layout` — drives CSS grid rendering |
| `cells` | state | Array of `{photo, flipKey}` — one entry per cell |
| `isReady` | state | Gates the cascade effect; set after init |
| `photoIdxRef` | ref | Cursor into the shuffled photos array |
| `prevCountRef` | ref | Last cycle's cell count (avoids repeating same count) |
| `layoutRef` | ref | Mirror of `layout` state — readable inside effect without causing re-runs |
| `recentlyUsedRef` | ref | Set of photo IDs shown last cycle (excluded from next pool) |
| `initialized` | ref | One-time init guard |

`layout` is **deliberately excluded** from the cascade effect's dependency array.  
If it were included, every `setLayout()` call inside `runCycle()` would cancel  
all pending cascade timeouts and restart — breaking the stagger.

---

## Configuration (admin → Modes → Grid)

| Key | Default | Effect |
|---|---|---|
| `cellIntervalSeconds` | `300` | How long each grid stays on screen (seconds) |

---

## Things That Are Fixed (not configurable today)

- **Stagger between cells**: always 1 second
- **Min/max cell count**: 3–6 (set by the layout library)
- **Grid dimensions**: always 12 col × 6 row
- **Gap between cells**: always 2 px
- **Cell flip animation**: always 0.85 s zoom-fade
- **Shuffle**: always on (photos are shuffled once at load, then walked in order)
- **Hi-res size**: always 2000 px (on fast connections)
- **Thumbnail size**: 800 px fast / 600 px slow (driven by `IMG_SIZES` in `src/lib/image-urls.ts`)
