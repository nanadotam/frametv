import type { Icon } from '@phosphor-icons/react';
import {
  Image as ImageIcon, GridFour, Columns, PushPin, FilmStrip, Disc, VinylRecord, Clock,
  Mountains, BookOpenText, Megaphone, PencilLine, CheckSquare,
} from '@phosphor-icons/react';
import type { TileTone } from '@/components/m/List';

export type LookGroup = 'photos' | 'clocks' | 'music' | 'notes';

export const LOOK_GROUPS: { id: LookGroup; label: string; blurb: string }[] = [
  { id: 'photos', label: 'Photos & Video', blurb: 'Your albums, laid out beautifully' },
  { id: 'clocks', label: 'Clocks & Calm', blurb: 'Ambient screens for any room' },
  { id: 'music', label: 'Music', blurb: 'Whatever is playing on Spotify' },
  { id: 'notes', label: 'Notes & Boards', blurb: 'Messages, reminders and to-dos' },
];

export interface Look {
  id: string;
  name: string;
  blurb: string;
  group: LookGroup;
  icon: Icon;
  tone: TileTone;
  /** Works on older smart-TV browsers (the /tv renderer). */
  tvSafe?: boolean;
}

export const LOOKS: Look[] = [
  { id: 'slideshow-single', name: 'Slideshow', blurb: 'One photo at a time, softly crossfading', group: 'photos', icon: ImageIcon, tone: 'ember', tvSafe: true },
  { id: 'slideshow-grid', name: 'Gallery Wall', blurb: 'A mosaic that changes one tile at a time', group: 'photos', icon: GridFour, tone: 'orange', tvSafe: true },
  { id: 'pinterest', name: 'Pinboard', blurb: 'Endless drifting columns of photos', group: 'photos', icon: Columns, tone: 'red', tvSafe: true },
  { id: 'scrapbook', name: 'Scrapbook', blurb: 'Polaroids taped and tossed across the screen', group: 'photos', icon: PushPin, tone: 'pink' },
  { id: 'video', name: 'Video Loops', blurb: 'Silent clips from your video albums', group: 'photos', icon: FilmStrip, tone: 'purple' },
  { id: 'clock-text', name: 'Clock', blurb: 'A big, quiet clock', group: 'clocks', icon: Clock, tone: 'gray', tvSafe: true },
  { id: 'unsplash-mood', name: 'Mood', blurb: 'Curated scenery that matches a feeling', group: 'clocks', icon: Mountains, tone: 'teal' },
  { id: 'scripture', name: 'Verse', blurb: 'Verse of the day over calm scenery', group: 'clocks', icon: BookOpenText, tone: 'indigo', tvSafe: true },
  { id: 'vinyl', name: 'Vinyl', blurb: 'A spinning record of what you are playing', group: 'music', icon: VinylRecord, tone: 'pink', tvSafe: true },
  { id: 'coverflow', name: 'Cover Flow', blurb: 'Album covers in 3D', group: 'music', icon: Disc, tone: 'blue', tvSafe: true },
  { id: 'flipboard', name: 'Flip Board', blurb: 'A split-flap board for messages', group: 'notes', icon: Megaphone, tone: 'yellow' },
  { id: 'easel', name: 'Easel', blurb: 'Hand-lettered rotating notes', group: 'notes', icon: PencilLine, tone: 'green' },
  { id: 'eisenhower', name: 'Priorities', blurb: 'Your to-dos in four quadrants', group: 'notes', icon: CheckSquare, tone: 'blue' },
];

export const LOOK_BY_ID: Record<string, Look> = Object.fromEntries(LOOKS.map((l) => [l.id, l]));

export function lookName(id: string | null | undefined) {
  return (id && LOOK_BY_ID[id]?.name) || 'Nothing yet';
}

/** Looks that read from albums (so the album picker matters). */
export const ALBUM_LOOKS = new Set(['slideshow-single', 'slideshow-grid', 'pinterest', 'scrapbook', 'video']);

/** Small illustrated thumbnail of each look — pure CSS, works in light and dark. */
export function LookArt({ id, className = '' }: { id: string; className?: string }) {
  const base = `relative overflow-hidden ${className}`;
  const sunset = 'linear-gradient(180deg,#3b2a6b 0%,#c24d86 55%,#ffb16b 100%)';
  const sea = 'linear-gradient(200deg,#9fd7f5 0%,#3e8fc9 50%,#123a63 100%)';
  const forest = 'linear-gradient(180deg,#1f3b2c 0%,#3f7a52 60%,#a8d08d 100%)';
  const peach = 'linear-gradient(160deg,#ffcf9f 0%,#ff8a65 60%,#c2185b 100%)';
  const tiles = [sunset, sea, forest, peach, sea, sunset];

  switch (id) {
    case 'slideshow-single':
      return (
        <div className={base} style={{ background: sunset }}>
          <div className="absolute left-1/2 top-[52%] h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffd98a] opacity-90" />
          <div className="absolute -bottom-[20%] -left-[10%] h-[50%] w-[120%] rounded-[50%] bg-[#3a1840]" />
        </div>
      );
    case 'slideshow-grid':
      return (
        <div className={`${base} grid grid-cols-3 grid-rows-2 gap-[3px] bg-black p-[3px]`}>
          {tiles.map((t, i) => <div key={i} className="rounded-[3px]" style={{ background: t }} />)}
        </div>
      );
    case 'pinterest':
      return (
        <div className={`${base} flex gap-[3px] bg-[#111] p-[3px]`}>
          {[0, 1, 2].map((c) => (
            <div key={c} className="flex flex-1 flex-col gap-[3px]" style={{ marginTop: c === 1 ? -14 : c === 2 ? -6 : 0 }}>
              {[0, 1, 2].map((r) => (
                <div key={r} className="rounded-[4px]" style={{ background: tiles[(c + r * 2) % 6], height: [38, 26, 32][(c + r) % 3] }} />
              ))}
            </div>
          ))}
        </div>
      );
    case 'scrapbook':
      return (
        <div className={base} style={{ background: '#e9dcc7' }}>
          {[[18, 16, -8, sunset], [48, 26, 6, sea], [30, 48, -3, forest]].map(([l, t, r, bg], i) => (
            <div key={i} className="absolute bg-white p-[3px] pb-[9px] shadow-md" style={{ left: `${l}%`, top: `${t}%`, width: '36%', transform: `rotate(${r}deg)` }}>
              <div className="aspect-square" style={{ background: bg as string }} />
            </div>
          ))}
        </div>
      );
    case 'video':
      return (
        <div className={base} style={{ background: sea }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/30 backdrop-blur">
              <div className="ml-1 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-white" />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[6px] bg-black/30"><div className="h-full w-2/5 bg-white/80" /></div>
        </div>
      );
    case 'clock-text':
      return (
        <div className={`${base} flex flex-col items-center justify-center bg-[#0c0c0e] text-white`}>
          <span className="text-[30px] font-semibold leading-none tracking-tight tabular-nums">9:41</span>
          <span className="mt-1 text-[9px] uppercase tracking-[0.2em] text-white/60">Sunday</span>
        </div>
      );
    case 'unsplash-mood':
      return (
        <div className={base} style={{ background: forest }}>
          <div className="absolute bottom-0 left-[8%] h-0 w-0 border-x-[34px] border-b-[56px] border-x-transparent border-b-[#1b2e22]" />
          <div className="absolute bottom-0 right-[10%] h-0 w-0 border-x-[28px] border-b-[44px] border-x-transparent border-b-[#24402e]" />
        </div>
      );
    case 'scripture':
      return (
        <div className={`${base} flex items-center justify-center px-4 text-center`} style={{ background: 'linear-gradient(180deg,#26324d,#6b5b7b)' }}>
          <p className="font-serif text-[11px] italic leading-snug text-white/90">“Be still, and know…”</p>
        </div>
      );
    case 'vinyl':
      return (
        <div className={`${base} flex items-center justify-center`} style={{ background: peach }}>
          <div className="relative h-[70%] aspect-square rounded-full bg-[#111] shadow-lg" style={{ backgroundImage: 'repeating-radial-gradient(circle,#111 0 2px,#1d1d1d 2px 4px)' }}>
            <div className="absolute inset-[34%] rounded-full bg-[#ff7a3d]" />
          </div>
        </div>
      );
    case 'coverflow':
      return (
        <div className={`${base} flex items-center justify-center gap-1 bg-[#0c0c0e] [perspective:200px]`}>
          {[sea, sunset, peach].map((bg, i) => (
            <div key={i} className="h-[54%] aspect-square rounded-[3px]" style={{ background: bg, transform: i === 1 ? 'scale(1.15)' : `rotateY(${i === 0 ? 40 : -40}deg)` }} />
          ))}
        </div>
      );
    case 'flipboard':
      return (
        <div className={`${base} flex flex-col items-center justify-center gap-[3px] bg-[#141414]`}>
          {['HELLO', 'HOME!'].map((w) => (
            <div key={w} className="flex gap-[2px]">
              {w.split('').map((ch, i) => (
                <span key={i} className="flex h-[18px] w-[14px] items-center justify-center rounded-[2px] bg-[#2a2a2a] font-mono text-[11px] font-bold text-[#ffd60a]">{ch}</span>
              ))}
            </div>
          ))}
        </div>
      );
    case 'easel':
      return (
        <div className={`${base} flex items-center justify-center bg-[#f6efe2]`}>
          <p className="rotate-[-3deg] font-serif text-[15px] italic text-[#3a2a1a]">dinner at 7 ♡</p>
        </div>
      );
    case 'eisenhower':
      return (
        <div className={`${base} grid grid-cols-2 grid-rows-2 gap-[3px] bg-[#111] p-[3px]`}>
          {['#e53935', '#fbc02d', '#1e88e5', '#43a047'].map((c) => (
            <div key={c} className="rounded-[3px] p-1" style={{ background: `${c}33` }}>
              <div className="h-[3px] w-3/4 rounded" style={{ background: c }} />
              <div className="mt-1 h-[3px] w-1/2 rounded" style={{ background: c }} />
            </div>
          ))}
        </div>
      );
    default:
      return <div className={base} style={{ background: sunset }} />;
  }
}
