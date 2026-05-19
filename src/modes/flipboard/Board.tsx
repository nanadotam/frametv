'use client';

import Tile from './Tile';
import type { FlipMessage } from './useFlipboardMessages';

interface BoardProps {
  cols: number;
  rows: number;
  message: FlipMessage | null;
}

const STAGGER_MS = 0.03; // seconds between tiles

function layoutMessage(text: string, cols: number, rows: number): string[][] {
  // Break text into lines that fit within cols
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= cols) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word.slice(0, cols);
    }
  }
  if (current) lines.push(current);

  // Cap to rows
  const cappedLines = lines.slice(0, rows);

  // Center each line within cols
  const grid: string[][] = [];

  // Vertical centering: pad top
  const topPad = Math.floor((rows - cappedLines.length) / 2);
  for (let r = 0; r < rows; r++) {
    const lineIdx = r - topPad;
    const line = lineIdx >= 0 && lineIdx < cappedLines.length ? cappedLines[lineIdx] : '';
    // Horizontal centering
    const padLeft = Math.floor((cols - line.length) / 2);
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      const charIdx = c - padLeft;
      row.push(charIdx >= 0 && charIdx < line.length ? line[charIdx] : ' ');
    }
    grid.push(row);
  }

  return grid;
}

export default function Board({ cols, rows, message }: BoardProps) {
  const grid = layoutMessage(message?.text ?? '', cols, rows);
  const bgColor = message?.bgColor;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: '2px',
        width: '100%',
        height: '100%',
      }}
    >
      {grid.map((row, ri) =>
        row.map((char, ci) => {
          const tileIndex = ri * cols + ci;
          return (
            <Tile
              key={`${ri}-${ci}`}
              char={char.toUpperCase()}
              bgColor={bgColor}
              delay={tileIndex * STAGGER_MS}
            />
          );
        })
      )}
    </div>
  );
}
