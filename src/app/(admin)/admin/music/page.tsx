'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search, Play, Pause, SkipForward, SkipBack, Volume2,
  Music2, Loader2, Wifi, WifiOff, Tv,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useSpotifyNowPlaying } from '@/hooks/useSpotifyNowPlaying';
import { cn } from '@/lib/utils';
import type { SpotifyTrack } from '@/lib/spotify/now-playing';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

async function playerAction(action: string, extra: Record<string, unknown> = {}) {
  await fetch('/api/spotify/player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  });
}

// ─── Now Playing bar ──────────────────────────────────────────────────────────

function NowPlayingBar({
  track,
  isPlaying,
  onPlay,
  onPause,
  onNext,
  onPrev,
}: {
  track: SpotifyTrack;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const progress = track.durationMs > 0 ? (track.progressMs / track.durationMs) * 100 : 0;

  return (
    <Card className="border-primary/20 bg-card/80">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center gap-4">
          {/* Album art */}
          <div className="relative shrink-0">
            {track.albumArtUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.albumArtUrl}
                alt={track.albumName}
                className="w-16 h-16 rounded-xl object-cover shadow-lg shadow-black/30"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center">
                <Music2 size={24} className="text-primary/60" />
              </div>
            )}
            {isPlaying && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-card animate-pulse" />
            )}
          </div>

          {/* Track info + progress */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base truncate leading-tight">{track.name}</p>
            <p className="text-sm text-muted-foreground truncate">{track.artists.join(', ')}</p>
            <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{track.albumName}</p>

            {/* Progress bar */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {fmtMs(track.progressMs)} / {fmtMs(track.durationMs)}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={onPrev}>
              <SkipBack size={16} />
            </Button>
            <Button
              size="sm"
              className="h-10 w-10 p-0 rounded-full"
              onClick={isPlaying ? onPause : onPlay}
            >
              {isPlaying
                ? <Pause size={16} />
                : <Play size={16} />}
            </Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={onNext}>
              <SkipForward size={16} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Search result row ────────────────────────────────────────────────────────

function TrackRow({
  track,
  isActive,
  onPlay,
}: {
  track: SpotifyTrack;
  isActive: boolean;
  onPlay: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handlePlay = async () => {
    setLoading(true);
    await onPlay();
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group flex items-center gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer border',
        isActive
          ? 'bg-primary/10 border-primary/30'
          : 'border-transparent hover:bg-accent hover:border-border'
      )}
      onClick={handlePlay}
    >
      {/* Album art */}
      <div className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-muted">
        {track.albumArtUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.albumArtUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music2 size={16} className="text-muted-foreground" />
          </div>
        )}
        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {loading
            ? <Loader2 size={16} className="text-white animate-spin" />
            : <Play size={14} className="text-white fill-white" />}
        </div>
      </div>

      {/* Track details */}
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-sm truncate', isActive && 'text-primary')}>
          {track.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {track.artists.join(', ')} · {track.albumName}
        </p>
      </div>

      {/* Duration + play hint */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground tabular-nums">{fmtMs(track.durationMs)}</span>
        <Button
          size="sm"
          variant={isActive ? 'default' : 'ghost'}
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); handlePlay(); }}
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MusicPage() {
  const { current, queue, isPlaying } = useSpotifyNowPlaying();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [volume, setVolume] = useState(70);
  const [tvConnected, setTvConnected] = useState<boolean | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if TV device is registered
  useEffect(() => {
    fetch('/api/spotify/now-playing')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setTvConnected(d !== null))
      .catch(() => setTvConnected(false));
  }, []);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.tracks ?? []);
      }
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 320);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const play = () => playerAction('play');
  const pause = () => playerAction('pause');
  const next = () => playerAction('next');
  const prev = () => playerAction('prev');
  const playTrack = (uri: string) => playerAction('play_track', { uri });
  const transferToTv = () => playerAction('transfer');

  const commitVolume = (v: number) => {
    setVolume(v);
    playerAction('volume', { volume: v });
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Music</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Search &amp; play on your TV</p>
        </div>

        {/* TV device status */}
        <div className="flex items-center gap-2">
          {tvConnected === true && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
              onClick={transferToTv}
            >
              <Tv size={12} /> Send to TV
            </Button>
          )}
          <div className={cn(
            'flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border',
            tvConnected
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : 'bg-muted text-muted-foreground border-border'
          )}>
            {tvConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {tvConnected ? 'TV ready' : 'No device'}
          </div>
        </div>
      </div>

      {/* Now Playing */}
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <NowPlayingBar
              track={current}
              isPlaying={isPlaying}
              onPlay={play}
              onPause={pause}
              onNext={next}
              onPrev={prev}
            />
          </motion.div>
        )}
        {!current && (
          <div className="flex items-center gap-3 py-4 px-4 bg-card rounded-2xl border border-border text-muted-foreground text-sm">
            <Music2 size={16} className="shrink-0" />
            Nothing playing on Spotify right now.
          </div>
        )}
      </AnimatePresence>

      {/* Volume */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Volume2 size={14} className="text-primary" />
              Volume
            </CardTitle>
            <span className="text-sm font-bold text-primary">{volume}%</span>
          </div>
        </CardHeader>
        <CardContent>
          <Slider
            min={0} max={100} step={1}
            value={[volume]}
            onValueChange={(v) => setVolume(Number(Array.isArray(v) ? v[0] : v))}
            onValueCommitted={(v) => commitVolume(Number(Array.isArray(v) ? v[0] : v))}
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* Up next */}
      {queue.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">
            Up next
          </p>
          <div className="space-y-0.5">
            {queue.slice(0, 3).map((t, i) => (
              <div key={t.id + i} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground">
                <span className="text-xs w-4 text-center opacity-50">{i + 1}</span>
                {t.albumArtUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={t.albumArtUrl} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" />
                  : <div className="w-8 h-8 rounded-md bg-muted shrink-0" />}
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate text-xs">{t.name}</p>
                  <p className="text-xs opacity-60 truncate">{t.artists.join(', ')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs, artists, albums…"
            className="pl-10 h-12 text-base rounded-2xl"
          />
          {searching && (
            <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mb-2">
              Results
            </p>
            {results.map((track, i) => (
              <TrackRow
                key={track.id + i}
                track={track}
                isActive={current?.id === track.id}
                onPlay={() => playTrack(track.uri)}
              />
            ))}
          </div>
        )}

        {!searching && query.trim() && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No results for &ldquo;{query}&rdquo;
          </p>
        )}

        {!query && (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Music2 size={28} className="opacity-40" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">Search for anything</p>
              <p className="text-xs opacity-60">Songs, artists, albums — hit play to send to TV</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {['Lo-fi beats', 'Afrobeats', 'Jazz', 'Focus'].map((q) => (
                <Badge
                  key={q}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors"
                  onClick={() => setQuery(q)}
                >
                  {q}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
