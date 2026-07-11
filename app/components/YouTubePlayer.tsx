'use client';

import React, { useEffect, useRef, useState } from 'react';

import type { YT, YTPlayer } from '@/types/youtube';

interface YouTubePlayerProps {
  videoId: string;
  isHost: boolean;
  playing: boolean;
  volume: number;
  muted: boolean;
  onReady: (player: YTPlayer) => void;
  onStateChange: (event: { target: YTPlayer; data: number }) => void;
  onError: (error: number) => void;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT: YT;
  }
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  isHost,
  playing,
  volume,
  muted,
  onReady,
  onStateChange,
  onError,
}) => {
  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isApiLoaded, setIsApiLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Load YouTube IFrame API script
    if (!window.YT) {
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      // Multiple YouTubePlayer instances (or a fast remount) would otherwise
      // each overwrite this global, silently dropping every callback but the
      // last one to attach — chain onto whatever is already registered.
      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        if (!cancelled) setIsApiLoaded(true);
      };
    } else {
      // Use setTimeout to avoid setState during render
      setTimeout(() => {
        if (!cancelled) setIsApiLoaded(true);
      }, 0);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isApiLoaded || !containerRef.current || !videoId) return;

    // Initialize player
    const player = new window.YT.Player(containerRef.current!, {
      height: '100%',
      width: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: isHost ? 1 : 0,
        disablekb: isHost ? 0 : 1,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        enablejsapi: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (event) => {
          playerRef.current = event.target;
          event.target.setVolume(volume * 100);
          if (muted) event.target.mute();
          onReady(event.target);
        },
        onStateChange: onStateChange,
        onError: (event) => onError(event.data),
      },
    });

    return () => {
      if (player && typeof player.destroy === 'function') {
        player.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApiLoaded, videoId, isHost]); // Re-initialize if videoId or role changes

  // Handle play/pause state changes from props
  useEffect(() => {
    if (!playerRef.current) return;

    try {
      const state = playerRef.current.getPlayerState();
      if (playing && state !== window.YT.PlayerState.PLAYING) {
        playerRef.current.playVideo();
      } else if (!playing && state === window.YT.PlayerState.PLAYING) {
        playerRef.current.pauseVideo();
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('YouTubePlayer: play/pause toggle failed (player may not be ready yet)', e);
    }
  }, [playing]);

  // Handle volume/mute changes
  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.setVolume(volume * 100);
    if (muted) {
      playerRef.current.mute();
    } else {
      playerRef.current.unMute();
    }
  }, [volume, muted]);

  return (
    <div className="w-full h-full bg-black">
      <div ref={containerRef} />
    </div>
  );
};
