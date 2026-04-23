"use client";

import React, { useEffect, useRef, useState } from "react";

interface YouTubePlayerProps {
    videoId: string;
    isHost: boolean;
    playing: boolean;
    volume: number;
    muted: boolean;
    onReady: (player: any) => void;
    onStateChange: (event: any) => void;
    onError: (error: number) => void;
}

declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        YT: any;
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
    const playerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isApiLoaded, setIsApiLoaded] = useState(false);

    useEffect(() => {
        // Load YouTube IFrame API script
        if (!window.YT) {
            const tag = document.createElement("script");
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName("script")[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = () => {
                setIsApiLoaded(true);
            };
        } else {
            setIsApiLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!isApiLoaded || !containerRef.current || !videoId) return;

        // Initialize player
        const player = new window.YT.Player(containerRef.current, {
            height: "100%",
            width: "100%",
            videoId: videoId,
            playerVars: {
                autoplay: 0,
                controls: isHost ? 1 : 0,
                disablekb: isHost ? 0 : 1,
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                iv_load_policy: 3,
                playsinline: 1,
                enablejsapi: 1,
                origin: window.location.origin,
            },
            events: {
                onReady: (event: any) => {
                    playerRef.current = event.target;
                    event.target.setVolume(volume * 100);
                    if (muted) event.target.mute();
                    onReady(event.target);
                },
                onStateChange: onStateChange,
                onError: (event: any) => onError(event.data),
            },
        });

        return () => {
            if (player && typeof player.destroy === "function") {
                player.destroy();
            }
        };
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
            // Player might not be fully ready yet
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
