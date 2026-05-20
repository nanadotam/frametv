// 12-column × 6-row grid layout library
// Screen AR = 16:9. colUnit = 16/12 ≈ 1.333. rowUnit = 9/6 = 1.5.
// cellAR = (colSpan * 1.333) / (rowSpan * 1.5) = (colSpan / rowSpan) * 0.889

export type LayoutTag = 'portrait' | 'landscape' | 'balanced';

export interface GridArea {
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
}

export interface Layout {
  count: number;
  tag: LayoutTag;
  areas: GridArea[];
}

export const ALL_LAYOUTS: Layout[] = [
  // ── 1-cell (focus mode) ──────────────────────────────────────────────────
  {
    count: 1, tag: 'balanced',
    areas: [{ colStart: 1, colEnd: 13, rowStart: 1, rowEnd: 7 }],
  },

  // ── 3-cell ──────────────────────────────────────────────────────────────
  {
    count: 3, tag: 'balanced',
    areas: [
      { colStart: 1, colEnd: 7,  rowStart: 1, rowEnd: 7 },  // left portrait  AR≈0.89
      { colStart: 7, colEnd: 13, rowStart: 1, rowEnd: 4 },  // top-right land AR≈1.78
      { colStart: 7, colEnd: 13, rowStart: 4, rowEnd: 7 },
    ],
  },
  {
    count: 3, tag: 'balanced',                              // mirrored
    areas: [
      { colStart: 1, colEnd: 7,  rowStart: 1, rowEnd: 4 },
      { colStart: 1, colEnd: 7,  rowStart: 4, rowEnd: 7 },
      { colStart: 7, colEnd: 13, rowStart: 1, rowEnd: 7 },  // right portrait AR≈0.89
    ],
  },
  {
    count: 3, tag: 'portrait',
    areas: [
      { colStart: 1, colEnd: 5,  rowStart: 1, rowEnd: 7 },  // 3 tall cols AR≈0.59
      { colStart: 5, colEnd: 9,  rowStart: 1, rowEnd: 7 },
      { colStart: 9, colEnd: 13, rowStart: 1, rowEnd: 7 },
    ],
  },
  {
    count: 3, tag: 'landscape',
    areas: [
      { colStart: 1,  colEnd: 7,  rowStart: 1, rowEnd: 4 },
      { colStart: 7,  colEnd: 13, rowStart: 1, rowEnd: 4 },
      { colStart: 1,  colEnd: 13, rowStart: 4, rowEnd: 7 }, // full-width bottom AR≈3.56
    ],
  },

  // ── 4-cell ──────────────────────────────────────────────────────────────
  {
    count: 4, tag: 'landscape',
    areas: [
      { colStart: 1, colEnd: 7,  rowStart: 1, rowEnd: 4 },  // 2×2 grid AR≈1.78
      { colStart: 7, colEnd: 13, rowStart: 1, rowEnd: 4 },
      { colStart: 1, colEnd: 7,  rowStart: 4, rowEnd: 7 },
      { colStart: 7, colEnd: 13, rowStart: 4, rowEnd: 7 },
    ],
  },
  {
    count: 4, tag: 'portrait',
    areas: [
      { colStart: 1,  colEnd: 4,  rowStart: 1, rowEnd: 7 }, // 4 tall cols AR≈0.44
      { colStart: 4,  colEnd: 7,  rowStart: 1, rowEnd: 7 },
      { colStart: 7,  colEnd: 10, rowStart: 1, rowEnd: 7 },
      { colStart: 10, colEnd: 13, rowStart: 1, rowEnd: 7 },
    ],
  },
  {
    count: 4, tag: 'balanced',                              // big left + 3 right stacked
    areas: [
      { colStart: 1, colEnd: 7,  rowStart: 1, rowEnd: 7 },  // left hero AR≈0.89
      { colStart: 7, colEnd: 13, rowStart: 1, rowEnd: 3 },
      { colStart: 7, colEnd: 13, rowStart: 3, rowEnd: 5 },
      { colStart: 7, colEnd: 13, rowStart: 5, rowEnd: 7 },
    ],
  },
  {
    count: 4, tag: 'balanced',                              // 3 left stacked + big right
    areas: [
      { colStart: 1, colEnd: 7,  rowStart: 1, rowEnd: 3 },
      { colStart: 1, colEnd: 7,  rowStart: 3, rowEnd: 5 },
      { colStart: 1, colEnd: 7,  rowStart: 5, rowEnd: 7 },
      { colStart: 7, colEnd: 13, rowStart: 1, rowEnd: 7 },  // right hero
    ],
  },

  // ── 5-cell ──────────────────────────────────────────────────────────────
  {
    count: 5, tag: 'landscape',
    areas: [
      { colStart: 1,  colEnd: 7,  rowStart: 1, rowEnd: 4 },
      { colStart: 7,  colEnd: 10, rowStart: 1, rowEnd: 4 },
      { colStart: 10, colEnd: 13, rowStart: 1, rowEnd: 4 },
      { colStart: 1,  colEnd: 5,  rowStart: 4, rowEnd: 7 },
      { colStart: 5,  colEnd: 13, rowStart: 4, rowEnd: 7 },
    ],
  },
  {
    count: 5, tag: 'balanced',
    areas: [
      { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 4 },
      { colStart: 5, colEnd: 9, rowStart: 1, rowEnd: 4 },
      { colStart: 9, colEnd: 13, rowStart: 1, rowEnd: 7 }, // right tall
      { colStart: 1, colEnd: 5, rowStart: 4, rowEnd: 7 },
      { colStart: 5, colEnd: 9, rowStart: 4, rowEnd: 7 },
    ],
  },
  {
    count: 5, tag: 'landscape',                            // wide banner top + 4 portrait cols
    areas: [
      { colStart: 1,  colEnd: 13, rowStart: 1, rowEnd: 3 },
      { colStart: 1,  colEnd: 4,  rowStart: 3, rowEnd: 7 },
      { colStart: 4,  colEnd: 7,  rowStart: 3, rowEnd: 7 },
      { colStart: 7,  colEnd: 10, rowStart: 3, rowEnd: 7 },
      { colStart: 10, colEnd: 13, rowStart: 3, rowEnd: 7 },
    ],
  },
  {
    count: 5, tag: 'balanced',                            // left portrait + 4 right
    areas: [
      { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 7 }, // left portrait AR≈0.59
      { colStart: 5, colEnd: 9, rowStart: 1, rowEnd: 4 },
      { colStart: 9, colEnd: 13, rowStart: 1, rowEnd: 4 },
      { colStart: 5, colEnd: 9, rowStart: 4, rowEnd: 7 },
      { colStart: 9, colEnd: 13, rowStart: 4, rowEnd: 7 },
    ],
  },

  // ── 6-cell ──────────────────────────────────────────────────────────────
  {
    count: 6, tag: 'balanced',                            // 3×2 equal grid
    areas: [
      { colStart: 1, colEnd: 5,  rowStart: 1, rowEnd: 4 }, // AR≈1.19
      { colStart: 5, colEnd: 9,  rowStart: 1, rowEnd: 4 },
      { colStart: 9, colEnd: 13, rowStart: 1, rowEnd: 4 },
      { colStart: 1, colEnd: 5,  rowStart: 4, rowEnd: 7 },
      { colStart: 5, colEnd: 9,  rowStart: 4, rowEnd: 7 },
      { colStart: 9, colEnd: 13, rowStart: 4, rowEnd: 7 },
    ],
  },
  {
    count: 6, tag: 'landscape',                           // 2 wide top + 4 portrait bottom
    areas: [
      { colStart: 1,  colEnd: 7,  rowStart: 1, rowEnd: 3 },
      { colStart: 7,  colEnd: 13, rowStart: 1, rowEnd: 3 },
      { colStart: 1,  colEnd: 4,  rowStart: 3, rowEnd: 7 },
      { colStart: 4,  colEnd: 7,  rowStart: 3, rowEnd: 7 },
      { colStart: 7,  colEnd: 10, rowStart: 3, rowEnd: 7 },
      { colStart: 10, colEnd: 13, rowStart: 3, rowEnd: 7 },
    ],
  },
  {
    count: 6, tag: 'portrait',                            // big portrait hero + 5 mosaic
    areas: [
      { colStart: 1, colEnd: 5,  rowStart: 1, rowEnd: 7 }, // left hero portrait AR≈0.59
      { colStart: 5, colEnd: 9,  rowStart: 1, rowEnd: 3 },
      { colStart: 9, colEnd: 13, rowStart: 1, rowEnd: 3 },
      { colStart: 5, colEnd: 9,  rowStart: 3, rowEnd: 5 },
      { colStart: 9, colEnd: 13, rowStart: 3, rowEnd: 5 },
      { colStart: 5, colEnd: 13, rowStart: 5, rowEnd: 7 }, // wide bottom
    ],
  },
  {
    count: 6, tag: 'balanced',                            // asymmetric mosaic
    areas: [
      { colStart: 1,  colEnd: 5,  rowStart: 1, rowEnd: 3 },
      { colStart: 5,  colEnd: 13, rowStart: 1, rowEnd: 3 }, // wide center-right
      { colStart: 1,  colEnd: 5,  rowStart: 3, rowEnd: 7 }, // tall bottom-left
      { colStart: 5,  colEnd: 9,  rowStart: 3, rowEnd: 5 },
      { colStart: 9,  colEnd: 13, rowStart: 3, rowEnd: 5 },
      { colStart: 5,  colEnd: 13, rowStart: 5, rowEnd: 7 }, // wide bottom-right
    ],
  },
];

/**
 * Compute the display aspect ratio of a single grid cell.
 * Assumes a 16:9 screen divided into a 12-col × 6-row grid.
 * AR = (colSpan × colUnit) / (rowSpan × rowUnit) = (colSpan/rowSpan) × (8/9)
 */
export function computeCellAR(area: GridArea): number {
  const colSpan = area.colEnd - area.colStart;
  const rowSpan = area.rowEnd - area.rowStart;
  return (colSpan / rowSpan) * (8 / 9);
}

/**
 * Pick a layout based on the average aspect ratio of incoming photos.
 * Prefers a different cell count than the previous cycle for visual variety.
 * Falls back gracefully when photos.length < desired count.
 */
export function pickLayout(
  avgRatio: number,
  prevCount: number | null,
  maxCells: number,
): Layout {
  // Tag preference driven by photo aspect ratios
  let preferred: LayoutTag;
  if (avgRatio < 0.85)      preferred = 'portrait';
  else if (avgRatio > 1.4)  preferred = 'landscape';
  else                       preferred = 'balanced';

  // Only use layouts whose count fits available photos
  const eligible = ALL_LAYOUTS.filter((l) => l.count <= maxCells);

  // Prefer a different count than last cycle
  const diffCount = eligible.filter((l) => l.count !== prevCount);
  const pool = diffCount.length ? diffCount : eligible;

  // Within the pool, prefer matching tag; fall back to any
  const tagged = pool.filter((l) => l.tag === preferred);
  const final = tagged.length ? tagged : pool;

  return final[Math.floor(Math.random() * final.length)];
}
