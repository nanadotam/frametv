import type { LucideIcon } from 'lucide-react';
import {
  Album,
  Camera,
  CheckSquare,
  Clock3,
  Columns3,
  Disc3,
  Grid3X3,
  Image,
  Images,
  ListTodo,
  MessageSquareText,
  Mountain,
  Music2,
  PenLine,
  Sparkles,
} from 'lucide-react';

export type ModeCategoryId = 'photos' | 'music' | 'ambient' | 'productivity';

export interface ModeMeta {
  id: string;
  label: string;
  description: string;
  category: ModeCategoryId;
  icon: LucideIcon;
}

export interface ModeCategoryMeta {
  id: ModeCategoryId;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: {
    text: string;
    iconBg: string;
    iconBorder: string;
    softBg: string;
    active: string;
    hover: string;
    ring: string;
  };
}

export const MODE_CATEGORIES: ModeCategoryMeta[] = [
  {
    id: 'photos',
    label: 'Photos',
    description: 'Albums, galleries, and moving photo layouts',
    icon: Images,
    tone: {
      text: 'text-sky-400',
      iconBg: 'bg-sky-500/12',
      iconBorder: 'border-sky-500/25',
      softBg: 'bg-sky-500/8',
      active: 'bg-sky-500/20 text-sky-100 border-sky-400/55 shadow-sky-500/15 ring-sky-400/25',
      hover: 'hover:border-sky-400/45 hover:bg-sky-500/10 hover:text-sky-100',
      ring: 'ring-sky-400/25',
    },
  },
  {
    id: 'music',
    label: 'Music',
    description: 'Spotify-led visual modes',
    icon: Music2,
    tone: {
      text: 'text-fuchsia-400',
      iconBg: 'bg-fuchsia-500/12',
      iconBorder: 'border-fuchsia-500/25',
      softBg: 'bg-fuchsia-500/8',
      active: 'bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-400/55 shadow-fuchsia-500/15 ring-fuchsia-400/25',
      hover: 'hover:border-fuchsia-400/45 hover:bg-fuchsia-500/10 hover:text-fuchsia-100',
      ring: 'ring-fuchsia-400/25',
    },
  },
  {
    id: 'ambient',
    label: 'Ambient',
    description: 'Mood, clock, scripture, and calm display modes',
    icon: Sparkles,
    tone: {
      text: 'text-amber-400',
      iconBg: 'bg-amber-500/12',
      iconBorder: 'border-amber-500/25',
      softBg: 'bg-amber-500/8',
      active: 'bg-amber-500/20 text-amber-100 border-amber-400/55 shadow-amber-500/15 ring-amber-400/25',
      hover: 'hover:border-amber-400/45 hover:bg-amber-500/10 hover:text-amber-100',
      ring: 'ring-amber-400/25',
    },
  },
  {
    id: 'productivity',
    label: 'Boards',
    description: 'Messages, writing, reminders, and task boards',
    icon: ListTodo,
    tone: {
      text: 'text-emerald-400',
      iconBg: 'bg-emerald-500/12',
      iconBorder: 'border-emerald-500/25',
      softBg: 'bg-emerald-500/8',
      active: 'bg-emerald-500/20 text-emerald-100 border-emerald-400/55 shadow-emerald-500/15 ring-emerald-400/25',
      hover: 'hover:border-emerald-400/45 hover:bg-emerald-500/10 hover:text-emerald-100',
      ring: 'ring-emerald-400/25',
    },
  },
];

export const MODE_CATEGORY_BY_ID = Object.fromEntries(
  MODE_CATEGORIES.map((category) => [category.id, category])
) as Record<ModeCategoryId, ModeCategoryMeta>;

export const MODE_METADATA: Record<string, ModeMeta> = {
  'slideshow-single': {
    id: 'slideshow-single',
    label: 'Slideshow',
    description: 'One photo at a time with smooth transitions',
    category: 'photos',
    icon: Image,
  },
  'slideshow-grid': {
    id: 'slideshow-grid',
    label: 'Grid',
    description: 'Mosaic grid of photos',
    category: 'photos',
    icon: Grid3X3,
  },
  pinterest: {
    id: 'pinterest',
    label: 'Pinterest',
    description: 'Scrolling masonry columns',
    category: 'photos',
    icon: Columns3,
  },
  scrapbook: {
    id: 'scrapbook',
    label: 'Scrapbook',
    description: 'Polaroids tossed and taped across the screen, 2000s style',
    category: 'photos',
    icon: Camera,
  },
  coverflow: {
    id: 'coverflow',
    label: 'Cover Flow',
    description: '3D cover flow carousel',
    category: 'music',
    icon: Album,
  },
  vinyl: {
    id: 'vinyl',
    label: 'Vinyl',
    description: 'Spinning vinyl record with Spotify album art',
    category: 'music',
    icon: Disc3,
  },
  'clock-text': {
    id: 'clock-text',
    label: 'Clock',
    description: 'Large ambient clock display',
    category: 'ambient',
    icon: Clock3,
  },
  'unsplash-mood': {
    id: 'unsplash-mood',
    label: 'Mood',
    description: 'Curated Unsplash photos by mood',
    category: 'ambient',
    icon: Mountain,
  },
  scripture: {
    id: 'scripture',
    label: 'Scripture',
    description: 'Verse of the day with atmospheric backgrounds',
    category: 'ambient',
    icon: Sparkles,
  },
  flipboard: {
    id: 'flipboard',
    label: 'FlipBoard',
    description: 'News-ticker style messages',
    category: 'productivity',
    icon: MessageSquareText,
  },
  easel: {
    id: 'easel',
    label: 'Easel',
    description: 'Rotating text messages',
    category: 'productivity',
    icon: PenLine,
  },
  eisenhower: {
    id: 'eisenhower',
    label: 'Eisenhower',
    description: 'Matrix of tasks in 4 priority quadrants',
    category: 'productivity',
    icon: CheckSquare,
  },
};

export const MODE_ORDER = [
  'slideshow-single',
  'slideshow-grid',
  'pinterest',
  'scrapbook',
  'coverflow',
  'vinyl',
  'clock-text',
  'unsplash-mood',
  'scripture',
  'flipboard',
  'easel',
  'eisenhower',
];
