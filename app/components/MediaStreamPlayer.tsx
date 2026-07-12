'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { YTPlayer } from '@/types/youtube';

interface MediaStreamPlayerProps {
  videoId: string;
  playing: boolean;
  volume: number;
  muted: boolean;
  onReady: (player: YTPlayer) => void;
  onStateChange: (event: { target: YTPlayer; data: number }) => void;
  onError: (error: number) => void;
  className?: string;
}

// Mirrors the subset of YT.PlayerState values StreamView/PlayerSection
// actually check for (0 = ENDED, 1 = PLAYING, 2 = PAUSED).
const STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 } as const;

// Plays a video stream extracted server-side via yt-dlp instead of embedding
// YouTube's IFrame player — sidesteps "embedding disabled by owner" entirely,
// since that flag only applies to the IFrame widget, not to fetching the
// underlying stream directly (the same technique Discord music bots use).
// Exposes the same YTPlayer-shaped interface the old YouTubePlayer did, so
// every existing playerRef.current call site (seek/sync/play/pause) keeps
// working unchanged. "Hide video" in PlayerSection is a pure CSS overlay on
// top of this component — it never affects what's playing here.
export const MediaStreamPlayer: React.FC<MediaStreamPlayerProps> = ({
  videoId,
  playing,
  volume,
  muted,
  onReady,
  onStateChange,
  onError,
  className,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const adapterRef = useRef<YTPlayer | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Stop the previous track immediately via the DOM ref rather than
    // waiting for setSrc(null) to commit on the next render — otherwise
    // the old audio/video keeps playing for the entire round trip that
    // produced this new videoId.
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }

    setIsReady(false);
    setSrc(null);

    // Resolving spawns a yt-dlp process server-side and can transiently fail
    // (rate limiting, a slow/overlapping spawn, brief network hiccup) —
    // that's not the same thing as "this video is genuinely unplayable".
    // Retry a couple of times locally before bubbling up to onError, which
    // upstream treats any failure as grounds to search for an alternate
    // upload and eventually blacklist the track.
    //
    // A 429 specifically is never "this video is broken" — it unambiguously
    // means "you'll succeed shortly" — so it gets its own longer-backoff,
    // higher-ceiling retry loop and never calls onError directly (which
    // would otherwise search for an alternate upload and potentially
    // blacklist a perfectly good track).
    const MAX_TRANSIENT_RETRIES = 2;
    const MAX_RATE_LIMIT_RETRIES = 6;

    const attemptResolve = async (attempt: number, rateLimitAttempt: number): Promise<void> => {
      try {
        const res = await fetch(
          `/api/streams/resolve?videoId=${encodeURIComponent(videoId)}&format=video`,
          { credentials: 'include' },
        );

        if (res.status === 429) {
          if (cancelled) return;
          if (rateLimitAttempt < MAX_RATE_LIMIT_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, 3000 * (rateLimitAttempt + 1)));
            if (!cancelled) await attemptResolve(attempt, rateLimitAttempt + 1);
            return;
          }
          // Exhausted a full rate-limit-shaped backoff (many seconds) —
          // something else is wrong; fall through to normal failure handling
          // instead of retrying forever.
          onError(100);
          return;
        }

        if (!res.ok) throw new Error(`resolve failed: ${res.status}`);
        const data: { url: string } = await res.json();
        if (cancelled) return;
        setSrc(`/api/streams/proxy?url=${encodeURIComponent(data.url)}`);
      } catch {
        if (cancelled) return;
        if (attempt < MAX_TRANSIENT_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
          if (!cancelled) await attemptResolve(attempt + 1, rateLimitAttempt);
          return;
        }
        onError(100);
      }
    };

    attemptResolve(0, 0);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    adapterRef.current = {
      playVideo: () => {
        video.play().catch(() => {});
      },
      pauseVideo: () => video.pause(),
      seekTo: (seconds: number) => {
        video.currentTime = seconds;
      },
      getCurrentTime: () => video.currentTime || 0,
      getDuration: () => video.duration || 0,
      getPlayerState: () =>
        video.ended ? STATE.ENDED : video.paused ? STATE.PAUSED : STATE.PLAYING,
      getPlaybackRate: () => video.playbackRate,
      setPlaybackRate: (rate: number) => {
        video.playbackRate = rate;
      },
      setVolume: (v: number) => {
        video.volume = Math.min(1, Math.max(0, v / 100));
      },
      mute: () => {
        video.muted = true;
      },
      unMute: () => {
        video.muted = false;
      },
      destroy: () => {
        video.pause();
        video.removeAttribute('src');
        video.load();
      },
    };
  }, [src]);

  const handleLoadedMetadata = () => {
    if (isReady || !adapterRef.current) return;
    setIsReady(true);
    adapterRef.current.setVolume(volume * 100);
    if (muted) adapterRef.current.mute();
    onReady(adapterRef.current);
  };

  const emitState = (data: number) => {
    if (adapterRef.current) onStateChange({ target: adapterRef.current, data });
  };

  // playing/volume/muted are prop-driven (same pattern as the old
  // YouTubePlayer) so callers keep controlling playback via props, not by
  // reaching into the adapter directly.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isReady) return;
    if (playing && video.paused) video.play().catch(() => {});
    else if (!playing && !video.paused) video.pause();
  }, [playing, isReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.min(1, Math.max(0, volume));
    video.muted = muted;
  }, [volume, muted]);

  return (
    <video
      ref={videoRef}
      src={src ?? undefined}
      preload="auto"
      onLoadedMetadata={handleLoadedMetadata}
      onPlay={() => emitState(STATE.PLAYING)}
      onPause={() => emitState(STATE.PAUSED)}
      onEnded={() => emitState(STATE.ENDED)}
      onError={() => onError(100)}
      className={className ?? 'w-full h-full object-contain'}
      playsInline
    />
  );
};
