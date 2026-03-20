"use client";

import { useState, useEffect } from "react";
import { Music, Play, User, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface FriendActivity {
    id: string;
    username: string;
    displayName: string;
    image: string | null;
    email: string;
    isListening: boolean;
    creatorId: string | null;
    partyCode: string | null;
    songTitle: string | null;
    lastSeen: string | null;
}

export function FriendActivityFeed() {
    const [activity, setActivity] = useState<FriendActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);

    const fetchActivity = async () => {
        try {
            const res = await fetch("/api/friends/activity");
            if (res.ok) {
                const data = await res.json();
                setActivity(data.activity);
            }
        } catch (err) {
            console.error("Failed to fetch friend activity", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivity();
        const interval = setInterval(fetchActivity, 15000);
        return () => clearInterval(interval);
    }, []);

    if (loading && activity.length === 0) return null;
    if (activity.length === 0) return (
        <div className="text-center py-8 px-4 bg-white/[0.02] border border-dashed border-white/5 rounded-2xl">
            <p className="text-xs text-gray-500 italic">No activity yet. Add friends to see what they&apos;re listening to!</p>
        </div>
    );

    return (
        <div className="space-y-4">
            <button 
                className="w-full flex items-center justify-between text-sm font-bold text-gray-400 uppercase tracking-widest md:cursor-default"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                Friend Activity
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black bg-white/5 px-2 py-0.5 rounded-full">
                        {activity.filter(a => a.isListening).length} ONLINE
                    </span>
                    <div className="md:hidden">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>
            </button>
            <div className={`${isExpanded ? "block" : "hidden"} md:block space-y-3`}>
                {activity.map((friend) => (
                    <div key={friend.id}>
                        {friend.isListening ? (
                            <div className="group flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all hover:border-blue-500/20 active:scale-[0.98]">
                                <div className="relative shrink-0">
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-green-500/30 flex items-center justify-center font-bold text-green-500 overflow-hidden">
                                        {friend.image ? (
                                            <img src={friend.image} className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-5 h-5 text-green-500" />
                                        )}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gray-900 shadow-[0_0_10px_rgba(34,197,94,0.4)] animate-pulse" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <Link href={`/user/${friend.username}`} className="text-xs font-black text-white truncate hover:text-primary transition-colors cursor-pointer">@{friend.username}</Link>
                                    <p className="text-[10px] text-blue-400 font-bold flex items-center gap-1.5 truncate mt-0.5">
                                        <Music className="w-3 h-3 animate-bounce shadow-blue-500/50" />
                                        {friend.songTitle || "Vibing..."}
                                    </p>
                                </div>
                                <Link 
                                    href={`/party/${friend.partyCode || friend.creatorId}`}
                                    className="p-2.5 rounded-xl bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow-inner"
                                    title="Join Stream"
                                >
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                </Link>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 p-3 rounded-2xl opacity-40 grayscale group hover:opacity-100 hover:grayscale-0 transition-all hover:bg-white/[0.02]">
                                <div className="w-10 h-10 rounded-2xl bg-gray-800/20 border border-white/5 flex items-center justify-center text-gray-600 shrink-0">
                                    {friend.image ? (
                                        <img src={friend.image} className="w-full h-full object-cover rounded-2xl" />
                                    ) : (
                                        <User className="w-5 h-5" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <Link href={`/user/${friend.username}`} className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors truncate hover:text-primary cursor-pointer">@{friend.username}</Link>
                                    <p className="text-[10px] text-gray-600 font-medium truncate mt-0.5">
                                        {friend.lastSeen ? `Last seen ${formatDistanceToNow(new Date(friend.lastSeen))} ago` : "Offline"}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
