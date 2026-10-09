// 12-column × 6-row grid layout library
// cellAR = (colSpan / 12 × screenW) / (rowSpan / 6 × screenH)
//        = (colSpan / rowSpan) × screenAR / 2
// The AR comments below assume a 16:9 screen (factor 0.889).

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

  {
    count: 4, tag: 'balanced',                              // 2 portraits + 2 landscapes
    areas: [
      { colStart: 1, colEnd: 5,  rowStart: 1, rowEnd: 7 },  // portrait AR≈0.59
      { colStart: 5, colEnd: 9,  rowStart: 1, rowEnd: 7 },  // portrait AR≈0.59
      { colStart: 9, colEnd: 13, rowStart: 1, rowEnd: 4 },  // AR≈1.19
      { colStart: 9, colEnd: 13, rowStart: 4, rowEnd: 7 },
    ],
  },
  {
    count: 4, tag: 'portrait',                              // 3:4 portraits side by side
    areas: [
      { colStart: 1, colEnd: 6,  rowStart: 1, rowEnd: 7 },  // AR≈0.74
      { colStart: 6, colEnd: 11, rowStart: 1, rowEnd: 7 },  // AR≈0.74
      { colStart: 11, colEnd: 13, rowStart: 1, rowEnd: 4 }, // AR≈0.59
      { colStart: 11, colEnd: 13, rowStart: 4, rowEnd: 7 },
    ],
  },

  // ── 5-cell ──────────────────────────────────────────────────────────────
  {
    count: 5, tag: 'balanced',                              // 2 portraits + 3 landscapes
    areas: [
      { colStart: 1, colEnd: 5,  rowStart: 1, rowEnd: 7 },  // portrait AR≈0.59
      { colStart: 5, colEnd: 9,  rowStart: 1, rowEnd: 7 },  // portrait AR≈0.59
      { colStart: 9, colEnd: 13, rowStart: 1, rowEnd: 3 },  // AR≈1.78
      { colStart: 9, colEnd: 13, rowStart: 3, rowEnd: 5 },
      { colStart: 9, colEnd: 13, rowStart: 5, rowEnd: 7 },
    ],
  },
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

  {
    count: 6, tag: 'portrait',                            // 3 tall portraits + 3 landscapes
    areas: [
      { colStart: 1,  colEnd: 4,  rowStart: 1, rowEnd: 7 }, // AR≈0.44 (9:16 phone)
      { colStart: 4,  colEnd: 7,  rowStart: 1, rowEnd: 7 },
      { colStart: 7,  colEnd: 10, rowStart: 1, rowEnd: 7 },
      { colStart: 10, colEnd: 13, rowStart: 1, rowEnd: 3 }, // AR≈1.33
      { colStart: 10, colEnd: 13, rowStart: 3, rowEnd: 5 },
      { colStart: 10, colEnd: 13, rowStart: 5, rowEnd: 7 },
    ],
  },

  // ── 8-cell ──────────────────────────────────────────────────────────────
  {
    count: 8, tag: 'balanced',                            // 4×2 equal grid
    areas: [
      { colStart: 1,  colEnd: 4,  rowStart: 1, rowEnd: 4 },
      { colStart: 4,  colEnd: 7,  rowStart: 1, rowEnd: 4 },
      { colStart: 7,  colEnd: 10, rowStart: 1, rowEnd: 4 },
      { colStart: 10, colEnd: 13, rowStart: 1, rowEnd: 4 },
      { colStart: 1,  colEnd: 4,  rowStart: 4, rowEnd: 7 },
      { colStart: 4,  colEnd: 7,  rowStart: 4, rowEnd: 7 },
      { colStart: 7,  colEnd: 10, rowStart: 4, rowEnd: 7 },
      { colStart: 10, colEnd: 13, rowStart: 4, rowEnd: 7 },
    ],
  },
  {
    count: 8, tag: 'balanced',                            // two heroes + 6 mosaic
    areas: [
      { colStart: 1, colEnd: 5,  rowStart: 1, rowEnd: 4 }, // top-left hero
      { colStart: 5, colEnd: 9,  rowStart: 1, rowEnd: 4 }, // top-mid hero
      { colStart: 9, colEnd: 13, rowStart: 1, rowEnd: 3 },
      { colStart: 9, colEnd: 13, rowStart: 3, rowEnd: 4 },
      { colStart: 1, colEnd: 4,  rowStart: 4, rowEnd: 7 },
      { colStart: 4, colEnd: 7,  rowStart: 4, rowEnd: 7 },
      { colStart: 7, colEnd: 10, rowStart: 4, rowEnd: 7 },
      { colStart: 10, colEnd: 13, rowStart: 4, rowEnd: 7 },
    ],
  },

  // ── 9-cell ──────────────────────────────────────────────────────────────
  {
    count: 9, tag: 'balanced',                            // 3×3 equal grid
    areas: [
      { colStart: 1, colEnd: 5,  rowStart: 1, rowEnd: 3 },
      { colStart: 5, colEnd: 9,  rowStart: 1, rowEnd: 3 },
      { colStart: 9, colEnd: 13, rowStart: 1, rowEnd: 3 },
      { colStart: 1, colEnd: 5,  rowStart: 3, rowEnd: 5 },
      { colStart: 5, colEnd: 9,  rowStart: 3, rowEnd: 5 },
      { colStart: 9, colEnd: 13, rowStart: 3, rowEnd: 5 },
      { colStart: 1, colEnd: 5,  rowStart: 5, rowEnd: 7 },
      { colStart: 5, colEnd: 9,  rowStart: 5, rowEnd: 7 },
      { colStart: 9, colEnd: 13, rowStart: 5, rowEnd: 7 },
    ],
  },

  // ── 12-cell ─────────────────────────────────────────────────────────────
  {
    count: 12, tag: 'balanced',                           // 4×3 dense mosaic
    areas: [
      { colStart: 1,  colEnd: 4,  rowStart: 1, rowEnd: 3 },
      { colStart: 4,  colEnd: 7,  rowStart: 1, rowEnd: 3 },
      { colStart: 7,  colEnd: 10, rowStart: 1, rowEnd: 3 },
      { colStart: 10, colEnd: 13, rowStart: 1, rowEnd: 3 },
      { colStart: 1,  colEnd: 4,  rowStart: 3, rowEnd: 5 },
      { colStart: 4,  colEnd: 7,  rowStart: 3, rowEnd: 5 },
      { colStart: 7,  colEnd: 10, rowStart: 3, rowEnd: 5 },
      { colStart: 10, colEnd: 13, rowStart: 3, rowEnd: 5 },
      { colStart: 1,  colEnd: 4,  rowStart: 5, rowEnd: 7 },
      { colStart: 4,  colEnd: 7,  rowStart: 5, rowEnd: 7 },
      { colStart: 7,  colEnd: 10, rowStart: 5, rowEnd: 7 },
      { colStart: 10, colEnd: 13, rowStart: 5, rowEnd: 7 },
    ],
  },
];

/** Display aspect ratio of a grid cell on a screen of the given AR. */
export function computeCellAR(area: GridArea, screenAR = 16 / 9): number {
  const colSpan = area.colEnd - area.colStart;
  const rowSpan = area.rowEnd - area.rowStart;
  return (colSpan / rowSpan) * (screenAR / 2);
}

export interface GridPlan {
  layout: Layout;
  /** picks[i] = index into the candidate pool shown in layout.areas[i]. */
  picks: number[];
}

/** log-scale AR mismatch — 0 = perfect fit, ln 2 ≈ 0.69 = half the photo cropped away. */
const misfit = (photoAR: number, cellAR: number) => Math.abs(Math.log(photoAR / cellAR));

/**
 * Fill a layout's cells from the pool: the most demanding cells (furthest
 * from square) choose first, each taking the photo that fits it best.
 */
function assign(layout: Layout, pool: number[], screenAR: number): { picks: number[]; cost: number } {
  const order = layout.areas
    .map((area, i) => ({ i, target: computeCellAR(area, screenAR) }))
    .sort((a, b) => Math.abs(Math.log(b.target)) - Math.abs(Math.log(a.target)));
  const taken = new Set<number>();
  const picks: number[] = new Array(layout.areas.length);
  let cost = 0;
  for (const { i, target } of order) {
    let best = -1;
    let bestDiff = Infinity;
    for (let p = 0; p < pool.length; p++) {
      if (taken.has(p)) continue;
      const d = misfit(pool[p], target);
      // Ties go to the earlier photo, keeping rotation order roughly intact
      if (d < bestDiff - 1e-9) { bestDiff = d; best = p; }
    }
    taken.add(best);
    picks[i] = best;
    cost += bestDiff;
  }
  return { picks, cost: cost / layout.areas.length };
}

/**
 * Choose the template *and* which photos go where, together, from the pool
 * of upcoming photos (their measured aspect ratios). Every eligible layout
 * is filled greedily and scored by average crop (log AR mismatch); the
 * best-fitting one wins, so a run of portrait shots gets a portrait
 * template instead of being zoomed into landscape cells.
 *
 * Averaging (rather than summing) keeps layouts of different cell counts
 * comparable. A small penalty for repeating last cycle's cell count adds
 * variety, kept small enough never to override a clearly better fit.
 *
 * The single-cell layout is excluded unless allowSingle (focus mode).
 */
export function planGrid(
  pool: number[],
  prevCount: number | null,
  maxCells: number,
  screenAR: number,
  allowSingle = false,
): GridPlan {
  const eligible = ALL_LAYOUTS.filter(
    (l) => l.count <= maxCells && l.count <= pool.length && (allowSingle || l.count > 1),
  );
  if (eligible.length === 0) {
    return { layout: ALL_LAYOUTS[0], picks: [0] };
  }

  const scored = eligible.map((layout) => {
    const { picks, cost } = assign(layout, pool, screenAR);
    const varietyPenalty = layout.count === prevCount ? 0.06 : 0;
    return { layout, picks, score: cost + varietyPenalty };
  });

  // Randomise only among near-equal fits
  scored.sort((a, b) => a.score - b.score);
  const topTier = scored.filter((s) => s.score <= scored[0].score + 0.05);
  const pick = topTier[Math.floor(Math.random() * topTier.length)];
  return { layout: pick.layout, picks: pick.picks };
}
