# FrameTV — Database Schema

High-level reference for the Supabase/Postgres schema. Raw migration SQL is
kept out of the repo intentionally; this diagram and table summary are the
source of truth for **shape**, not for exact DDL.

## Entity relationship diagram

```mermaid
erDiagram
    APP_USERS ||--o{ APP_SESSIONS : "has"
    APP_USERS ||--o{ AUTH_EVENTS : "generates"
    APP_USERS ||--o{ ALBUMS : "owns"
    APP_USERS ||--o{ PHOTOS : "owns"
    APP_USERS ||--o{ MODES : "customizes"
    APP_USERS ||--o{ USER_MODES : "has"
    APP_USERS ||--|| DISPLAY_STATE : "has one"
    APP_USERS ||--o{ SCHEDULES : "owns"
    APP_USERS ||--o{ REMINDERS : "owns"
    APP_USERS ||--o{ SETTINGS : "owns"
    APP_USERS ||--o| SPOTIFY_AUTH : "connects"
    APP_USERS ||--o{ FLIPBOARD_MESSAGES : "posts"
    APP_USERS ||--o{ DISPLAY_DEVICES : "registers"
    APP_USERS ||--o{ TV_PAIRING_CODES : "approves"

    ALBUMS ||--o{ PHOTOS : "contains"
    MODES ||--o{ SCHEDULES : "referenced by"
    MODES ||--o{ DISPLAY_STATE : "active mode"

    APP_USERS {
        uuid id PK
        text email UK
        text username UK
        text name
        text password_hash
        text pin_hash
        timestamptz created_at
        timestamptz updated_at
    }

    APP_SESSIONS {
        uuid id PK
        uuid user_id FK
        text session_hash UK
        text kind "admin | display"
        text device_name
        timestamptz expires_at
        timestamptz revoked_at
        timestamptz last_seen_at
    }

    AUTH_EVENTS {
        uuid id PK
        uuid user_id FK "nullable, set null on delete"
        text event_type "signup | login | pin_unlock | logout | failed_login | failed_pin | tv_pair_approved | tv_pair_consumed | account_deleted"
        text email
        text device_name
        timestamptz created_at
    }

    ALBUMS {
        uuid id PK
        uuid user_id FK
        text name
        text source_type "drive | picker | upload"
        text drive_folder_id
        uuid cover_photo_id
        boolean is_archived
        int display_order
    }

    PHOTOS {
        uuid id PK
        uuid album_id FK
        uuid user_id FK
        text source_type "drive | picker | upload"
        text source_id
        text storage_path
        text thumbnail_path
        int width
        int height
        text aspect_ratio
        boolean is_favorite
        jsonb metadata "incl. focal_x, focal_y, focal_detected"
        timestamptz taken_at
    }

    MODES {
        text id PK
        uuid user_id FK "null = global template"
        text name
        text description
        boolean is_enabled
        jsonb config
    }

    USER_MODES {
        uuid user_id PK_FK
        text id PK
        text name
        text description
        boolean is_enabled
        jsonb config
    }

    DISPLAY_STATE {
        int id PK
        uuid user_id FK
        text active_mode_id FK
        uuid_array active_album_ids
        boolean is_paused
        int brightness "5-100"
        int photo_skip "next/prev signal counter"
        timestamptz override_until
    }

    SCHEDULES {
        uuid id PK
        uuid user_id FK
        text name
        int_array days_of_week
        time start_time
        time end_time
        text mode_id FK
        uuid_array album_ids
        int priority
        boolean is_enabled
    }

    REMINDERS {
        uuid id PK
        uuid user_id FK
        text text
        text priority "eisenhower quadrant"
        boolean is_done
        boolean show_on_board
        timestamptz due_at
    }

    SETTINGS {
        text key PK
        uuid user_id FK "null = legacy/global row"
        jsonb value
        timestamptz updated_at
    }

    SPOTIFY_AUTH {
        int id PK
        uuid user_id FK UK "one connection per user"
        text access_token
        text refresh_token
        timestamptz expires_at
        text scope
    }

    FLIPBOARD_MESSAGES {
        uuid id PK
        uuid user_id FK
        text text
        text author
        boolean is_active
        timestamptz expires_at
    }

    DISPLAY_DEVICES {
        uuid id PK
        uuid user_id FK
        text client_id UK "unique per user"
        text label
        text route
        text active_mode_id
        text device_type
        timestamptz first_seen_at
        timestamptz last_seen_at
    }

    TV_PAIRING_CODES {
        uuid id PK
        uuid user_id FK "nullable until approved"
        text code UK
        text status "pending | approved | expired | consumed"
        timestamptz created_at
        timestamptz approved_at
        timestamptz expires_at
    }
```

## Notes

- **Multi-tenancy model**: almost every table carries a `user_id` foreign key
  to `app_users`, cascading on delete — deleting an account cleans up its
  albums, photos, settings, sessions, Spotify connection, etc. automatically.
- **`modes` vs `user_modes`**: `modes` rows with `user_id = null` act as
  global templates seeded on signup into a per-user copy in `user_modes`.
  `settings` follows the same "nullable legacy row, otherwise per-user"
  pattern for backward compatibility with the app's original single-user
  version.
- **`display_state`**: one row per user (not truly 1:1 enforced at the DB
  level, but the app treats it that way) holding which mode/albums are
  currently active on that user's display.
- **`spotify_auth`**: one row per user, enforced by a unique constraint on
  `user_id` — each account's Spotify connection is independent.
- **`drive_auth`**: table exists in the schema but is unused by the app;
  Google Drive album sync uses public folder URLs + an API key, not OAuth.
- **No row-level security**: tables are open (RLS disabled or permissive),
  with authorization enforced entirely in the Next.js API layer via session
  cookies (`admin` vs `display` session kinds).
