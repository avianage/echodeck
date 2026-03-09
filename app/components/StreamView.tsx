/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Share2, Volume2, VolumeX, X, ListPlus, Plus, Trash2, ChevronUp, ChevronDown, Play, Music } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css'
import { PLAYLIST_REGEX, SPOTIFY_PLAYLIST_REGEX, YT_REGEX, SPOTIFY_TRACK_REGEX } from "@/app/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Appbar } from "./Appbar";
import ReactPlayer from "react-player/youtube";
import { usePathname } from "next/navigation";

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



    const addLog = (type: "success" | "error", message: string) => {
        setActivityLogs(prev => [{ type, message, timestamp: Date.now() }, ...prev].slice(0, 10));
    };

    const reactPlayerRef = useRef<ReactPlayer | null>(null);
    const pathname = usePathname();
    const isFixingRestrictedRef = useRef(false);


    const refreshStreams = useCallback(async () => {
        try {
            console.log("Fetching streams from API...");
            const res = await fetch(`/api/streams/?creatorId=${creatorId}`, {
                method: "GET",
                credentials: "include",
            });
            const json = await res.json();
            setQueue(json.streams.sort((a: any, b: any) => {
                if (a.upvotes !== b.upvotes) {
                    return b.upvotes - a.upvotes;
                }
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }));
            setCurrentUserId(json.currentUserId);

            setCurrentVideo(video => {
                if (!json.activeStream?.stream) {
                    // If no active stream exists, clear the video
                    return null;
                }
                if (!json.activeStream?.stream || video?.id === json.activeStream.stream.id) {
                    return video;
                }
                return json.activeStream.stream

            });
        } catch (error) {
            console.error("Error Fetching Stream: ", error)
        }
    }, [creatorId]);

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
    }, [videoLink]);


    useEffect(() => {
        refreshStreams();

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

                        // Force seek if listener is > 2s off
                        if (Math.abs(myTime - data.currentTime) > 2) {
                            console.log(`📡 Forced sync: ${myTime} -> ${data.currentTime}`);
                            reactPlayerRef.current.seekTo(data.currentTime, 'seconds');
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
                    // Even if not joined, refresh queue periodically
                    refreshStreams();
                }
            } catch (err) {
                console.error("Heartbeat failed:", err);
            }
        }, 2000); // Check every 2s for "snappy" sync

        return () => {
            clearInterval(heartbeatInterval);
        };
    }, [creatorId, pathname, isJoined, playing, currentVideo, refreshStreams]);

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
        if (!currentVideo?.extractedId) return;

        const isListener = pathname.startsWith("/party/");

        // Sync offset for listeners who have already joined
        if (isListener && isJoined && currentVideo.playedTs) {
            const playedAt = new Date(currentVideo.playedTs).getTime();
            const now = new Date().getTime();
            const offsetSeconds = (now - playedAt) / 1000;
            if (offsetSeconds > 0) {
                console.log(`📡 Syncing to offset: ${offsetSeconds}s`);
                // Seek on ready via a small delay to ensure player is loaded
                setTimeout(() => {
                    reactPlayerRef.current?.seekTo(offsetSeconds, 'seconds');
                }, 500);
            }
        }

        if (!isListener || isJoined) {
            setPlaying(true);
        } else {
            setPlaying(false);
        }
    }, [currentVideo, pathname, isJoined]);

    useEffect(() => {
        setResolvedUrl(null); // Reset resolved URL when video changes
        if (!currentVideo?.extractedId) return;
    }, [currentVideo?.id]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!videoLink.trim()) return;

        const isUrl = videoLink.match(YT_REGEX) || videoLink.match(SPOTIFY_TRACK_REGEX) || videoLink.match(PLAYLIST_REGEX);

        if (!isUrl) {
            // If it's not a URL, treat it as a search query
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
            refreshStreams();
        } catch (err: any) {
            console.error("Error adding video:", err);
        } finally {
            setLoading(false);
        }
    };

    const resolveStream = async (videoId: string) => {
        try {
            console.log("📡 SSR Resolution: Attempting to bypass restriction for:", videoId);
            const res = await fetch(`/api/streams/resolve?videoId=${videoId}`);
            const data = await res.json();
            if (data.url) {
                console.log("✅ SSR Resolution: Success! Using direct stream.");
                setResolvedUrl(data.url);
            } else {
                throw new Error(data.error || "No URL returned");
            }
        } catch (err) {
            console.error("❌ SSR Resolution: Failed", err);
            toast.error("This video cannot be played. Restriction bypass failed.");
            playNext();
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
            refreshStreams();
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
                refreshStreams();
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
            refreshStreams();
        } catch (err: any) {
            toast.error(err.message || "Error removing song");
        }
    };

    const handleVote = (id: string, isUpvote: boolean) => {
        console.log("Voting for Stream ID:", id);

        setQueue(queue.map((video) =>
            video.id === id
                ? {
                    ...video,
                    upvotes: isUpvote ? video.upvotes + 1 : video.upvotes - 1,
                    haveUpvoted: !video.haveUpvoted
                }
                : video
        )
            .sort((a, b) => b.upvotes - a.upvotes)
        );

        fetch(`/api/streams/${isUpvote ? "upvote" : "downvote"}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                streamId: id
            }),
        });
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
            refreshStreams();
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

        // Final sync attempt
        if (lastSync) {
            console.log("Applying final cached sync on join:", lastSync);
            reactPlayerRef.current.seekTo(lastSync.currentTime, 'seconds');
            if (lastSync.type === "play") setPlaying(true);
            else setPlaying(false);
            setLastSync(null);
        } else {
            setPlaying(true);
        }

        // Request an up-to-date sync from creator
        fetch("/api/streams/sync/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creatorId })
        });
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
        <div className="flex min-h-screen flex-col bg-gray-950 px-4 md:px-20 pt-6 text-white overflow-x-hidden">
            <div className="mb-8">
                <Appbar />
            </div>

            <div className="max-w-7xl mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-3xl font-bold text-white">Now Playing</h2>
                            <Button
                                onClick={handleShare}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                            >
                                <Share2 className="w-4 h-4 mr-2" /> Share
                            </Button>
                        </div>

                        <Card className="bg-gray-900/50 border-gray-800 overflow-hidden backdrop-blur-sm shadow-2xl">
                            <CardContent className="p-0 relative">
                                {currentVideo ? (
                                    playVideo ? (
                                        <div className="w-full relative">
                                            <div className="relative w-full aspect-video md:h-[450px] bg-black bg-opacity-90 overflow-hidden rounded-xl shadow-2xl">
                                                <ReactPlayer
                                                    ref={reactPlayerRef}
                                                    url={resolvedUrl || `https://www.youtube.com/watch?v=${currentVideo.extractedId}`}
                                                    playing={playing}
                                                    muted={isMuted}
                                                    controls={!pathname.startsWith("/party/")}
                                                    width="100%"
                                                    height="100%"
                                                    style={{ minHeight: '300px' }}
                                                    className="aspect-video min-h-[300px] md:min-h-[450px]"
                                                    config={{
                                                        playerVars: {
                                                            rel: 0,
                                                            modestbranding: 1,
                                                            iv_load_policy: 3,
                                                            playsinline: 1,
                                                            enablejsapi: 1,
                                                            autoplay: 1,
                                                            origin: typeof window !== 'undefined' ? window.location.origin : ''
                                                        }
                                                    }}

                                                    onReady={() => {
                                                        console.log('✅ ReactPlayer Ready');
                                                        setIsPlayerReady(true);
                                                    }}
                                                    onPlay={() => {
                                                        setIsPaused(false);
                                                        setPlaying(true);
                                                        const isCreator = !pathname.startsWith("/party/");
                                                        if (isCreator && reactPlayerRef.current) {
                                                            const currentTime = reactPlayerRef.current.getCurrentTime() || 0;
                                                            console.log(`📤 Sending sync: play at ${currentTime}s`);
                                                            fetch("/api/streams/sync", {
                                                                method: "POST",
                                                                headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify({ creatorId, type: "play", currentTime })
                                                            });
                                                        }
                                                    }}
                                                    onPause={() => {
                                                        setIsPaused(true);
                                                        setPlaying(false);
                                                        const isCreator = !pathname.startsWith("/party/");
                                                        if (isCreator && reactPlayerRef.current) {
                                                            const currentTime = reactPlayerRef.current.getCurrentTime() || 0;
                                                            console.log(`📤 Sending sync: pause at ${currentTime}s`);
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
                                                        console.warn('⚠️ ReactPlayer error:', err, 'for ID:', currentVideo.extractedId);
                                                        // 150/101 are embed restrictions. 2/100 are general errors.
                                                        if (err === 101 || err === 150 || err === 2 || err === 100) {
                                                            if (!resolvedUrl) {
                                                                toast.info("Embbed restricted. Attempting to bypass...");
                                                                resolveStream(currentVideo.extractedId);
                                                            } else {
                                                                console.log("🔄 Restriction detected even on resolved URL, skipping video");
                                                                toast.error("Playback failed. Skipping...");
                                                                playNext();
                                                            }
                                                        }
                                                    }}
                                                />

                                                {pathname.startsWith("/party/") && !isJoined && (
                                                    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                                                        <div className="text-center space-y-6 max-w-sm px-6">
                                                            <div className="relative">
                                                                <div className="absolute -inset-4 bg-blue-600/20 blur-2xl rounded-full" />
                                                                <Play className="w-16 h-16 text-blue-500 mx-auto relative z-10 animate-pulse" />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <h3 className="text-2xl font-bold text-white">Ready to join?</h3>
                                                                <p className="text-gray-400 text-sm">Click below to sync up with the streamer and start listening.</p>
                                                            </div>
                                                            <Button
                                                                onClick={handleGoLive}
                                                                disabled={!isPlayerReady}
                                                                className={`w-full h-14 text-lg font-bold rounded-2xl transition-all duration-300 shadow-xl ${isPlayerReady
                                                                    ? "bg-blue-600 hover:bg-blue-700 text-white scale-105 hover:scale-110"
                                                                    : "bg-gray-800 text-gray-500 cursor-not-allowed"
                                                                    }`}
                                                            >
                                                                {isPlayerReady ? "GO LIVE" : "LOADING VIDEO..."}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}

                                                {isPaused && (isJoined || !pathname.startsWith("/party/")) && (
                                                    <div
                                                        className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-[2px] transition-opacity duration-300"
                                                        onClick={() => {
                                                            const isCreator = !pathname.startsWith("/party/");
                                                            if (isCreator) {
                                                                setPlaying(true);
                                                            }
                                                        }}
                                                    >
                                                        <div className="relative z-10 flex flex-col items-center gap-4">
                                                            {!pathname.startsWith("/party/") ? (
                                                                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                                                                    <Play className="fill-white w-10 h-10 ml-1" />
                                                                </div>
                                                            ) : (
                                                                <div className="bg-blue-600/90 px-8 py-3 rounded-full border border-blue-400/50 shadow-2xl">
                                                                    <p className="text-xl font-bold tracking-widest uppercase text-white">Paused by Streamer</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {pathname.startsWith("/party/") && (
                                                    <>
                                                        <div className="absolute inset-0 z-10 cursor-default" />
                                                        <div className="absolute bottom-4 right-4 z-20">
                                                            <Button
                                                                onClick={() => setIsMuted(!isMuted)}
                                                                size="sm"
                                                                className="bg-black/60 hover:bg-black/80 text-white"
                                                            >
                                                                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                                            </Button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <div className="p-4 bg-gray-900 border-t border-gray-800">
                                                <p className="text-xl font-semibold text-white truncate">{currentVideo.title}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full">
                                            <div className="relative w-full aspect-video md:h-[450px]">
                                                {currentVideo.bigImg ? (
                                                    <img
                                                        src={currentVideo.bigImg}
                                                        alt={currentVideo.title}
                                                        className="object-contain w-full h-full"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500">No Image</div>
                                                )}
                                            </div>
                                            <div className="p-4 bg-gray-900 border-t border-gray-800 text-center">
                                                <p className="text-xl font-semibold text-white truncate">{currentVideo.title}</p>
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-4">
                                        <Play className="w-10 h-10 opacity-20" />
                                        <p className="text-lg">No video playing</p>
                                    </div>
                                )}
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

                        <AnimatePresence>
                            {activityLogs.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="p-4 bg-gray-900/50 rounded-2xl border border-gray-800 backdrop-blur-sm"
                                >
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Activity Log</h4>
                                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                        {activityLogs.map((log, index) => (
                                            <div key={`${log.timestamp}-${index}`} className="text-sm flex items-start gap-3">
                                                <span className={log.type === "success" ? "text-green-500" : "text-red-500"}>
                                                    {log.type === "success" ? "✓" : "✕"}
                                                </span>
                                                <span className="text-gray-400">{log.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="lg:col-span-1 space-y-8">
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-white">Add to Queue</h2>
                            <div className="space-y-4">
                                <div className="relative">
                                    <Input
                                        value={videoLink}
                                        onChange={(e) => {
                                            setVideoLink(e.target.value);
                                            if (e.target.value.length >= 2 && !e.target.value.match(YT_REGEX) && !e.target.value.match(SPOTIFY_TRACK_REGEX)) {
                                                handleSearch(e.target.value);
                                            } else {
                                                setSearchResults([]);
                                            }
                                        }}
                                        placeholder="Paste Link or Type Song Name"
                                        className="w-full h-12 bg-gray-900 border-gray-800 text-white rounded-xl pr-10"
                                    />
                                    {isSearching && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                                        </div>
                                    )}

                                    <AnimatePresence>
                                        {searchResults.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                className="absolute z-50 left-0 right-0 mt-2 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto custom-scrollbar"
                                            >
                                                {searchResults.map((video) => (
                                                    <button
                                                        key={video.id}
                                                        onClick={() => handleSelectSearchResult(video)}
                                                        className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left border-b border-gray-800 last:border-0"
                                                    >
                                                        <img
                                                            src={video.thumbnail}
                                                            alt=""
                                                            className="w-16 h-10 rounded object-cover flex-shrink-0"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-white truncate">{video.title}</p>
                                                            <p className="text-xs text-gray-400 truncate">{video.channelTitle}</p>
                                                        </div>
                                                        <Plus className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 font-bold rounded-xl"
                                >
                                    {loading ? "Adding..." : "Add to Queue"}
                                </Button>
                                {videoLink && videoLink.match(YT_REGEX) && !loading && (
                                    <div className="rounded-xl overflow-hidden border border-gray-800">
                                        <LiteYouTubeEmbed
                                            title="Youtube Video Preview"
                                            id={videoLink.match(YT_REGEX)![1]}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                Upcoming <span className="text-sm font-normal text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">{queue.length}</span>
                            </h2>
                            {queue.length <= 0 ? (
                                <Card className="bg-gray-900/30 border-gray-800 border-dashed text-white">
                                    <CardContent className="p-8 flex items-center justify-center opacity-50">Empty Queue</CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {queue.map((video, index) => (
                                        <Card key={`${video.id}-${index}`} className="bg-white/5 border-white/5 hover:bg-white/10 transition-colors">
                                            <CardContent className="p-3 flex items-center gap-4">
                                                <div className="w-20 h-12 relative flex-shrink-0">
                                                    {video.extractedId ? (
                                                        <img
                                                            src={`https://img.youtube.com/vi/${video.extractedId}/mqdefault.jpg`}
                                                            alt={video.title}
                                                            className="rounded object-cover w-full h-full"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gray-800 rounded" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-white truncate text-xs">{video.title}</h3>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {(video.addedById === currentUserId || creatorId === currentUserId) && (
                                                        <Button variant="ghost" size="sm" onClick={() => handleRemove(video.id)} className="h-8 w-8 p-0 text-gray-500 hover:text-red-500"><Trash2 className="h-4 w-4" /></Button>
                                                    )}
                                                    <Button variant="ghost" size="sm" onClick={() => handleVote(video.id, !video.haveUpvoted)} className={`h-8 px-2 ${video.haveUpvoted ? "text-blue-500" : "text-gray-400"}`}>
                                                        {video.haveUpvoted ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                                        <span className="ml-1 text-xs font-bold">{video.upvotes}</span>
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div >
            </div >

            <ToastContainer position="top-right" autoClose={3000} theme="dark" />

            <AnimatePresence>
                {isPlaylistModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
                        >
                            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-white truncate max-w-md">{playlistTitle}</h2>
                                    <p className="text-sm text-gray-400">{playlistVideos.length} videos found</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button onClick={handleAddAllFromPlaylist} className="bg-blue-600 font-bold rounded-xl"><ListPlus className="w-4 h-4 mr-2" /> Add All</Button>
                                    <button onClick={() => setIsPlaylistModalOpen(false)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400"><X className="w-6 h-6" /></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                {playlistVideos.map((video: any, index: number) => (
                                    <div key={`${video.id}-${index}`} className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-transparent hover:border-gray-800 hover:bg-white/10 transition-all">
                                        <div className="w-24 h-14 relative flex-shrink-0">
                                            {video.thumbnail ? (
                                                <img
                                                    src={video.thumbnail}
                                                    alt={video.title}
                                                    className="rounded-lg object-cover w-full h-full"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-800 rounded-lg" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-white text-sm line-clamp-2">{video.title}</h4>
                                        </div>
                                        <Button size="sm" variant="ghost" onClick={() => handleAddFromPlaylist(video)} className="h-10 w-10 p-0 rounded-full text-gray-400"><Plus className="w-5 h-5" /></Button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
