import type { Photo } from '@/types/db';

// 12-column × 6-row grid layout definitions
// Each area: [colStart, colEnd, rowStart, rowEnd] (1-indexed CSS grid)
export interface GridArea {
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
}

export interface Layout {
  count: number;
  areas: GridArea[];
}

// PRD §7.3: layouts for n=3,4,5 photos on a 12-col × 6-row grid
export const LAYOUTS: Record<number, Layout[]> = {
  3: [
    {
      count: 3,
      areas: [
        { colStart: 1, colEnd: 7, rowStart: 1, rowEnd: 7 },   // large left
        { colStart: 7, colEnd: 13, rowStart: 1, rowEnd: 4 },  // top right
        { colStart: 7, colEnd: 13, rowStart: 4, rowEnd: 7 },  // bottom right
      ],
    },
    {
      count: 3,
      areas: [
        { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 7 },   // left third
        { colStart: 5, colEnd: 9, rowStart: 1, rowEnd: 7 },   // center third
        { colStart: 9, colEnd: 13, rowStart: 1, rowEnd: 7 },  // right third
      ],
    },
  ],
  4: [
    {
      count: 4,
      areas: [
        { colStart: 1, colEnd: 7, rowStart: 1, rowEnd: 4 },   // top left
        { colStart: 7, colEnd: 13, rowStart: 1, rowEnd: 4 },  // top right
        { colStart: 1, colEnd: 7, rowStart: 4, rowEnd: 7 },   // bottom left
        { colStart: 7, colEnd: 13, rowStart: 4, rowEnd: 7 },  // bottom right
      ],
    },
    {
      count: 4,
      areas: [
        { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 7 },   // col 1
        { colStart: 5, colEnd: 9, rowStart: 1, rowEnd: 4 },   // col 2 top
        { colStart: 5, colEnd: 9, rowStart: 4, rowEnd: 7 },   // col 2 bottom
        { colStart: 9, colEnd: 13, rowStart: 1, rowEnd: 7 },  // col 3
      ],
    },
  ],
  5: [
    {
      count: 5,
      areas: [
        { colStart: 1, colEnd: 7, rowStart: 1, rowEnd: 4 },   // top left large
        { colStart: 7, colEnd: 10, rowStart: 1, rowEnd: 4 },  // top center-right
        { colStart: 10, colEnd: 13, rowStart: 1, rowEnd: 4 }, // top right
        { colStart: 1, colEnd: 5, rowStart: 4, rowEnd: 7 },   // bottom left
        { colStart: 5, colEnd: 13, rowStart: 4, rowEnd: 7 },  // bottom right large
      ],
    },
    {
      count: 5,
      areas: [
        { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 4 },
        { colStart: 5, colEnd: 9, rowStart: 1, rowEnd: 4 },
        { colStart: 9, colEnd: 13, rowStart: 1, rowEnd: 7 },
        { colStart: 1, colEnd: 5, rowStart: 4, rowEnd: 7 },
        { colStart: 5, colEnd: 9, rowStart: 4, rowEnd: 7 },
      ],
    },
  ],
};

// Pick a layout appropriate for the number of photos available
export function pickLayout(photos: Photo[]): Layout | null {
  const n = photos.length;
  if (n === 0) return null;

  // Find the closest supported count (3, 4, or 5)
  const supported = [3, 4, 5];
  const count = supported.reduce((prev, curr) =>
    Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev
  );

  const options = LAYOUTS[count];
  if (!options || options.length === 0) return null;

  // Rotate through layout variants using photo count as a seed
  const idx = Math.floor(Date.now() / 1000 / 30) % options.length;
  return options[idx];
}
