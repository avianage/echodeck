/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
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
    creatorId
}: {
    creatorId: string
}) {
    const [videoLink, setVideoLink] = useState('');
    const [queue, setQueue] = useState<Video[]>([]);
    const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
    const [loading, setLoading] = useState(false);

    async function refreshStreams() {
        console.log("Fetching streams...");
        const res = await fetch(`/api/streams/?creatorId=${creatorId}`, {
            method: "GET",
            credentials: "include",
        });
        const json = await res.json();
        setQueue(json.streams.sort((a: any, b: any) => a.upvotes < b.upvotes ? 1 : -1));
    }

    useEffect(() => {
        refreshStreams();
        const interval = setInterval(() => {
            refreshStreams();
        }, REFRESH_INTERVAL_MS);
    }, []);



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


    const playNext = () => {
        if (queue.length > 0) {
            setCurrentVideo(queue[0]);
            setQueue(queue.slice(1));
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
        <div className="flex min-h-screen flex-col bg-gradient-to-br from-black via-blue-900 to-gray-900 p-6 text-white">
            <h1 className="text-3xl font-bold text-center mb-6">
                🎵 Fan-Powered Stream Queue
            </h1>

            <div className="flex justify-end mb-4">
                <Button
                    onClick={handleShare}
                    variant="outline"
                    className="border-white text-white"
                >
                    <Share2 className="w-4 h-4 mr-2" /> Share with Fans
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center mb-8">
                <Input
                    value={videoLink}
                    onChange={(e) => setVideoLink(e.target.value)}
                    placeholder="Paste YouTube link here"
                    className="w-full md:w-2/3 text-black"
                />
                <Button
                    onClick={handleSubmit}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    type="submit"
                    disabled={loading}
                >{loading ? "Loading..." : "Add to Queue..."}</Button>
            </div>

            {videoLink && videoLink.match(YT_REGEX) && !loading && (
                <div className="mb-8">
                    {/* <iframe
                        className="w-full aspect-video rounded-md"
                        src={`https://www.youtube.com/embed/${extractVideoId(videoLink)}`}
                        title="YouTube preview"
                        allowFullScreen
                    /> */}

                    <LiteYouTubeEmbed title="Youtube Video" id={videoLink.match(YT_REGEX)![1]} />
                </div>
            )}

            {currentVideo && (
                <div className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">Now Playing</h2>
                    <iframe
                        className="w-full aspect-video rounded-md"
                        src={`https://www.youtube.com/embed/${currentVideo.extractedId}?autoplay=1`}
                        title="Current Song"
                        allowFullScreen
                    />
                </div>
            )}

            <div className="text-center">
                <Button
                    onClick={playNext}
                    className="text-white bg-green-600 hover:bg-green-700"
                >
                    <Play className="mr-2 h-4 w-4" /> Play Next
                </Button>
            </div>

            <div>
                <h2 className="text-2xl font-semibold mb-4">Upcoming Songs</h2>
                {queue.length <= 0 ? (
                    <p className="text-gray-300">No songs in queue.</p>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2">
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
                                                handleVote(
                                                    video.id,
                                                    !video.haveUpvoted
                                                )
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
