import React from "react";
import ReactPlayer from "react-player";
import Image from "next/image";
import { Lock, Users, CheckCircle, XCircle, Play, VolumeX, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    resolvedUrl: string | null;
    pathname: string;
    creatorId: string;
    currentUserId: string | null;
    accessStatus: string | null;
    pendingRequests: any[];
    volume: number;
    reactPlayerRef: React.RefObject<ReactPlayer | null>;
    onReady: () => void;
    onPlay: () => void;
    onPause: () => void;
    onEnded: () => void;
    onError: (err: any) => void;
    onGoLive: () => void;
    onApprove: (viewerId: string, approve: boolean) => void;
    onMuteToggle: () => void;
    onVolumeChange: (v: number) => void;
    onPlayClick: () => void;
    onRequestAccess: () => void;
    isResolving: boolean;
}

export function PlayerSection({
    currentVideo,
    playVideo,
    playing,
    isMuted,
    isPaused,
    isJoined,
    isPlayerReady,
    resolvedUrl,
    pathname,
    creatorId,
    currentUserId,
    accessStatus,
    pendingRequests,
    volume,
    reactPlayerRef,
    onReady,
    onPlay,
    onPause,
    onEnded,
    onError,
    onGoLive,
    onApprove,
    onMuteToggle,
    onVolumeChange,
    onPlayClick,
    onRequestAccess,
    isResolving
}: PlayerSectionProps) {

    if (!currentVideo) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-4">
                <Play className="w-10 h-10 opacity-20" />
                <p className="text-lg">No video playing</p>
            </div>
        );
    }

    if (!playVideo) {
        return (
            <div className="w-full">
                <div className="relative w-full aspect-video md:h-[450px]">
                    {currentVideo.bigImg ? (
                        <Image
                            src={currentVideo.bigImg}
                            alt={currentVideo.title}
                            fill
                            className="object-contain"
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500">No Image</div>
                    )}
                </div>
                <div className="p-4 bg-gray-900 border-t border-gray-800 text-center">
                    <p className="text-xl font-semibold text-white truncate">{currentVideo.title}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full relative">
            {/* streamer approval UI */}
            {currentUserId === creatorId && pendingRequests.length > 0 && (
                <div className="absolute top-4 left-4 z-50 pointer-events-auto">
                    <div className="bg-gray-900/90 border border-blue-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-md max-w-xs animate-in slide-in-from-left">
                        <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4" /> Join Requests ({pendingRequests.length})
                        </h4>
                        <div className="space-y-3 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {pendingRequests.map((req) => (
                                <div key={req.id} className="flex justify-between items-center gap-3 bg-white/5 p-2 rounded-xl">
                                    <p className="text-xs font-medium text-white truncate max-w-[120px]">{req.viewer.email}</p>
                                    <div className="flex gap-1">
                                        <button onClick={() => onApprove(req.viewer.id, true)} className="p-1 hover:bg-green-500/20 text-green-500 rounded-md transition-colors">
                                            <CheckCircle className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => onApprove(req.viewer.id, false)} className="p-1 hover:bg-red-500/20 text-red-500 rounded-md transition-colors">
                                            <XCircle className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            <div className="relative w-full aspect-video md:h-[450px] bg-black bg-opacity-90 overflow-hidden rounded-xl shadow-2xl">
                {isResolving && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm gap-4">
                        <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
                        <p className="text-white font-semibold text-lg">Resolving stream...</p>
                        <p className="text-gray-400 text-sm">Bypassing embed restriction</p>
                    </div>
                )}
                {resolvedUrl ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-black gap-4 p-6">
                        <div className="relative w-full h-64">
                            <Image
                                src={currentVideo.bigImg}
                                alt={currentVideo.title}
                                fill
                                className="object-contain rounded-xl opacity-80"
                            />
                        </div>
                        <audio
                            ref={(el) => { if (el) el.volume = volume; }}
                            src={resolvedUrl}
                            autoPlay={playing}
                            controls
                            className="w-full"
                            onEnded={onEnded}
                            onError={() => onError(null)}
                        />
                    </div>
                ) : (
                    <ReactPlayer
                        ref={reactPlayerRef}
                        url={`https://www.youtube.com/watch?v=${currentVideo.extractedId}`}
                        playing={playing}
                        muted={isMuted}
                        volume={volume}
                        controls={!pathname.startsWith("/party/")}
                        width="100%"
                        height="100%"
                        style={{ minHeight: '300px' }}
                        className="aspect-video min-h-[300px] md:min-h-[450px]"
                        config={{
                            youtube: {
                                playerVars: {
                                    rel: 0,
                                    modestbranding: 1,
                                    iv_load_policy: 3,
                                    playsinline: 1,
                                    enablejsapi: 1,
                                    autoplay: 0,
                                    origin: typeof window !== 'undefined' ? window.location.origin : ''
                                }
                            }
                        }}
                        onReady={onReady}
                        onPlay={onPlay}
                        onPause={onPause}
                        onEnded={onEnded}
                        onError={onError}
                    />
                )}

                {!isJoined && (
                    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                        <div className="text-center space-y-6 max-w-sm px-6">
                            <div className="relative">
                                <div className="absolute -inset-4 bg-blue-600/20 blur-2xl rounded-full" />
                                <Play className="w-16 h-16 text-blue-500 mx-auto relative z-10 animate-pulse" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-white">
                                    {pathname.startsWith("/party/") ? "Ready to join?" : "Ready to stream?"}
                                </h3>
                                <p className="text-gray-400 text-sm">
                                    {pathname.startsWith("/party/") 
                                        ? "Click below to sync up with the streamer and start listening." 
                                        : "Click below to start your session and let everyone vibe."}
                                </p>
                            </div>
                            <Button
                                onClick={onGoLive}
                                disabled={!isPlayerReady}
                                className={`w-full h-14 text-lg font-bold rounded-2xl transition-all duration-300 shadow-xl ${isPlayerReady
                                    ? "bg-blue-600 hover:bg-blue-700 text-white scale-105 hover:scale-110"
                                    : "bg-gray-800 text-gray-500 cursor-not-allowed"
                                    }`}
                            >
                                {isPlayerReady ? (pathname.startsWith("/party/") ? "GO LIVE" : "START SESSION") : "LOADING VIDEO..."}
                            </Button>
                        </div>
                    </div>
                )}

                {isPaused && (isJoined || !pathname.startsWith("/party/")) && (
                    <div
                        className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-[2px] transition-opacity duration-300"
                        onClick={onPlayClick}
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

                {/* Global Volume Control — only for listeners, not the creator */}
                {currentUserId !== creatorId && (
                <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-black/60 px-3 py-2 rounded-xl border border-white/5 backdrop-blur-md group/vol transition-all hover:pr-4">
                        <Button
                            onClick={onMuteToggle}
                            size="sm"
                            className="bg-transparent hover:bg-white/5 text-white h-7 w-7 p-0"
                        >
                            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-blue-400" />}
                        </Button>
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.01" 
                            value={isMuted ? 0 : volume} 
                            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                            className="w-0 group-hover/vol:w-20 transition-all cursor-pointer accent-blue-500 h-1 bg-white/20 rounded-lg appearance-none overflow-hidden"
                        />
                    </div>
                </div>
                )}

                {pathname.startsWith("/party/") && (
                    <div className="absolute inset-0 z-10 cursor-default" />
                )}
            </div>
            <div className="p-4 bg-gray-900 border-t border-gray-800">
                <p className="text-xl font-semibold text-white truncate">{currentVideo.title}</p>
            </div>
        </div>
    );
}
