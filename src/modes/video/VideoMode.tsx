'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ModeProps } from '@/modes/types';
import { usePhotoRotation } from '@/hooks/usePhotoRotation';

interface VideoConfig {
  /** 'playlist' plays the album's videos back to back; 'loop' repeats one. */
  playback?: 'playlist' | 'loop';
  shuffle?: boolean;
  /** Playlist only: loop each clip this many minutes before advancing (0 = play once). */
  holdMinutes?: number;
  fit?: 'cover' | 'contain';
}

export default function VideoMode({ config, brightness, isPaused, albumIds, onReady }: ModeProps) {
  const cfg = config as VideoConfig;
  const playback = cfg.playback ?? 'playlist';
  const shuffle = cfg.shuffle ?? false;
  const holdMinutes = Math.max(0, cfg.holdMinutes ?? 0);
  const fit = cfg.fit ?? 'cover';

  const { photos: videos, currentIndex, currentPhoto: video, advance } = usePhotoRotation({
    albumIds,
    shuffle,
    mediaType: 'video',
  });
  const single = videos.length <= 1;
  // Native looping whenever we're not advancing on 'ended'
  const nativeLoop = playback === 'loop' || single || holdMinutes > 0;
  const next = single ? null : videos[(currentIndex + 1) % videos.length];

  useEffect(() => {
    if (videos.length > 0) onReady?.();
  }, [videos.length, onReady]);

  // Hold timer: in playlist mode with holdMinutes, advance on a clock
  useEffect(() => {
    if (playback !== 'playlist' || holdMinutes <= 0 || single || isPaused) return;
    const id = setTimeout(advance, holdMinutes * 60_000);
    return () => clearTimeout(id);
  }, [playback, holdMinutes, single, isPaused, advance, video?.id]);

  if (!video) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black text-white/40 text-lg">
        No videos in the active albums yet
      </div>
    );
  }

  const poster = video.thumbnail_path ?? undefined;

  return (
    <div className="relative w-full h-full overflow-hidden bg-black" style={{ opacity: brightness / 100 }}>
      <AnimatePresence initial={false}>
        <motion.div
          key={video.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          {fit === 'contain' && poster && (
            // Blurred poster fills the letterbox bars
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'blur(48px) saturate(0.8) brightness(0.5)', transform: 'scale(1.15)' }}
            />
          )}
          <Clip
            src={video.storage_path ?? undefined}
            poster={poster}
            isPaused={isPaused}
            loop={nativeLoop}
            fit={fit}
            onEnded={nativeLoop ? undefined : advance}
            onError={single ? undefined : advance}
          />
        </motion.div>
      </AnimatePresence>

      {/* Warm the next clip so the cut is instant */}
      {next?.storage_path && (
        <video key={next.id} src={next.storage_path} preload="auto" muted playsInline className="hidden" />
      )}
    </div>
  );
}

// Each clip owns its element so the outgoing clip unmounting after the
// crossfade can't clobber the incoming clip's ref.
function Clip({
  src, poster, isPaused, loop, fit, onEnded, onError,
}: {
  src?: string;
  poster?: string;
  isPaused: boolean;
  loop: boolean;
  fit: 'cover' | 'contain';
  onEnded?: () => void;
  onError?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isPaused) el.pause();
    else el.play().catch(() => { /* muted autoplay is allowed; ignore interrupted play() */ });
  }, [isPaused]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      autoPlay={!isPaused}
      muted
      playsInline
      loop={loop}
      preload="auto"
      disablePictureInPicture
      onEnded={onEnded}
      onError={onError}
      className="absolute inset-0 w-full h-full"
      style={{ objectFit: fit }}
    />
  );
}
