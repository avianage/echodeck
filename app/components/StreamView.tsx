"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Share2, Play, Star, Lock } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css'
import { PLAYLIST_REGEX, SPOTIFY_PLAYLIST_REGEX, YT_REGEX, SPOTIFY_TRACK_REGEX } from "@/app/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Appbar } from "./Appbar";
import ReactPlayer from "react-player";
import { usePathname } from "next/navigation";
import { useDebounce } from "@/app/lib/useDebounce";
import { PlayerSection } from "./PlayerSection";
import { SearchBar } from "./SearchBar";
import { QueueSection } from "./QueueSection";
import { ActivityLog } from "./ActivityLog";
import { PlaylistModal } from "./PlaylistModal";

interface Video {
    id: string,
    type: string,
    url: string,
    extractedId: string,
    title: string,
    smallImg: string,
    bigImg: string,
    active: string,
    userId: string,
    addedById: string,
    upvotes: number,
    haveUpvoted: boolean,
    playedTs: string | null
}

const REFRESH_INTERVAL_MS = 10 * 1000;

export default function StreamView({
    creatorId,
    playVideo = false
}: {
    creatorId: string,
    playVideo: boolean
}) {
    const [videoLink, setVideoLink] = useState('');
    const [queue, setQueue] = useState<Video[]>([]);
    const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
    const [loading, setLoading] = useState(false);
    const [playNextLoader, setPlayNextLoader] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [lastSync, setLastSync] = useState<{ type: "play" | "pause", currentTime: number } | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [isJoined, setIsJoined] = useState(false);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
    const [playlistVideos, setPlaylistVideos] = useState<any[]>([]);
    const [playlistTitle, setPlaylistTitle] = useState("");
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
    const [activityLogs, setActivityLogs] = useState<{ type: "success" | "error", message: string, timestamp: number }[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [creator, setCreator] = useState<{ id: string, email: string, isPublic: boolean } | null>(null);
    const [accessStatus, setAccessStatus] = useState<string | null>(null);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [isFavorite, setIsFavorite] = useState(false);
    const [volume, setVolume] = useState(0.8);
    const [heartbeatFailCount, setHeartbeatFailCount] = useState(0);
    const [isResolving, setIsResolving] = useState(false);
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



    const addLog = (type: "success" | "error", message: string) => {
        setActivityLogs(prev => [{ type, message, timestamp: Date.now() }, ...prev].slice(0, 10));
    };

    const reactPlayerRef = useRef<ReactPlayer | null>(null);
    const pathname = usePathname();
    const isFixingRestrictedRef = useRef(false);


    const refreshStreams = useCallback(async (isInitial: boolean = false) => {
        try {
            lastRefreshRef.current = Date.now();
            console.log("Fetching streams from API...", isInitial ? "(Initial Load / Reset Access)" : "");
            const res = await fetch(`/api/streams/?creatorId=${creatorId}${isInitial ? "&resetAccess=true" : ""}`, {
                method: "GET",
                credentials: "include",
            });

            if (!res.ok) {
                console.warn("Stream fetch failed:", res.status, res.statusText);
                return;
            }

            const json = await res.json();
            setQueue((json.streams ?? []).sort((a: any, b: any) => {
                if (a.upvotes !== b.upvotes) {
                    return b.upvotes - a.upvotes;
                }
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }));
            setCurrentUserId(json.currentUserId);
            setCreator(json.creator);
            setAccessStatus(json.accessStatus);

            setCurrentVideo(video => {
                if (!json.activeStream?.stream) {
                    return null;
                }
                if (video?.id === json.activeStream.stream.id) {
                    return video;
                }
                return json.activeStream.stream
            });

            // Non-blocking: check if creator is already favorited
            fetch("/api/user/favorites")
                .then(r => r.ok ? r.json() : null)
                .then(favData => {
                    if (!favData) return;
                    const alreadyFav = favData.favorites?.some((f: any) => f.id === creatorId);
                    setIsFavorite(!!alreadyFav);
                })
                .catch(() => { /* favorites fetch failed silently */ });

            // If streamer, poll pending requests at most once every 30s
            if (json.currentUserId === creatorId) {
                const now = Date.now();
                if (now - lastAccessPollRef.current > 30_000) {
                    lastAccessPollRef.current = now;
                    const reqsRes = await fetch("/api/streams/access");
                    const reqsData = await reqsRes.json();
                    setPendingRequests(reqsData.requests || []);
                }
            }
        } catch (error) {
            console.error("Error Fetching Stream: ", error)
        }
    }, [creatorId]);

    const refreshIfStale = useCallback(() => {
        const stale = Date.now() - lastRefreshRef.current > 3000; // only refresh if >3s since last
        if (stale) refreshStreams();
    }, [refreshStreams]);

    const handleSubmit = useCallback(async (e?: React.FormEvent | KeyboardEvent) => {
        if (e && 'preventDefault' in e) e.preventDefault();
        if (!videoLink.trim()) return;

        const isUrl = videoLink.match(YT_REGEX) || videoLink.match(SPOTIFY_TRACK_REGEX) || videoLink.match(PLAYLIST_REGEX);

        if (!isUrl) {
            handleSearch(videoLink);
            return;
        }

        const playlistMatch = videoLink.match(PLAYLIST_REGEX) || videoLink.match(SPOTIFY_PLAYLIST_REGEX);
        if (playlistMatch) {
            const playlistId = playlistMatch[1];
            setLoading(true);
            try {
                const res = await fetch("/api/streams/playlist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ playlistId, url: videoLink })
                });
                if (!res.ok) throw new Error("Failed to fetch playlist");
                const data = await res.json();
                setPlaylistVideos(data.videos);
                setPlaylistTitle(data.title);
                setIsPlaylistModalOpen(true);
                setVideoLink("");
            } catch {
                toast.error("Could not load playlist. Make sure it's public.");
            } finally {
                setLoading(false);
            }
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/streams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    creatorId: creatorId,
                    url: videoLink
                })
            });
            const data = await res.json();
            if (!res.ok) {
                const errorMsg = data.message || "Failed to add video";
                toast.error(errorMsg);
                addLog("error", `Failed: ${videoLink} - ${errorMsg}`);
                throw new Error(errorMsg);
            }
            setQueue([...queue, data]);
            setVideoLink('');
            toast.success("Added to queue!");
            addLog("success", `Added single video: ${data.title}`);
            refreshIfStale();
        } catch (err: any) {
            console.error("Error adding video:", err);
        } finally {
            setLoading(false);
        }
    }, [videoLink, creatorId, queue, refreshIfStale]);


    useEffect(() => {
        console.log("🔵 StreamView mounted");

        return () => {
            console.log("🔴 StreamView unmounted");
        };
    }, []);


    useEffect(() => {
        const handleEnter = (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                handleSubmit(e as any);
            }
        };
        window.addEventListener("keydown", handleEnter);
        return () => window.removeEventListener("keydown", handleEnter);
    }, [handleSubmit]);


    const isFirstLoad = useRef(true);
    useEffect(() => {
        refreshStreams(isFirstLoad.current);
        isFirstLoad.current = false;

        // High-Frequency Heartbeat Sync System (Replaces Pusher)
        const heartbeatInterval = setInterval(async () => {
            const isCreator = !pathname.startsWith("/party/");
            try {
                    if (isCreator) {
                        // Streamer pushes state to DB
                        if (reactPlayerRef.current) {
                            const currentTime = reactPlayerRef.current.getCurrentTime() || 0;
                            await fetch("/api/streams/heartbeat", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    creatorId,
                                    currentTime,
                                    isPaused: !playing // Use actual state
                                })
                            });
                        }

                        // Poll pending requests every 5s so streamer sees requests quickly
                        const now = Date.now();
                        if (now - lastAccessPollRef.current > 5_000) {
                            lastAccessPollRef.current = now;
                            const reqsRes = await fetch("/api/streams/access");
                            if (reqsRes.ok) {
                                const reqsData = await reqsRes.json();
                                setPendingRequests(reqsData.requests || []);
                            }
                        }
                    } else if (isJoined) {
                    // Listener pulls state from DB
                    const res = await fetch("/api/streams/heartbeat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ creatorId })
                    });
                    const data = await res.json();

                    if (data.currentTime !== undefined && reactPlayerRef.current) {
                        const myTime = reactPlayerRef.current.getCurrentTime();
                        const staleness = (Date.now() - new Date(data.updatedAt).getTime()) / 1000;
                        const compensatedTime = data.isPaused 
                            ? data.currentTime 
                            : data.currentTime + staleness;

                        // Force seek if listener is > 2s off (including staleness)
                        if (Math.abs(myTime - compensatedTime) > 2) {
                            console.log(`📡 Syncing with staleness compensation: +${staleness.toFixed(2)}s`);
                            reactPlayerRef.current.seekTo(compensatedTime, 'seconds');
                        }

                        // Sync Play/Pause
                        if (playing === data.isPaused) { // If mismatch
                            setPlaying(!data.isPaused);
                        }

                        // If song changed remotely, refresh
                        if (data.stream && currentVideo?.id !== data.stream.id) {
                            console.log("🎵 Song changed remotely, refreshing...");
                            refreshStreams();
                        }
                    }
                } else {
                    // Viewer waiting for approval — poll refreshStreams to pick up access changes
                    refreshStreams();
                }

                // If we reach here, heartbeat succeeded
                if (heartbeatFailCount > 0) {
                    setHeartbeatFailCount(0);
                    toast.dismiss("heartbeat-warning");
                    toast.success("Reconnected!", { autoClose: 2000 });
                }
            } catch (err) {
                console.error("Heartbeat failed:", err);
                setHeartbeatFailCount(prev => {
                    const newCount = prev + 1;
                    if (newCount === MAX_HEARTBEAT_FAILURES) {
                        toast.warning("Connection unstable. Attempting to reconnect...", {
                            toastId: "heartbeat-warning", // prevent duplicate toasts
                            autoClose: false
                        });
                    }
                    if (newCount >= MAX_HEARTBEAT_FAILURES) {
                        // Force a full queue refresh as a recovery attempt
                        refreshStreams();
                    }
                    return newCount;
                });
            }
        }, 2000); // Check every 2s for "snappy" sync

        return () => {
            clearInterval(heartbeatInterval);
        };
    }, [creatorId, pathname, isJoined, playing, currentVideo, refreshStreams, heartbeatFailCount]);

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




    // Apply cached sync (from Pusher) once player is ready
    useEffect(() => {
        if (lastSync && reactPlayerRef.current) {
            console.log("🎯 Applying last cached sync:", lastSync);
            reactPlayerRef.current.seekTo(lastSync.currentTime, 'seconds');
            if (lastSync.type === "play") {
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
            console.warn("⚠️ onReady never fired — forcing player ready state");
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
            console.error("Search failed:", err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectSearchResult = async (video: any) => {
        setSearchResults([]);
        setVideoLink("");
        setLoading(true);
        try {
            const res = await fetch("/api/streams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    creatorId: creatorId,
                    url: `https://www.youtube.com/watch?v=${video.id}`
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Added ${video.title}`);
                refreshStreams();
            } else {
                toast.error(data.message || "Failed to add video");
            }
        } catch (err) {
            toast.error("Error adding video");
        } finally {
            setLoading(false);
        }
    };


    const resolveStream = async (videoId: string) => {
        try {
            setIsResolving(true);
            console.log("📡 SSR Resolution: Attempting to bypass restriction for:", videoId);
            const res = await fetch(`/api/streams/resolve?videoId=${videoId}`);
            const data = await res.json();
            if (data.url) {
                console.log("✅ SSR Resolution: Success! Using direct stream.");
                setResolvedUrl(`/api/streams/proxy?url=${encodeURIComponent(data.url)}`);
            } else {
                throw new Error(data.error || "No URL returned");
            }
        } catch (err) {
            console.error("❌ SSR Resolution: Failed", err);
            toast.error("This video cannot be played. Skipping...");
            playNext();
        } finally {
            setIsResolving(false);
        }
    };

    const handleAddFromPlaylist = async (video: any) => {
        try {
            const videoUrl = video.isSpotify ? video.url : `https://www.youtube.com/watch?v=${video.id}`;
            const res = await fetch("/api/streams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    creatorId: creatorId,
                    url: videoUrl
                })
            });
            const data = await res.json();
            if (!res.ok) {
                const errorMsg = data.message || "Failed to add video";
                toast.error(errorMsg);
                addLog("error", `Failed ${video.title}: ${errorMsg}`);
                return;
            }
            toast.success(`Added ${video.title}`);
            addLog("success", `Added from playlist: ${video.title}`);
            refreshIfStale();
        } catch {
            toast.error("Error adding video");
            addLog("error", `Error adding video: ${video.title}`);
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
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            try {
                const targetUrl = video.url || (video.id ? `https://www.youtube.com/watch?v=${video.id}` : null);

                if (!targetUrl) {
                    console.error(`❌ No URL or ID found for video at index ${i}:`, video);
                    failCount++;
                    continue;
                }

                const res = await fetch("/api/streams", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        creatorId: creatorId,
                        url: targetUrl
                    })
                });

                if (res.ok) {
                    successCount++;
                    addLog("success", `Added: ${video.title}`);
                } else {
                    failCount++;
                    const errData = await res.json().catch(() => ({}));
                    const errorMsg = errData.message || "Server error";
                    console.error(`❌ Failed to add "${video.title}":`, errorMsg);
                    addLog("error", `Skip ${video.title}: ${errorMsg}`);
                }
            } catch (err) {
                failCount++;
                console.error(`❌ Network error adding "${video.title}":`, err);
                addLog("error", `Network Error: ${video.title}`);
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
            const res = await fetch("/api/streams/remove", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ streamId })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to remove stream");
            }

            toast.success("Song removed from queue");
            refreshIfStale();
        } catch (err: any) {
            toast.error(err.message || "Error removing song");
        }
    };

    const handleVote = async (id: string, isUpvote: boolean) => {
        console.log("Voting for Stream ID:", id);
        
        // Save snapshot for rollback
        const previousQueue = [...queue];

        // Optimistic update
        setQueue(queue.map((video) =>
            video.id === id
                ? {
                    ...video,
                    upvotes: isUpvote ? video.upvotes + 1 : video.upvotes - 1,
                    haveUpvoted: !video.haveUpvoted
                }
                : video
        ).sort((a, b) => b.upvotes - a.upvotes));

        try {
            const res = await fetch(`/api/streams/${isUpvote ? "upvote" : "downvote"}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ streamId: id }),
            });

            if (!res.ok) throw new Error("Vote failed");
        } catch (err) {
            console.error("Vote failed, reverting:", err);
            setQueue(previousQueue); // Rollback
            toast.error("Failed to register vote. Please try again.");
        }
    };

    const playNext = async () => {
        try {
            setPlayNextLoader(true);
            const response = await fetch("/api/streams/next", { method: "GET" });

            if (!response.ok) {
                const errMsg = await response.json();
                console.log("Fetch failed:", errMsg.message);
                return;
            }

            const json = await response.json();

            if (!json.stream) {
                console.warn("No stream received");
                return;
            }

            // With react-player, no cleanup needed — the URL change handles it
            setCurrentVideo(json.stream);
            setQueue(q => q.filter(x => x.id !== json.stream.id));
            setPlaying(true);
            toast.info(`Now playing: ${json.stream.title}`);
        } catch (e) {
            console.error("Error: ", e);
        } finally {
            setPlayNextLoader(false);
        }
    };

    // Removed handleRestrictedVideo as we now favor raw iframe fallback


    const stopQueue = async () => {
        try {
            const response = await fetch("/api/streams/clear", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || "Failed to stop queue");
            }

            // With react-player, no imperative cleanup needed
            setCurrentVideo(null);
            setPlaying(false);
            setQueue([]);
            refreshIfStale();
            toast.success("Queue stopped and cleared!");

            console.log("Queue successfully cleared");
        } catch (error) {
            console.error("Error stopping queue:", error);
            toast.error("Failed to stop queue");
        }
    };


    const handleGoLive = async () => {
        if (!reactPlayerRef.current) return;

        setIsJoined(true);

        // Immediate Sync Pull for Listeners
        const isListener = pathname.startsWith("/party/");
        if (isListener) {
            try {
                const res = await fetch("/api/streams/heartbeat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ creatorId })
                });
                const data = await res.json();
                if (data.currentTime !== undefined) {
                    console.log("🎯 Immediate sync on join:", data.currentTime);
                    reactPlayerRef.current.seekTo(data.currentTime, 'seconds');
                    setPlaying(!data.isPaused);
                    setIsPaused(data.isPaused);
                }
            } catch (err) {
                console.error("Initial join sync failed:", err);
            }
        } else {
            // Host just starts playing
            setPlaying(true);
        }

        // Final sync attempt (Pusher fallback)
        if (lastSync) {
            console.log("Applying final cached sync on join:", lastSync);
            reactPlayerRef.current.seekTo(lastSync.currentTime, 'seconds');
            if (lastSync.type === "play") setPlaying(true);
            else setPlaying(false);
            setLastSync(null);
        }

        // Request an up-to-date sync from creator (Broadcast)
        fetch("/api/streams/sync/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creatorId })
        });
    };

    const handleRequestAccess = async () => {
        try {
            const res = await fetch("/api/streams/access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ streamerId: creatorId, action: "request" })
            });
            if (res.ok) {
                toast.success("Access request sent!");
                refreshStreams();
            }
        } catch (err) {
            toast.error("Failed to send request");
        }
    };

    const handleApprove = async (viewerId: string, approve: boolean) => {
        try {
            const res = await fetch("/api/streams/access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ viewerId, action: approve ? "approve" : "reject" })
            });
            if (res.ok) {
                toast.success(`Request ${approve ? "approved" : "rejected"}`);
                refreshStreams();
            }
        } catch (err) {
            toast.error("Failed to process request");
        }
    };

    const handleToggleFavorite = async () => {
        try {
            const res = await fetch("/api/user/favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ favoriteId: creatorId })
            });
            if (res.ok) {
                const data = await res.json();
                setIsFavorite(data.message.includes("Added"));
                toast.success(data.message);
            }
        } catch (err) {
            toast.error("Failed to update favorites");
        }
    };

    const handleShare = () => {
        const sharableLink = `${window.location.protocol}//${window.location.host}/party/${creatorId}`;
        navigator.clipboard.writeText(sharableLink).then(() => {
            toast.success("Link Copied to Clipboard!", {
                position: "top-right",
                autoClose: 3000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined
            });
        },
            (err) => {
                console.error("Could not copy: ", err);
                toast.error("Failed to copy link. Please Try Again", {
                    position: "top-right",
                    autoClose: 3000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined
                });
            }
        );
    };

    return (
        <div className="flex min-h-screen flex-col bg-gray-950 px-4 md:px-20 pt-6 pb-safe text-white overflow-x-hidden">
            <div className="mb-8">
                <Appbar />
            </div>

            {!pathname.startsWith("/stream") && currentUserId !== null && accessStatus !== "APPROVED" && currentUserId !== creatorId ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 bg-black/40 backdrop-blur-md rounded-xl border border-gray-800 my-8">
                    <Lock className="w-16 h-16 text-yellow-500 mb-6 animate-bounce" />
                    <h3 className="text-2xl font-bold text-white mb-2">Private Stream</h3>
                    <p className="text-gray-400 mb-8 max-w-sm text-center px-4">
                        This stream is private. You need the streamer&apos;s approval to join and listen.
                    </p>
                    {accessStatus === "PENDING" ? (
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
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-3xl font-bold text-white">Now Playing</h2>
                                <div className="flex gap-2">
                                    {currentUserId !== creatorId && (
                                        <Button
                                            onClick={handleToggleFavorite}
                                            variant="outline"
                                            className={`border-gray-800 font-bold px-4 py-2 rounded-xl transition-all shadow-lg active:scale-95 ${isFavorite ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" : "bg-gray-900/50 text-gray-400 hover:text-white"}`}
                                        >
                                            <Star className={`w-4 h-4 mr-2 ${isFavorite ? "fill-yellow-500" : ""}`} /> 
                                            {isFavorite ? "Favorited" : "Favorite"}
                                        </Button>
                                    )}
                                    <Button
                                        onClick={handleShare}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                                    >
                                        <Share2 className="w-4 h-4 mr-2" /> Share
                                    </Button>
                                </div>
                            </div>

                            <Card className="bg-gray-900/50 border-gray-800 overflow-hidden backdrop-blur-sm shadow-2xl">
                                <CardContent className="p-0 relative">
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
                                        pendingRequests={pendingRequests}
                                        volume={volume}
                                        reactPlayerRef={reactPlayerRef}
                                        onReady={() => {
                                            console.log('✅ ReactPlayer Ready');
                                            setIsPlayerReady(true);
                                        }}
                                        onPlay={() => {
                                            const isCreator = !pathname.startsWith("/party/");
                                            if (!isJoined && !isCreator) return;
                                            setIsPaused(false);
                                            setPlaying(true);
                                            if (isCreator && reactPlayerRef.current) {
                                                const currentTime = reactPlayerRef.current.getCurrentTime() || 0;
                                                fetch("/api/streams/sync", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ creatorId, type: "play", currentTime })
                                                });
                                            }
                                        }}
                                        onPause={() => {
                                            const isCreator = !pathname.startsWith("/party/");
                                            if (!isJoined && !isCreator) return;
                                            setIsPaused(true);
                                            setPlaying(false);
                                            if (isCreator && reactPlayerRef.current) {
                                                const currentTime = reactPlayerRef.current.getCurrentTime() || 0;
                                                fetch("/api/streams/sync", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ creatorId, type: "pause", currentTime })
                                                });
                                            }
                                        }}
                                        onEnded={() => {
                                            console.log('Video ended, playing next');
                                            playNext();
                                        }}
                                        onError={(err) => {
                                            if (!currentVideo) return;
                                            console.warn('⚠️ ReactPlayer error:', err, 'for ID:', currentVideo.extractedId);
                                            
                                            const isEmbedRestricted = err === 101 || err === 150;
                                            const isInvalidVideo = err === 2 || err === 100;

                                            if (isInvalidVideo) {
                                                toast.error("Video unavailable. Skipping...");
                                                playNext();
                                                return;
                                            }

                                            if (isEmbedRestricted) {
                                                if (!resolvedUrl) {
                                                    toast.info("Embed restricted. Resolving stream...");
                                                    resolveStream(currentVideo.extractedId);
                                                } else {
                                                    console.log("🔄 Restriction persists on resolved URL, skipping.");
                                                    toast.error("Playback failed. Skipping...");
                                                    playNext();
                                                }
                                                return;
                                            }

                                            console.error("Unknown player error:", err);
                                            toast.error("Playback error. Skipping...");
                                            playNext();
                                        }}
                                        onGoLive={handleGoLive}
                                        onApprove={handleApprove}
                                        onMuteToggle={() => setIsMuted(!isMuted)}
                                        onVolumeChange={(v) => {
                                            setVolume(v);
                                            if (v > 0) setIsMuted(false);
                                        }}
                                        onPlayClick={() => {
                                            if (!pathname.startsWith("/party/")) setPlaying(true);
                                        }}
                                        onRequestAccess={handleRequestAccess}
                                        isResolving={isResolving}
                                    />
                                </CardContent>
                            </Card>

                            {!pathname.startsWith("/party/") && (
                                <div className="flex gap-4">
                                    <Button
                                        disabled={playNextLoader}
                                        onClick={playNext}
                                        className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                                    >
                                        <Play className="mr-2 h-5 w-5 fill-current" />
                                        {playNextLoader ? "Loading..." : "Play Next"}
                                    </Button>
                                    <Button
                                        onClick={stopQueue}
                                        variant="destructive"
                                        className="flex-1 h-12 font-bold rounded-xl"
                                    >
                                        Stop Queue
                                    </Button>
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
                                        if (v.match(YT_REGEX) || v.match(SPOTIFY_TRACK_REGEX) || v.match(PLAYLIST_REGEX) || v.match(SPOTIFY_PLAYLIST_REGEX)) {
                                            setSearchResults([]);
                                        }
                                    }}
                                    onSubmit={handleSubmit}
                                    onSelectResult={handleSelectSearchResult}
                                />
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
                </div>
            )}

            <ToastContainer position="top-right" autoClose={3000} theme="dark" />

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
