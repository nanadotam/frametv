'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ALL_LAYOUTS } from '@/modes/slideshow-grid/layout';
import type { Photo } from '@/types/db';
import Clip from './Clip';

interface VideoGridProps {
  videos: Photo[];
  /** Rotation offset from usePhotoRotation — remote next/prev shifts every tile */
  offset: number;
  cells: number;
  isPaused: boolean;
}

/**
 * Several clips playing at once in the same mosaic layouts as the photo
 * grid. With more clips than tiles, each tile moves on to an unseen clip
 * when its current one ends; with fewer, tiles loop and repeats of the same
 * clip start at staggered points so the wall never plays in lockstep.
 */
export default function VideoGrid({ videos, offset, cells, isPaused }: VideoGridProps) {
  const layout = useMemo(() => {
    const options = ALL_LAYOUTS.filter((l) => l.count === cells);
    return options.find((l) => l.tag === 'balanced') ?? options[0] ?? ALL_LAYOUTS[0];
  }, [cells]);

  // How many times each tile has advanced past its starting clip
  const [steps, setSteps] = useState<number[]>([]);
  const n = videos.length;
  const rotates = n > layout.count;

  return (
    <div
      className="w-full h-full"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gridTemplateRows: 'repeat(6, 1fr)',
        gap: '2px',
      }}
    >
      {layout.areas.map((area, i) => {
        const step = steps[i] ?? 0;
        const idx = (offset + i + step * layout.count) % n;
        const video = videos[idx];
        const durSec = (video.duration_ms ?? 0) / 1000;
        // Stagger repeats: the k-th copy of a clip starts k/copies of the way in
        const copies = Math.ceil(layout.count / n);
        const copy = Math.floor(i / n);
        const startAt = !rotates && copies > 1 && durSec ? (copy / copies) * durSec : undefined;

        return (
          <div
            key={`${area.colStart}-${area.colEnd}-${area.rowStart}-${area.rowEnd}`}
            style={{
              gridColumn: `${area.colStart} / ${area.colEnd}`,
              gridRow: `${area.rowStart} / ${area.rowEnd}`,
              position: 'relative',
              overflow: 'hidden',
              background: '#000',
            }}
          >
            <AnimatePresence initial={false}>
              <motion.div
                key={`${video.id}-${step}`}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
              >
                <Clip
                  src={video.storage_path ?? undefined}
                  poster={video.thumbnail_path ?? undefined}
                  isPaused={isPaused}
                  loop={!rotates}
                  fit="cover"
                  startAt={startAt}
                  onEnded={
                    rotates
                      ? () => setSteps((prev) => {
                          const next = [...prev];
                          next[i] = (next[i] ?? 0) + 1;
                          return next;
                        })
                      : undefined
                  }
                />
              </motion.div>
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
