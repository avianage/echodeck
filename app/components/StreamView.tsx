/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronUp, ChevronDown, Play } from "lucide-react";
import Image from "next/image";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css'
import { Share2, Volume2, VolumeX, X, ListPlus, Plus, Trash2 } from "lucide-react";
import { PLAYLIST_REGEX, YT_REGEX } from "@/app/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Appbar } from "./Appbar";
import YouTubePlayer from "youtube-player";
import { usePathname } from "next/navigation";
import { pusherClient } from "@/app/lib/pusher";

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
    // const [recommendations, setRecommendations] = useState<any[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const [isJoined, setIsJoined] = useState(false);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
    const [playlistVideos, setPlaylistVideos] = useState<any[]>([]);
    const [playlistTitle, setPlaylistTitle] = useState("");
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [activityLogs, setActivityLogs] = useState<{ type: "success" | "error", message: string, timestamp: number }[]>([]);

    const addLog = (type: "success" | "error", message: string) => {
        setActivityLogs(prev => [{ type, message, timestamp: Date.now() }, ...prev].slice(0, 10));
    };
    const [playlistErrors, setPlaylistErrors] = useState<{ title: string, reason: string }[]>([]);

    const videoPlayerRef = useRef<HTMLDivElement | null>(null);
    const playerInstanceRef = useRef<any>(null);
    const pathname = usePathname();

    async function refreshStreams() {
        try {
            console.log("Fetching streams...");
            const res = await fetch(`/api/streams/?creatorId=${creatorId}`, {
                method: "GET",
                credentials: "include",
            });
            const json = await res.json();
            setQueue(json.streams.sort((a: any, b: any) => {
                if (a.upvotes === b.upvotes) {
                    return new Date(a.createdAt) > new Date(b.createdAt) ? 1 : -1;
                }
                return b.upvotes - a.upvotes;
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
    }

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

        const channel = pusherClient.subscribe(creatorId);
        channel.bind("stream-update", () => {
            console.log("🚀 Real-time update received!");
            refreshStreams();
        });

        channel.bind("player-sync", async (data: { type: "play" | "pause", currentTime: number }) => {
            const isListener = pathname.startsWith("/creator/");
            if (!isListener || !playerInstanceRef.current) return;

            // If listener hasn't joined yet, just cache the sync
            if (!isJoined) {
                console.log("📥 Caching sync until join:", data);
                setLastSync(data);
                return;
            }

            console.log("📡 Remote sync command:", data);
            const player = playerInstanceRef.current;
            const myTime = await player.getCurrentTime();

            // Sync time if drift is too much or it's a play command
            if (Math.abs(myTime - data.currentTime) > 2 || data.type === "play") {
                player.seekTo(data.currentTime, true);
            }

            if (data.type === "play") {
                player.playVideo();
                setIsPaused(false);
            } else {
                player.pauseVideo();
                setIsPaused(true);
            }
        });

        channel.bind("queue-cleared", () => {
            console.log("🚫 Queue cleared by creator, resetting state...");
            if (playerInstanceRef.current) {
                try {
                    playerInstanceRef.current.destroy();
                } catch (e) {
                    console.error("Sync cleanup error:", e);
                }
                playerInstanceRef.current = null;
            }
            setCurrentVideo(null);
            setQueue([]);
            toast.info("Stream ended by host");
        });

        channel.bind("request-sync", async () => {
            const isCreator = !pathname.startsWith("/creator/");
            if (!isCreator || !playerInstanceRef.current) return;

            console.log("📥 Sync requested by listener, broadcasting current state...");
            const player = playerInstanceRef.current;
            const currentTime = (await player.getCurrentTime()) || 0;
            const state = await player.getPlayerState();
            const type = state === 1 ? "play" : "pause";

            fetch("/api/streams/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    creatorId,
                    type,
                    currentTime: typeof currentTime === 'number' ? currentTime : 0
                })
            });
        });

        const interval = setInterval(() => {
            refreshStreams();
        }, REFRESH_INTERVAL_MS);
        return () => {
            console.log("🧹 Clearing interval & unsubscribing for creator:", creatorId);
            clearInterval(interval);
        };
    }, [creatorId]);

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




    useEffect(() => {
        if (lastSync && playerInstanceRef.current) {
            console.log("🎯 Applying last cached sync:", lastSync);
            const player = playerInstanceRef.current;
            player.seekTo(lastSync.currentTime, true);
            if (lastSync.type === "play") {
                player.playVideo().catch((e: any) => console.error("Cached Play failed:", e));
                setIsPaused(false);
            } else {
                player.pauseVideo();
                setIsPaused(true);
            }
            setLastSync(null); // Clear after applying
        }
    }, [lastSync]);

    useEffect(() => {
        if (!videoPlayerRef.current || !currentVideo?.extractedId) return;

        // If listener, don't play until joined
        // Removing the isJoined guard so it plays automatically


        if (!playerInstanceRef.current) {
            playerInstanceRef.current = YouTubePlayer(videoPlayerRef.current, {
                playerVars: {
                    controls: pathname.startsWith("/creator/") ? 0 : 1,
                    disablekb: pathname.startsWith("/creator/") ? 1 : 0,
                    rel: 0,
                    modestbranding: 1
                }
            });

            playerInstanceRef.current.on("ready", () => {
                console.log("✅ YouTube Player Ready");
                setIsPlayerReady(true);
            });

            playerInstanceRef.current.on("stateChange", async (event: any) => {
                const isCreator = !pathname.startsWith("/creator/");

                if (event.data === 0) {
                    playNext();
                }

                // Synchronization: Only creator broadcasts
                if (isCreator && playerInstanceRef.current) {
                    const currentTime = await playerInstanceRef.current.getCurrentTime();
                    let type: "play" | "pause" = "pause";

                    if (event.data === 1) {
                        type = "play"; // PLAYING
                        setIsPaused(false);
                    }
                    if (event.data === 2) {
                        type = "pause"; // PAUSED
                        setIsPaused(true);
                    }

                    if (event.data === 1 || event.data === 2) {
                        const currentTime = (await playerInstanceRef.current.getCurrentTime()) || 0;
                        console.log(`📤 Sending sync: ${type} at ${currentTime}s`);
                        fetch("/api/streams/sync", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                creatorId,
                                type,
                                currentTime: typeof currentTime === 'number' ? currentTime : 0
                            })
                        }).then(r => {
                            if (!r.ok) console.error("❌ Sync broadcast failed status:", r.status);
                        }).catch(e => console.error("❌ Sync broadcast failed:", e));
                    }
                } else if (pathname.startsWith("/creator/")) {
                    // For listener, just track state locally for overlay
                    if (event.data === 1) setIsPaused(false);
                    if (event.data === 2) setIsPaused(true);
                }
            });
        }

        const player = playerInstanceRef.current;
        player.loadVideoById(currentVideo.extractedId);

        const isListener = pathname.startsWith("/creator/");

        // Sync logic for listeners - ONLY IF JOINED
        if (isListener && isJoined && currentVideo.playedTs) {
            const playedAt = new Date(currentVideo.playedTs).getTime();
            const now = new Date().getTime();
            const offsetSeconds = (now - playedAt) / 1000;

            if (offsetSeconds > 0) {
                console.log(`📡 Syncing to offset: ${offsetSeconds}s`);
                player.seekTo(offsetSeconds, true);
            }
        }

        // Only auto-play if creator OR if listener has already joined
        if (!isListener || isJoined) {
            player.playVideo().catch((err: any) => {
                console.warn("Autoplay failed:", err);
            });
        }

        return () => {
            if (playerInstanceRef.current) {
                // We only destroy if the component unmounts or creatorId changes
                // But currentVideo change should just load next video
            }
        };
    }, [currentVideo]);

    // Separate effect for mute/unmute
    useEffect(() => {
        if (playerInstanceRef.current) {
            if (isMuted) {
                playerInstanceRef.current.mute();
            } else {
                playerInstanceRef.current.unMute();
            }
        }
    }, [isMuted]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (playerInstanceRef.current) {
                playerInstanceRef.current.destroy();
                playerInstanceRef.current = null;
            }
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!videoLink.trim()) return;

        const playlistMatch = videoLink.match(PLAYLIST_REGEX);
        if (playlistMatch) {
            const playlistId = playlistMatch[1];
            setLoading(true);
            try {
                const res = await fetch("/api/streams/playlist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ playlistId })
                });
                if (!res.ok) throw new Error("Failed to fetch playlist");
                const data = await res.json();
                setPlaylistVideos(data.videos);
                setPlaylistTitle(data.title);
                setIsPlaylistModalOpen(true);
            } catch (err) {
                toast.error("Could not load playlist. Make sure it's public.");
            } finally {
                setLoading(false);
            }
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/streams/", {
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
        } catch (err: any) {
            console.error("Error adding video:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddFromPlaylist = async (video: any) => {
        try {
            const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
            const res = await fetch("/api/streams/", {
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
        } catch (err) {
            toast.error("Error adding video");
            addLog("error", `Error adding video: ${video.title}`);
        }
    };

    const handleAddAllFromPlaylist = async () => {
        setIsPlaylistModalOpen(false);
        const total = playlistVideos.length;
        let successCount = 0;
        let failCount = 0;

        toast.info(`Adding ${total} videos...`, { autoClose: 5000 });

        for (let i = 0; i < total; i++) {
            const video = playlistVideos[i];

            // Throttling: Gap of 5 seconds after the first 5 songs
            if (i >= 5) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            try {
                const res = await fetch("/api/streams/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        creatorId: creatorId,
                        url: `https://www.youtube.com/watch?v=${video.id}`
                    })
                });

                if (res.ok) {
                    successCount++;
                    addLog("success", `Playlist add: ${video.title}`);
                } else {
                    failCount++;
                    const errData = await res.json();
                    const errorMsg = errData.message || "Unknown error";
                    console.error(`Failed to add video ${i + 1}: ${video.title}. Error:`, errorMsg);
                    addLog("error", `Skip ${video.title}: ${errorMsg}`);
                }
            } catch (err) {
                failCount++;
                console.error(`Network error adding video ${i + 1}:`, err);
                addLog("error", `Network Error: ${video.title}`);
            }

            // Progress toast every 5 videos
            if ((i + 1) % 5 === 0) {
                toast.info(`Progress: ${i + 1}/${total} processed...`, { autoClose: 2000 });
            }

            // Update UI periodically
            if ((i + 1) % 5 === 0 || i === total - 1) {
                refreshStreams();
            }
        }

        if (failCount > 0) {
            toast.warning(`Finished! ${successCount} added, ${failCount} failed. Check console for details.`);
        } else {
            toast.success(`Successfully added all ${successCount} videos to queue!`);
        }
        setVideoLink('');
    };

    // const handleAddRecommendation = async (recommendation: any) => {
    //     try {
    //         setLoading(true);
    //         const videoUrl = `https://www.youtube.com/watch?v=${recommendation.id}`;
    //         const res = await fetch("/api/streams/", {
    //             method: "POST",
    //             headers: { "Content-Type": "application/json" },
    //             body: JSON.stringify({
    //                 creatorId: creatorId,
    //                 url: videoUrl
    //             })
    //         });
    //         // ... handle response
    //     } catch (err) {
    //         console.error("Error adding recommendation:", err);
    //     } finally {
    //         setLoading(false);
    //     }
    // };

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

            // Defensively destroy old player before loading new one
            // to prevent removeChild conflicts during unmounting/remounting
            if (playerInstanceRef.current) {
                try {
                    playerInstanceRef.current.destroy();
                } catch (e) {
                    console.error("playNext: Error destroying old player:", e);
                }
                playerInstanceRef.current = null;
            }

            // Small delay to ensure YouTube API has finished DOM cleanup
            setTimeout(() => {
                setCurrentVideo(json.stream);
                setQueue(q => q.filter(x => x.id !== json.stream.id));
                toast.info(`Now playing: ${json.stream.title}`);
            }, 50);
        } catch (e) {
            console.error("Error: ", e);
        } finally {
            setPlayNextLoader(false);
        }
    };

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

            // Cleanup YouTube player FIRST to avoid race conditions with React unmounting
            if (playerInstanceRef.current) {
                try {
                    playerInstanceRef.current.destroy();
                } catch (e) {
                    console.error("Safe cleanup: Error destroying player:", e);
                }
                playerInstanceRef.current = null;
            }

            // Delay state updates slightly to ensure YouTube API finishes DOM manipulation
            setTimeout(() => {
                setCurrentVideo(null);
                setQueue([]);
                refreshStreams();
                toast.success("Queue stopped and cleared!");
            }, 50);

            console.log("Queue successfully cleared");
        } catch (error) {
            console.error("Error stopping queue:", error);
            toast.error("Failed to stop queue");
        }
    };


    const handleGoLive = async () => {
        if (!playerInstanceRef.current) return;

        setIsJoined(true);
        const player = playerInstanceRef.current;

        // Final sync attempt
        if (lastSync) {
            console.log("Applying final cached sync on join:", lastSync);
            player.seekTo(lastSync.currentTime, true);
            if (lastSync.type === "play") player.playVideo();
            else player.pauseVideo();
            setLastSync(null);
        } else {
            player.playVideo();
        }

        // Request an up-to-date sync from creator
        fetch("/api/streams/sync/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creatorId })
        });
    };

    const handleShare = () => {
        const sharableLink = `${window.location.protocol}//${window.location.host}/creator/${creatorId}`;
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
                                            <div className="relative">
                                                <div id="youtube-player" ref={videoPlayerRef} className="w-full aspect-video min-h-[300px] md:min-h-[450px] bg-black" />

                                                {pathname.startsWith("/creator/") && !isJoined && (
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

                                                {isPaused && currentVideo && (isJoined || !pathname.startsWith("/creator/")) && (
                                                    <div
                                                        className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-[2px] transition-opacity duration-300"
                                                        onClick={() => {
                                                            const isCreator = !pathname.startsWith("/creator/");
                                                            if (isCreator && playerInstanceRef.current) {
                                                                playerInstanceRef.current.playVideo();
                                                            }
                                                        }}
                                                    >
                                                        <div className="relative z-10 flex flex-col items-center gap-4">
                                                            {!pathname.startsWith("/creator/") ? (
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

                                                {pathname.startsWith("/creator/") && (
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
                                                    <Image
                                                        src={currentVideo.bigImg}
                                                        alt={currentVideo.title}
                                                        fill
                                                        className="object-contain"
                                                        priority
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

                        {!pathname.startsWith("/creator/") && (
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
                                        {activityLogs.map((log) => (
                                            <div key={log.timestamp} className="text-sm flex items-start gap-3">
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
                                <Input
                                    value={videoLink}
                                    onChange={(e) => setVideoLink(e.target.value)}
                                    placeholder="YouTube Video or Playlist Link"
                                    className="w-full h-12 bg-gray-900 border-gray-800 text-white rounded-xl"
                                />
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
                                    {queue.map((video) => (
                                        <Card key={video.id} className="bg-white/5 border-white/5 hover:bg-white/10 transition-colors">
                                            <CardContent className="p-3 flex items-center gap-4">
                                                <div className="w-20 h-12 relative flex-shrink-0">
                                                    {video.extractedId ? (
                                                        <Image src={`https://img.youtube.com/vi/${video.extractedId}/mqdefault.jpg`} alt={video.title} fill className="rounded object-cover" />
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
                </div>
            </div>

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
                                {playlistVideos.map((video: any) => (
                                    <div key={video.id} className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-transparent hover:border-gray-800 hover:bg-white/10 transition-all">
                                        <div className="w-24 h-14 relative flex-shrink-0">
                                            <Image src={video.thumbnail} alt={video.title} fill className="rounded-lg object-cover" />
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
        </div>
    );
}
