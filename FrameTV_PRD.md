# FrameTV — Product Requirements Document (PRD)

> **Codename:** FrameTV  
> **Working title alternatives:** Amoako Frame, Mirror, Vignette, AmbientOS  
> **Author:** Nana Amoako (SoroTech)  
> **Document version:** v1.0 — Draft  
> **Date:** May 19, 2026  
> **Status:** Spec complete, ready for build  
> **Engineering lead:** Nana Amoako  
> **Target launch:** Personal use first (single-tenant), then optional public release  

---

## 0. Reader's note

Chale, this PRD is intentionally long. You said you wanted everything thought through, with the research, the connectors, code snippets, and instructions. So that's what's here. The doc is structured so you can read it top-to-bottom for the full picture, or jump straight to a module if you just need to build one piece. Every feature you described in the brief is captured — nothing has been dropped, even the ones that needed reworking because of API constraints (Google Photos in particular).

A few things up front before you dive in:

1. **Google Photos Library API was effectively killed on March 31, 2025.** Third-party apps can now only read media that *the app itself uploaded* — not your existing albums. This kills the dream of "just point at my Google Photos albums" cleanly. I've designed around this with three workable paths (Picker API for one-shot album selection, Google Drive as the primary source, and self-hosted Supabase storage as the long-term winner). See §6.
2. **Spotify Web API still supports `GET /me/player/currently-playing`**, which is all we actually need for Cover Flow mode. The endpoints they killed in Nov 2024 (audio-features, recommendations, audio-analysis) are not in our path. See §10.
3. **Unsplash works fine** — 50 req/hour in demo, 5000/hour after production approval. We cache aggressively, so this is plenty. See §9.
4. **The architecture is the previous photo-gallery app, repurposed.** We're keeping the Next.js + Supabase + Drive-link upload pipeline and extending it. See §4.

---

## 1. Vision & motivation

### 1.1 What this is

FrameTV is a single-user, browser-based **ambient display OS** for a TV. It lives at a URL, runs full-screen in a browser on an old Android phone (your Samsung) plugged into your TV via HDMI, and cycles through a curated stream of your life: photos of friends, family, vacations, throwbacks, plus modes for clocks, split-flap reminders, Spotify cover flow, Pinterest-style moving grids, and Unsplash mood feeds.

It's a Samsung Frame TV — but free, customizable, personal, and yours.

### 1.2 Why

You said it best in the brief, and it's worth repeating in the doc so future-Nana remembers the *why* when the *how* gets hard:

> "I don't want to be in my old age going through albums. I want to start now, being happy and grateful for life, looking at inspiration, looking at photos, looking at good stuff."

That's the product. The whole thing is in service of one job-to-be-done: **make my room feel like a curated museum of my life and inspiration, with zero effort once it's set up.**

### 1.3 Design principles

These aren't decoration — they should drive every decision when there's ambiguity later:

1. **Boring tech, magical output.** The stack is Next.js, Supabase, vanilla web APIs. Nothing exotic. The magic is in the curation and the transitions.
2. **Offline-first.** Once a thumbnail or full image has been seen, it lives in the device's cache. If the WiFi dies, the TV keeps showing photos.
3. **One admin, one user.** That's you. No multi-tenancy, no auth roles, no "share with friends" flows. This frees us from a *lot* of complexity.
4. **Touch-first settings, lean-back viewing.** Big buttons, Material-style ripples, fat date pickers. The TV doesn't have a remote — your phone is the remote, your laptop is the admin panel.
5. **Sunrise-aware.** The app knows where you are and what time it is. Borders, brightness, and theme flip automatically at sunrise and sunset.
6. **Mode-based.** Photo slideshow, Clock, Split-flap, Cover Flow, Pinterest grid, Unsplash mood, Easel — each is a mode. You switch between them. Some modes can be scheduled.
7. **Composable, not monolithic.** Each mode is its own React component tree. Killing or adding a mode doesn't break the others.

### 1.4 Anti-goals (what this is NOT)

- **Not a photo editor.** No Lightroom-lite, no crops, no filters beyond the auto theme tinting.
- **Not a social product.** No likes, no comments, no sharing.
- **Not multi-user.** No accounts page, no role management.
- **Not a Chromecast app.** It runs in a browser. If we want a native cast experience later, that's v2.
- **Not a backup tool.** It reads your photos; it doesn't promise to keep them safe. Google Drive / your phone / your existing backup chain stays the source of truth.

---

## 2. Hardware & deployment context

Designing for the actual physical setup matters because it constrains everything.

| Component | Detail |
|---|---|
| **Display device** | Old Samsung Android phone, plugged into TV via HDMI-out (or screen mirroring). Likely running a recent-ish Chrome or Samsung Internet browser. |
| **TV** | 16:9 panel. Phone is mounted/laid in landscape, so the rendered viewport is **landscape 16:9**. |
| **Admin device** | MacBook Pro M4 Pro — primary control surface for changing albums, schedules, settings. |
| **Phone-as-remote** | iPhone — for quick mode switching, brightness override, and casual edits when you're already on the couch. |
| **Network** | Home WiFi. Assume occasional drops. Design for graceful degradation. |
| **Power** | Phone is permanently plugged in. Power saving = dim screen + slow refresh, not sleep. |

**Implication for code:** the display client must work as a PWA (installable, service-worker-cached) and must aggressively cache images locally. The admin clients (laptop, phone) are regular web pages — they can be online-first.

---

## 3. Top-level feature list

This is the master checklist. Every item below has its own section later in the doc. If you ever want to know "did we cover X?", check this list.

### 3.1 Display modes

1. **Photo Slideshow — Single** — one photo at a time, full-screen, with smart aspect-ratio fitting.
2. **Photo Slideshow — Mixed Grid** — multiple photos at once in a smart grid, with pixelation/fade transitions.
3. **Pinterest Mode** — slow-moving multi-column grid of photos, like a live Pinterest board.
4. **Clock Mode (Text Clock)** — the existing `text-clock-by-nanaamoako` repo, embedded as a full-screen mode.
5. **Split-Flap Mode (FlipOff-based)** — the `flipoff` repo, embedded and extended to display reminders, todos, quotes, and the time.
6. **Cover Flow Mode (Spotify)** — modernized iPod Classic cover flow showing currently-playing track + up next.
7. **Unsplash Mood Mode** — search Unsplash by mood ("beach", "rain", "mountains") and slideshow the results.
8. **Easel Mode** — minimal black screen with a quote or single line of text. (Placeholder; you said you'd send the reference repo later.)

### 3.2 Cross-cutting features

9. **Sunrise/sunset auto theme** — borders and chrome flip between light and dark based on local sun times.
10. **Night auto-dim** — past a threshold, the whole UI dims by a configurable percentage for power saving.
11. **Day/time scheduling** — assign albums or modes to specific days and time ranges (e.g. Monday mornings = Family album).
12. **Settings page** — touch-first, Material-style, runs anywhere (laptop / phone). The hub for all configuration.
13. **Photo source management** — Google Drive link upload, Google Photos Picker, Supabase native upload.
14. **Offline cache & service worker** — IndexedDB + Cache API for full PWA offline behavior.
15. **Remote admin** — from your laptop, change what's showing on the TV without touching the TV phone.
16. **Reminders/todo integration with Split-Flap** — feed your Eisenhower matrix items into the flip-board with color coding.

---

## 4. Architecture overview

### 4.1 The big picture

```
┌─────────────────────────────────────────────────────────────────┐
│                      FrameTV — Single Project                    │
│                                                                  │
│  ┌────────────────┐    ┌──────────────────┐   ┌──────────────┐  │
│  │   Display      │    │     Admin        │   │   Mobile     │  │
│  │   Client       │    │     Client       │   │   Remote     │  │
│  │   (TV phone)   │    │   (Laptop)       │   │   (iPhone)   │  │
│  │                │    │                  │   │              │  │
│  │  /display      │    │  /admin          │   │ /admin       │  │
│  │  Full-screen   │    │  Settings,       │   │ Quick mode   │  │
│  │  PWA           │    │  albums,         │   │ switch,      │  │
│  │  Service       │    │  schedules,      │   │ dim, pause   │  │
│  │  worker        │    │  reminders       │   │              │  │
│  └────────┬───────┘    └────────┬─────────┘   └──────┬───────┘  │
│           │                     │                    │           │
│           └─────────────────────┼────────────────────┘           │
│                                 │                                │
│                                 ▼                                │
│                  ┌──────────────────────────────┐                │
│                  │     Next.js App (Vercel)     │                │
│                  │                              │                │
│                  │  /api/photos                 │                │
│                  │  /api/schedules              │                │
│                  │  /api/settings               │                │
│                  │  /api/spotify-now-playing    │                │
│                  │  /api/unsplash-mood          │                │
│                  │  /api/reminders              │                │
│                  │  /api/realtime  (Supabase)   │                │
│                  └──────────────┬───────────────┘                │
│                                 │                                │
│                                 ▼                                │
│                  ┌──────────────────────────────┐                │
│                  │       Supabase               │                │
│                  │                              │                │
│                  │  • Postgres (metadata)       │                │
│                  │  • Storage (cached photos)   │                │
│                  │  • Realtime (live sync)      │                │
│                  │  • Auth (single user)        │                │
│                  └──────────────────────────────┘                │
│                                                                  │
│  External: Google Drive API, Google Photos Picker API,           │
│  Spotify Web API, Unsplash API, Google Fonts API                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Why this shape

- **Single Next.js app, multiple route groups.** `/display` for the TV, `/admin` for the laptop. Same codebase, same auth, same Supabase client. Vercel hosts it.
- **Supabase Realtime is the secret sauce.** When you change the active mode from your laptop, the TV picks it up instantly via a postgres-channel subscription — no polling, no refresh.
- **All state in Postgres.** Settings, schedules, photo metadata, reminders. The TV client is a thin renderer over remote state plus its local cache.
- **Service worker on the TV client only.** The admin clients don't need offline.

### 4.3 Stack confirmation

You said your preferred stack is **Next.js + Sheets** (I'm reading "Sheets" as "Supabase" given your prior projects — confirm if I'm wrong). Final stack:

| Layer | Tech | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | You know it, SSR/RSC helps with initial paint on the TV, Vercel deploy is one click. |
| Language | **TypeScript** | Same as GoOutside, KeySafe web. |
| Styling | **Tailwind CSS v4** + a few CSS modules for animations | Consistent with your other projects. |
| UI primitives | **Radix UI** + **shadcn/ui** for the admin; custom for display | Touch targets, accessible Material-style components. |
| State (client) | **Zustand** for ephemeral UI state, **TanStack Query** for server data | Lightweight, you've used both. |
| Animations | **Framer Motion** (transitions, fades, Pinterest grid) + **GSAP** for the split-flap (it's the de-facto best for that kind of thing) | |
| Backend | **Supabase** (Postgres, Storage, Realtime, Auth) | Already in your stack. |
| Deployment | **Vercel** (web), **Supabase Cloud** (DB/storage) | One-click. |
| Caching | **Service Worker + Workbox + IndexedDB** | Offline-first. |
| Image optimization | **Next.js `<Image>`** + Supabase image transformations | Free CDN, automatic resizing. |

---

## 5. Project structure & monorepo layout

We're not doing a true monorepo (no Turborepo overhead needed for one app). Single Next.js project with clear domain folders:

```
frametv/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (display)/                # Route group — full-screen, no chrome
│   │   │   ├── display/
│   │   │   │   ├── page.tsx          # Main display router (picks active mode)
│   │   │   │   ├── layout.tsx        # Full-screen, no header, registers SW
│   │   │   │   └── loading.tsx
│   │   │   └── layout.tsx
│   │   ├── (admin)/                  # Route group — has nav, Material UI
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx          # Dashboard
│   │   │   │   ├── albums/
│   │   │   │   ├── schedule/
│   │   │   │   ├── reminders/
│   │   │   │   ├── settings/
│   │   │   │   └── modes/
│   │   │   └── layout.tsx
│   │   ├── api/                      # Route handlers
│   │   │   ├── photos/
│   │   │   ├── schedule/
│   │   │   ├── spotify/
│   │   │   │   ├── auth/
│   │   │   │   └── now-playing/
│   │   │   ├── unsplash/
│   │   │   ├── drive/
│   │   │   ├── photos-picker/
│   │   │   └── reminders/
│   │   ├── layout.tsx                # Root layout, providers
│   │   └── globals.css
│   ├── modes/                        # One folder per display mode
│   │   ├── slideshow-single/
│   │   ├── slideshow-grid/
│   │   ├── pinterest/
│   │   ├── clock-text/                # Adapted from text-clock-by-nanaamoako
│   │   ├── flipboard/                 # Adapted from flipoff
│   │   ├── coverflow/                 # Adapted from ipod-classic-js
│   │   ├── unsplash-mood/
│   │   └── easel/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── realtime.ts
│   │   ├── drive/                    # Google Drive integration
│   │   ├── photos-picker/            # Google Photos Picker API
│   │   ├── spotify/
│   │   ├── unsplash/
│   │   ├── theme/                    # Sunrise/sunset, dark/light
│   │   ├── scheduler/                # Cron-style schedule resolution
│   │   └── cache/                    # SW + IndexedDB helpers
│   ├── components/
│   │   ├── display/                  # Shared display chrome
│   │   ├── admin/                    # Material-style admin UI
│   │   └── ui/                       # shadcn primitives
│   ├── hooks/
│   ├── store/                        # Zustand stores
│   ├── types/                        # Shared types + DB types from Supabase
│   └── workers/
│       └── service-worker.ts         # Workbox-generated
├── public/
│   ├── icons/
│   ├── sounds/                       # flap.mp3, etc.
│   └── manifest.json
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── scripts/
│   ├── clone-references.sh           # AI-agent prompt to clone all reference repos
│   └── extract-references.ts         # Pull useful components out of cloned repos
├── tests/
├── .env.local.example
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

### 5.1 Reference repos to clone & extract from

You asked for an AI-agent prompt to git-clone and harvest the relevant repos. Here's the script:

**`scripts/clone-references.sh`:**

```bash
#!/usr/bin/env bash
# clone-references.sh — fetch every upstream repo we're borrowing from.
# Run this once during initial project setup.
set -euo pipefail

REFS_DIR="references"
mkdir -p "$REFS_DIR"
cd "$REFS_DIR"

# Repos to clone — name|url|branch
repos=(
  "flipoff|https://github.com/magnum6actual/flipoff.git|main"
  "text-clock|https://github.com/nanadotam/text-clock-by-nanaamoako.git|main"
  "ipod-classic-js|https://github.com/tvillarete/ipod-classic-js.git|master"
)

for entry in "${repos[@]}"; do
  IFS='|' read -r name url branch <<< "$entry"
  if [ -d "$name" ]; then
    echo "↻  $name already exists — pulling latest"
    (cd "$name" && git pull --ff-only origin "$branch")
  else
    echo "↓  Cloning $name from $url"
    git clone --depth 1 --branch "$branch" "$url" "$name"
  fi
done

echo ""
echo "✓ All reference repos cloned into ./references/"
echo "  Next: run 'pnpm extract-refs' to pull useful files into src/modes/"
```

**Agent prompt** — paste this into Claude Code (or any agent) after cloning:

```text
You are an expert frontend engineer.

CONTEXT
We are building a project called FrameTV (Next.js 15 + TypeScript + Tailwind).
Three reference repositories have been cloned into ./references/:

1. ./references/flipoff           — vanilla HTML/CSS/JS split-flap display
2. ./references/text-clock        — vanilla JS text clock ("it is half past nine")
3. ./references/ipod-classic-js   — Next.js + styled-components iPod simulator
                                    with cover flow

GOAL
For each reference repo, identify the core logic and convert it into a clean
TypeScript React module that lives under src/modes/<name>/.

REQUIREMENTS
- Replace any vanilla DOM manipulation with idiomatic React hooks.
- Replace styled-components with Tailwind classes; keep behavior identical.
- Inline only the constants/timings/colors that are actually used.
- Drop dead code (keyboard shortcuts we don't need, dev-only files, etc.).
- Preserve attribution: add a top-of-file comment crediting the original repo
  (URL, author, license).
- Export a single default React component per mode: <ClockMode />,
  <FlipboardMode />, <CoverFlowMode />.
- Each component must accept a `config` prop (typed) for runtime tweaks.
- Do not pull in extra dependencies unless absolutely needed; if you must,
  list them in a TODO at the top of the file so I can install them.

DELIVERABLES per mode:
  src/modes/<name>/<Name>Mode.tsx       # Main component
  src/modes/<name>/types.ts             # Config type
  src/modes/<name>/constants.ts         # Tunable values
  src/modes/<name>/README.md            # Notes + attribution

Start with flipoff. When done, stop and let me review before moving on.
```

The agent should produce three pull-request-sized chunks of work, not one mega-commit.

---

## 6. Photo source strategy — the hard problem

This is the section where reality bites. You wanted Google Photos because all your photos already live there. **That door is mostly closed** as of March 31, 2025. Let me lay out what's possible and recommend an approach.

### 6.1 The Google Photos Library API situation

As of March 31, 2025, three scopes were removed from the Google Photos Library API: `photoslibrary.readonly`, `photoslibrary.sharing`, and `photoslibrary` (the broad ones). Calls relying only on these scopes now return `403 PERMISSION_DENIED`. The Library API can now only read/manage photos that **your app itself uploaded**. Existing albums on your account, shared albums, and your camera-roll history are off-limits to any new app. This is documented on [the official Google Photos updates page](https://developers.google.com/photos/support/updates).

Google's official replacement is the **Photos Picker API** — your app launches a session, the user manually picks photos in the Google Photos UI, those selected photos are then accessible to your app for a limited time. Good for one-shot import flows; **not** good for "watch this album forever and auto-sync new uploads."

### 6.2 What that means for FrameTV

The original idea — "create albums in Google Photos and FrameTV auto-displays them" — won't work. We have to pick one of these approaches:

| Approach | How it works | Pros | Cons |
|---|---|---|---|
| **A. Picker-only** | You open admin, click "Add from Google Photos", Picker UI lets you select photos, they get downloaded into Supabase Storage. | Direct from Google Photos. Easy UX. | Manual every time. No auto-sync. New photos won't appear. |
| **B. Google Drive as source of truth** | You put photos into Google Drive folders that mirror albums (e.g. `FrameTV/Family`). App watches the folder via Drive API and syncs new images automatically. | Auto-sync works. Drive API still allows folder reads. Folder = album. | You have to copy/move photos to Drive — a second storage layer. |
| **C. Direct upload to Supabase** | Skip Google entirely. Upload photos to Supabase Storage via the admin UI (drag & drop, or share-from-iPhone-camera). | No external dependency. Fast. | Third copy of your photos. Storage cost on your Supabase account. |
| **D. Hybrid (recommended)** | Drive as primary, Picker as one-shot import shortcut, direct upload as escape hatch. | Best of all worlds. | More code. |

**Recommendation: Approach D.** Build all three but make Google Drive the default. Here's why:

- **Drive is free up to 15 GB** (shared with Gmail). Your TV gallery doesn't need 100k photos — a few thousand carefully curated images is the whole product. A 4 MB JPEG × 3,000 photos = 12 GB, comfortably inside the free tier.
- **Drive's folder model maps cleanly to your album folder structure:**
  ```
  Drive/
    FrameTV/
      Family/
      Friends/
      Graduation/
      Throwbacks/
      Monday Morning/
      Evening Calm/
  ```
- **Drive API is stable and not under threat of deprecation.** You can list files in a folder, get their thumbnails and download URLs, and watch for changes via Drive's `changes.list` endpoint.
- **The Picker API still gives you a "quick import" button** for those moments when you just want to grab a few off your phone without putting them in Drive first.

### 6.3 The sync model

Three tiers of storage, each with a clear role:

1. **Source of truth: Google Drive** (and, for one-shot imports, Picker-selected photos).
2. **Cached copies: Supabase Storage.** When a photo is added to a Drive folder, the server downloads it once and stores a normalized copy in Supabase. This gives us:
   - Fast CDN delivery to the TV (Drive's image URLs are slow and rate-limited).
   - Thumbnails generated by Supabase image transformations.
   - Stable URLs that don't depend on Drive auth refreshes.
3. **Local cache: Service Worker + IndexedDB on the TV phone.** Once shown, photos stick around for offline.

### 6.4 Database schema (Supabase / Postgres)

```sql
-- ============================================================================
-- FrameTV — Supabase schema
-- ============================================================================

-- Albums map to Drive folders (or are user-created groupings of picked photos)
create table public.albums (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  source_type     text not null check (source_type in ('drive', 'picker', 'upload')),
  drive_folder_id text,                       -- null if not drive-backed
  cover_photo_id  uuid,                       -- references photos.id
  is_archived     boolean default false,
  display_order   int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table public.photos (
  id               uuid primary key default gen_random_uuid(),
  album_id         uuid references public.albums(id) on delete cascade,
  source_type      text not null check (source_type in ('drive', 'picker', 'upload')),
  source_id        text,                      -- Drive file ID, Picker item ID, etc.
  storage_path     text,                      -- path in Supabase Storage (after caching)
  thumbnail_path   text,
  width            int,
  height           int,
  aspect_ratio     text,                      -- '16:9', '9:16', '4:3', '3:4', etc.
  taken_at         timestamptz,               -- from EXIF if available
  mime_type        text,
  bytes            bigint,
  is_favorite      boolean default false,
  metadata         jsonb default '{}'::jsonb, -- exif, gps, original filename, etc.
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index idx_photos_album on public.photos(album_id);
create index idx_photos_taken_at on public.photos(taken_at);
create index idx_photos_aspect on public.photos(aspect_ratio);

-- Modes: which displays are available, and which is currently active
create table public.modes (
  id              text primary key,           -- 'slideshow-single', 'flipboard', etc.
  name            text not null,
  description     text,
  is_enabled      boolean default true,
  config          jsonb default '{}'::jsonb   -- per-mode tunables
);

-- The single global state row — what should the TV be showing RIGHT NOW
create table public.display_state (
  id              int primary key default 1,
  active_mode_id  text references public.modes(id),
  active_album_ids uuid[] default '{}',       -- which albums are in the current rotation
  is_paused       boolean default false,
  brightness      int default 100 check (brightness between 5 and 100),
  override_until  timestamptz,                -- temporary manual override before schedule resumes
  updated_at      timestamptz default now(),
  -- Enforce single row
  constraint single_row check (id = 1)
);

insert into public.display_state (id) values (1) on conflict do nothing;

-- Schedules: assign modes/albums to days + time ranges
create table public.schedules (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  -- Days: array of 0=Sunday..6=Saturday, or null = every day
  days_of_week    int[],
  -- Time range in local time, HH:MM
  start_time      time not null,
  end_time        time not null,
  -- What to show during this window
  mode_id         text references public.modes(id),
  album_ids       uuid[] default '{}',
  priority        int default 0,             -- higher wins on conflict
  is_enabled      boolean default true,
  created_at      timestamptz default now()
);

create index idx_schedules_enabled on public.schedules(is_enabled);

-- Reminders / todos for the split-flap board
create table public.reminders (
  id              uuid primary key default gen_random_uuid(),
  text            text not null,
  priority        text not null check (priority in ('urgent_important', 'not_urgent_important', 'urgent_not_important', 'not_urgent_not_important')),
  -- Eisenhower:                       red                yellow                  blue                       green
  is_done         boolean default false,
  show_on_board   boolean default true,
  due_at          timestamptz,
  created_at      timestamptz default now()
);

-- Generic settings (single-row key-value-ish)
create table public.settings (
  key             text primary key,
  value           jsonb not null,
  updated_at      timestamptz default now()
);

-- Spotify OAuth tokens (single user)
create table public.spotify_auth (
  id              int primary key default 1,
  access_token    text,
  refresh_token   text,
  expires_at      timestamptz,
  scope           text,
  updated_at      timestamptz default now(),
  constraint single_row check (id = 1)
);

-- Google Drive OAuth tokens (single user)
create table public.drive_auth (
  id              int primary key default 1,
  access_token    text,
  refresh_token   text,
  expires_at      timestamptz,
  scope           text,
  updated_at      timestamptz default now(),
  constraint single_row check (id = 1)
);

-- Updated_at triggers (apply to all tables with that column)
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger albums_updated_at before update on public.albums
  for each row execute function public.handle_updated_at();
create trigger photos_updated_at before update on public.photos
  for each row execute function public.handle_updated_at();
create trigger display_state_updated_at before update on public.display_state
  for each row execute function public.handle_updated_at();

-- RLS: single-user, so we keep it simple — only the authenticated user can do anything.
alter table public.albums          enable row level security;
alter table public.photos          enable row level security;
alter table public.modes           enable row level security;
alter table public.display_state   enable row level security;
alter table public.schedules       enable row level security;
alter table public.reminders       enable row level security;
alter table public.settings        enable row level security;
alter table public.spotify_auth    enable row level security;
alter table public.drive_auth      enable row level security;

-- The display client uses an anon read-only token. Admin uses a service role.
create policy "anon read"    on public.albums         for select using (true);
create policy "anon read"    on public.photos         for select using (true);
create policy "anon read"    on public.modes          for select using (true);
create policy "anon read"    on public.display_state  for select using (true);
create policy "anon read"    on public.schedules      for select using (true);
create policy "anon read"    on public.reminders      for select using (true);
create policy "anon read"    on public.settings       for select using (true);
-- spotify_auth and drive_auth are never readable by anon — service role only

-- Realtime: enable on display_state, reminders, schedules so the TV reacts live
alter publication supabase_realtime add table public.display_state;
alter publication supabase_realtime add table public.reminders;
alter publication supabase_realtime add table public.schedules;
alter publication supabase_realtime add table public.albums;
```

### 6.5 The Drive sync pipeline

```ts
// src/lib/drive/sync.ts
//
// Background job (called from a cron route handler) that:
//   1. Lists all files in each FrameTV/<album> Drive folder.
//   2. For any file we don't have, downloads + uploads to Supabase Storage.
//   3. For any photo in our DB whose Drive file is gone, marks it deleted.
//
// Trigger: Vercel Cron every 15 minutes, or manual "Sync now" button in admin.

import { google } from 'googleapis';
import { createServiceClient } from '@/lib/supabase/server';
import { getDriveAuth } from './auth';

const FRAMETV_ROOT_FOLDER = 'FrameTV';

export async function syncDrive() {
  const supabase = createServiceClient();
  const auth = await getDriveAuth();
  const drive = google.drive({ version: 'v3', auth });

  // 1. Find the FrameTV root folder
  const rootRes = await drive.files.list({
    q: `name='${FRAMETV_ROOT_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
    pageSize: 1,
  });
  const rootFolder = rootRes.data.files?.[0];
  if (!rootFolder) throw new Error('FrameTV folder not found in Drive');

  // 2. Find all child folders (= albums)
  const albumFoldersRes = await drive.files.list({
    q: `'${rootFolder.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
    pageSize: 100,
  });
  const albumFolders = albumFoldersRes.data.files ?? [];

  for (const folder of albumFolders) {
    // 3. Upsert album row
    const { data: album } = await supabase
      .from('albums')
      .upsert(
        {
          name: folder.name,
          source_type: 'drive',
          drive_folder_id: folder.id,
        },
        { onConflict: 'drive_folder_id' }
      )
      .select()
      .single();

    if (!album) continue;

    // 4. List photos in this folder
    let pageToken: string | undefined;
    do {
      const filesRes = await drive.files.list({
        q: `'${folder.id}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, imageMediaMetadata, modifiedTime)',
        pageSize: 100,
        pageToken,
      });

      for (const file of filesRes.data.files ?? []) {
        // Already have it?
        const { data: existing } = await supabase
          .from('photos')
          .select('id')
          .eq('source_type', 'drive')
          .eq('source_id', file.id!)
          .maybeSingle();

        if (existing) continue;

        // Download + cache to Supabase Storage
        await downloadAndCachePhoto(drive, file, album.id, supabase);
      }

      pageToken = filesRes.data.nextPageToken ?? undefined;
    } while (pageToken);
  }
}

async function downloadAndCachePhoto(
  drive: ReturnType<typeof google.drive>,
  file: any,
  albumId: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  const res = await drive.files.get(
    { fileId: file.id, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  const buffer = Buffer.from(res.data as ArrayBuffer);
  const storagePath = `photos/${albumId}/${file.id}-${file.name}`;

  const { error: uploadErr } = await supabase.storage
    .from('photos')
    .upload(storagePath, buffer, {
      contentType: file.mimeType,
      upsert: true,
    });
  if (uploadErr) throw uploadErr;

  const width = file.imageMediaMetadata?.width ?? null;
  const height = file.imageMediaMetadata?.height ?? null;
  const aspect = width && height ? `${width}:${height}` : null;

  await supabase.from('photos').insert({
    album_id: albumId,
    source_type: 'drive',
    source_id: file.id,
    storage_path: storagePath,
    width,
    height,
    aspect_ratio: aspect,
    mime_type: file.mimeType,
    bytes: file.size ? parseInt(file.size) : null,
    taken_at: file.imageMediaMetadata?.time ?? null,
  });
}
```

### 6.6 The Google Photos Picker fallback

When you click "Quick add from Google Photos" in admin, we launch a Picker session and poll for completion:

```ts
// src/lib/photos-picker/session.ts
//
// Wrapper around the Google Photos Picker API. The Picker API works in three steps:
//   1. Create a session — returns a pickerUri (URL to open).
//   2. User opens that URL on their phone or laptop and selects photos.
//   3. Poll session until mediaItemsSet === true, then list selected items.
//
// Docs: https://developers.google.com/photos/picker/guides/get-started

const PICKER_BASE = 'https://photospicker.googleapis.com/v1';

export async function createPickerSession(accessToken: string) {
  const res = await fetch(`${PICKER_BASE}/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Picker session create failed: ${res.status}`);
  return res.json() as Promise<{
    id: string;
    pickerUri: string;
    mediaItemsSet: boolean;
    pollingConfig: { pollInterval: string; timeoutIn: string };
    expireTime: string;
  }>;
}

export async function pollSession(sessionId: string, accessToken: string) {
  const res = await fetch(`${PICKER_BASE}/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

export async function listSessionMediaItems(sessionId: string, accessToken: string) {
  const items: any[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${PICKER_BASE}/mediaItems`);
    url.searchParams.set('sessionId', sessionId);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    items.push(...(data.mediaItems ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}
```


---

## 7. Display modes — detailed specs

Each mode is a React component with a shared interface so the display router can swap them in and out cleanly.

### 7.1 Mode interface

```ts
// src/modes/types.ts

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
  brightness: number;            // 5–100
  isPaused: boolean;
  onReady?: () => void;
}

export interface ModeDefinition {
  id: ModeId;
  name: string;
  description: string;
  icon: React.ReactNode;
  defaultConfig: Record<string, unknown>;
  Component: React.ComponentType<ModeProps>;
}
```

### 7.2 Slideshow — Single

**Behavior:** one photo at a time, centered, full screen, with a thin border at the edges (3–5px, white when light theme, dark when dark theme).

**Aspect ratio handling:**

The TV is 16:9. Your photos are mostly 9:16 (phone portrait), 4:3, 3:2, or 3:4. We need a smart fitter:

- If the photo's aspect ratio is within ±10% of 16:9 → fill the screen (object-fit: cover).
- Otherwise → contain (letterbox/pillarbox) with a tasteful blurred backdrop made from the same photo. This is the same trick Apple Photos uses.

**Transitions:** fade (default), pixelation (premium feel), slide, crossfade-blur. User-configurable in mode config.

**Timing:** default 8 seconds per photo, configurable 3–60 seconds.

**Code sketch:**

```tsx
// src/modes/slideshow-single/SlideshowSingleMode.tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhotoRotation } from '@/hooks/usePhotoRotation';
import type { ModeProps } from '@/modes/types';

interface Config {
  intervalSeconds: number;          // 8
  transition: 'fade' | 'pixelate' | 'slide' | 'blur';
  blurredBackdrop: boolean;         // true for non-16:9 photos
  borderPx: number;                 // 4
  shuffle: boolean;                 // true
}

export default function SlideshowSingleMode({ config, theme, brightness, isPaused }: ModeProps) {
  const c = config as unknown as Config;
  const { currentPhoto, advance } = usePhotoRotation({ shuffle: c.shuffle });

  useEffect(() => {
    if (isPaused) return;
    const t = setInterval(advance, c.intervalSeconds * 1000);
    return () => clearInterval(t);
  }, [advance, c.intervalSeconds, isPaused]);

  if (!currentPhoto) return null;

  const isLandscape = currentPhoto.width >= currentPhoto.height;
  const borderColor = theme === 'dark' ? '#0a0a0a' : '#fefefe';

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ backgroundColor: borderColor, opacity: brightness / 100 }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPhoto.id}
          initial={{ opacity: 0, filter: c.transition === 'pixelate' ? 'blur(40px)' : 'none' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: c.transition === 'pixelate' ? 'blur(40px)' : 'none' }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0"
          style={{ padding: c.borderPx }}
        >
          {c.blurredBackdrop && !isLandscape && (
            <div
              className="absolute inset-0 scale-110 blur-2xl"
              style={{
                backgroundImage: `url(${currentPhoto.url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.5,
              }}
            />
          )}
          <img
            src={currentPhoto.url}
            alt=""
            className="relative w-full h-full"
            style={{
              objectFit: isLandscape ? 'cover' : 'contain',
            }}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

### 7.3 Slideshow — Mixed Grid

**Behavior:** multiple photos shown at once in a smart grid optimized for the screen's 16:9 area. The grid composes images of different aspect ratios into a balanced layout. Transitions between grid sets use a coordinated stagger so it doesn't feel like every cell is fighting for attention.

**Layout strategy:** use a deterministic packing algorithm seeded by the album hash so the same album always produces the same nice layouts in the same order — no random ugly compositions. Borrow from the **masonry + bin-packing** approach used by photo apps:

```ts
// src/modes/slideshow-grid/layout.ts
//
// Choose one of a small set of pre-computed layouts based on the
// aspect ratios of the next N photos. Each layout is a list of
// (row, col, rowSpan, colSpan) tuples on a 12x6 grid.

type Layout = Array<{ row: number; col: number; rowSpan: number; colSpan: number }>;

const LAYOUTS: Record<number, Layout[]> = {
  3: [
    // One big + two small stacked
    [
      { row: 0, col: 0, rowSpan: 6, colSpan: 8 },
      { row: 0, col: 8, rowSpan: 3, colSpan: 4 },
      { row: 3, col: 8, rowSpan: 3, colSpan: 4 },
    ],
    // Three columns equal
    [
      { row: 0, col: 0, rowSpan: 6, colSpan: 4 },
      { row: 0, col: 4, rowSpan: 6, colSpan: 4 },
      { row: 0, col: 8, rowSpan: 6, colSpan: 4 },
    ],
  ],
  4: [
    // Grid 2x2
    [
      { row: 0, col: 0, rowSpan: 3, colSpan: 6 },
      { row: 0, col: 6, rowSpan: 3, colSpan: 6 },
      { row: 3, col: 0, rowSpan: 3, colSpan: 6 },
      { row: 3, col: 6, rowSpan: 3, colSpan: 6 },
    ],
    // Big left, three stacked right
    [
      { row: 0, col: 0, rowSpan: 6, colSpan: 7 },
      { row: 0, col: 7, rowSpan: 2, colSpan: 5 },
      { row: 2, col: 7, rowSpan: 2, colSpan: 5 },
      { row: 4, col: 7, rowSpan: 2, colSpan: 5 },
    ],
  ],
  5: [
    [
      { row: 0, col: 0, rowSpan: 4, colSpan: 6 },
      { row: 0, col: 6, rowSpan: 2, colSpan: 6 },
      { row: 2, col: 6, rowSpan: 2, colSpan: 3 },
      { row: 2, col: 9, rowSpan: 2, colSpan: 3 },
      { row: 4, col: 0, rowSpan: 2, colSpan: 12 },
    ],
  ],
};

export function pickLayout(photos: Photo[]): Layout {
  const n = photos.length;
  const candidates = LAYOUTS[n] ?? LAYOUTS[4];
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx];
}
```

**Pixelation transition between grids:**

```tsx
// Use a CSS animation that bumps blur up, swaps content, then bumps blur back down.
// This mimics the "premium upscaler" look you described.

<motion.div
  key={gridKey}
  initial={{ filter: 'blur(30px) saturate(2)', opacity: 0 }}
  animate={{ filter: 'blur(0px) saturate(1)', opacity: 1 }}
  exit={{ filter: 'blur(30px) saturate(2)', opacity: 0 }}
  transition={{ duration: 0.9 }}
/>
```

### 7.4 Pinterest Mode

**Behavior:** a Pinterest-style grid of photos, rounded corners, slowly drifting horizontally (or vertically) like a never-ending loop. Three rows by default, columns determined by photo count. Speed: 0.5x / 1x / 2x.

**Why CSS, not JS:** smoother on the old Samsung. Use `transform: translateX()` with a long-duration `linear` `animation` and `animation-iteration-count: infinite`. Duplicate the photo list once so the loop seam isn't visible.

```tsx
// src/modes/pinterest/PinterestMode.tsx
'use client';

import { useMemo } from 'react';
import { usePhotos } from '@/hooks/usePhotos';
import styles from './PinterestMode.module.css';

interface Config {
  rows: number;                  // 3
  speed: 0.5 | 1 | 2;            // 1
  direction: 'left' | 'right';   // 'left'
  cornerRadius: number;          // 24
  gap: number;                   // 12
}

export default function PinterestMode({ config }: { config: Config }) {
  const photos = usePhotos();

  const rows = useMemo(() => {
    const perRow = Math.ceil(photos.length / config.rows);
    return Array.from({ length: config.rows }, (_, r) =>
      photos.slice(r * perRow, (r + 1) * perRow)
    );
  }, [photos, config.rows]);

  // Duration: longer = slower. Inverse of speed.
  const baseSeconds = 120;
  const duration = baseSeconds / config.speed;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <div className="h-full flex flex-col" style={{ gap: config.gap }}>
        {rows.map((row, i) => (
          <div
            key={i}
            className={styles.scroller}
            style={
              {
                '--duration': `${duration}s`,
                '--direction': i % 2 === 0 ? 'normal' : 'reverse',
                flex: 1,
              } as React.CSSProperties
            }
          >
            <div className={styles.track} style={{ gap: config.gap }}>
              {/* Duplicate for seamless loop */}
              {[...row, ...row].map((p, idx) => (
                <img
                  key={`${p.id}-${idx}`}
                  src={p.thumbnailUrl}
                  alt=""
                  style={{
                    borderRadius: config.cornerRadius,
                    height: '100%',
                    width: 'auto',
                    objectFit: 'cover',
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```css
/* PinterestMode.module.css */
.scroller {
  overflow: hidden;
  position: relative;
}
.track {
  display: flex;
  height: 100%;
  animation: scroll var(--duration) linear infinite;
  animation-direction: var(--direction);
  width: max-content;
}
@keyframes scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }  /* duplicated content, so 50% is one full set */
}
```

### 7.5 Clock Mode (Text Clock)

**Behavior:** full-screen black canvas with the existing text-clock layout — words light up to spell "IT IS TWENTY FIVE TO TEN." Adapted from your `text-clock-by-nanaamoako` repo.

**What we keep:** the highlighting logic, the next-hour helper, the four themes (Dark / Light / Nude / Cream), the 17→20px scale-up.

**What changes:** instead of vanilla JS DOM mutation, render the grid as a React component driven by a `useTime()` hook. Theme is driven by the global theme prop, not the in-mode cycle button (the cycle button moves to the admin Mode Config screen). The favicon-swapping logic moves to a `<Head>` effect.

```tsx
// src/modes/clock-text/ClockTextMode.tsx
'use client';

import { useEffect, useState } from 'react';
import { computeActiveWords } from './logic';
import { GRID } from './constants';
import type { ModeProps } from '../types';

interface Config {
  theme: 'dark' | 'light' | 'nude' | 'cream';
  fontSize: number;
  fontFamily: string;  // Google Font family name
}

export default function ClockTextMode({ config, brightness }: ModeProps) {
  const c = config as unknown as Config;
  const [activeWords, setActiveWords] = useState<Set<string>>(new Set());

  useEffect(() => {
    const update = () => setActiveWords(computeActiveWords(new Date()));
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, []);

  const { bg, on, off } = THEMES[c.theme];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: bg, opacity: brightness / 100 }}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${GRID.cols}, 1fr)`,
          gap: '0.5em',
          fontFamily: c.fontFamily,
          fontSize: `${c.fontSize}px`,
          letterSpacing: '0.2em',
          fontWeight: 700,
        }}
      >
        {GRID.cells.map((cell, i) => (
          <span
            key={i}
            style={{
              color: activeWords.has(cell.wordId) ? on : off,
              transition: 'color 800ms ease',
            }}
          >
            {cell.letter}
          </span>
        ))}
      </div>
    </div>
  );
}

const THEMES = {
  dark:  { bg: '#000000', on: '#ffffff', off: '#1a1a1a' },
  light: { bg: '#ffffff', on: '#000000', off: '#e8e8e8' },
  nude:  { bg: '#f5e6d3', on: '#3a2515', off: '#e8d5b8' },
  cream: { bg: '#fffaf0', on: '#4a3520', off: '#f0e5d0' },
};
```

The `computeActiveWords()` function ports your existing `getNextHour()` + minute-rounding logic from JS to TypeScript with proper unit tests.

### 7.6 Flipboard Mode (Split-Flap)

**Behavior:** the full FlipOff split-flap board, but instead of just rotating inspirational quotes, it can show:

- **Reminders** from your Eisenhower matrix (color-coded: red/yellow/blue/green tiles).
- **The current time** as the message (uses the same text clock logic).
- **Custom messages** you push from admin.
- **Quotes** (the default behavior, preserved).

**Mode-within-mode:** the flip-board has its own "what to show" rotation:

```ts
type FlipboardSource = 'reminders' | 'time' | 'quotes' | 'custom';

interface FlipboardConfig {
  sources: FlipboardSource[];        // rotated through in order
  secondsPerMessage: number;         // 12
  showSound: boolean;                // true (the clacking sound)
  cols: number;                      // 22 (FlipOff default)
  rows: number;                      // 6
}
```

**Reminder color mapping (Eisenhower):**

```ts
const PRIORITY_COLORS: Record<Reminder['priority'], string> = {
  urgent_important:           '#e53935',  // Red
  not_urgent_important:       '#fbc02d',  // Yellow
  urgent_not_important:       '#1e88e5',  // Blue
  not_urgent_not_important:   '#43a047',  // Green
};
```

The original FlipOff already supports per-tile colored backgrounds during the scramble; we extend that to allow a persistent background on the *settled* tile too, keyed by reminder priority. So an urgent task literally lights up red on your board.

**Adapting FlipOff:** the original repo is vanilla JS with `Board.js`, `Tile.js`, `SoundEngine.js`, etc. The agent prompt in §5.1 covers the conversion. The key change in `Board.tsx`:

```tsx
// src/modes/flipboard/Board.tsx
'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Tile } from './Tile';
import { SoundEngine } from './SoundEngine';
import { useFlipboardMessages } from './useFlipboardMessages';

interface Props {
  cols: number;
  rows: number;
  secondsPerMessage: number;
  showSound: boolean;
}

export default function Board({ cols, rows, secondsPerMessage, showSound }: Props) {
  const { current, advance } = useFlipboardMessages();
  const soundEngineRef = useRef<SoundEngine | null>(null);

  useEffect(() => {
    if (showSound) soundEngineRef.current = new SoundEngine();
  }, [showSound]);

  useEffect(() => {
    const t = setInterval(advance, secondsPerMessage * 1000);
    return () => clearInterval(t);
  }, [advance, secondsPerMessage]);

  useEffect(() => {
    if (current && soundEngineRef.current) soundEngineRef.current.play();
  }, [current]);

  // Layout the message into the grid (centered by default)
  const grid = useMemo(() => layoutMessage(current?.text ?? '', cols, rows), [current, cols, rows]);

  return (
    <div
      className="grid bg-neutral-900 p-2 gap-[2px]"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        aspectRatio: `${cols * 1.2} / ${rows * 1.8}`,
      }}
    >
      {grid.map((cell, i) => (
        <Tile
          key={i}
          target={cell.char}
          bgColor={cell.bgColor}
        />
      ))}
    </div>
  );
}
```

### 7.7 Cover Flow Mode (Spotify)

**Behavior:** modernized iPod Classic cover flow. Big center album art of the currently playing track, smaller "up next" tiles fanning out behind. Background is a gradient extracted from the current album art. Track title and artist below.

**What we keep from `ipod-classic-js`:** the cover flow component and its 3D transform math. Inspect the `app/components/CoverFlow*` files in that repo.

**What we drop:** the click wheel, the iPod chrome, the multi-screen navigation. We don't need any of that — we're a passive display.

**What we add:**
- **Color extraction** from album art using [`fast-average-color`](https://github.com/fast-average-color/fast-average-color) to drive the background gradient.
- **Smooth crossfade** when the song changes.
- **Polling Spotify** every 5 seconds via our own `/api/spotify/now-playing` proxy.

```tsx
// src/modes/coverflow/CoverFlowMode.tsx
'use client';

import { useEffect, useState } from 'react';
import { FastAverageColor } from 'fast-average-color';
import { CoverFlowCarousel } from './CoverFlowCarousel';
import { useSpotifyNowPlaying } from '@/hooks/useSpotifyNowPlaying';

export default function CoverFlowMode() {
  const { current, queue, isPlaying } = useSpotifyNowPlaying();
  const [bgGradient, setBgGradient] = useState('linear-gradient(180deg, #000 0%, #111 100%)');

  useEffect(() => {
    if (!current?.albumArtUrl) return;
    const fac = new FastAverageColor();
    fac.getColorAsync(current.albumArtUrl, { mode: 'speed' }).then((color) => {
      const dark = darken(color.hex, 0.4);
      setBgGradient(`radial-gradient(circle at 50% 30%, ${color.hex}66 0%, ${dark} 60%, #000 100%)`);
    });
  }, [current?.albumArtUrl]);

  if (!current) return <NoSpotify />;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center transition-[background] duration-1000"
      style={{ background: bgGradient }}
    >
      <CoverFlowCarousel current={current} queue={queue} />
      <div className="text-center mt-12 text-white">
        <div className="text-5xl font-bold tracking-tight">{current.name}</div>
        <div className="text-2xl opacity-70 mt-2">{current.artists.join(', ')}</div>
      </div>
    </div>
  );
}
```

### 7.8 Unsplash Mood Mode

**Behavior:** you type a mood ("beach", "rain", "mountains") in admin, and the TV slideshows curated Unsplash photos for that query. Auto-attributes the photographer and Unsplash per their API guidelines.

**Rate limits:** demo is 50 req/hr; production is 5,000/hr after approval. We cache results in Supabase for at least 24 hours per query, so a single mood costs us ~1 search call (returns 30 photos) + 30 download tracking calls when each is displayed. Comfortably under demo limits.

**Attribution:** required by the [Unsplash API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines). Show a small bottom-left credit: "Photo by [Photographer] on Unsplash" with the proper UTM params.

```ts
// src/lib/unsplash/client.ts
const UNSPLASH_BASE = 'https://api.unsplash.com';
const UTM = '?utm_source=frametv&utm_medium=referral';

export async function searchByMood(mood: string, page = 1) {
  const url = new URL(`${UNSPLASH_BASE}/search/photos`);
  url.searchParams.set('query', mood);
  url.searchParams.set('per_page', '30');
  url.searchParams.set('page', String(page));
  url.searchParams.set('orientation', 'landscape');

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
    next: { revalidate: 60 * 60 * 24 },  // cache 24h
  });
  if (!res.ok) throw new Error(`Unsplash search failed: ${res.status}`);
  return res.json();
}

export async function trackDownload(downloadLocation: string) {
  // Required by Unsplash guidelines when displaying a photo
  await fetch(downloadLocation, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
  });
}
```

### 7.9 Easel Mode

Placeholder mode pending your reference. **Spec for now:**

- Solid background (theme-driven).
- A single line of text, centered, in a hand-drawn or display font.
- Text rotates every N minutes from a configurable list ("quote", "scripture", "today's intention").

Once you send the reference repo, we'll align it to that.

---

## 8. The theme & sunrise/sunset system

You want borders + chrome to flip based on real sun times. This is fully achievable client-side.

### 8.1 Inputs

- **Your location:** stored once in settings. Default: Accra, Ghana (5.6037° N, -0.1870° W).
- **Current time:** `Date.now()`.

### 8.2 Computing sun times

Use [`suncalc`](https://github.com/mourner/suncalc) — a tiny (3 kb) library that's been the standard for years:

```ts
// src/lib/theme/sun.ts
import SunCalc from 'suncalc';

export function getThemeFor(date: Date, lat: number, lng: number): 'light' | 'dark' {
  const times = SunCalc.getTimes(date, lat, lng);
  const now = date.getTime();
  // "Day" = between sunrise and sunset
  return now >= times.sunrise.getTime() && now < times.sunset.getTime() ? 'light' : 'dark';
}

export function getNextThemeFlip(date: Date, lat: number, lng: number): Date {
  const t = SunCalc.getTimes(date, lat, lng);
  const now = date.getTime();
  if (now < t.sunrise.getTime()) return t.sunrise;
  if (now < t.sunset.getTime()) return t.sunset;
  // After today's sunset → tomorrow's sunrise
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return SunCalc.getTimes(tomorrow, lat, lng).sunrise;
}
```

### 8.3 Hook for the display

```ts
// src/hooks/useAutoTheme.ts
'use client';

import { useEffect, useState } from 'react';
import { useSettings } from './useSettings';
import { getThemeFor, getNextThemeFlip } from '@/lib/theme/sun';

export function useAutoTheme() {
  const settings = useSettings();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (!settings.location) return;
    const { lat, lng } = settings.location;

    const apply = () => {
      const t = getThemeFor(new Date(), lat, lng);
      setTheme(t);
    };

    apply();

    // Schedule the exact next flip — no polling needed
    const nextFlip = getNextThemeFlip(new Date(), lat, lng);
    const ms = nextFlip.getTime() - Date.now();
    const timer = setTimeout(apply, ms);
    return () => clearTimeout(timer);
  }, [settings.location, theme]);

  return theme;
}
```

### 8.4 Night auto-dim

A second toggle on top of the theme. After a configurable time (default 23:00 local), brightness drops to 60% and screen content gets a `filter: brightness(0.7) saturate(0.9)` overlay. This saves power on the phone (OLED-style) and is easier on the eyes if you fall asleep with it on.

```ts
// src/hooks/useAutoDim.ts
export function useAutoDim() {
  const settings = useSettings();
  const [dim, setDim] = useState(false);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const cur = h * 60 + m;
      const dimStart = settings.dim?.startMinute ?? 23 * 60;
      const dimEnd = settings.dim?.endMinute ?? 6 * 60;

      // Handle overnight wrap
      const inWindow = dimStart > dimEnd
        ? cur >= dimStart || cur < dimEnd
        : cur >= dimStart && cur < dimEnd;
      setDim(inWindow);
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [settings.dim]);

  return dim;
}
```


---

## 9. Scheduling system

You want different albums or modes at different times of day and different days of the week. Example from your brief: "Mondays in the morning I want to see this picture, Mondays in the afternoon a different one."

### 9.1 Schedule resolution

Schedules are evaluated every minute. The active schedule = the highest-priority enabled schedule whose `days_of_week` includes today and whose `start_time`–`end_time` range includes now. If no schedule matches, the default mode/album set from `display_state` is used.

```ts
// src/lib/scheduler/resolve.ts
import type { Schedule } from '@/types/db';

export function findActiveSchedule(
  schedules: Schedule[],
  now: Date = new Date()
): Schedule | null {
  const dow = now.getDay();
  const curMinutes = now.getHours() * 60 + now.getMinutes();

  const matching = schedules.filter((s) => {
    if (!s.is_enabled) return false;
    if (s.days_of_week && s.days_of_week.length > 0 && !s.days_of_week.includes(dow)) {
      return false;
    }
    const start = parseTimeToMinutes(s.start_time);
    const end = parseTimeToMinutes(s.end_time);
    // Handle overnight ranges
    if (start <= end) {
      return curMinutes >= start && curMinutes < end;
    } else {
      return curMinutes >= start || curMinutes < end;
    }
  });

  if (matching.length === 0) return null;
  return matching.sort((a, b) => b.priority - a.priority)[0];
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
```

### 9.2 The "override" pattern

When you tap "Show family photos NOW" on your phone, we don't want that to permanently override the schedule. Instead we set `display_state.override_until = now + 30 minutes`. A scheduled job (or a `setTimeout` in the display client) clears it. The display logic picks override over schedule, schedule over default:

```ts
// src/hooks/useActiveMode.ts
export function useActiveMode() {
  const displayState = useDisplayState();
  const schedules = useSchedules();

  return useMemo(() => {
    // Manual override wins
    if (displayState.override_until && new Date(displayState.override_until) > new Date()) {
      return {
        modeId: displayState.active_mode_id,
        albumIds: displayState.active_album_ids,
        source: 'override',
      };
    }
    // Otherwise, check schedule
    const sched = findActiveSchedule(schedules);
    if (sched) {
      return { modeId: sched.mode_id, albumIds: sched.album_ids, source: 'schedule' };
    }
    // Default
    return {
      modeId: displayState.active_mode_id,
      albumIds: displayState.active_album_ids,
      source: 'default',
    };
  }, [displayState, schedules]);
}
```

### 9.3 UI for schedules

The admin schedule page is a weekly calendar (7 columns × 24 rows). Tap-and-drag to create a new schedule block. Each block shows the mode + album. Material-style time pickers, day-of-week chips, mode dropdown. Implementation: [`@dnd-kit/core`](https://dndkit.com/) for the drag interactions.

---

## 10. Spotify integration — what's still available

### 10.1 What works (May 2026)

- **`GET /me/player/currently-playing`** — returns the current track, album art, artists. ✓
- **`GET /me/player`** — full playback state including device, shuffle/repeat. ✓
- **`GET /me/player/recently-played`** — last 50 tracks. ✓
- **`POST /me/player/queue`** — add to queue. ✓

### 10.2 What's gone

Killed in November 2024, no longer available to new apps: `/audio-features`, `/audio-analysis`, `/recommendations`, `/browse/new-releases`, `/artists/{id}/top-tracks`. We didn't need any of those, so we're fine.

### 10.3 Cover Flow "up next" caveat

There is **no Spotify endpoint that reliably returns the upcoming queue** for the current user. The closest thing is `/me/player`, which exposes `context` (the playlist or album the user is playing from), and from that we can list the *album tracks* or *playlist tracks* and infer the next few. This works well enough for your use case because:

- You said you're controlling playback from your PC.
- You'll typically be playing an album or a playlist with a clear order.
- We can fall back to "recently played" if no clear context.

```ts
// src/lib/spotify/now-playing.ts
export async function getNowPlayingWithQueue(accessToken: string) {
  const playback = await spotifyFetch('/me/player', accessToken);
  if (!playback?.item) return null;

  const current = playback.item;
  let queue: any[] = [];

  if (playback.context?.type === 'album') {
    const albumId = playback.context.uri.split(':').pop();
    const albumTracks = await spotifyFetch(`/albums/${albumId}/tracks?limit=50`, accessToken);
    const idx = albumTracks.items.findIndex((t: any) => t.id === current.id);
    queue = albumTracks.items.slice(idx + 1, idx + 6);
  } else if (playback.context?.type === 'playlist') {
    const playlistId = playback.context.uri.split(':').pop();
    const playlistTracks = await spotifyFetch(
      `/playlists/${playlistId}/tracks?limit=50&fields=items(track(id,name,artists,album))`,
      accessToken
    );
    const idx = playlistTracks.items.findIndex((it: any) => it.track.id === current.id);
    queue = playlistTracks.items.slice(idx + 1, idx + 6).map((it: any) => it.track);
  }

  return { current, queue, isPlaying: playback.is_playing };
}
```

### 10.4 OAuth scopes needed

```
user-read-currently-playing
user-read-playback-state
user-read-recently-played
```

No write scopes. We're read-only.

### 10.5 Polling cadence

Don't poll faster than every 5 seconds. Spotify's rate limit is generous but not infinite. Use a `setInterval` in the Cover Flow hook with a 5-second beat, and back off to 30 seconds if the user is paused.

---

## 11. Settings page — touch-first admin UX

Your brief was extremely clear on this point: **big buttons, Material ripples, fat date/time pickers, mobile-friendly**. Settings is the most-touched surface, so it has to feel right.

### 11.1 Layout

Single-page app with a fixed bottom tab bar (mobile) or left sidebar (desktop). Five top-level sections:

1. **Now Playing** — the dashboard. Shows what the TV is currently displaying, with a big "pause" and "next" button. Quick mode-switch chips at the top.
2. **Albums** — manage Drive folders, picked albums, uploaded photos. Per album: edit name, archive, set cover photo, set as primary for a schedule.
3. **Schedule** — the weekly calendar grid.
4. **Modes** — per-mode configuration (slideshow timing, flipboard sources, Pinterest speed, etc.).
5. **System** — location, sunrise toggle, dim window, Spotify/Drive/Unsplash auth, advanced.

### 11.2 Design tokens

Riffing on your KeySafe palette but tuned for the TV-admin use case:

```ts
// tailwind.config.ts (relevant excerpt)
export default {
  theme: {
    extend: {
      colors: {
        bg:        { DEFAULT: '#0a0a0a', soft: '#141414', card: '#1c1c1e' },
        fg:        { DEFAULT: '#fafafa', muted: '#a0a0a0', dim: '#606060' },
        accent:    { DEFAULT: '#fbbf24', hover: '#f59e0b' },  // warm amber
        success:   '#22c55e',
        warning:   '#fbbf24',
        danger:    '#ef4444',
        priority: {
          urgent_important: '#e53935',
          not_urgent_important: '#fbc02d',
          urgent_not_important: '#1e88e5',
          not_urgent_not_important: '#43a047',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '12px',
        pill: '999px',
      },
    },
  },
};
```

### 11.3 Touch targets

Minimum hit area: **48 × 48 px** (per Material guidelines). Most CTAs are bigger — 56 px height on the primary buttons.

### 11.4 Material ripple

Use [`@material/web`](https://github.com/material-components/material-web) ripple component, or roll a 12-line custom version:

```tsx
// src/components/admin/Ripple.tsx
'use client';

import { useRef } from 'react';

export function Ripple({ children, onClick, className = '' }: any) {
  const ref = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = ref.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
    onClick?.(e);
  };

  return (
    <button ref={ref} onClick={handleClick} className={`relative overflow-hidden ${className}`}>
      {children}
    </button>
  );
}
```

```css
.ripple {
  position: absolute;
  border-radius: 50%;
  width: 200px;
  height: 200px;
  margin: -100px;
  background: rgba(255, 255, 255, 0.3);
  pointer-events: none;
  animation: ripple 600ms ease-out;
}
@keyframes ripple {
  from { transform: scale(0); opacity: 1; }
  to   { transform: scale(2.5); opacity: 0; }
}
```

### 11.5 Big date / time picker

For the schedule UI, use [`react-aria-components`](https://react-spectrum.adobe.com/react-aria/) `TimeField` — it has the best touch support and accessibility. Wrap it in a custom skin to match the dark theme.

---

## 12. Offline / PWA strategy

This is essential. Your home internet will drop, and the TV must keep showing photos.

### 12.1 Service worker setup

Use `next-pwa` (or its modern fork `@ducanh2912/next-pwa` for App Router compatibility):

```ts
// next.config.mjs
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  scope: '/display',         // only register SW on the display route
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /\.(?:jpg|jpeg|png|webp|avif)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'photos',
        expiration: { maxEntries: 5000, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      urlPattern: ({ url }) => url.pathname.startsWith('/api/photos'),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'photo-metadata',
        expiration: { maxAgeSeconds: 60 * 60 * 6 },
      },
    },
    {
      urlPattern: ({ url }) => url.pathname.startsWith('/_next/static'),
      handler: 'CacheFirst',
      options: { cacheName: 'next-static' },
    },
  ],
});

export default withPWA({
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { hostname: '*.supabase.co' },
      { hostname: 'images.unsplash.com' },
      { hostname: 'i.scdn.co' },        // Spotify album art
      { hostname: 'lh3.googleusercontent.com' },  // Google Photos / Drive thumbnails
    ],
  },
});
```

### 12.2 Pre-warming the cache

When the TV first boots up online, we proactively fetch the next ~50 photos in the rotation so they're cached before the user even sees them. Use the Cache API directly:

```ts
// src/lib/cache/preload.ts
export async function preloadPhotos(urls: string[]) {
  const cache = await caches.open('photos');
  await Promise.allSettled(
    urls.map((url) =>
      cache.match(url).then((hit) => {
        if (hit) return;
        return fetch(url).then((res) => {
          if (res.ok) cache.put(url, res.clone());
        });
      })
    )
  );
}
```

### 12.3 Background sync

If the TV goes offline, queue any state changes (like "mark this photo as favorite") in IndexedDB and replay them when connectivity returns. Use [`workbox-background-sync`](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync). Mostly irrelevant for the display itself but matters for admin actions made from the phone in low-signal areas.

### 12.4 Manifest

```json
// public/manifest.json
{
  "name": "FrameTV",
  "short_name": "FrameTV",
  "start_url": "/display",
  "display": "fullscreen",
  "orientation": "landscape",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

When you "Add to Home Screen" on the Samsung phone, it launches in fullscreen-landscape immediately.

---

## 13. Reminders + Eisenhower matrix → Flipboard

You wanted to push to-do items into the split-flap. Here's the model.

### 13.1 Admin reminders UI

A 2×2 Eisenhower grid. Each quadrant is a drop zone. Tap "+" in any quadrant to add a task. The quadrants are color-coded matching the priority tile color on the board.

```
┌──────────────────────────┬──────────────────────────┐
│  Urgent + Important      │  Not Urgent + Important  │
│  🔴 Do                   │  🟡 Plan                 │
│                          │                          │
│  • Submit DuoSign demo   │  • Plan Fire Camp ops    │
│  • Confirm graduation    │  • NSS onboarding prep   │
│                          │                          │
├──────────────────────────┼──────────────────────────┤
│  Urgent + Not Important  │  Not Urgent + Not Imp.   │
│  🔵 Delegate             │  🟢 Eliminate            │
│                          │                          │
│  • Reply to vendor email │  • Reorganize photos     │
└──────────────────────────┴──────────────────────────┘
```

### 13.2 Pushing to the board

Reminders with `show_on_board = true` rotate through the Flipboard alongside quotes. Each reminder becomes a short message — we automatically truncate or wrap to fit the 22×6 grid.

```ts
// src/modes/flipboard/messageSources.ts
export async function reminderMessages(): Promise<FlipMessage[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('reminders')
    .select('*')
    .eq('is_done', false)
    .eq('show_on_board', true)
    .order('priority');

  return (data ?? []).map((r) => ({
    text: shorten(r.text, 132),         // 22 cols × 6 rows = 132 chars max
    bgColor: PRIORITY_COLORS[r.priority],
    sourceId: r.id,
  }));
}

function shorten(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
```

### 13.3 Marking done from the board

A small "✓" button appears next to each reminder in the admin view. Tap to mark done. Realtime updates the board within seconds.

---

## 14. Realtime sync (Supabase Realtime)

This is what makes the laptop → TV control flow feel instant.

### 14.1 Display client subscription

```ts
// src/hooks/useDisplayStateRealtime.ts
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DisplayState } from '@/types/db';

export function useDisplayStateRealtime() {
  const [state, setState] = useState<DisplayState | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Initial fetch
    supabase
      .from('display_state')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => setState(data));

    // Subscribe to changes
    const channel = supabase
      .channel('display_state')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'display_state' },
        (payload) => setState(payload.new as DisplayState)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return state;
}
```

### 14.2 Admin write

```ts
// src/lib/actions/setMode.ts
'use server';

import { createServiceClient } from '@/lib/supabase/server';

export async function setMode(modeId: string, albumIds: string[] = []) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('display_state')
    .update({
      active_mode_id: modeId,
      active_album_ids: albumIds,
      override_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .eq('id', 1);
  if (error) throw error;
}
```

When you tap a mode chip on the laptop, the change hits the DB in ~80 ms, and the TV's open Realtime channel pushes the update within another ~100 ms. Feels instant.

---

## 15. Authentication & security

Single user, so this is mostly about keeping your data out of strangers' hands rather than role management.

### 15.1 Auth options

- **Supabase Auth with Google OAuth.** You sign in once with your Google account on each device. The TV phone, the laptop, and your iPhone all share the same user.
- **The display client doesn't need write permissions.** It can authenticate as a long-lived anonymous viewer session that only has read access to public tables.

### 15.2 Securing the display URL

The `/display` route is public — anyone with the URL could view your photos. Mitigations:

- **Obscure path:** `/display/<random-32-char-token>`. Generated once, baked into the PWA manifest. Easy to rotate.
- **CORS lockdown:** the API routes only accept requests with the right Supabase JWT.
- **Optional PIN:** the admin can require a 4-digit PIN on first load, stored in localStorage. Not real security but makes accidental sharing harder.

### 15.3 Token storage for external services

Spotify, Drive, Picker, Unsplash access keys all live in `spotify_auth` / `drive_auth` / `settings`. **These tables are only readable via the service role**, never the anon key. The display client never sees them directly — it calls our own `/api/spotify/now-playing` and we proxy the call.

---

## 16. Performance budget

The Samsung phone is old. Budgets:

| Metric | Target |
|---|---|
| Display initial render | < 2.5 s on 4G |
| Mode swap | < 400 ms |
| Photo transition jank | 0 dropped frames (60 fps) |
| Memory ceiling | < 250 MB |
| Idle CPU | < 5% (so the phone stays cool) |

### 16.1 Image strategy

- Always serve through Next.js `<Image>` + Supabase image transformations. Request a width that matches the rendered area (e.g. 1920 for full-screen on a 1080p TV).
- Use `loading="eager"` only for the *currently visible* image. The next-up photo is `loading="lazy"` but preloaded into the SW cache.
- Format: serve `image/avif` if supported, then `image/webp`, fall back to JPEG.

### 16.2 React rendering

- Each mode mounts/unmounts cleanly when the active mode changes — no keep-alive of off-screen modes.
- Memoize heavy components with `React.memo` and stable prop references.
- Animation frames driven by `requestAnimationFrame`, not React state, for the Pinterest scroller.

### 16.3 Bundle splitting

The display client should not ship Cover Flow code unless Cover Flow is active. Use Next.js `dynamic()` per mode:

```ts
// src/modes/index.ts
import dynamic from 'next/dynamic';

export const MODES = {
  'slideshow-single': dynamic(() => import('./slideshow-single/SlideshowSingleMode')),
  'slideshow-grid':   dynamic(() => import('./slideshow-grid/SlideshowGridMode')),
  'pinterest':        dynamic(() => import('./pinterest/PinterestMode')),
  'clock-text':       dynamic(() => import('./clock-text/ClockTextMode')),
  'flipboard':        dynamic(() => import('./flipboard/FlipboardMode')),
  'coverflow':        dynamic(() => import('./coverflow/CoverFlowMode'), { ssr: false }),
  'unsplash-mood':    dynamic(() => import('./unsplash-mood/UnsplashMoodMode')),
  'easel':            dynamic(() => import('./easel/EaselMode')),
};
```


---

## 17. Build phases & timeline

Realistic breakdown given that you're also juggling DuoSign, NSS, and Fire Camp.

### Phase 0 — Project scaffolding (Day 1–2)

- [ ] Duplicate the previous photo-gallery repo to `frametv`.
- [ ] Strip out anything not needed; rename app metadata.
- [ ] Run `clone-references.sh` to pull FlipOff, text-clock, ipod-classic-js.
- [ ] Set up Supabase project, run the schema in §6.4.
- [ ] Add env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.
- [ ] Deploy to Vercel on a `dev.frametv.<your-domain>` subdomain.
- [ ] Wire up basic Supabase Auth (Google OAuth).

**Exit criteria:** you can sign in on laptop, see an empty admin page, and the `/display` route renders "no mode active."

### Phase 1 — Photo pipeline (Day 3–5)

- [ ] Bring forward the Drive-link upload code from the previous app.
- [ ] Implement the Drive sync pipeline (§6.5).
- [ ] Implement Google Photos Picker (§6.6).
- [ ] Implement direct upload (drag-drop).
- [ ] Build the admin Albums page.

**Exit criteria:** you can upload photos via all three sources and see them listed in admin.

### Phase 2 — Slideshow MVP (Day 6–7)

- [ ] Implement Slideshow Single.
- [ ] Implement the auto-theme + dim system.
- [ ] Wire up `display_state` Realtime sync.
- [ ] Build the admin Now-Playing dashboard.

**Exit criteria:** photos cycle on the TV; you can pause/resume from the laptop and it works within ~200 ms.

### Phase 3 — Multi-mode (Day 8–12)

- [ ] Clock Mode (port from text-clock).
- [ ] Slideshow Grid Mode.
- [ ] Pinterest Mode.
- [ ] Mode-switch chips in admin.

**Exit criteria:** four modes work; switching between them is smooth.

### Phase 4 — FlipBoard + Reminders (Day 13–16)

- [ ] Port FlipOff to React.
- [ ] Implement the reminders Eisenhower UI.
- [ ] Hook reminders into the flip-board.
- [ ] Quote and time sources.

**Exit criteria:** the flip-board cycles through quotes, reminders, and the current time.

### Phase 5 — Spotify Cover Flow (Day 17–19)

- [ ] OAuth flow for Spotify.
- [ ] Port the cover flow carousel from `ipod-classic-js`.
- [ ] Color extraction + gradient background.
- [ ] Polling now-playing.

**Exit criteria:** you press play on Spotify on your laptop and within 5 seconds the TV shows the cover flow with the right track.

### Phase 6 — Scheduling + Unsplash (Day 20–22)

- [ ] Schedule resolution logic.
- [ ] Admin weekly-calendar UI.
- [ ] Unsplash Mood Mode.

**Exit criteria:** you can set "Mondays 6–9 AM = Family album with slideshow grid mode" and it just works.

### Phase 7 — Polish + offline (Day 23–25)

- [ ] PWA manifest, service worker, cache rules.
- [ ] Pre-warm cache logic.
- [ ] Performance pass on the Samsung phone.
- [ ] Easel mode (after you send the reference).

**Exit criteria:** unplug WiFi and the TV keeps showing photos.

### Phase 8 — Daily-driver soak (ongoing)

Use it. Note what's annoying. Fix.

---

## 18. Testing strategy

For a single-user personal product, exhaustive test coverage is overkill. But these tests are worth writing:

### 18.1 Unit tests (Vitest)

- `lib/theme/sun.ts` — sun time calculations against known dates and locations.
- `lib/scheduler/resolve.ts` — overnight ranges, day-of-week, priority resolution.
- `modes/clock-text/logic.ts` — every 5-minute interval in a day yields the right active words.
- `modes/slideshow-grid/layout.ts` — every n in [3, 4, 5, 6] returns a valid layout.

### 18.2 Integration tests

- The Drive sync pipeline against a test folder with known files.
- The Spotify now-playing proxy with a mocked Spotify response.

### 18.3 Manual smoke test before each phase ships

Run through:

1. Open /display on the Samsung. It loads in < 3 s.
2. Change mode from laptop. TV updates in < 1 s.
3. Pause from phone. TV pauses.
4. Disconnect WiFi. TV keeps cycling photos for at least 5 minutes.
5. Reconnect. New photos appear.

---

## 19. Risks & open questions

### 19.1 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Google Drive auth refresh fails silently | Medium | High | Daily background check, admin notification on failure |
| Samsung phone browser doesn't support some Framer Motion features | Medium | Medium | Test on the actual device early; have CSS-only fallbacks for transitions |
| Spotify revokes more endpoints | Low | Medium | We use the most fundamental endpoints; if they go, the mode degrades gracefully |
| Photos with EXIF rotation render sideways | Medium | Low | Auto-correct rotation during sync via `sharp` |
| Heat on the phone from continuous full-screen rendering | Medium | Medium | Dim mode, brightness cap, periodic 30-sec black-screen refresh |
| Unsplash demo limit hit | Low | Low | Aggressive cache; apply for production |
| SW cache fills the phone's storage | Medium | Medium | LRU eviction policy in Workbox (5000 photos max) |
| Sleep / lockscreen kicks in on the Samsung | High | High | Use WakeLock API; document Samsung's "stay awake while charging" dev setting |

### 19.2 Open questions for Nana

1. **Domain.** Hosting on `frametv.sorotech.io`? Or under your existing domain?
2. **Easel mode reference.** Send the repo when you find it.
3. **iPhone admin.** Do you want a separate native shortcut for "switch to Family album right now," or is a bookmarked admin page enough?
4. **Multi-TV.** Stays out of scope, right? Single display device?
5. **Photos in videos.** Do you want short video clips in the slideshow too? Drive supports it. Adds complexity (autoplay, mute, looping).
6. **Backup of the admin DB.** Supabase daily backups are paid. Worth it for the schedule/album metadata, or are we fine with re-creating from Drive if disaster hits?

---

## 20. Appendix A — Environment variables

```bash
# .env.local.example

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Google (Drive + Picker + OAuth)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=https://frametv.example.com/api/auth/google/callback

# Spotify
SPOTIFY_CLIENT_ID=xxxxx
SPOTIFY_CLIENT_SECRET=xxxxx
SPOTIFY_REDIRECT_URI=https://127.0.0.1:3000/api/auth/spotify/callback

# Unsplash
UNSPLASH_ACCESS_KEY=xxxxx
UNSPLASH_SECRET_KEY=xxxxx

# App
NEXT_PUBLIC_APP_URL=https://frametv.example.com
DISPLAY_TOKEN=random_32_char_token_for_display_url
```

---

## 21. Appendix B — Library inventory

Final dependency list to install in one go:

```bash
pnpm add next@latest react@latest react-dom@latest
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add framer-motion gsap
pnpm add zustand @tanstack/react-query
pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-tooltip
pnpm add lucide-react clsx tailwind-merge
pnpm add googleapis google-auth-library
pnpm add suncalc
pnpm add fast-average-color
pnpm add date-fns
pnpm add react-aria-components
pnpm add @dnd-kit/core @dnd-kit/sortable

pnpm add -D typescript @types/node @types/react @types/react-dom
pnpm add -D tailwindcss @tailwindcss/postcss @tailwindcss/typography
pnpm add -D vitest @testing-library/react @testing-library/jest-dom happy-dom
pnpm add -D @ducanh2912/next-pwa
pnpm add -D eslint eslint-config-next
pnpm add -D prettier prettier-plugin-tailwindcss
```

---

## 22. Appendix C — Drive folder convention

Lock this in upfront so the sync code can be dead simple:

```
Drive/
  FrameTV/
    Family/                 ← becomes album "Family"
      cover.jpg             ← optional, becomes album cover
      img-001.jpg
      img-002.heic
    Friends/
    Graduation/
    Throwbacks/
    Monday Morning/         ← spaces allowed
    Evening Calm/
    _archived/              ← folders prefixed with _ are skipped
```

Rules the sync code enforces:

- A file named `cover.jpg` (or `.png`, `.heic`) inside an album folder is treated as that album's cover photo.
- Folders starting with `_` are ignored.
- Nested folders deeper than 1 level are flattened into the album they sit in.
- HEIC files are converted to JPEG during caching (using `sharp` server-side).

---

## 23. Appendix D — Quick links to source references

- **FlipOff** (split-flap): https://github.com/magnum6actual/flipoff
- **Text Clock** (your repo): https://github.com/nanadotam/text-clock-by-nanaamoako
- **iPod Classic JS** (cover flow): https://github.com/tvillarete/ipod-classic-js
- **Google Photos API updates** (the bad news): https://developers.google.com/photos/support/updates
- **Google Photos Picker API**: https://developers.google.com/photos/picker
- **Google Drive API v3**: https://developers.google.com/drive/api/v3/about-sdk
- **Spotify Web API — Currently Playing**: https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track
- **Spotify Nov 2024 deprecation notice**: https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api
- **Unsplash API docs**: https://unsplash.com/documentation
- **Unsplash API Guidelines**: https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines
- **SunCalc**: https://github.com/mourner/suncalc
- **Workbox**: https://developer.chrome.com/docs/workbox
- **`@ducanh2912/next-pwa`**: https://github.com/DuCanhGH/next-pwa

---

## 24. Closing note

This document captures every feature you described, with the architecture, schema, code snippets, and phased plan to actually ship it. The biggest constraint to be aware of is Google Photos — the Library API is essentially gone for third-party apps, so the design routes around it via Drive (primary) and the Photos Picker (one-shot import). Everything else you asked for is straightforwardly buildable.

The phases are sized so you can take a week off (Fire Camp, graduation, NSS onboarding) without losing your place — each phase has a clean exit criterion you can return to.

When you're ready to start, the very first move is:

```bash
git clone <previous-photo-gallery-repo> frametv
cd frametv
bash scripts/clone-references.sh
```

Then we onboard Supabase and you're off.

Chale, ready when you are.

— *End of PRD v1.0*
