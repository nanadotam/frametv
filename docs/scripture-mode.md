# Scripture Mode — Design Document

## What It Is

A dedicated TV display mode that shows the Bible Verse of the Day (VOTD) in a cinematic, full-screen 16:9 layout. The verse rotates daily (auto-refreshes at midnight) and sits over a beautiful background image. Built for believers who want their TV to reflect their faith when it's not showing photos.

---

## Data Sources

### Verse Text

**Primary: `labs.bible.org` (NET Bible)**
```
GET https://labs.bible.org/api/?passage=votd&type=json
```
- No API key required
- Returns the same verse all day (genuinely curated daily by Bible.org)
- Response: `[{ bookname, chapter, verse, text }]`
- Translation: NET Bible (New English Translation) — modern, readable

**Fallback: Our Manna**
```
GET https://beta.ourmanna.com/api/v1/get?format=json&order=daily
```
- No API key required
- Returns `{ verse: { details: { text, reference, version } } }`
- Multiple translations available

### Background Images

No external API for pre-composed scripture images at 16:9 exists freely.

**Approach: Unsplash (already integrated)**
- The app already has an Unsplash integration (`/api/unsplash`)
- Query a curated set of moods: `sunrise`, `nature`, `mountains`, `light`, `cross`, `clouds`, `forest`, `ocean`
- Rotate background daily (seeded by date so it's consistent for the day)
- We already have the Unsplash API key + proxy set up — zero additional cost

**Alternative (no extra API call): Static background pack**
- Bundle 10-15 high-res 16:9 landscape/nature images in the repo under `public/scripture-bg/`
- Deterministically pick one per day: `dayOfYear % imageCount`
- Zero API dependency, instant load, offline-safe

**Recommendation: Start with static pack, add Unsplash mood fetch as enhancement**

---

## Display Layout (16:9 TV canvas)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│          [Background photo — full bleed, slight dark overlay]           │
│                                                                          │
│                                                                          │
│            ┌─────────────────────────────────────────────┐              │
│            │                                             │              │
│            │   "For God so loved the world, that he      │              │
│            │    gave his only Son, that whoever           │              │
│            │    believes in him should not perish         │              │
│            │    but have eternal life."                   │              │
│            │                                             │              │
│            │              — John 3:16 (NET)              │              │
│            └─────────────────────────────────────────────┘              │
│                                                                          │
│  [thin cross icon, top-left corner, ~32px]                              │
│                                                    [Unsplash credit]    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Typography

| Element         | Style                                         |
|----------------|-----------------------------------------------|
| Verse text      | Large serif (e.g. `Georgia`, or Playfair Display via Google Fonts) |
| Reference       | Smaller, lighter weight, letter-spaced        |
| Both            | White, with subtle text-shadow for legibility |

### Visual Treatment

- Full-bleed background photo
- Gradient overlay: `radial-gradient` darkening center slightly, or bottom-fade
- Frosted glass panel behind the text (optional — `backdrop-filter: blur(12px)` + `bg-white/10`)
- Fade-in animation on load (same Framer Motion pattern as other modes)
- Optional: subtle particle or shimmer animation (keep it optional, off by default)

---

## Config Options (admin panel)

| Option             | Type              | Default        | Description                                  |
|--------------------|-------------------|----------------|----------------------------------------------|
| `translation`      | `select`          | `NET`          | Bible translation (NET, KJV, WEB, ESV*)      |
| `bgStyle`          | `select`          | `photo`        | Background style: `photo`, `gradient`, `dark`|
| `bgMood`           | `select`          | `nature`       | Unsplash mood keyword for background         |
| `showCross`        | `boolean`         | `true`         | Show small cross icon watermark              |
| `fontFamily`       | `select`          | `Georgia`      | Serif font for verse text                    |
| `fontSize`         | `slider`          | `40`           | Base font size (px)                          |
| `autoRefresh`      | `boolean`         | `true`         | Auto-refresh verse at midnight               |

> *ESV requires a free API key from crossway.org — skip for now, add later if requested

---

## API Route to Add

**`/api/scripture`** — server-side proxy (avoids CORS, caches for 24h)

```ts
// src/app/api/scripture/route.ts
// GET /api/scripture?translation=NET
// Fetches VOTD from labs.bible.org, returns { text, reference, book, chapter, verse }
// Cache-Control: max-age=3600, stale-while-revalidate=86400
```

Why proxy it server-side:
- Avoids CORS issues in the browser
- Can cache the response in Next.js fetch cache for the day
- Easy to swap data source without changing the mode component

---

## File Structure

```
src/
  modes/
    scripture/
      ScriptureMode.tsx          ← main display component
      ScriptureConfig.tsx        ← admin config panel component
      constants.ts               ← gradient presets, font options
  app/
    api/
      scripture/
        route.ts                 ← server-side VOTD proxy
public/
  scripture-bg/
    01.jpg … 12.jpg              ← static background photos (1920×1080)
```

---

## Implementation Steps (in order)

1. **Add `/api/scripture` route** — fetch from labs.bible.org, parse, return clean JSON, set cache headers
2. **Add static background images** to `public/scripture-bg/` (12 images, 1920×1080)
3. **Build `ScriptureMode.tsx`** — fetch verse on mount, pick bg by day, render layout
4. **Build `ScriptureConfig.tsx`** — config panel for admin/modes page
5. **Register in `modes/index.ts`** — add `'scripture'` to `MODES`
6. **Add `'scripture'` to `ModeId`** union in `types.ts`
7. **Wire config UI** in `(admin)/admin/modes/page.tsx`

---

## Open Questions / Future Ideas

- **YouVersion images**: Register a free dev token → fetch official VOTD image (square, but still good). Could layer it as an option.
- **Verse cycling**: Should the mode cycle through a few related verses throughout the day, or stay fixed on VOTD? Fixed is simpler and intentional.
- **Translation selector**: NET is great but some users may want KJV for tradition. Easy to add Our Manna as fallback with a translation param.
- **Audio**: Could read the verse aloud via Web Speech API (accessibility / devotional use). Out of scope for now.
- **Daily notification**: Push a reminder to check the TV in the morning. Out of scope.
- **Multiple verses**: Carousel mode — show 3-4 themed verses that rotate, not just VOTD. Could be a separate mode or a config toggle.

---

## Effort Estimate

| Task                          | Estimate |
|-------------------------------|----------|
| API route + caching           | ~30 min  |
| Static bg images (sourcing)   | ~20 min  |
| ScriptureMode component       | ~1.5 hr  |
| Admin config UI               | ~45 min  |
| Register + wire up            | ~15 min  |
| **Total**                     | **~3.5 hrs** |
