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
 * Pick the layout that best fits the actual ARs of incoming photos.
 *
 * For each candidate layout we simulate the greedy match and average the
 * log-scale AR mismatch across all cells — the lowest average cost wins.
 * Averaging (rather than summing) matters once layouts of very different
 * cell counts compete: a summed cost always favors layouts with fewer
 * areas to mismatch, so a 1-cell "fullscreen" layout would win almost
 * every cycle regardless of fit, collapsing the grid into a slideshow.
 * A small penalty for re-using the same cell count as last cycle keeps
 * the display visually varied without sacrificing fit quality.
 *
 * The single-cell layout is excluded unless the caller explicitly wants
 * it (allowSingle) — grid mode should stick to genuine multi-photo
 * layouts; true fullscreen belongs to focus mode / slideshow-single.
 *
 * photoARs: individual cached ARs for the next batch of photos (order irrelevant).
 */
export function pickLayout(
  photoARs: number[],
  prevCount: number | null,
  maxCells: number,
  allowSingle = false,
): Layout {
  const eligible = ALL_LAYOUTS.filter(
    (l) => l.count <= maxCells && l.count <= photoARs.length && (allowSingle || l.count > 1),
  );
  if (eligible.length === 0) return ALL_LAYOUTS[0];

  type Scored = { layout: Layout; score: number };

  const scored: Scored[] = eligible.map((layout) => {
    const remaining = [...photoARs];
    let cost = 0;

    for (const area of layout.areas) {
      const target = computeCellAR(area);
      let bestIdx = 0;
      let bestDiff = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const diff = Math.abs(Math.log(remaining[i] / target));
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
      }
      cost += bestDiff;
      remaining.splice(bestIdx, 1);
    }

    // Average cost per cell — keeps layouts of different sizes comparable.
    const avgCost = cost / layout.areas.length;

    // Mild penalty for repeating the same cell count (variety without sacrificing fit)
    const varietyPenalty = layout.count === prevCount ? 0.25 : 0;
    return { layout, score: avgCost + varietyPenalty };
  });

  // Sort by score ascending; randomise among layouts within 0.15 of the best
  scored.sort((a, b) => a.score - b.score);
  const threshold = scored[0].score + 0.15;
  const topTier = scored.filter((s) => s.score <= threshold);

  return topTier[Math.floor(Math.random() * topTier.length)].layout;
}
