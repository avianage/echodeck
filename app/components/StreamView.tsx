/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronUp, ChevronDown, Play, Share2 } from "lucide-react";
import Image from "next/image";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css'
import { YT_REGEX } from "@/app/lib/utils";
import { Appbar } from "./Appbar";
import YouTubePlayer from "youtube-player";

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
    haveUpvoted: boolean
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
    const videoPlayerRef = useRef<HTMLDivElement | null>(null);


    async function refreshStreams() {
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
            if (!json.activeStream?.stream || video?.id === json.activeStream.stream.id) {
                return video;
            }
            return json.activeStream.stream

        });
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

        const interval = setInterval(() => {
            refreshStreams();
        }, REFRESH_INTERVAL_MS);

        return () => {
            console.log("🧹 Clearing interval for creator:", creatorId);
            clearInterval(interval);
        };
    }, [creatorId]); // 👈 Add dependency

    useEffect(() => {
        if (!videoPlayerRef.current || !currentVideo?.extractedId) return;

        const player = YouTubePlayer(videoPlayerRef.current);

        player.loadVideoById(currentVideo.extractedId);

        // Mute the video to allow autoplay
        player.mute();

        player.playVideo().catch(err => {
            console.warn("Autoplay failed:", err);
        });

        const eventHandler = (event: any) => {
            if (event.data === 0) {
                playNext();
            }
        };

        player.on("stateChange", eventHandler);

        return () => {
            player.destroy();
        };
    }, [currentVideo]);



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true);
        const res = await fetch("/api/streams/", {
            method: "POST",
            body: JSON.stringify({
                creatorId: "ff79778f-b1ec-4a5b-9ca5-9177db586af0",
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



    const handleShare = () => {
        const sharableLink = `${window.location.hostname}/creator/${creatorId}`;
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
                                            <Image
                                                src={`https://img.youtube.com/vi/${video.extractedId}/0.jpg`}
                                                alt={video.title}
                                                fill
                                                className="rounded object-cover"
                                            />
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
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronUp className="h-4 w-4" />
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
                            <Button
                                onClick={handleShare}
                                variant="default"
                                className=" bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow"
                            >
                                <Share2 className="w-4 h-4 mr-2" /> Share
                            </Button>
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
                    <div>
                        <h2 className="text-2xl text-white mb-2">Now Playing</h2>
                        <Card className="bg-gray-900 border-gray-800">
                            <CardContent className="p-4">
                                {currentVideo ? (
                                    playVideo ? (

                                        <div id="youtube-player" ref={videoPlayerRef} className="w-full">

                                        </div>
                                        // <iframe
                                        //     width={"100%"}
                                        //     height={300}
                                        //     src={`https://www.youtube.com/embed/${currentVideo.extractedId}?autoplay=1`}
                                        //     allow="autoplay"
                                        //     title="Current Video"
                                        //     className="rounded"
                                        // />
                                    ) : (
                                        <>
                                            <iframe
                                                src={currentVideo.bigImg}
                                                title="Current Video"
                                                className="w-full h-72 object-cover rounded-md"
                                                allowFullScreen
                                            />
                                            <p className="mt-2 text-center font-semibold text-white">
                                                {currentVideo.title}
                                            </p>
                                        </>
                                    )
                                ) : (
                                    <p className="text-center py-8 text-gray-400">No video playing</p>
                                )}
                            </CardContent>
                        </Card>
                        {playNext && (
                            <Button
                                disabled={playNextLoader}
                                onClick={playNext}
                                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <Play className="mr-2 h-4 w-4" />
                                {playNextLoader ? "Loading..." : "Play Next"}
                            </Button>
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
