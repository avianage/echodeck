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
import { YT_REGEX } from "@/app/lib/utils";
import { Appbar } from "./Appbar";
import YouTubePlayer from "youtube-player";
import { usePathname } from "next/navigation";
import { pusherClient } from "@/app/lib/pusher";
import { Share2, Volume2, VolumeX } from "lucide-react";

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

            console.log("📡 Remote sync command:", data);
            const player = playerInstanceRef.current;
            const myTime = await player.getCurrentTime();

            // Sync time if drift is too much or it's a play command
            if (Math.abs(myTime - data.currentTime) > 2 || data.type === "play") {
                player.seekTo(data.currentTime, true);
            }

            if (data.type === "play") {
                player.playVideo();
            } else {
                player.pauseVideo();
            }
        });

        const interval = setInterval(() => {
            refreshStreams();
        }, REFRESH_INTERVAL_MS);
        return () => {
            console.log("🧹 Clearing interval & unsubscribing for creator:", creatorId);
            clearInterval(interval);
            pusherClient.unsubscribe(creatorId);
        };
    }, [creatorId]);



    useEffect(() => {
        if (lastSync && playerInstanceRef.current) {
            console.log("🎯 Applying last cached sync:", lastSync);
            const player = playerInstanceRef.current;
            player.seekTo(lastSync.currentTime, true);
            if (lastSync.type === "play") {
                player.playVideo().catch((e: any) => console.error("Cached Play failed:", e));
            } else {
                player.pauseVideo();
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

            playerInstanceRef.current.on("stateChange", async (event: any) => {
                const isCreator = !pathname.startsWith("/creator/");

                if (event.data === 0) {
                    playNext();
                }

                // Synchronization: Only creator broadcasts
                if (isCreator && playerInstanceRef.current) {
                    const currentTime = await playerInstanceRef.current.getCurrentTime();
                    let type: "play" | "pause" = "pause";

                    if (event.data === 1) type = "play"; // PLAYING
                    if (event.data === 2) type = "pause"; // PAUSED

                    if (event.data === 1 || event.data === 2) {
                        console.log(`📤 Sending sync: ${type} at ${currentTime}s`);
                        fetch("/api/streams/sync", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                creatorId,
                                type,
                                currentTime
                            })
                        }).then(r => {
                            if (!r.ok) console.error("❌ Sync broadcast failed status:", r.status);
                        }).catch(e => console.error("❌ Sync broadcast failed:", e));
                    }
                }
            });
        }

        const player = playerInstanceRef.current;
        player.loadVideoById(currentVideo.extractedId);

        // Sync logic for listeners
        if (pathname.startsWith("/creator/") && currentVideo.playedTs) {
            const playedAt = new Date(currentVideo.playedTs).getTime();
            const now = new Date().getTime();
            const offsetSeconds = (now - playedAt) / 1000;

            if (offsetSeconds > 0) {
                console.log(`📡 Syncing to offset: ${offsetSeconds}s`);
                player.seekTo(offsetSeconds, true);
            }
        }

        player.playVideo().catch((err: any) => {
            console.warn("Autoplay failed:", err);
        });

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
        e.preventDefault()
        setLoading(true);
        const res = await fetch("/api/streams/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                creatorId: creatorId,
                url: videoLink
            })
        })

        setQueue([...queue, await res.json()]);
        setLoading(false);
        setVideoLink('');
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

            setCurrentVideo(json.stream);
            setQueue(q => q.filter(x => x.id !== json.stream.id)); // optional
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
            setCurrentVideo(null);
            setQueue([]);

            if (videoPlayerRef.current) {
                videoPlayerRef.current.innerHTML = '';
            }

            refreshStreams();

            console.log("Queue successfully cleared");
        } catch (error) {
            console.error("Error stopping queue:", error);
        }
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

        <div className="flex min-h-screen flex-col  bg-gray-950  px-8 md:px-20 pt-6 text-white">
            <div className="mb-8">
                <Appbar />
            </div>
            {/* Main Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-8">
                {/* Left Column - Upcoming Songs */}
                <div>
                    <h2 className="text-2xl font-semibold mb-4">Upcoming Songs</h2>
                    {queue.length <= 0 ? (
                        <Card className="bg-gray-900 border-gray-800 text-white">
                            <CardContent className="p-4">
                                <p className="text-gray-300">No songs in queue.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {queue.map((video) => (
                                <Card key={video.id} className="bg-white/10 text-white">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="w-24 h-16 relative">
                                            {video.extractedId ? (
                                                <Image
                                                    src={`https://img.youtube.com/vi/${video.extractedId}/0.jpg`}
                                                    alt={video.title}
                                                    fill
                                                    className="rounded object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-800 rounded" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold">{video.title}</h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    handleVote(video.id, !video.haveUpvoted)
                                                }
                                                className="flex items-center space-x-1 bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                                            >
                                                {video.haveUpvoted ? (
                                                    <ChevronDown key={`down-${video.id}`} className="h-4 w-4" />
                                                ) : (
                                                    <ChevronUp key={`up-${video.id}`} className="h-4 w-4" />
                                                )}
                                                <span>{video.upvotes}</span>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>


                {/* Right Column - Add Song & Current Video */}
                <div className="space-y-6">
                    {/* Add to Queue */}
                    <div>
                        {/* Top row: Add to Queue + Share button */}
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-2xl font-medium">Add to Queue</p>
                            <div className="flex gap-2">

                                <Button
                                    onClick={handleShare}
                                    variant="default"
                                    className=" bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow"
                                >
                                    <Share2 className="w-4 h-4 mr-2" /> Share
                                </Button>
                            </div>
                        </div>

                        {/* Input + Add button row */}
                        <div className="flex flex-col">
                            <div className="mb-4">
                                <Input
                                    value={videoLink}
                                    onChange={(e) => setVideoLink(e.target.value)}
                                    placeholder="Paste YouTube link here"
                                    className="w-full bg-gray-900 border-gray-800 text-white"
                                />
                            </div>
                            <div>
                                <Button
                                    onClick={handleSubmit}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? "Loading..." : "Add to Queue"}
                                </Button>
                            </div>
                        </div>



                    </div>


                    {/* YouTube Preview */}
                    {videoLink && videoLink.match(YT_REGEX) && !loading && (
                        <LiteYouTubeEmbed
                            title="Youtube Video"
                            id={videoLink.match(YT_REGEX)![1]}
                        />
                    )}

                    {/* Current Video */}
                    <div className="relative">
                        <h2 className="text-2xl text-white mb-2">Now Playing</h2>
                        <Card className="bg-gray-900 border-gray-800 overflow-hidden">
                            <CardContent className="p-4 relative">
                                {currentVideo ? (
                                    playVideo ? (
                                        <div className="w-full relative">
                                            <div className="relative">
                                                <div id="youtube-player" ref={videoPlayerRef} className="w-full aspect-video min-h-[300px] bg-black rounded-lg" />

                                                {pathname.startsWith("/creator/") && (
                                                    <>
                                                        {/* Click-jacking protection for listeners */}
                                                        <div className="absolute inset-0 z-10 cursor-default" />
                                                        {/* Custom Mute Control */}
                                                        <div className="absolute bottom-4 right-4 z-20">
                                                            <Button
                                                                onClick={() => setIsMuted(!isMuted)}
                                                                size="sm"
                                                                className="bg-black/60 hover:bg-black/80 text-white border-white/20 backdrop-blur-sm"
                                                            >
                                                                {isMuted ? (
                                                                    <span className="flex items-center gap-2">
                                                                        <VolumeX className="h-4 w-4" /> Unmute
                                                                    </span>
                                                                ) : (
                                                                    <span className="flex items-center gap-2">
                                                                        <Volume2 className="h-4 w-4" /> Mute
                                                                    </span>
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <p className="mt-2 text-center font-semibold text-white">
                                                {currentVideo.title}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="w-full">
                                            <div className="relative w-full h-72">
                                                {currentVideo.bigImg ? (
                                                    <Image
                                                        src={currentVideo.bigImg}
                                                        alt={currentVideo.title}
                                                        fill
                                                        className="object-contain rounded-md"
                                                        sizes="(max-width: 768px) 100vw, 700px"
                                                        priority={true}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-gray-800 flex items-center justify-center rounded-md">
                                                        <p className="text-gray-500">No image available</p>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="mt-2 text-center font-semibold text-white">
                                                {currentVideo.title}
                                            </p>
                                        </div>
                                    )
                                ) : (
                                    <p className="text-center py-8 text-gray-400">No video playing</p>
                                )}
                            </CardContent>
                        </Card>
                        {!pathname.startsWith("/creator/") && (
                            <div className="flex gap-4 mt-4">
                                <Button
                                    disabled={playNextLoader}
                                    onClick={playNext}
                                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    <Play className="mr-2 h-4 w-4" />
                                    {playNextLoader ? "Loading..." : "Play Next"}
                                </Button>

                                <Button
                                    onClick={stopQueue}
                                    className="w-full mt-4 text-white"
                                    variant="destructive"
                                >
                                    Stop Queue
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Toasts */}
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
            />
        </div>
    );
}
