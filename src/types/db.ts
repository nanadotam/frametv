// ─── Mode IDs ─────────────────────────────────────────────────────────────────
export type ModeId =
  | 'slideshow-single'
  | 'slideshow-grid'
  | 'pinterest'
  | 'clock-text'
  | 'flipboard'
  | 'coverflow'
  | 'unsplash-mood'
  | 'easel';

// ─── Albums ───────────────────────────────────────────────────────────────────
export interface Album {
  id: string;
  name: string;
  source_type: 'drive' | 'picker' | 'upload';
  drive_folder_id: string | null;
  cover_photo_id: string | null;
  is_archived: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// ─── Photos ───────────────────────────────────────────────────────────────────
export interface Photo {
  id: string;
  album_id: string;
  source_type: 'drive' | 'picker' | 'upload';
  source_id: string | null;
  storage_path: string | null;
  thumbnail_path: string | null;
  width: number | null;
  height: number | null;
  aspect_ratio: number | null;
  taken_at: string | null;
  mime_type: string | null;
  bytes: number | null;
  is_favorite: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ─── Modes ────────────────────────────────────────────────────────────────────
export interface Mode {
  id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  config: Record<string, unknown> | null;
}

// ─── Display State ────────────────────────────────────────────────────────────
export interface DisplayState {
  id: 1;
  active_mode_id: string | null;
  active_album_ids: string[];
  is_paused: boolean;
  brightness: number; // 5–100
  override_until: string | null;
  photo_skip: number;
  updated_at: string;
}

// ─── Schedules ────────────────────────────────────────────────────────────────
export interface Schedule {
  id: string;
  name: string;
  days_of_week: number[]; // 0=Sun … 6=Sat
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
  mode_id: string;
  album_ids: string[];
  priority: number;
  is_enabled: boolean;
  created_at: string;
}

// ─── Reminders ────────────────────────────────────────────────────────────────
export type ReminderPriority =
  | 'urgent_important'
  | 'not_urgent_important'
  | 'urgent_not_important'
  | 'not_urgent_not_important';

export interface Reminder {
  id: string;
  text: string;
  priority: ReminderPriority;
  is_done: boolean;
  show_on_board: boolean;
  due_at: string | null;
  created_at: string;
}

// ─── Spotify Auth ─────────────────────────────────────────────────────────────
export interface SpotifyAuth {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
  updated_at: string;
}

// ─── Drive Auth ───────────────────────────────────────────────────────────────
export interface DriveAuth {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
  updated_at: string;
}
