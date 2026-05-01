'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Share2,
  Play,
  Pause,
  Star,
  Lock,
  Globe,
  X,
  RefreshCw,
  Settings,
  Save,
  CheckCircle2,
  ShieldAlert,
  Timer,
} from 'lucide-react';
import { toast } from 'react-toastify';
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css';
import {
  PLAYLIST_REGEX,
  SPOTIFY_PLAYLIST_REGEX,
  YT_REGEX,
  SPOTIFY_TRACK_REGEX,
} from '@/app/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

import ReactPlayer from 'react-player';
import { usePathname, useRouter } from 'next/navigation';
import { useDebounce } from '@/app/lib/useDebounce';
import { PlayerSection } from './PlayerSection';
import { SearchBar } from './SearchBar';
import { QueueSection } from './QueueSection';
import { ActivityLog } from './ActivityLog';
import { PlaylistModal } from './PlaylistModal';
import { StreamManagement } from './StreamManagement';

function Countdown({ until }: { until: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(until).getTime() - Date.now();
      if (diff <= 0) {
        window.location.reload();
        return 'Refreshing...';
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      let str = '';
      if (days > 0) str += `${days}d `;
      if (hours > 0 || days > 0) str += `${hours}h `;
      str += `${mins}m ${secs}s`;
      return str;
    };

    const timer = setInterval(() => setTimeLeft(calculate()), 1000);
    setTimeLeft(calculate());
    return () => clearInterval(timer);
  }, [until]);

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 font-black text-[10px] uppercase tracking-widest mt-4 shadow-xl shadow-amber-500/5">
      <Timer className="w-3.5 h-3.5 animate-pulse" />
      Restriction expires in: {timeLeft}
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

interface StreamEvent {
  id: string;
  type:
    | 'USER_BANNED_PLATFORM'
    | 'USER_BANNED_STREAM'
    | 'USER_TIMED_OUT_PLATFORM'
    | 'USER_TIMED_OUT_STREAM'
    | 'CREATOR_ROLE_REVOKED'
    | 'STREAM_FORCE_CLOSED'
    | 'MOD_PROMOTED'
    | 'MOD_DEMOTED'
    | 'SONG_REMOVED_BY_MOD'
    | 'SONG_SKIPPED_BY_CREATOR';
  message: string;
}

const REFRESH_INTERVAL_MS = 10 * 1000;

export default function StreamView({
  creatorId,
  playVideo = false,
}: {
  creatorId: string;
  playVideo: boolean;
}) {
  const router = useRouter();
  const [videoLink, setVideoLink] = useState('');
  const [queue, setQueue] = useState<Video[]>([]);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(false);
  const [playNextLoader, setPlayNextLoader] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [lastSync, setLastSync] = useState<{ type: 'play' | 'pause'; currentTime: number } | null>(
    null,
  );
  const [isPaused, setIsPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [playlistVideos, setPlaylistVideos] = useState<any[]>([]);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<
    { type: 'success' | 'error'; message: string; timestamp: number }[]
  >([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [creator, setCreator] = useState<{
    id: string;
    email?: string;
    isPublic: boolean;
    partyCode?: string | null;
  } | null>(null);
  const [accessStatus, setAccessStatus] = useState<string | null>(null);
  const [streamRole, setStreamRole] = useState<string>('MEMBER');
  const [restriction, setRestriction] = useState<{
    isBanned: boolean;
    bannedUntil: string | null;
    reason: string | null;
    scope: 'PLATFORM' | 'STREAM';
  } | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [heartbeatFailCount, setHeartbeatFailCount] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [streamIsPublic, setStreamIsPublic] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamGenre, setStreamGenre] = useState('');
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [showSpotifyPrompt, setShowSpotifyPrompt] = useState(false);
  const lastRefreshRef = useRef<number>(0);
  const lastAccessPollRef = useRef<number>(0);
  const MAX_HEARTBEAT_FAILURES = 3;
  const debouncedVideoLink = useDebounce(videoLink, 300);

  // Load logs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`echodeck-logs-${creatorId}`);
      if (stored) {
        setActivityLogs(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, [creatorId]);

  // Save logs to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(`echodeck-logs-${creatorId}`, JSON.stringify(activityLogs));
    } catch {
      // Ignore storage errors
    }
  }, [activityLogs, creatorId]);

  const addLog = (type: 'success' | 'error', message: string) => {
    setActivityLogs((prev) => [{ type, message, timestamp: Date.now() }, ...prev].slice(0, 10));
  };

  const playerRef = useRef<any>(null);
  const pathname = usePathname();
  const isFixingRestrictedRef = useRef(false);
  const lastSeekRef = useRef<number>(0);
  const lastSyncPushRef = useRef<number>(0);
  // true while an SSE connection is healthy — disables the fallback poll
  const sseActiveRef = useRef(false);

  const refreshStreams = useCallback(
    async (isInitial: boolean = false) => {
      try {
        lastRefreshRef.current = Date.now();
        console.log(
          'Fetching streams from API...',
          isInitial ? '(Initial Load / Reset Access)' : '',
        );
        const res = await fetch(
          `/api/streams/?creatorId=${creatorId}${isInitial ? '&resetAccess=true' : ''}`,
          {
            method: 'GET',
            credentials: 'include',
          },
        );

        if (!res.ok) {
          console.warn('Stream fetch failed:', res.status, res.statusText);
          return;
        }

        const json = await res.json();
        setQueue(
          (json.streams ?? []).sort((a: any, b: any) => {
            if (a.upvotes !== b.upvotes) {
              return b.upvotes - a.upvotes;
            }
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          }),
        );
        setCurrentUserId(json.currentUserId);
        setCreator(json.creator);
        setAccessStatus(json.accessStatus);
        setStreamRole(json.streamRole || 'MEMBER');
        setRestriction(json.restriction);

        if (!json.activeStream?.stream && json.creator?.isPublic !== undefined) {
          setStreamIsPublic(json.creator.isPublic);
        }

        setCurrentVideo((video) => {
          if (!json.activeStream?.stream) {
            return null;
          }
          setStreamIsPublic(json.creator.isPublic);
          setViewerCount(json.activeStream.viewerCount);
          if (video?.id === json.activeStream.stream.id) {
            return video;
          }
          setStreamTitle(json.activeStream.stream.title || '');
          setStreamGenre(json.activeStream.stream.genre || '');
          return json.activeStream.stream;
        });

        // Non-blocking: check if creator is already favorited
        fetch('/api/user/favorites')
          .then((r) => (r.ok ? r.json() : null))
          .then((favData) => {
            if (!favData) return;
            const alreadyFav = favData.favorites?.some((f: any) => f.id === creatorId);
            setIsFavorite(!!alreadyFav);
          })
          .catch(() => {
            /* favorites fetch failed silently */
          });
      } catch (error) {
        console.error('Error Fetching Stream: ', error);
      }
    },
    [creatorId],
  );

  const refreshIfStale = useCallback(() => {
    const stale = Date.now() - lastRefreshRef.current > 3000; // only refresh if >3s since last
    if (stale) refreshStreams();
  }, [refreshStreams]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent | KeyboardEvent) => {
      if (e && 'preventDefault' in e) e.preventDefault();
      if (!videoLink.trim()) return;

      const isUrl =
        videoLink.match(YT_REGEX) ||
        videoLink.match(SPOTIFY_TRACK_REGEX) ||
        videoLink.match(PLAYLIST_REGEX) ||
        videoLink.match(SPOTIFY_PLAYLIST_REGEX);

      if (!isUrl) {
        handleSearch(videoLink);
        return;
      }

      const playlistMatch =
        videoLink.match(PLAYLIST_REGEX) || videoLink.match(SPOTIFY_PLAYLIST_REGEX);
      if (playlistMatch) {
        const playlistId = playlistMatch[1];
        setLoading(true);
        try {
          const res = await fetch('/api/streams/playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playlistId, url: videoLink }),
          });
          if (!res.ok) throw new Error('Failed to fetch playlist');
          const data = await res.json();
          setPlaylistVideos(data.videos);
          setPlaylistTitle(data.title);
          setIsPlaylistModalOpen(true);
          setVideoLink('');
        } catch {
          toast.error("Could not load playlist. Make sure it's public.");
        } finally {
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const res = await fetch('/api/streams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creatorId: creatorId,
            url: videoLink,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.code === 'SPOTIFY_NOT_CONNECTED') {
            setShowSpotifyPrompt(true);
            setLoading(false);
            return;
          }
          const errorMsg = data.message || 'Failed to add video';
          toast.error(errorMsg);
          addLog('error', `Failed: ${videoLink} - ${errorMsg}`);
          throw new Error(errorMsg);
        }
        setQueue([...queue, data]);
        setVideoLink('');
        toast.success('Added to queue!');
        addLog('success', `Added single video: ${data.title}`);
        refreshIfStale();
      } catch (err: any) {
        console.error('Error adding video:', err);
      } finally {
        setLoading(false);
      }
    },
    [videoLink, creatorId, queue, refreshIfStale],
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        lastSeekRef.current = 0;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    console.log('🔵 StreamView mounted');
    const isCreator = !pathname.startsWith('/party/');

    const handleUnload = () => {
      if (isCreator) {
        // Use fetch with keepalive for reliability on exit
        fetch('/api/streams/metadata', { method: 'DELETE', keepalive: true });
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      console.log('🔴 StreamView unmounted');
      window.removeEventListener('beforeunload', handleUnload);
      if (isCreator) {
        fetch('/api/streams/metadata', { method: 'DELETE' });
      }
    };
  }, [pathname]);

  useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit(e as any);
      }
    };
    window.addEventListener('keydown', handleEnter);
    return () => window.removeEventListener('keydown', handleEnter);
  }, [handleSubmit]);

  const isFirstLoad = useRef(true);
  useEffect(() => {
    refreshStreams(isFirstLoad.current);
    isFirstLoad.current = false;

    // High-Frequency Heartbeat Sync System (Replaces Pusher)
    const heartbeatInterval = setInterval(
      async () => {
        const isCreator = !pathname.startsWith('/party/');
        try {
          if (isCreator) {
            // Streamer pushes state to DB every 2s as a fallback
            if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
              const currentTime = playerRef.current.getCurrentTime() || 0;
              const isPausedNow = isPaused || !playing;

              await fetch('/api/streams/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  creatorId,
                  currentTime,
                  isPaused: isPausedNow,
                }),
              });
            }
          } else if (isJoined && !sseActiveRef.current) {
            // Fallback: Listener polls DB when SSE is not connected
            const res = await fetch('/api/streams/heartbeat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ creatorId }),
            });

            if (!res.ok) {
              if (res.status === 403 && !isCreator) {
                console.log(`Access revoked (403). Updating status and refreshing...`);
                refreshStreams(); // Full refresh to pick up restriction details
                setPlaying(false);
                return;
              }
              if (res.status === 404 && !isCreator) {
                console.log(`Streamer explicitly went offline (404)`);
                toast.error('The streamer is offline.', {
                  toastId: 'offline-kick',
                  autoClose: false,
                });
                clearInterval(heartbeatInterval);
                setTimeout(() => window.location.reload(), 2000);
                return;
              }
              throw new Error(`Heartbeat failed: ${res.status}`);
            }

            const data = await res.json();

            if (data.currentTime !== undefined && playerRef.current) {
              const myTime = playerRef.current.getCurrentTime();
              const staleness = (Date.now() - new Date(data.updatedAt).getTime()) / 1000;

              // 5-second offline detection for abrupt disconnects
              if (staleness > 5 && !isCreator) {
                console.log(`Streamer went offline abruptly. Staleness: ${staleness}s`);
                toast.error('The streamer is offline.', {
                  toastId: 'offline-kick',
                  autoClose: false,
                });
                clearInterval(heartbeatInterval);
                setTimeout(() => window.location.reload(), 2000);
                return;
              }

              const compensatedTime = data.isPaused
                ? data.currentTime
                : data.currentTime + staleness;

              // Force seek if listener is > 2s off (including staleness)
              const now = Date.now();
              if (Math.abs(myTime - compensatedTime) > 2 && now - lastSeekRef.current > 2000) {
                console.log(`📡 Syncing with staleness compensation: +${staleness.toFixed(2)}s`);
                lastSeekRef.current = now;
                playerRef.current.seekTo(compensatedTime, true);
              }

              // Sync Play/Pause
              if (playing === data.isPaused) {
                // If mismatch
                setPlaying(!data.isPaused);
              }

              // If song changed remotely, refresh
              if (data.stream && currentVideo?.id !== data.stream.id) {
                console.log('🎵 Song changed remotely, refreshing...');
                refreshStreams();
              }

              // Update viewer count for everyone
              if (data.actualViewerCount !== undefined) {
                setViewerCount(data.actualViewerCount);
              }

              // If stream privacy changed to private, hard refresh for listeners to force them to the access gate
              if (data.isPublic === false && streamIsPublic === true && !isCreator) {
                console.log('🔒 Stream became private, refreshing page...');
                window.location.reload();
                return; // Stop processing this heartbeat
              }
              setStreamIsPublic(data.isPublic);

              if (
                playerRef.current &&
                !data.isPaused &&
                typeof playerRef.current.getDuration === 'function'
              ) {
                const duration = playerRef.current.getDuration();
                const current = playerRef.current.getCurrentTime();
                if (duration > 0 && duration - current < 3) {
                  playNext();
                }
              }

              // Process events
              if (data.events && data.events.length > 0) {
                data.events.forEach((event: StreamEvent) => {
                  switch (event.type) {
                    case 'STREAM_FORCE_CLOSED':
                    case 'CREATOR_ROLE_REVOKED':
                      toast.error(event.message, { autoClose: false, toastId: event.id });
                      setTimeout(() => router.push('/discover'), 3000);
                      break;
                    case 'USER_BANNED_PLATFORM':
                    case 'USER_TIMED_OUT_PLATFORM':
                    case 'USER_BANNED_STREAM':
                    case 'USER_TIMED_OUT_STREAM':
                      toast.warning(event.message, { autoClose: 5000, toastId: event.id });
                      break;
                    case 'SONG_SKIPPED_BY_CREATOR':
                    case 'SONG_REMOVED_BY_MOD':
                    case 'MOD_PROMOTED':
                      toast.info(event.message, { autoClose: 3000, toastId: event.id });
                      break;
                    case 'MOD_DEMOTED':
                      // event.message contains the targetUserId
                      if (event.message === currentUserId) {
                        console.log('⚠️ You have been demoted. Refreshing...');
                        window.location.reload();
                      }
                      break;
                  }
                });
              }
            }
          } else {
            // Viewer waiting for approval — poll refreshStreams to pick up access changes
            refreshStreams();
          }

          // If we reach here, heartbeat succeeded
          if (heartbeatFailCount > 0) {
            setHeartbeatFailCount(0);
            toast.dismiss('heartbeat-warning');
            toast.success('Reconnected!', { autoClose: 2000 });
          }
        } catch (err) {
          console.error('Heartbeat failed:', err);
          setHeartbeatFailCount((prev) => {
            const newCount = prev + 1;
            if (newCount === MAX_HEARTBEAT_FAILURES) {
              toast.warning('Connection unstable. Attempting to reconnect...', {
                toastId: 'heartbeat-warning', // prevent duplicate toasts
                autoClose: false,
              });
            }
            if (newCount >= MAX_HEARTBEAT_FAILURES) {
              // Force a full queue refresh as a recovery attempt
              refreshStreams();
            }
            return newCount;
          });
        }
      },
      pathname.startsWith('/party/') ? 500 : 2000,
    );

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [creatorId, pathname, isJoined, playing, currentVideo, refreshStreams, heartbeatFailCount]);

  //
  // SSE connection for viewers — replaces the 500ms poll when healthy.
  // Falls back to the heartbeat poll automatically when EventSource errors.
  //
  useEffect(() => {
    const isViewer = pathname.startsWith('/party/');
    if (!isViewer || !isJoined) return;

    let es: EventSource | null = null;

    const connect = () => {
      es = new EventSource(`/api/streams/${creatorId}/events`);

      es.onopen = () => {
        console.log('🔴 SSE connected');
        sseActiveRef.current = true;
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!playerRef.current) return;

          const myTime = playerRef.current.getCurrentTime?.() ?? 0;
          const staleness = (Date.now() - new Date(data.updatedAt).getTime()) / 1000;

          // Offline detection — if updatedAt is stale the host dropped
          if (staleness > 10) {
            toast.error('The streamer is offline.', { toastId: 'offline-kick', autoClose: false });
            setTimeout(() => window.location.reload(), 2000);
            return;
          }

          const compensatedTime = data.isPaused ? data.currentTime : data.currentTime + staleness;

          // Drift correction
          const now = Date.now();
          if (Math.abs(myTime - compensatedTime) > 2 && now - lastSeekRef.current > 2000) {
            console.log(`📡 [SSE] Drift corrected: ${(myTime - compensatedTime).toFixed(2)}s`);
            lastSeekRef.current = now;
            playerRef.current.seekTo(compensatedTime, true);
          }

          // Play/Pause sync
          if (data.isPaused !== undefined) {
            setPlaying(!data.isPaused);
            setIsPaused(data.isPaused);
          }

          // Song changed remotely
          if (data.stream && currentVideo?.id !== data.stream.id) {
            console.log('🎵 [SSE] Song changed remotely, refreshing...');
            refreshStreams();
          }
        } catch (err) {
          console.error('[SSE] Failed to parse message:', err);
        }
      };

      es.onerror = () => {
        // EventSource will auto-reconnect; mark SSE inactive so the
        // fallback heartbeat poll takes over during the gap.
        console.warn('⚠️ SSE connection lost — falling back to polling');
        sseActiveRef.current = false;
        // Don't close; browser reconnects automatically.
      };
    };

    connect();

    return () => {
      console.log('🔴 SSE disconnected');
      sseActiveRef.current = false;
      es?.close();
    };
  }, [creatorId, pathname, isJoined, currentVideo?.id]);

  // useEffect(() => {
  //     if (currentVideo?.title) {
  //         fetch(`/api/streams/recommendations?videoTitle=${encodeURIComponent(currentVideo.title)}&videoId=${currentVideo.extractedId}`)
  //             .then(res => res.json())
  //             .then(data => {
  //                 if (data.recommendations) {
  //                     setRecommendations(data.recommendations);
  //                 }
  //             })
  //             .catch(err => console.error("Error fetching recommendations:", err));
  //     }
  // }, [currentVideo?.id]);

  // Apply cached sync once player is ready
  useEffect(() => {
    if (lastSync && playerRef.current) {
      console.log('🎯 Applying last cached sync:', lastSync);
      playerRef.current.seekTo(lastSync.currentTime, true);
      if (lastSync.type === 'play') {
        setPlaying(true);
        setIsPaused(false);
      } else {
        setPlaying(false);
        setIsPaused(true);
      }
      setLastSync(null);
    }
  }, [lastSync]);

  // When current video changes, start playing it
  useEffect(() => {
    if (currentVideo) {
      if (isJoined) {
        setPlaying(true);
      } else {
        setPlaying(false);
      }
    }
  }, [currentVideo, pathname, isJoined]);

  useEffect(() => {
    if (!currentVideo?.extractedId) return;

    // Reset ready state on video change
    setIsPlayerReady(false);
    setResolvedUrl(null);
    setIsResolving(false);

    // Force-enable GO LIVE after 5s if onReady never fires
    const fallbackTimer = setTimeout(() => {
      setIsPlayerReady(true);
      console.warn('⚠️ onReady never fired — forcing player ready state');
    }, 5000);

    return () => clearTimeout(fallbackTimer);
  }, [currentVideo?.extractedId]);

  useEffect(() => {
    if (
      debouncedVideoLink.length >= 2 &&
      !debouncedVideoLink.match(YT_REGEX) &&
      !debouncedVideoLink.match(SPOTIFY_TRACK_REGEX) &&
      !debouncedVideoLink.match(PLAYLIST_REGEX) &&
      !debouncedVideoLink.match(SPOTIFY_PLAYLIST_REGEX)
    ) {
      handleSearch(debouncedVideoLink);
    } else {
      setSearchResults([]);
    }
  }, [debouncedVideoLink]);

  const handleSearch = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setIsSearching(true);
      const res = await fetch(`/api/streams/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = async (video: any) => {
    setSearchResults([]);
    setVideoLink('');
    setLoading(true);
    try {
      const res = await fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: creatorId,
          url: `https://www.youtube.com/watch?v=${video.id}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Added ${video.title}`);
        refreshStreams();
      } else {
        toast.error(data.message || 'Failed to add video');
      }
    } catch (err) {
      toast.error('Error adding video');
    } finally {
      setLoading(false);
    }
  };

  const blockVideo = async (videoId: string) => {
    try {
      await fetch('/api/streams/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      console.log(`🚫 Video ${videoId} blacklisted.`);
    } catch (err) {
      console.error('Failed to block video:', err);
    }
  };

  const handleAddFromPlaylist = async (video: any) => {
    try {
      const videoUrl = video.isSpotify ? video.url : `https://www.youtube.com/watch?v=${video.id}`;
      const res = await fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: creatorId,
          url: videoUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.message || 'Failed to add video';
        toast.error(errorMsg);
        addLog('error', `Failed ${video.title}: ${errorMsg}`);
        return;
      }
      toast.success(`Added ${video.title}`);
      addLog('success', `Added from playlist: ${video.title}`);
      refreshIfStale();
    } catch {
      toast.error('Error adding video');
      addLog('error', `Error adding video: ${video.title}`);
    }
  };

  const handleAddAllFromPlaylist = async () => {
    setIsPlaylistModalOpen(false);
    const videosToProcess = [...playlistVideos];
    const total = videosToProcess.length;
    let successCount = 0;
    let failCount = 0;

    if (total === 0) return;

    toast.info(`Adding ${total} videos...`, { autoClose: 5000 });
    console.log(`🚀 Starting bulk add for ${total} videos`);

    for (let i = 0; i < total; i++) {
      const video = videosToProcess[i];
      if (!video) {
        console.warn(`⚠️ Skipping null video at index ${i}`);
        continue;
      }

      // Throttling: Gap of 5 seconds after the first 5 songs to avoid rate limits
      if (i >= 5) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      try {
        const targetUrl =
          video.url || (video.id ? `https://www.youtube.com/watch?v=${video.id}` : null);

        if (!targetUrl) {
          console.error(`❌ No URL or ID found for video at index ${i}:`, video);
          failCount++;
          continue;
        }

        const res = await fetch('/api/streams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creatorId: creatorId,
            url: targetUrl,
          }),
        });

        if (res.ok) {
          successCount++;
          addLog('success', `Added: ${video.title}`);
        } else {
          failCount++;
          const errData = await res.json().catch(() => ({}));
          const errorMsg = errData.message || 'Server error';
          console.error(`❌ Failed to add "${video.title}":`, errorMsg);
          addLog('error', `Skip ${video.title}: ${errorMsg}`);
        }
      } catch (err) {
        failCount++;
        console.error(`❌ Network error adding "${video.title}":`, err);
        addLog('error', `Network Error: ${video.title}`);
      }

      // Periodically refresh the queue to show progress
      if ((i + 1) % 5 === 0 || i === total - 1) {
        refreshIfStale();
      }
    }

    if (failCount > 0) {
      toast.warning(`Bulk add finished: ${successCount} added, ${failCount} skipped.`);
    } else {
      toast.success(`Successfully added all ${successCount} songs!`);
    }
    setVideoLink('');
  };

  const handleRemove = async (streamId: string) => {
    try {
      const res = await fetch('/api/streams/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to remove stream');
      }

      toast.success('Song removed from queue');
      refreshIfStale();
    } catch (err: any) {
      toast.error(err.message || 'Error removing song');
    }
  };

  const handleVote = async (id: string, isUpvote: boolean) => {
    console.log('Voting for Stream ID:', id);

    // Save snapshot for rollback
    const previousQueue = [...queue];

    // Optimistic update
    setQueue(
      queue
        .map((video) =>
          video.id === id
            ? {
                ...video,
                upvotes: isUpvote ? video.upvotes + 1 : video.upvotes - 1,
                haveUpvoted: !video.haveUpvoted,
              }
            : video,
        )
        .sort((a, b) => b.upvotes - a.upvotes),
    );

    try {
      const res = await fetch(`/api/streams/${isUpvote ? 'upvote' : 'downvote'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId: id }),
      });

      if (!res.ok) throw new Error('Vote failed');
    } catch (err) {
      console.error('Vote failed, reverting:', err);
      setQueue(previousQueue); // Rollback
      toast.error('Failed to register vote. Please try again.');
    }
  };

  const playNext = async () => {
    try {
      setPlayNextLoader(true);
      const response = await fetch('/api/streams/next', { method: 'GET' });

      if (!response.ok) {
        const errMsg = await response.json();
        console.log('Fetch failed:', errMsg.message);
        return;
      }

      const json = await response.json();

      if (!json.stream) {
        console.warn('No stream received');
        return;
      }

      // With react-player, no cleanup needed — the URL change handles it
      setCurrentVideo(json.stream);
      setQueue((q) => q.filter((x) => x.id !== json.stream.id));
      setPlaying(true);
      toast.info(`Now playing: ${json.stream.title}`);
    } catch (e) {
      console.error('Error: ', e);
    } finally {
      setPlayNextLoader(false);
    }
  };

  // Removed handleRestrictedVideo as we now favor raw iframe fallback

  const stopQueue = async () => {
    try {
      const response = await fetch('/api/streams/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to stop queue');
      }

      // With react-player, no imperative cleanup needed
      setCurrentVideo(null);
      setPlaying(false);
      setQueue([]);
      refreshIfStale();
      toast.success('Queue stopped and cleared!');

      console.log('Queue successfully cleared');
    } catch (error) {
      console.error('Error stopping queue:', error);
      toast.error('Failed to stop queue');
    }
  };

  const handleGoLive = async () => {
    if (!playerRef.current) return;

    // Autoplay compliance: call playVideo directly within the user gesture handler
    if (typeof playerRef.current.playVideo === 'function') {
      playerRef.current.playVideo();
    }

    setIsJoined(true);

    // Immediate Sync Pull for Listeners
    const isListener = pathname.startsWith('/party/');
    if (isListener) {
      try {
        const res = await fetch('/api/streams/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creatorId }),
        });
        const data = await res.json();
        if (data.currentTime !== undefined) {
          console.log('🎯 Immediate sync on join:', data.currentTime);
          playerRef.current.seekTo(data.currentTime, true);
          setPlaying(!data.isPaused);
          setIsPaused(data.isPaused);
        }
      } catch (err) {
        console.error('Initial join sync failed:', err);
      }
    } else {
      // Host just starts playing
      setPlaying(true);
    }

    // Final sync attempt (Pusher fallback)
    if (lastSync) {
      console.log('Applying final cached sync on join:', lastSync);
      playerRef.current.seekTo(lastSync.currentTime, true);
      if (lastSync.type === 'play') setPlaying(true);
      else setPlaying(false);
      setLastSync(null);
    }

    // Request an up-to-date sync from creator (Broadcast)
    fetch('/api/streams/sync/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatorId }),
    });
  };

  const handleRequestAccess = async () => {
    try {
      const res = await fetch('/api/streams/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamerId: creatorId, action: 'request' }),
      });
      if (res.ok) {
        toast.success('Access request sent!');
        refreshStreams();
      }
    } catch (err) {
      toast.error('Failed to send request');
    }
  };

  const handleToggleFavorite = async () => {
    try {
      const res = await fetch('/api/user/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favoriteId: creatorId }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsFavorite(data.message.includes('Added'));
        toast.success(data.message);
      }
    } catch (err) {
      toast.error('Failed to update favorites');
    }
  };

  const handleShare = () => {
    const sharableLink = `${window.location.protocol}//${window.location.host}/party/${creator?.partyCode || creatorId}`;
    navigator.clipboard.writeText(sharableLink).then(() => {
      toast.success('Link Copied to Clipboard!');
    });
  };

  const handleToggleStreamVisibility = async () => {
    const newState = !streamIsPublic;
    setStreamIsPublic(newState);
    try {
      const updaters = [
        fetch('/api/user/privacy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublic: newState }),
        }),
      ];

      if (currentVideo) {
        updaters.push(
          fetch(`/api/streams/${currentVideo.id}/visibility`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isPublic: newState }),
          }),
        );
      }

      const results = await Promise.all(updaters);
      if (results.every((res) => res.ok)) {
        toast.success(`Stream is now ${newState ? 'Public' : 'Private'}`);
      } else {
        throw new Error();
      }
    } catch {
      setStreamIsPublic(!newState);
      toast.error('Failed to update visibility');
    }
  };

  const handleSaveMetadata = async () => {
    if (!currentVideo) return;
    setIsSavingMetadata(true);
    try {
      const res = await fetch('/api/streams/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId: currentVideo.id,
          title: streamTitle,
          genre: streamGenre,
        }),
      });
      if (res.ok) {
        toast.success('Stream settings updated!');
        refreshStreams();
      } else {
        toast.error('Failed to update stream settings');
      }
    } catch (err) {
      toast.error('Error saving settings');
    } finally {
      setIsSavingMetadata(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 px-3 sm:px-6 md:px-12 lg:px-20 pt-4 md:pt-6 pb-safe text-white overflow-x-hidden">
      {accessStatus === 'BANNED' || !!restriction ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-red-900/20 backdrop-blur-md border border-red-500/20 my-8 mx-4 md:mx-0 rounded-[2rem] animate-in fade-in zoom-in duration-500 min-h-[60vh]">
          <div className="p-6 bg-red-500/10 rounded-full border border-red-500/20 mb-6 shadow-2xl shadow-red-500/10">
            <ShieldAlert className="w-16 h-16 text-red-500" />
          </div>
          <h3 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter italic">
            Join Restricted
          </h3>
          <p className="text-gray-400 mb-2 max-w-sm text-center px-4 font-black uppercase text-[10px] tracking-widest leading-relaxed">
            {restriction?.scope === 'PLATFORM'
              ? 'Your account has a platform-wide restriction.'
              : 'You have been timed out or banned from this stream.'}
          </p>
          {restriction?.reason && (
            <p className="text-red-400/60 mb-8 max-w-sm text-center px-4 font-medium italic text-xs">
              "{restriction.reason}"
            </p>
          )}

          {restriction?.bannedUntil && (
            <div className="flex flex-col items-center mb-8">
              <Countdown until={restriction.bannedUntil} />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                Access restored at{' '}
                {new Date(restriction.bannedUntil).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                ({new Date(restriction.bannedUntil).toLocaleDateString()})
              </p>
            </div>
          )}

          <Button
            onClick={() => router.push('/discover')}
            className="bg-white/5 hover:bg-white/10 text-white border border-white/10 font-black uppercase tracking-widest px-8 py-3 h-14 rounded-2xl transition-all shadow-xl"
          >
            Explore Other Streams
          </Button>
        </div>
      ) : !pathname.startsWith('/stream') &&
        currentUserId !== null &&
        accessStatus !== 'APPROVED' &&
        currentUserId !== creatorId ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-black/40 backdrop-blur-md rounded-xl border border-gray-800 my-8">
          <Lock className="w-16 h-16 text-yellow-500 mb-6 animate-bounce" />
          <h3 className="text-2xl font-bold text-white mb-2">Private Stream</h3>
          <p className="text-gray-400 mb-8 max-w-sm text-center px-4">
            This stream is private. You need the streamer&apos;s approval to join and listen.
          </p>
          {accessStatus === 'PENDING' ? (
            <div className="px-6 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-yellow-500 font-bold flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              WAITING FOR APPROVAL
            </div>
          ) : (
            <Button
              onClick={handleRequestAccess}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all text-lg"
            >
              Request Access
            </Button>
          )}
        </div>
      ) : (
        <div className="max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 pb-16 md:pb-20">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                  Now Playing
                </h2>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5 shadow-lg w-full sm:w-auto justify-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs font-black tracking-widest uppercase text-gray-300">
                      {' '}
                      {viewerCount} Viewers{' '}
                    </span>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    {currentUserId === creatorId && currentVideo && (
                      <Button
                        onClick={handleToggleStreamVisibility}
                        variant="outline"
                        className={`h-11 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 flex flex-1 sm:flex-none items-center justify-center gap-3 ${streamIsPublic ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20' : 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20'}`}
                      >
                        {streamIsPublic ? (
                          <Globe className="w-4 h-4" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                        {streamIsPublic ? 'Public' : 'Private'}
                      </Button>
                    )}
                    {currentUserId !== creatorId && (
                      <Button
                        onClick={handleToggleFavorite}
                        variant="outline"
                        className={`border-gray-800 font-bold px-4 py-2 w-full sm:w-auto rounded-xl transition-all shadow-lg active:scale-95 ${isFavorite ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' : 'bg-gray-900/50 text-gray-400 hover:text-white'}`}
                      >
                        <Star className={`w-4 h-4 mr-2 ${isFavorite ? 'fill-yellow-500' : ''}`} />
                        {isFavorite ? 'Favorited' : 'Favorite'}
                      </Button>
                    )}
                    <Button
                      onClick={handleShare}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                      <Share2 className="w-4 h-4 mr-2" /> Share
                    </Button>
                  </div>
                </div>
              </div>

              <Card className="bg-gray-900/50 border-gray-800 overflow-hidden backdrop-blur-sm shadow-2xl flex flex-col justify-center">
                <CardContent className="p-0 relative flex-1 flex flex-col">
                  {!pathname.startsWith('/stream') &&
                  currentUserId !== null &&
                  accessStatus !== 'APPROVED' &&
                  currentUserId !== creatorId ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black/60 backdrop-blur-sm">
                      <Lock className="w-16 h-16 text-yellow-500 mb-6 animate-bounce" />
                      <h3 className="text-2xl font-bold text-white mb-2">Private Stream</h3>
                      <p className="text-gray-400 mb-8 max-w-sm text-center px-4">
                        This stream is private. You need the streamer&apos;s approval to join and
                        listen.
                      </p>
                      {accessStatus === 'PENDING' ? (
                        <div className="px-6 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-yellow-500 font-bold flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                          WAITING FOR APPROVAL
                        </div>
                      ) : (
                        <Button
                          onClick={handleRequestAccess}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all text-lg"
                        >
                          Request Access
                        </Button>
                      )}
                    </div>
                  ) : (
                    <PlayerSection
                      currentVideo={currentVideo}
                      playVideo={playVideo}
                      playing={playing}
                      isMuted={isMuted}
                      isPaused={isPaused}
                      isJoined={isJoined}
                      isPlayerReady={isPlayerReady}
                      resolvedUrl={resolvedUrl}
                      pathname={pathname}
                      creatorId={creatorId}
                      currentUserId={currentUserId}
                      accessStatus={accessStatus}
                      volume={volume}
                      playerRef={playerRef}
                      onReady={(player) => {
                        console.log('✅ YouTube Player Ready');
                        setIsPlayerReady(true);
                      }}
                      onPlay={() => {
                        const isCreator = !pathname.startsWith('/party/');
                        if (!isJoined && !isCreator) return;
                        setIsPaused(false);
                        setPlaying(true);
                        if (isCreator && playerRef.current) {
                          const currentTime = playerRef.current.getCurrentTime() || 0;
                          fetch('/api/streams/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ creatorId, type: 'play', currentTime }),
                          });
                        }
                      }}
                      onPause={() => {
                        const isCreator = !pathname.startsWith('/party/');
                        if (!isJoined && !isCreator) return;
                        setIsPaused(true);
                        setPlaying(false);
                        if (isCreator && playerRef.current) {
                          const currentTime = playerRef.current.getCurrentTime() || 0;
                          fetch('/api/streams/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ creatorId, type: 'pause', currentTime }),
                          });
                        }
                      }}
                      onEnded={() => {
                        console.log('Video ended, playing next');
                        playNext();
                      }}
                      onError={(err) => {
                        if (!currentVideo) return;
                        console.warn(
                          '⚠️ YouTube Player error:',
                          err,
                          'for ID:',
                          currentVideo.extractedId,
                        );

                        const isEmbedRestricted = err === 101 || err === 150;
                        const isInvalidVideo = err === 2 || err === 100;

                        if (isInvalidVideo) {
                          toast.error('Video unavailable. Skipping...');
                          playNext();
                          return;
                        }

                        if (isEmbedRestricted) {
                          toast.error('Embed restricted for this video. Skipping...');
                          blockVideo(currentVideo.extractedId);
                          playNext();
                          return;
                        }

                        console.error('Unknown player error:', err);
                        toast.error('Playback error. Skipping...');
                        playNext();
                      }}
                      onGoLive={handleGoLive}
                      onMuteToggle={() => setIsMuted(!isMuted)}
                      onVolumeChange={(v) => {
                        setVolume(v);
                        if (v > 0) setIsMuted(false);
                      }}
                      onPlayClick={async () => {
                        if (!pathname.startsWith('/party/')) {
                          setPlaying(true);
                          setIsPaused(false);
                          const currentTime = playerRef.current?.getCurrentTime() || 0;
                          try {
                            await fetch('/api/streams/sync', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ creatorId, type: 'play', currentTime }),
                            });
                          } catch (err) {
                            // eslint-disable-next-line no-console
                            console.error(err);
                          }
                        }
                      }}
                      onRequestAccess={handleRequestAccess}
                    />
                  )}
                </CardContent>
              </Card>

              {!pathname.startsWith('/party/') && (
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  {currentVideo && (
                    <Button
                      onClick={() => {
                        if (playing) {
                          playerRef.current.pauseVideo();
                          setPlaying(false);
                          setIsPaused(true);
                          // Trigger manual sync
                          const currentTime = playerRef.current.getCurrentTime() || 0;
                          fetch('/api/streams/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ creatorId, type: 'pause', currentTime }),
                          }).catch(console.error);
                        } else {
                          playerRef.current.playVideo();
                          setPlaying(true);
                          setIsPaused(false);
                          // Trigger manual sync
                          const currentTime = playerRef.current.getCurrentTime() || 0;
                          fetch('/api/streams/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ creatorId, type: 'play', currentTime }),
                          }).catch(console.error);
                        }
                      }}
                      className="w-full sm:flex-1 h-11 sm:h-12 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl"
                    >
                      {playing ? (
                        <Pause className="mr-2 h-5 w-5 fill-current" />
                      ) : (
                        <Play className="mr-2 h-5 w-5 fill-current" />
                      )}
                      {playing ? 'Pause' : 'Play'}
                    </Button>
                  )}
                  <Button
                    disabled={playNextLoader || (!currentVideo && queue.length === 0)}
                    onClick={playNext}
                    className={`w-full sm:flex-1 h-11 sm:h-12 text-white font-bold rounded-xl transition-all ${
                      currentVideo
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <Play className="mr-2 h-5 w-5 fill-current" />
                    {playNextLoader ? 'Loading...' : currentVideo ? 'Skip' : 'Start'}
                  </Button>
                  {(currentVideo || queue.length > 0) && (
                    <Button
                      onClick={stopQueue}
                      variant="destructive"
                      className="w-full sm:flex-1 h-11 sm:h-12 font-bold rounded-xl"
                    >
                      Stop Queue
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-1 space-y-8">
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Add to Queue</h2>
                <SearchBar
                  videoLink={videoLink}
                  searchResults={searchResults}
                  isSearching={isSearching}
                  loading={loading}
                  onChange={(v) => {
                    setVideoLink(v);
                    if (
                      v.match(YT_REGEX) ||
                      v.match(SPOTIFY_TRACK_REGEX) ||
                      v.match(PLAYLIST_REGEX) ||
                      v.match(SPOTIFY_PLAYLIST_REGEX)
                    ) {
                      setSearchResults([]);
                    }
                  }}
                  onSubmit={handleSubmit}
                  onSelectResult={handleSelectSearchResult}
                />

                <AnimatePresence>
                  {showSpotifyPrompt && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="p-4 bg-gray-900 border border-green-800 rounded-2xl flex items-center gap-4 mt-4"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">
                          Connect Spotify to use Spotify links
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Required to resolve Spotify track metadata
                        </p>
                      </div>

                      <a
                        href="/api/auth/spotify-connect"
                        className="bg-green-500 hover:bg-green-600 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                      >
                        Connect
                      </a>
                      <button
                        onClick={() => setShowSpotifyPrompt(false)}
                        className="text-gray-500 hover:text-gray-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <QueueSection
                queue={queue}
                currentUserId={currentUserId}
                creatorId={creatorId}
                onVote={handleVote}
                onRemove={handleRemove}
              />
            </div>
          </div>

          {/* MANAGEMENT PANEL — visible to creator, mods, and owner */}
          {(currentUserId === creatorId ||
            streamRole === 'MODERATOR' ||
            streamRole === 'OWNER') && (
            <div className="pb-20 border-t border-white/5 pt-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div
                className={`grid grid-cols-1 ${currentUserId === creatorId || streamRole === 'OWNER' ? 'lg:grid-cols-2' : ''} gap-8 items-start`}
              >
                {/* ── Session Settings ──────────────────── */}
                {(currentUserId === creatorId || streamRole === 'OWNER') && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent/10 rounded-xl border border-accent/20">
                        <Settings className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black tracking-tighter uppercase italic">
                          Session Settings
                        </h3>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          Branding &amp; Metadata
                        </p>
                      </div>
                    </div>
                    <Card className="bg-white/[0.02] border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                      <CardContent className="p-6 space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                            Stream Title
                          </label>
                          <Input
                            value={streamTitle}
                            onChange={(e) => setStreamTitle(e.target.value)}
                            placeholder="Enter a catchy title..."
                            className="h-12 bg-white/5 border-white/10 rounded-2xl focus:ring-accent/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                            Genre (Optional)
                          </label>
                          <Input
                            value={streamGenre}
                            onChange={(e) => setStreamGenre(e.target.value)}
                            placeholder="e.g. Chill, Lofi, Gaming"
                            className="h-12 bg-white/5 border-white/10 rounded-2xl focus:ring-accent/30"
                          />
                        </div>
                        <Button
                          onClick={handleSaveMetadata}
                          disabled={isSavingMetadata || !currentVideo}
                          className="w-full h-12 rounded-2xl bg-accent hover:bg-accent/90 text-white font-black uppercase tracking-widest gap-2 shadow-lg shadow-accent/20"
                        >
                          {isSavingMetadata ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          Update Settings
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* ── Live Viewers ──────────────────────── */}
                <StreamManagement
                  creatorId={creatorId}
                  userRole={streamRole}
                  currentUserId={currentUserId || undefined}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <ActivityLog
        logs={activityLogs}
        onClear={() => {
          setActivityLogs([]);
          localStorage.removeItem(`echodeck-logs-${creatorId}`);
        }}
      />
      <PlaylistModal
        isOpen={isPlaylistModalOpen}
        title={playlistTitle}
        videos={playlistVideos}
        onClose={() => setIsPlaylistModalOpen(false)}
        onAddOne={handleAddFromPlaylist}
        onAddAll={handleAddAllFromPlaylist}
      />
    </div>
  );
}
