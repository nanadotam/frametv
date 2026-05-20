'use client';

import { useEffect, useRef, useState } from 'react';
import { getRealtimeClient } from '@/lib/supabase/realtime';
import Tile from '@/modes/flipboard/Tile';
import type { ModeProps } from '@/modes/types';
import type { Reminder, ReminderPriority } from '@/types/db';

const GAP = 3;
const TARGET_TILE = 40;

// Quadrant definitions — order: TL, TR, BL, BR
const QUADRANTS: {
  priority: ReminderPriority;
  label: string;
  tileBg: string;   // the tile inner background in this quadrant
  textColor: string; // used for the tile char (via CSS filter/contrast — tile char is always white so we just need the bg)
}[] = [
  { priority: 'urgent_important',         label: 'DO FIRST',  tileBg: '#8B1010', textColor: '#fff' },
  { priority: 'not_urgent_important',     label: 'SCHEDULE',  tileBg: '#8B7000', textColor: '#fff' },
  { priority: 'urgent_not_important',     label: 'DELEGATE',  tileBg: '#0D3F8F', textColor: '#fff' },
  { priority: 'not_urgent_not_important', label: 'ELIMINATE', tileBg: '#0D6B2E', textColor: '#fff' },
];

const DIVIDER_BG = '#1A1A1A'; // standard dark tile bg for the cross

function buildGrid(label: string, tasks: string[], cols: number, rows: number): string[][] {
  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill(' '));

  const writeCentered = (text: string, row: number) => {
    if (row < 0 || row >= rows) return;
    const trimmed = text.slice(0, cols);
    const pad = Math.floor((cols - trimmed.length) / 2);
    for (let c = 0; c < trimmed.length; c++) {
      const col = pad + c;
      if (col >= 0 && col < cols) grid[row][col] = trimmed[c];
    }
  };

  // Row 0: label
  writeCentered(label, 0);

  // Rows 2+: tasks with "- " prefix, word-wrapped
  let row = 2;
  for (const task of tasks) {
    if (row >= rows) break;
    const upper = task.toUpperCase();
    const maxWidth = cols - 2;
    const words = upper.split(' ');
    let line = '';
    let isFirst = true;

    const flush = (t: string) => {
      writeCentered((isFirst ? '- ' : '  ') + t, row++);
      isFirst = false;
    };

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length <= maxWidth) {
        line = candidate;
      } else {
        if (line) flush(line);
        if (row >= rows) break;
        let rem = word;
        while (rem.length > maxWidth) { flush(rem.slice(0, maxWidth)); rem = rem.slice(maxWidth); if (row >= rows) break; }
        line = rem;
      }
    }
    if (line && row < rows) flush(line);
    row++; // blank between tasks
  }

  return grid;
}

function QuadrantGrid({
  label, tasks, cols, rows, tileSize, tileBg,
}: {
  label: string;
  tasks: string[];
  cols: number;
  rows: number;
  tileSize: number;
  tileBg: string;
}) {
  const grid = buildGrid(label, tasks, cols, rows);
  const staggerMs = Math.min(15, Math.floor(600 / Math.max(1, cols * rows)));

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${tileSize}px)`,
          gap: `${GAP}px`,
        }}
      >
        {grid.map((rowArr, ri) =>
          rowArr.map((char, ci) => (
            <Tile
              key={`${ri}-${ci}`}
              char={char}
              tileSize={tileSize}
              delay={(ri * cols + ci) * staggerMs}
              defaultBg={tileBg}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DividerCol({ rows, tileSize }: { rows: number; tileSize: number }) {
  return (
    <div style={{ background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: GAP, overflow: 'hidden', width: '100%', height: '100%' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Tile key={i} char=" " tileSize={tileSize} defaultBg={DIVIDER_BG} />
      ))}
    </div>
  );
}

function DividerRow({ cols, tileSize }: { cols: number; tileSize: number }) {
  return (
    <div style={{ background: '#111', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GAP, overflow: 'hidden', width: '100%', height: '100%' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Tile key={i} char=" " tileSize={tileSize} defaultBg={DIVIDER_BG} />
      ))}
    </div>
  );
}

export default function EisenhowerMode({ brightness, onReady }: ModeProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ halfCols: 15, halfRows: 8, tileSize: TARGET_TILE });

  useEffect(() => {
    const fetchReminders = async () => {
      const res = await fetch('/api/reminders');
      if (!res.ok) return;
      const json = await res.json();
      const data = (json.reminders ?? []) as Reminder[];
        if (data) setReminders(data);
        onReady?.();
    };
    fetchReminders();
    const supabase = getRealtimeClient();
    const channel = supabase
      .channel('eisenhower_reminders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, fetchReminders)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      const step = TARGET_TILE + GAP;
      const totalCols = Math.max(12, Math.floor((width  + GAP) / step));
      const totalRows = Math.max(8,  Math.floor((height + GAP) / step));
      const tileSize  = Math.max(24, Math.floor((width  + GAP) / totalCols) - GAP);
      setDims({
        halfCols: Math.floor((totalCols - 1) / 2),
        halfRows: Math.floor((totalRows - 1) / 2),
        tileSize,
      });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const { halfCols, halfRows, tileSize } = dims;

  const grouped: Record<ReminderPriority, string[]> = {
    urgent_important: [],
    not_urgent_important: [],
    urgent_not_important: [],
    not_urgent_not_important: [],
  };
  for (const r of reminders) grouped[r.priority].push(r.text);

  const qPx  = (half: number) => half * (tileSize + GAP) - GAP;
  const divPx = tileSize;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#111',
        overflow: 'hidden',
        opacity: brightness / 100,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: `${qPx(halfCols)}px ${divPx}px ${qPx(halfCols)}px`,
          gridTemplateRows:    `${qPx(halfRows)}px ${divPx}px ${qPx(halfRows)}px`,
          gap: `${GAP}px`,
        }}
      >
        {/* TL — DO FIRST (red tiles) */}
        <QuadrantGrid label={QUADRANTS[0].label} tasks={grouped[QUADRANTS[0].priority]}
          cols={halfCols} rows={halfRows} tileSize={tileSize} tileBg={QUADRANTS[0].tileBg} />

        {/* TC — vertical divider top */}
        <DividerCol rows={halfRows} tileSize={tileSize} />

        {/* TR — SCHEDULE (yellow tiles) */}
        <QuadrantGrid label={QUADRANTS[1].label} tasks={grouped[QUADRANTS[1].priority]}
          cols={halfCols} rows={halfRows} tileSize={tileSize} tileBg={QUADRANTS[1].tileBg} />

        {/* ML — horizontal divider left */}
        <DividerRow cols={halfCols} tileSize={tileSize} />

        {/* Center intersection */}
        <div style={{ background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Tile char=" " tileSize={tileSize} defaultBg={DIVIDER_BG} />
        </div>

        {/* MR — horizontal divider right */}
        <DividerRow cols={halfCols} tileSize={tileSize} />

        {/* BL — DELEGATE (blue tiles) */}
        <QuadrantGrid label={QUADRANTS[2].label} tasks={grouped[QUADRANTS[2].priority]}
          cols={halfCols} rows={halfRows} tileSize={tileSize} tileBg={QUADRANTS[2].tileBg} />

        {/* BC — vertical divider bottom */}
        <DividerCol rows={halfRows} tileSize={tileSize} />

        {/* BR — ELIMINATE (green tiles) */}
        <QuadrantGrid label={QUADRANTS[3].label} tasks={grouped[QUADRANTS[3].priority]}
          cols={halfCols} rows={halfRows} tileSize={tileSize} tileBg={QUADRANTS[3].tileBg} />
      </div>
    </div>
  );
}
