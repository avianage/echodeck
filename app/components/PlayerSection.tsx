import React, { useEffect, useState } from 'react';
import { MediaStreamPlayer } from './MediaStreamPlayer';
import Image from 'next/image';
import { Play, VolumeX, Volume2, EyeOff, Video as VideoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { YTPlayer } from '@/types/youtube';

const VIEW_MODE_STORAGE_KEY = 'echodeck:playerViewMode';

// Just visually covers the video — the underlying stream (video element,
// audio included) keeps playing completely untouched underneath. No
// re-resolve, no format switch, no restart risk: this is purely a CSS cover.
function VideoHiddenOverlay() {
  return (
    <div className="absolute inset-0 z-[15] flex items-center justify-center bg-gray-950 text-gray-500 text-sm font-medium">
      Video hidden — audio still playing
    </div>
  );
}

interface Video {
  id: string;
  type: string;
  url: string;
  extractedId: string;
  title: string;
  smallImg: string;
  bigImg: string;
  active: string;
  userId: string;
  addedById: string;
  upvotes: number;
  haveUpvoted: boolean;
  playedTs: string | null;
}

interface PlayerSectionProps {
  currentVideo: Video | null;
  playVideo: boolean;
  playing: boolean;
  isMuted: boolean;
  isPaused: boolean;
  isJoined: boolean;
  isPlayerReady: boolean;
  pathname: string;
  currentUserId: string | null;
  accessStatus: string | null;
  volume: number;
  playerRef: React.RefObject<YTPlayer | null>;
  onReady: (player: YTPlayer) => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onError: (err: number) => void;
  onGoLive: () => void;
  onMuteToggle: () => void;
  onVolumeChange: (v: number) => void;
  onPlayClick: () => void;
  onRequestAccess: () => void;
}

export function PlayerSection({
  currentVideo,
  playVideo,
  playing,
  isMuted,
  isPaused,
  isJoined,
  isPlayerReady,
  pathname,
  currentUserId,
  accessStatus: _accessStatus,
  volume,
  playerRef,
  onReady,
  onPlay,
  onPause,
  onEnded,
  onError,
  onGoLive,
  onMuteToggle,
  onVolumeChange,
  onPlayClick: _onPlayClick,
  onRequestAccess: _onRequestAccess,
}: PlayerSectionProps) {
  // Per-viewer preference (not stream state — no sync/broadcast), so each
  // person watching can independently choose to hide the video. The
  // underlying stream is always resolved/played as 'video' regardless of
  // this setting — toggling it never touches playback, it only shows/hides
  // a CSS overlay, so there's no restart, no re-resolve, no rate-limit risk.
  const [videoHidden, setVideoHidden] = useState(false);
  useEffect(() => {
    setVideoHidden(localStorage.getItem(VIEW_MODE_STORAGE_KEY) === 'audio');
  }, []);
  const toggleVideoHidden = () => {
    setVideoHidden((prev) => {
      const next = !prev;
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, next ? 'audio' : 'video');
      return next;
    });
  };

  // Enforce 1x playback speed aggressively against extensions
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef?.current && typeof playerRef.current.getPlaybackRate === 'function') {
        const currentRate = playerRef.current.getPlaybackRate();
        if (currentRate !== 1) {
          playerRef.current.setPlaybackRate(1);
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [playerRef]);

  if (!currentVideo) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-4">
        <Play className="w-10 h-10 opacity-20" />
        <p className="text-lg">No video playing</p>
      </div>
    );
  }

  if (currentUserId === null) {
    // currentUserId resolves shortly after mount (once the initial
    // refreshStreams() call completes). Mounting the player before then
    // would compute isHost as false even for the real creator, then flip
    // it true a moment later — and since YouTube's IFrame API can't change
    // `controls` without fully recreating the player, that flip destroys
    // and rebuilds the instance while `isPlayerReady` stays stuck true,
    // leaving "Start Session" silently clicking a dead player reference.
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-4">
        <Play className="w-10 h-10 opacity-20 animate-pulse" />
        <p className="text-lg">Loading…</p>
      </div>
    );
  }

  if (!playVideo) {
    return (
      <div className="w-full">
        <div className="relative w-full aspect-video md:h-[360px] lg:h-[450px] bg-black">
          {currentVideo.bigImg ? (
            <Image
              src={currentVideo.bigImg}
              alt={currentVideo.title}
              fill
              sizes="(max-width: 768px) 100vw, 800px"
              className="object-contain"
            />
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500">
              No Image
            </div>
          )}
          <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-20 pointer-events-none">
            <p className="text-sm sm:text-lg font-semibold text-white line-clamp-2 sm:truncate drop-shadow-md">
              {currentVideo.title}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative">
      <div className="relative w-full aspect-video md:h-[360px] lg:h-[450px] bg-black bg-opacity-90 overflow-hidden rounded-xl shadow-2xl">
        <MediaStreamPlayer
          videoId={currentVideo.extractedId}
          playing={playing}
          volume={volume}
          muted={isMuted}
          onReady={(player) => {
            playerRef.current = player;
            onReady(player);
          }}
          onStateChange={(event) => {
            const state = event.data;
            if (state === 1) onPlay(); // 1 = PLAYING
            if (state === 2) onPause(); // 2 = PAUSED
            if (state === 0) onEnded(); // 0 = ENDED
          }}
          onError={onError}
        />
        {/* Just a CSS cover over the video — the underlying stream (audio
            included) keeps playing exactly as-is underneath. */}
        {videoHidden && <VideoHiddenOverlay />}

        {!isJoined && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4">
            <div className="text-center space-y-3 sm:space-y-6 w-full max-w-sm flex flex-col items-center px-2 sm:px-6">
              <div className="relative shrink-0 mt-1 sm:mt-0">
                <div className="absolute -inset-2 sm:-inset-4 bg-blue-600/20 blur-xl sm:blur-2xl rounded-full" />
                <Play className="w-10 h-10 sm:w-16 sm:h-16 text-blue-500 mx-auto relative z-10 animate-pulse" />
              </div>
              <div className="space-y-1 sm:space-y-2 shrink-0">
                <h3 className="text-lg sm:text-2xl font-bold text-white leading-tight">
                  {pathname.startsWith('/party/') ? 'Ready to join?' : 'Ready to stream?'}
                </h3>
                <p className="text-gray-400 text-[11px] sm:text-sm px-4 sm:px-0 max-w-[280px] sm:max-w-none mx-auto leading-tight sm:leading-normal">
                  {pathname.startsWith('/party/')
                    ? 'Click below to sync up with the streamer and start listening.'
                    : 'Click below to start your session and let everyone vibe.'}
                </p>
              </div>
              <Button
                onClick={onGoLive}
                disabled={!isPlayerReady}
                className={`w-[90%] sm:w-full max-w-[240px] sm:max-w-none h-10 sm:h-14 text-sm sm:text-lg font-bold rounded-xl sm:rounded-2xl transition-all duration-300 shadow-xl shrink-0 mt-1 sm:mt-0 ${
                  isPlayerReady
                    ? 'bg-blue-600 hover:bg-blue-700 text-white sm:scale-105 sm:hover:scale-110'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isPlayerReady
                  ? pathname.startsWith('/party/')
                    ? 'JOIN STREAM'
                    : 'START SESSION'
                  : 'LOADING VIDEO...'}
              </Button>
            </div>
          </div>
        )}

        {isPaused && (isJoined || !pathname.startsWith('/party/')) && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 pointer-events-none">
            <div className="relative z-10 flex flex-col items-center gap-4">
              {!pathname.startsWith('/party/') ? (
                <div className="bg-amber-600/90 px-8 py-3 rounded-full border border-amber-400/50 shadow-2xl">
                  <p className="text-xl font-bold tracking-widest uppercase text-white">Paused</p>
                </div>
              ) : (
                <div className="bg-blue-600/90 px-8 py-3 rounded-full border border-blue-400/50 shadow-2xl">
                  <p className="text-xl font-bold tracking-widest uppercase text-white">
                    Paused by Streamer
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hide/show video — a per-viewer preference, not synced to other
            viewers or the stream's own state. Purely visual: audio keeps
            playing from the same stream either way. */}
        <Button
          onClick={toggleVideoHidden}
          size="sm"
          aria-label={videoHidden ? 'Show video' : 'Hide video'}
          title={videoHidden ? 'Show video' : 'Hide video (audio only)'}
          className="absolute bottom-4 left-4 z-20 h-9 px-3 gap-1.5 bg-black/70 hover:bg-black/80 text-white border border-white/10 backdrop-blur-md rounded-xl"
        >
          {videoHidden ? (
            <>
              <VideoIcon className="h-4 w-4" /> Show Video
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4" /> Hide Video
            </>
          )}
        </Button>

        {/* Global Volume Control — the creator has no native embed controls
            reachable (blocked by the overlay below), so they need this too.
            Always visible (not hover-reveal) since hover doesn't exist on
            touch devices. */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 bg-black/70 px-3 py-2 rounded-xl border border-white/10 backdrop-blur-md">
          <Button
            onClick={onMuteToggle}
            size="sm"
            aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
            className="bg-transparent hover:bg-white/10 text-white h-8 w-8 p-0 flex-shrink-0"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-5 w-5 text-red-400" />
            ) : (
              <Volume2 className="h-5 w-5 text-blue-400" />
            )}
          </Button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            aria-label="Volume"
            className="w-20 sm:w-28 cursor-pointer accent-blue-500 h-1.5 bg-white/20 rounded-lg appearance-none"
          />
        </div>

        <div className="absolute inset-0 z-10 cursor-default" />

        <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-20 pointer-events-none">
          <p className="text-sm sm:text-lg font-semibold text-white line-clamp-2 sm:truncate drop-shadow-lg">
            {currentVideo.title}
          </p>
        </div>
      </div>
    </div>
  );
}
