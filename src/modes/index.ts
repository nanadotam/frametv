import dynamic from 'next/dynamic';
import type { ModeId } from './types';
import type { ComponentType } from 'react';
import type { ModeProps } from './types';

const SlideshowSingleMode = dynamic(
  () => import('./slideshow-single/SlideshowSingleMode'),
  { ssr: true }
);

const SlideshowGridMode = dynamic(
  () => import('./slideshow-grid/SlideshowGridMode'),
  { ssr: true }
);

const PinterestMode = dynamic(
  () => import('./pinterest/PinterestMode'),
  { ssr: true }
);

const ClockTextMode = dynamic(
  () => import('./clock-text/ClockTextMode'),
  { ssr: true }
);

const FlipboardMode = dynamic(
  () => import('./flipboard/FlipboardMode'),
  { ssr: true }
);

const CoverFlowMode = dynamic(
  () => import('./coverflow/CoverFlowMode'),
  { ssr: false }
);

const UnsplashMoodMode = dynamic(
  () => import('./unsplash-mood/UnsplashMoodMode'),
  { ssr: true }
);

const EaselMode = dynamic(
  () => import('./easel/EaselMode'),
  { ssr: true }
);

const EisenhowerMode = dynamic(
  () => import('./eisenhower/EisenhowerMode'),
  { ssr: false }
);

export const MODES: Record<ModeId, ComponentType<ModeProps>> = {
  'slideshow-single': SlideshowSingleMode,
  'slideshow-grid': SlideshowGridMode,
  pinterest: PinterestMode,
  'clock-text': ClockTextMode,
  flipboard: FlipboardMode,
  coverflow: CoverFlowMode,
  'unsplash-mood': UnsplashMoodMode,
  easel: EaselMode,
  eisenhower: EisenhowerMode,
};
