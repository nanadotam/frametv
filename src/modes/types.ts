export type ModeId =
  | 'slideshow-single'
  | 'slideshow-grid'
  | 'pinterest'
  | 'clock-text'
  | 'flipboard'
  | 'coverflow'
  | 'unsplash-mood'
  | 'easel';

export interface ModeProps {
  config: Record<string, unknown>;
  theme: 'light' | 'dark';
  brightness: number; // 5–100
  isPaused: boolean;
  onReady?: () => void;
}
