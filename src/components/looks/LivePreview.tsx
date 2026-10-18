'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { SHOWCASE, photo } from '@/lib/showcase';
import { cn } from '@/lib/utils';

/**
 * A few seconds of each look, playing on a loop with sample photos, so
 * people can see what a look does before choosing it. Animations only run
 * while the preview is on screen (and not at all with Reduce Motion).
 */

const P = SHOWCASE.map((p) => photo(p, 480, 360));
const SQ = SHOWCASE.map((p) => photo(p, 300, 300));

function usePlaying<T extends Element>() {
  const ref = useRef<T>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver(([e]) => setPlaying(e.isIntersecting && !reduce), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, playing };
}

function useTick(ms: number, playing: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms, playing]);
  return n;
}

function Img({ src, className, style }: { src: string; className?: string; style?: CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" draggable={false} className={cn('h-full w-full object-cover', className)} style={style} />;
}

function Slideshow({ playing }: { playing: boolean }) {
  const n = useTick(2600, playing);
  const order = [0, 5, 2, 12, 1];
  return (
    <>
      {order.map((i, k) => (
        <div key={i} className="absolute inset-0 transition-opacity duration-[1200ms]" style={{ opacity: k === n % order.length ? 1 : 0 }}>
          <Img src={P[i]} className="transition-transform duration-[4000ms] ease-out" style={{ transform: k === n % order.length ? 'scale(1.12)' : 'scale(1)' }} />
        </div>
      ))}
    </>
  );
}

function GalleryWall({ playing }: { playing: boolean }) {
  const n = useTick(1100, playing);
  const pool = [3, 7, 9, 13, 4, 11, 0, 5, 14, 2, 6, 8];
  const tiles = Array.from({ length: 6 }, (_, t) => pool[(t + Math.floor((n + (5 - t)) / 6) * 6) % pool.length]);
  const changing = n % 6;
  return (
    <div className="grid h-full grid-cols-3 grid-rows-2 gap-[3px] bg-black p-[3px]">
      {tiles.map((i, t) => (
        <div key={t} className="overflow-hidden rounded-[3px]">
          <Img key={i} src={SQ[i]} className={cn(t === changing && playing && 'animate-in fade-in-0 zoom-in-110 duration-700')} />
        </div>
      ))}
    </div>
  );
}

function Pinboard({ playing }: { playing: boolean }) {
  const cols = [[5, 10, 0, 13, 5, 10], [8, 12, 14, 3, 8, 12], [1, 6, 3, 9, 1, 6]];
  return (
    <div className="flex h-full gap-[4px] overflow-hidden bg-[#111] p-[4px]">
      {cols.map((col, c) => (
        <div
          key={c}
          className="flex flex-1 flex-col gap-[4px]"
          style={{ animation: playing ? `mantel-drift ${9 + c * 2}s linear infinite` : undefined, animationDirection: c === 1 ? 'reverse' : 'normal' }}
        >
          {col.map((i, r) => (
            <div key={r} className="shrink-0 overflow-hidden rounded-[5px]" style={{ height: `${[42, 30, 36][(c + r) % 3]}%` }}>
              <Img src={SQ[i]} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Scrapbook({ playing }: { playing: boolean }) {
  const n = useTick(1400, playing);
  const cards = [
    { i: 13, l: 8, t: 10, r: -9 },
    { i: 4, l: 44, t: 18, r: 7 },
    { i: 12, l: 24, t: 40, r: -3 },
    { i: 2, l: 56, t: 46, r: 11 },
  ];
  const shown = playing ? (n % (cards.length + 2)) + 1 : cards.length;
  return (
    <div className="absolute inset-0 bg-[#e9dcc7]">
      {cards.map((c, k) => (
        <div
          key={k}
          className="absolute bg-white p-[5px] pb-[16px] shadow-xl transition-all duration-500"
          style={{
            left: `${c.l}%`,
            top: `${c.t}%`,
            width: '34%',
            transform: `rotate(${c.r}deg) scale(${k < shown ? 1 : 1.4})`,
            opacity: k < shown ? 1 : 0,
          }}
        >
          <div className="aspect-square overflow-hidden">
            <Img src={SQ[c.i]} />
          </div>
          <div className="absolute -top-2 left-1/2 h-3 w-10 -translate-x-1/2 rotate-2 bg-[#f5e6a8]/80" />
        </div>
      ))}
    </div>
  );
}

function VideoLoops({ playing }: { playing: boolean }) {
  return (
    <>
      <Img src={P[14]} style={{ animation: playing ? 'mantel-pan 6s ease-in-out infinite alternate' : undefined }} />
      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/25">
        <div className="h-full bg-white" style={{ animation: playing ? 'mantel-progress 6s linear infinite' : undefined, width: playing ? undefined : '40%' }} />
      </div>
    </>
  );
}

function Clock({ playing, photoBg = false }: { playing: boolean; photoBg?: boolean }) {
  const tick = useTick(1000, playing);
  // Real time only in the browser (server and client clocks would differ).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), [tick]);
  if (!now) {
    return (
      <div className={cn('absolute inset-0 flex items-center justify-center text-white', !photoBg && 'bg-[#0c0c0e]')}>
        <span className="text-[clamp(28px,7cqw,64px)] font-semibold tabular-nums">9:41</span>
      </div>
    );
  }
  return (
    <div className={cn('absolute inset-0 flex flex-col items-center justify-center text-white', !photoBg && 'bg-[#0c0c0e]')}>
      {photoBg && <Img src={P[6]} className="absolute inset-0 brightness-[.55]" />}
      <span className="relative text-[clamp(28px,7cqw,64px)] font-semibold leading-none tracking-tight tabular-nums">
        {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/i, '')}
        <span className="text-white/50" style={{ opacity: now.getSeconds() % 2 ? 1 : 0.4 }}>·</span>
        <span className="text-[0.45em] text-white/60">{String(now.getSeconds()).padStart(2, '0')}</span>
      </span>
      <span className="relative mt-1.5 text-[10px] uppercase tracking-[0.22em] text-white/60">
        {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
      </span>
    </div>
  );
}

function Mood({ playing }: { playing: boolean }) {
  const n = useTick(3000, playing);
  const order = [6, 14, 8];
  return (
    <>
      {order.map((i, k) => (
        <div key={i} className="absolute inset-0 transition-opacity duration-[1500ms]" style={{ opacity: k === n % 3 ? 1 : 0 }}>
          <Img src={P[i]} style={{ animation: playing ? 'mantel-pan 9s ease-in-out infinite alternate' : undefined }} />
        </div>
      ))}
      <span className="absolute bottom-2 left-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">calm · ocean</span>
    </>
  );
}

function Verse({ playing }: { playing: boolean }) {
  const n = useTick(3500, playing);
  const verses = ['“Be still, and know that I am God.”', '“This is the day the Lord has made.”', '“Let all that you do be done in love.”'];
  return (
    <>
      <Img src={P[8]} className="brightness-[.45]" style={{ animation: playing ? 'mantel-pan 12s ease-in-out infinite alternate' : undefined }} />
      <div className="absolute inset-0 flex items-center justify-center px-5 text-center">
        <p key={n} className="animate-in fade-in-0 slide-in-from-bottom-1 font-serif text-[13px] italic leading-snug text-white duration-1000">{verses[n % 3]}</p>
      </div>
    </>
  );
}

function Vinyl({ playing }: { playing: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-4 bg-gradient-to-br from-[#ffcf9f] via-[#ff8a65] to-[#c2185b]">
      <div
        className="relative aspect-square h-[72%] rounded-full shadow-2xl"
        style={{
          backgroundImage: 'repeating-radial-gradient(circle,#111 0 2px,#1f1f1f 2px 4px)',
          animation: playing ? 'mantel-spin 3.4s linear infinite' : undefined,
        }}
      >
        <div className="absolute inset-[30%] overflow-hidden rounded-full">
          <Img src={SQ[10]} />
        </div>
      </div>
    </div>
  );
}

function CoverFlow({ playing }: { playing: boolean }) {
  const n = useTick(1600, playing);
  const covers = [3, 10, 5, 12, 13, 0];
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0c0c0e] [perspective:400px]">
      {[-2, -1, 0, 1, 2].map((off) => {
        const i = covers[(n + off + covers.length * 10) % covers.length];
        return (
          <div
            key={off}
            className="absolute aspect-square h-[52%] overflow-hidden rounded-[4px] shadow-xl transition-all duration-700"
            style={{
              transform: off === 0 ? 'translateX(0) scale(1.15)' : `translateX(${off * 34}%) rotateY(${off < 0 ? 50 : -50}deg) scale(.9)`,
              zIndex: 10 - Math.abs(off),
              filter: off === 0 ? undefined : 'brightness(.7)',
            }}
          >
            <Img src={SQ[i]} />
          </div>
        );
      })}
    </div>
  );
}

function FlipBoard({ playing }: { playing: boolean }) {
  const n = useTick(2400, playing);
  const lines = [['WELCOME', 'HOME!'], ['DINNER', 'AT 7'], ['LOVE', 'YOU']][n % 3];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4px] bg-[#141414]">
      {lines.map((w, r) => (
        <div key={r} className="flex gap-[3px]">
          {w.padEnd(7, ' ').split('').map((ch, i) => (
            <span
              key={`${n}-${r}-${i}`}
              className="flex h-[22px] w-[16px] items-center justify-center rounded-[2px] bg-[#2a2a2a] font-mono text-[13px] font-bold text-[#ffd60a] animate-in fade-in-0 slide-in-from-top-2"
              style={{ animationDelay: `${(r * 7 + i) * 40}ms`, animationFillMode: 'both' }}
            >
              {ch}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Easel({ playing }: { playing: boolean }) {
  const n = useTick(2800, playing);
  const notes = ['dinner at 7 ♡', 'you’ve got this!', 'call grandma'];
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#f6efe2]">
      <p key={n} className="rotate-[-3deg] font-serif text-[18px] italic text-[#3a2a1a] animate-in fade-in-0 duration-1000">{notes[n % 3]}</p>
    </div>
  );
}

function Priorities({ playing }: { playing: boolean }) {
  const n = useTick(900, playing);
  const quad = ['#e53935', '#fbc02d', '#1e88e5', '#43a047'];
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-[3px] bg-[#111] p-[3px]">
      {quad.map((c, q) => (
        <div key={c} className="space-y-1 rounded-[3px] p-1.5" style={{ background: `${c}2a` }}>
          {[0, 1, 2].map((k) => (
            <div
              key={k}
              className="h-[4px] rounded transition-all duration-500"
              style={{ background: c, width: `${[80, 55, 65][k]}%`, opacity: !playing || (n + q) % 4 >= k ? 1 : 0.15 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LivePreview({ id, className = '' }: { id: string; className?: string }) {
  const { ref, playing } = usePlaying<HTMLDivElement>();
  const body = (() => {
    switch (id) {
      case 'slideshow-single': return <Slideshow playing={playing} />;
      case 'slideshow-grid': return <GalleryWall playing={playing} />;
      case 'pinterest': return <Pinboard playing={playing} />;
      case 'scrapbook': return <Scrapbook playing={playing} />;
      case 'video': return <VideoLoops playing={playing} />;
      case 'clock-text': return <Clock playing={playing} />;
      case 'unsplash-mood': return <Mood playing={playing} />;
      case 'scripture': return <Verse playing={playing} />;
      case 'vinyl': return <Vinyl playing={playing} />;
      case 'coverflow': return <CoverFlow playing={playing} />;
      case 'flipboard': return <FlipBoard playing={playing} />;
      case 'easel': return <Easel playing={playing} />;
      case 'eisenhower': return <Priorities playing={playing} />;
      default: return <Slideshow playing={playing} />;
    }
  })();
  return (
    <div ref={ref} className={cn('relative overflow-hidden bg-black [container-type:inline-size]', className)}>
      {body}
    </div>
  );
}
