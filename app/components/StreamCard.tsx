"use client";

import { Lock, Users, Play, Radio, User } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

interface StreamCardProps {
    stream: any;
    isGuest: boolean;
    onJoinClick: (stream: any) => void;
}

export function StreamCard({ stream, isGuest, onJoinClick }: StreamCardProps) {
    const viewerCount = stream.currentStream?.viewerCount ?? 0;
    const thumbnail = stream.bigImg || stream.smallImg || "/placeholder-stream.jpg";

    return (
        <div className="group relative bg-[#111] border border-white/5 rounded-[2rem] overflow-hidden transition-all hover:bg-[#151515] hover:border-white/10 hover:shadow-2xl hover:shadow-blue-900/10">
            {/* Top Area: Player Preview / Lock */}
            <div className="relative aspect-video w-full overflow-hidden bg-[#0a0a0a]">
                <img 
                    src={thumbnail} 
                    alt={stream.title}
                    className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${isGuest ? "blur-md scale-110 opacity-50" : "opacity-80"}`}
                />
                
                {isGuest && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                        <div className="p-4 bg-white/10 rounded-full border border-white/10 shadow-2xl">
                            <Lock className="w-8 h-8 text-white/90" />
                        </div>
                        <p className="text-white/70 text-sm font-black uppercase tracking-widest">Sign in to join</p>
                    </div>
                )}

                {/* Live Badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                    <div className="bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg shadow-red-900/20">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        Live
                    </div>
                </div>

                {/* Play Icon Suggestion */}
                {!isGuest && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="p-5 bg-blue-600 rounded-full shadow-2xl shadow-blue-600/50 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            <Play className="w-8 h-8 text-white fill-current" />
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Area: Metadata */}
            <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4">
                        <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-2xl border-2 border-white/5 bg-gray-900 flex items-center justify-center overflow-hidden">
                                {stream.user?.image ? (
                                    <img 
                                        src={stream.user.image} 
                                        className="w-full h-full object-cover"
                                        alt={stream.user.username}
                                    />
                                ) : (
                                    <User className="w-6 h-6 text-gray-500" />
                                )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-[#111] rounded-full" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <h3 className="text-white font-bold leading-none line-clamp-1 group-hover:text-primary transition-colors">
                                    {stream.title || "Untitled Session"}
                                </h3>
                                {stream.genre && (
                                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0">
                                        {stream.genre}
                                    </span>
                                )}
                            </div>
                            <p className="text-gray-500 text-xs font-medium"> @{stream.user?.username} </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-bold text-gray-300"> {viewerCount} </span>
                    </div>
                </div>

                <Button 
                    onClick={() => onJoinClick(stream)}
                    className="w-full h-14 rounded-2xl bg-white text-black hover:bg-white/90 font-black uppercase tracking-widest text-xs transition-all active:scale-95"
                >
                    {isGuest ? "Join Stream" : "Jump In"}
                </Button>
            </div>
        </div>
    );
}
