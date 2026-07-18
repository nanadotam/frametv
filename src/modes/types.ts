export type ModeId =
  | 'slideshow-single'
  | 'slideshow-grid'
  | 'pinterest'
  | 'scrapbook'
  | 'clock-text'
  | 'flipboard'
  | 'coverflow'
  | 'unsplash-mood'
  | 'easel'
  | 'eisenhower'
  | 'scripture'
  | 'vinyl';

export interface ModeProps {
  config: Record<string, unknown>;
  theme: 'light' | 'dark';
  brightness: number; // 5–100
  isPaused: boolean;
  albumIds?: string[];
  onReady?: () => void;
}
