# FrameTV Admin UI/UX Analysis

## What the Admin Panel Is

The admin panel is a **TV remote** accessed from a phone. Its primary job is:
1. Quick-switch what's on the TV right now (mode, album)
2. Control playback (pause, next, brightness)
3. Configure stuff less often (schedules, mode settings, integrations)

This framing matters — everything should be evaluated against "how fast can someone do this one-handed while standing across the room?"

---

## The Big Problems

### 1. Dual Design System — Only One Is Used

There are two separate component/style systems and they don't agree with each other:

| System | Files | Tokens | Status |
|--------|-------|--------|--------|
| **Custom admin components** | `src/components/admin/` | `bg-accent`, `text-fg`, `bg-bg-card` (tailwind.config.ts custom tokens) | **Not used in pages** |
| **shadcn/ui components** | `src/components/ui/` | `bg-primary`, `text-foreground`, CSS vars | **Actually used in all pages** |

The `src/components/admin/Button.tsx` has a beautiful ripple effect, proper min touch targets (h-10/h-12/h-14), and mobile-first sizing. The `src/components/admin/TabBar.tsx` has a cleaner sidebar implementation. **None of this is wired up.**

The actual layout (`src/app/(admin)/layout.tsx`) rolls its own nav inline and uses shadcn components throughout. The `admin/` component folder is dead code that represents an earlier (and in some ways better) design direction.

**Decision needed**: consolidate on one system. The shadcn system is further along and has more coverage — the right move is to port the good ideas from `admin/` (ripple button, touch sizing, active indicator dots) into the pages using shadcn patterns.

### 2. Six-Item Bottom Nav Is Too Many

The mobile bottom nav has 6 items at `text-[9px]` font. This is cramped and hard to tap accurately. Standard mobile conventions cap at 5.

Current items: `Now Playing | Albums | Schedule | Modes | FlipBoard | System`

The rarely-used ones (Schedule, FlipBoard inner sections) shouldn't be top-level tabs. The admin `TabBar.tsx` component (unused) made the right call by only including 5 — and it excluded FlipBoard from the primary nav.

### 3. Settings Page Has Two Save Buttons (Confusing)

The Settings page has:
- A "Save Clock Settings" button inside the Clock Overlay card
- A "Save Settings" button at the bottom for Location + Auto Theme + Night Dim

These are separate API calls (`clock_overlay` vs `app_settings` keys), but from a user's perspective it's confusing. Why does this section save but that one needs its own button? Feels broken.

**Pattern to adopt**: either auto-save on change (debounced), or group settings into one form with one save.

### 4. No Confirmation on Destructive Actions

`deleteAlbum`, `deleteSchedule`, and `deleteReminder` fire immediately on button click. No confirm dialog, no undo. For albums especially (which take time to re-import from Drive), this is a bad experience.

### 5. The FlipBoard Page Is Too Dense for Mobile

FlipBoard currently combines three distinct features on one page:
- Content Sources (toggle switches)
- Eisenhower Reminders matrix (2×2 grid, 4 input forms)
- Live Messages (compose + history)

On mobile this means scrolling through ~3 full screens to reach Live Messages (the most action-oriented section). The Eisenhower matrix on a small phone is especially cramped — a 2-column grid of task lists each with an input.

---

## What's Working Well

### Mode Switcher Grid (Now Playing page)
The 4-column emoji grid with scale-on-hover, active ring, and dot indicator is exactly right for a TV remote pattern. Quick to scan, quick to tap. The only tweak needed: on very small phones (375px), 4 columns becomes ~80px per cell which is under the 48px minimum comfortable touch target when you account for text below the emoji.

### Playback Controls
The `h-14` Play/Pause button and `h-12` Prev/Next buttons are appropriately large. The color change (green=resume, yellow=pause) gives instant visual state. This section is the closest to "TV remote done right" in the whole app.

### Card-Based Layout with Status Indicators
The status badges (Live/Paused, Connected/No DB, Active/Disabled) using colored outline variants are clean and consistent. The pattern of a status indicator in the header of a card works well.

### Pill-Toggle Pattern for Multi-Select
The days-of-week picker in Schedule and the source toggle in FlipBoard use `rounded-full` pill buttons with `bg-primary` when selected. This is the right pattern for multi-select on mobile — much better than checkboxes.

### Skeleton Loading States
All list pages have consistent `animate-pulse` skeleton placeholders. Good pattern, well-applied.

### Active Album Callout
The golden `bg-primary/10 border-primary/20` banner "X albums currently showing on TV" gives immediate feedback about TV state without the user needing to cross-reference.

---

## Navigation Restructure Recommendation

### Current structure (flat, 6 tabs):
```
Now Playing | Albums | Schedule | Modes | FlipBoard | System
```

### Proposed structure (5 tabs, re-grouped):
```
Remote | Albums | Content | Modes | Settings
```

Where:
- **Remote** = current Now Playing (quick controls, mode switch, brightness)
- **Albums** = same as now
- **Content** = FlipBoard + Reminders merged (they're already on the same page), renamed to convey "stuff on the board"
- **Modes** = same as now
- **Settings** = Schedule + System merged — or Schedule lives under Modes since it's mode-scheduling

**Alternative — keep 6 but fix spacing**: If all 6 must stay top-level, use icon-only on mobile (drop labels, increase icon size to 22px), with a small active dot indicator below. The label at `text-[9px]` is borderline illegible.

---

## Admin Page (Now Playing) — Remote-Optimized Redesign Notes

This page is the most important one. It should feel like picking up a remote. Current gaps:

1. **No live photo preview** — a small thumbnail of what's currently showing on the TV would make it feel connected. Even a blurred/small 160×90 thumbnail from the current photo would be powerful.

2. **Mode switcher too small on phone** — 4 columns × 9 items = cells that may be under 48px wide on 375px screens. Consider 3 columns on mobile, 4-5 on larger.

3. **Brightness slider is hard to drag accurately on touch** — the slider track is `w-full` with no min-height on the thumb. Consider a larger step (5%) and a +/- button pair for coarse adjustment, or a taller track.

4. **Header status chip is tiny** — the `Live / No DB` chip in the top-right uses `text-xs` and `px-3 py-1.5`. Fine for desktop but easy to miss at a glance on mobile.

5. **Quick album switcher is missing** — the Now Playing page shows which albums are active but doesn't let you quickly toggle them. You have to navigate to Albums. This is the most common action ("show me the family photos" → "show me the holiday ones") and it requires a tab switch.

---

## Settings Page Restructure

Break the current Settings page into logical groups, each auto-saving or with a single grouped save:

```
Settings
├── Display Behavior
│   ├── Auto Theme (toggle) — auto-save
│   ├── Night Dim (toggle + times) — auto-save
│   └── Brightness default — auto-save
├── Clock Overlay
│   ├── Enabled (toggle)
│   ├── Position (2×2 grid)
│   └── Font (list) — auto-save on any change
├── Location
│   ├── Lat/Long inputs
│   └── [Save Location] single button
└── Integrations (separate card, already good)
    ├── Spotify connect/disconnect
    ├── Google API key
    └── Unsplash key status
```

**Key change**: toggles should auto-save (optimistic update + background PATCH) — no button needed. Only free-text inputs (lat/lng, API key) need an explicit save.

---

## Component Patterns to Standardize

### Touch Targets
All interactive elements should be minimum 44×44px on mobile. Current violations:
- Ghost action buttons in album cards: `h-9 w-9 p-0` (36px) — too small
- Delete/edit icon buttons in schedule list: `h-8 w-8 p-0` (32px) — too small
- The eye/trash icons in reminder list items: `size={12}` icons with no padding wrapper

**Fix**: ghost icon buttons should use `h-11 w-11` on mobile, achieved via `min-[768px]:h-8 min-[768px]:w-8`.

### Confirmation Pattern for Destructive Actions
Albums and Schedules need a confirm step. Simplest approach: inline — clicking delete changes button to a red "Confirm?" state for 3s, then reverts. Avoids a modal for a simple delete.

```
[Delete] → click → [Are you sure?] (3s timeout) → click again → deleted
           OR                                       wait 3s → back to [Delete]
```

### Auto-Save Toggle Pattern
For boolean settings, apply immediately with an optimistic update + silent background save. Show a brief "Saved" toast only on error. This removes all the `saving`/`saved` state complexity from toggle switches.

### Page Header Pattern (Consistent)
Every page uses the same header block but with slight variations. Standardize to:
```tsx
<div className="flex items-start justify-between pt-2 mb-6">
  <div>
    <h1 className="text-xl font-bold tracking-tight">{title}</h1>
    <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
  </div>
  {action && <div className="flex gap-2 shrink-0">{action}</div>}
</div>
```
Note: `text-2xl` on mobile is large — `text-xl` is more appropriate for mobile screens and matches the "remote" aesthetic better.

---

## Mobile-First Checklist for Admin Pages

- [ ] All tap targets ≥ 44px height
- [ ] Bottom nav ≤ 5 items
- [ ] Single save button per logical form (or auto-save toggles)
- [ ] Confirm step on destructive actions
- [ ] Mode switcher: 3 cols on mobile, 4+ on md+
- [ ] FlipBoard: tabbed or sectioned so Live Messages is reachable without 3 screens of scroll
- [ ] Now Playing: quick album toggle inline (most common remote action)
- [ ] Settings: auto-save toggles, group text inputs with single save

---

## Now Playing — Shortcut Surface (Remote Control Shortcuts)

The Now Playing page is open most of the time when someone is using the admin as a remote. But the most common follow-up actions after switching a mode require navigating away entirely. Every nav-away is friction — especially if you're standing, phone in one hand, trying to tweak the TV.

The fix: a **contextual shortcut drawer** that appears below the active mode card showing the 2-3 most relevant controls for whatever mode is currently active. No navigation, no modal hunting.

### Shortcut Map by Mode

| Active Mode | Shortcut Controls to Surface |
|-------------|-------------------------------|
| **Slideshow** | Interval (30s/1m/2m/5m/10m chip row) · Transition (fade/slide/blur) · Shuffle toggle |
| **Grid** | Interval chip row · Shuffle toggle |
| **Pinterest** | Scroll speed (0.25×/0.5×/1×/2× chips) · Rows (2/3/4 chips) · Direction toggle |
| **Clock** | Theme (dark/light/nude/cream chips) · Font size slider |
| **FlipBoard** | Quick message input (send directly to board) · Sources summary |
| **Mood (Unsplash)** | Mood/keyword input · Interval slider |
| **Easel** | Interval slider |
| **Cover Flow** | No runtime config — show "no settings" gracefully |
| **Eisenhower** | No runtime config — link to Reminders |

### Album Quick-Toggle (All Modes)

Below the status card, always show a horizontal scrollable row of album pills:

```
[ Family Photos ✓ ]  [ Holidays ]  [ Architecture ]  [ + Add Album ]
```

Active albums are filled (bg-primary), inactive are outlined. Tapping toggles instantly and patches `active_album_ids` — same API call that the Albums page already makes. This is the #1 most common remote action that currently requires a full page switch.

### Shortcut Drawer — Interaction Pattern

The drawer should be:
- **Collapsed by default** when the mode has no live config (Cover Flow, Eisenhower)
- **Expanded by default** when the mode has quick-tweakable settings
- A single `<details>` / accordion section directly under the Status Card, labeled "Quick Settings" with the active mode name
- Changes apply immediately (optimistic update → PATCH `modes/{id}/config`) — no Save button
- On mobile: the controls stack vertically with large tap targets; on desktop: they can go horizontal

### What Belongs in the Shortcut Drawer vs the Modes Page

The line is: **runtime tweaks** (things you change while watching) go in the drawer; **setup-time config** (things you set once) stays in Modes.

| Control | Where |
|---------|-------|
| Interval (how fast photos change) | **Drawer** — you tune this while watching |
| Transition style | **Drawer** — quick vibe change |
| Shuffle | **Drawer** — toggle on the fly |
| Scroll speed (Pinterest) | **Drawer** — tune while watching |
| Clock font size | **Drawer** — aesthetic tweak while watching |
| Clock position | Modes page — set-and-forget |
| Easel texts (edit the messages) | Modes page — content editing |
| FlipBoard sources on/off | Modes page — configuration |
| Quick FlipBoard message send | **Drawer** — live action |
| Unsplash mood keyword | **Drawer** — often changed per session |

### Schedule Shortcut

Add a single "Schedule" row in the status card area showing the next active schedule (if any):

```
[Clock icon]  Morning Routine  08:00–10:00  [toggle on/off]
```

This lets someone instantly disable a schedule that kicked in unexpectedly without navigating to the Schedule page. Just a PATCH `schedules/{id}` with `is_enabled: false`.

### Clock Overlay Shortcut

The clock overlay (show/hide clock on display) is buried in Settings > Clock Overlay. It's something people toggle often ("turning off for a movie night"). Add a single toggle row to the bottom of the Status Card:

```
[Clock icon]  Clock overlay  [switch]
```

One PATCH to `/api/settings` with `key: clock_overlay, value: { ...current, enabled: !current.enabled }`.

### FlipBoard Message Shortcut (When FlipBoard Mode is Active)

When the active mode is FlipBoard, surface a minimal compose input directly on the Now Playing page:

```
[  Type a message…  ]  [Send ↑]
```

This is the most action-oriented thing on the FlipBoard page (sending a message to the TV right now) and it currently requires a full tab switch. It's a single POST to `/api/flipboard/messages`.

### Now Playing Page Layout — Proposed Order After Shortcuts

```
1. Header (Now Playing · Live indicator)
2. ──── Status Card ────
     Mode + Albums grid
     Clock overlay toggle row
     Next schedule row (if any)
3. ──── Album Quick-Toggle ────
     Horizontal scroll of album pills
4. ──── Mode Switcher Grid ────
     3 cols mobile / 4 cols md+
5. ──── Quick Settings Drawer ────  ← NEW
     Contextual controls for active mode
     (FlipBoard: compose input)
6. ──── Playback Controls ────
     Play/Pause · Prev · Next
7. ──── Brightness ────
     Slider
```

This ordering puts the most-used remote actions (mode switch, album toggle) near the top, with contextual settings for the current mode right below before less-common playback controls.

---

## Quick Wins (Low-Effort, High-Impact)

1. **Increase ghost button size** — `h-8 w-8` → `h-10 w-10` on all icon-only buttons. One class change per instance.
2. **Inline album toggle on Now Playing** — add a small horizontal scroll row of album pill-toggles below the Status Card. Mirrors the active album display already there.
3. **Auto-save for Switch components** — remove explicit Save buttons from Auto Theme, Night Dim, Clock Enabled. Just call the API in `onCheckedChange`.
4. **Merge the two save buttons on Settings** — save Location + Auto Theme + Night Dim in one call, triggered by one button.
5. **Bottom nav icon size** — increase from `size={17}` to `size={20}`, drop label font from `text-[9px]` to nothing (icon-only) if keeping 6 items, or drop to 5 items and restore `text-[10px]` labels.
6. **Delete confirmation inline** — two-tap delete for albums and schedules. No modal needed.
