'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search, Play, Pause, SkipForward, SkipBack, Volume2,
  Music2, Loader2, Radio, Tv, Laptop, Smartphone, Speaker,
  RefreshCw, MonitorSmartphone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useSpotifyNowPlaying } from '@/hooks/useSpotifyNowPlaying';
import { cn } from '@/lib/utils';
import type { SpotifyTrack } from '@/lib/spotify/now-playing';
import type { SpotifyDevice } from '@/app/api/spotify/devices/route';
import PageGuide from '@/components/admin/PageGuide';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

async function playerAction(action: string, extra: Record<string, unknown> = {}) {
  return fetch('/api/spotify/player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  });
}

function deviceIcon(type: string) {
  const t = type.toLowerCase();
  if (t === 'computer' || t === 'laptop') return <Laptop size={14} className="shrink-0" />;
  if (t === 'smartphone') return <Smartphone size={14} className="shrink-0" />;
  if (t === 'speaker' || t === 'cast_audio') return <Speaker size={14} className="shrink-0" />;
  if (t === 'tv' || t === 'castvideo') return <Tv size={14} className="shrink-0" />;
  return <MonitorSmartphone size={14} className="shrink-0" />;
}

// ─── Now Playing card ─────────────────────────────────────────────────────────

function NowPlayingCard({
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
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="p-0">
        <div className="flex gap-0">
          <div className="relative shrink-0 w-28 h-28 md:w-32 md:h-32">
            {track.albumArtUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.albumArtUrl} alt={track.albumName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/15 flex items-center justify-center">
                <Music2 size={28} className="text-primary/50" />
              </div>
            )}
            {isPlaying && (
              <span className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-green-400 shadow-lg shadow-green-400/50 animate-pulse" />
            )}
          </div>

          <div className="flex-1 min-w-0 p-4 flex flex-col justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight truncate">{track.name}</p>
              <p className="text-sm text-muted-foreground truncate mt-0.5">{track.artists.join(', ')}</p>
              <p className="text-xs text-muted-foreground/50 truncate mt-0.5">{track.albumName}</p>
            </div>

            <div className="space-y-1">
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground/50 tabular-nums">
                <span>{fmtMs(track.progressMs)}</span>
                <span>{fmtMs(track.durationMs)}</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onPrev}
                className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <SkipBack size={16} />
              </button>
              <button
                type="button"
                onClick={isPlaying ? onPause : onPlay}
                className="w-11 h-11 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30 hover:opacity-90 active:scale-95 transition-all"
              >
                {isPlaying
                  ? <Pause size={18} fill="currentColor" />
                  : <Play size={18} fill="currentColor" className="translate-x-0.5" />}
              </button>
              <button
                type="button"
                onClick={onNext}
                className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <SkipForward size={16} />
              </button>
              <div className="ml-auto">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] gap-1 border rounded-full',
                    isPlaying
                      ? 'border-green-500/30 text-green-400 bg-green-500/10'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  <Radio size={9} className={isPlaying ? 'animate-pulse' : ''} />
                  {isPlaying ? 'Playing' : 'Paused'}
                </Badge>
              </div>
            </div>
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
  onPlay: () => Promise<unknown>;
}) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    await onPlay();
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer border',
        isActive
          ? 'bg-primary/10 border-primary/30'
          : 'border-transparent hover:bg-accent hover:border-border'
      )}
      onClick={handle}
    >
      <div className="relative w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-muted">
        {track.albumArtUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.albumArtUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music2 size={14} className="text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {loading
            ? <Loader2 size={14} className="text-white animate-spin" />
            : <Play size={13} className="text-white fill-white" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-sm truncate', isActive && 'text-primary')}>
          {track.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {track.artists.join(', ')} · {track.albumName}
        </p>
      </div>
      <span className="text-xs text-muted-foreground/60 tabular-nums shrink-0">{fmtMs(track.durationMs)}</span>
    </motion.div>
  );
}

// ─── Device selector ──────────────────────────────────────────────────────────

function DeviceSelector() {
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [frameTvDeviceId, setFrameTvDeviceId] = useState<string | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [transferring, setTransferring] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    try {
      const res = await fetch('/api/spotify/devices');
      if (res.status === 401) { setNotConnected(true); return; }
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices ?? []);
        setFrameTvDeviceId(data.frameTvDeviceId ?? null);
        setNotConnected(false);
      }
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const transfer = async (deviceId?: string) => {
    const key = deviceId ?? 'frametv';
    setTransferring(key);
    try {
      await playerAction('transfer', deviceId ? { device_id: deviceId } : {});
      await loadDevices();
    } finally {
      setTransferring(null);
    }
  };

  if (notConnected) return null;

  const frameTvEntry = frameTvDeviceId
    ? devices.find((d) => d.id === frameTvDeviceId)
    : null;
  const otherDevices = devices.filter((d) => d.id !== frameTvDeviceId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Tv size={14} className="text-primary" />
            Audio Output
          </CardTitle>
          <button
            type="button"
            onClick={loadDevices}
            disabled={loadingDevices}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh devices"
          >
            <RefreshCw size={13} className={loadingDevices ? 'animate-spin' : ''} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loadingDevices && devices.length === 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 py-2">
            <Loader2 size={11} className="animate-spin" /> Loading devices…
          </p>
        )}

        {/* FrameTV device — highlighted */}
        {frameTvDeviceId && (
          <div className={cn(
            'flex items-center justify-between p-3 rounded-xl border',
            frameTvEntry?.is_active
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-primary/8 border-primary/20'
          )}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={cn(
                'flex size-8 items-center justify-center rounded-lg border',
                frameTvEntry?.is_active
                  ? 'bg-green-500/15 border-green-500/30 text-green-400'
                  : 'bg-primary/15 border-primary/25 text-primary'
              )}>
                <Tv size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {frameTvEntry?.name ?? 'FrameTV Browser'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {frameTvEntry?.is_active ? 'Currently playing here' : 'Registered TV device'}
                  {frameTvEntry?.volume_percent != null && ` · ${frameTvEntry.volume_percent}%`}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={frameTvEntry?.is_active ? 'secondary' : 'default'}
              className={cn('shrink-0 gap-1.5', frameTvEntry?.is_active && 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30')}
              onClick={() => transfer()}
              disabled={transferring !== null || frameTvEntry?.is_active}
            >
              {transferring === 'frametv' && <Loader2 size={12} className="animate-spin" />}
              {frameTvEntry?.is_active ? 'Playing' : 'Send to TV'}
            </Button>
          </div>
        )}

        {/* Other Spotify devices */}
        {otherDevices.length > 0 && (
          <>
            {frameTvDeviceId && <Separator />}
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium px-1 pt-1">
              Other Spotify devices
            </p>
            {otherDevices.map((device) => (
              <div
                key={device.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl border transition-colors',
                  device.is_active ? 'bg-accent border-border' : 'border-border'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={cn(
                    'flex size-7 items-center justify-center rounded-lg text-muted-foreground',
                    device.is_active && 'text-foreground'
                  )}>
                    {deviceIcon(device.type)}
                  </span>
                  <div className="min-w-0">
                    <p className={cn('text-sm font-medium truncate', device.is_active && 'font-semibold')}>
                      {device.name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {device.type.toLowerCase().replace(/_/g, ' ')}
                      {device.is_active && ' · Active'}
                      {device.volume_percent != null && ` · ${device.volume_percent}%`}
                    </p>
                  </div>
                </div>
                {!device.is_active && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() => transfer(device.id)}
                    disabled={transferring !== null}
                  >
                    {transferring === device.id && <Loader2 size={12} className="animate-spin" />}
                    Play here
                  </Button>
                )}
                {device.is_active && (
                  <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400 bg-green-500/10 gap-1">
                    <Radio size={8} className="animate-pulse" /> Playing
                  </Badge>
                )}
              </div>
            ))}
          </>
        )}

        {!loadingDevices && devices.length === 0 && !frameTvDeviceId && (
          <p className="text-sm text-muted-foreground py-2">
            No Spotify devices found. Open Spotify on any device to see it here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MusicPage() {
  const { current, queue, isPlaying } = useSpotifyNowPlaying();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [volume, setVolume] = useState(70);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults((await res.json()).tracks ?? []);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const play  = () => playerAction('play');
  const pause = () => playerAction('pause');
  const next  = () => playerAction('next');
  const prev  = () => playerAction('prev');
  const playTrack = (uri: string) => playerAction('play_track', { uri });
  const commitVolume = (v: number) => { setVolume(v); playerAction('volume', { volume: v }); };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">

      <PageGuide
        pageKey="music"
        icon={<Music2 size={18} className="text-primary" />}
        title="Music"
        about="Search Spotify and play music directly on your TV browser. The TV tab becomes a Spotify device called FrameTV — requires Spotify Premium for in-browser playback."
        steps={[
          'Connect Spotify in Settings first.',
          'Open the display tab on your TV and leave it running — it registers as a Spotify device.',
          'Use Audio Output to route sound to the FrameTV browser or any other Spotify device.',
          'Type a song, artist, or album in the search box.',
          'Click a result to play it on the active device.',
        ]}
      />

      {/* Header */}
      <div className="pt-2">
        <h1 className="text-xl font-bold tracking-tight">Music</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {current ? `${current.name} — ${current.artists[0]}` : 'Open Spotify to start playing'}
        </p>
      </div>

      {/* Now Playing */}
      <AnimatePresence mode="wait">
        {current ? (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <NowPlayingCard
              track={current}
              isPlaying={isPlaying}
              onPlay={play}
              onPause={pause}
              onNext={next}
              onPrev={prev}
            />
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 py-5 px-4 bg-card rounded-2xl border border-border text-muted-foreground text-sm"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Music2 size={16} className="opacity-50" />
            </div>
            <div>
              <p className="font-medium text-foreground">Nothing playing</p>
              <p className="text-xs mt-0.5 opacity-70">Start Spotify on any device, then control it here</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio Output / Device Selector */}
      <DeviceSelector />

      {/* Volume */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Volume2 size={14} className="text-primary" /> Volume
            </CardTitle>
            <span className="text-sm font-bold text-primary tabular-nums">{volume}%</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
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
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">Up next</p>
          <div className="space-y-0.5">
            {queue.slice(0, 3).map((t, i) => (
              <div key={t.id + i} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm">
                <span className="text-xs w-4 text-center text-muted-foreground/40 tabular-nums">{i + 1}</span>
                {t.albumArtUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={t.albumArtUrl} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" />
                  : <div className="w-8 h-8 rounded-md bg-muted shrink-0" />}
                <div className="min-w-0">
                  <p className="font-medium text-xs truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground/60 truncate">{t.artists.join(', ')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs, artists, albums…"
            className="pl-10 h-12 text-sm rounded-2xl"
          />
          {searching && (
            <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
          )}
        </div>

        {results.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mb-2">Results</p>
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
          <p className="text-sm text-muted-foreground text-center py-8">No results for &ldquo;{query}&rdquo;</p>
        )}

        {!query && (
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <Music2 size={24} className="opacity-40" />
            </div>
            <p className="text-sm font-medium">Search for anything</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Afrobeats', 'Lo-fi', 'Jazz', 'Focus', 'R&B'].map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs h-7"
                  onClick={() => setQuery(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
