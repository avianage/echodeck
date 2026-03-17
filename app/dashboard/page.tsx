"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Users, Star, LogOut, Settings, Globe, Lock, Plus, ArrowLeft } from "lucide-react";
import { Appbar } from "../components/Appbar";
import { toast } from "react-toastify";

export default function Dashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [view, setView] = useState<"choice" | "join">("choice");
    const [joinInput, setJoinInput] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [favorites, setFavorites] = useState<{id: string, email: string, isOnline: boolean}[]>([]);
    const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);

    useEffect(() => {
        if (session?.user) {
            fetchFavorites();
            fetch("/api/user/privacy").then(res => res.json()).then(data => {
                if (data.isPublic !== undefined) setIsPublic(data.isPublic);
            });
        }
    }, [session]);

    const fetchFavorites = async () => {
        try {
            const res = await fetch("/api/user/favorites");
            const data = await res.json();
            setFavorites(data.favorites || []);
        } catch (err) {
            console.error("Failed to fetch favorites", err);
        } finally {
            setIsLoadingFavorites(false);
        }
    };

    if (status === "loading") {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!session?.user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white gap-4">
                <h1 className="text-2xl font-bold">Please sign in to continue</h1>
                <Button onClick={() => signIn()}>Sign In</Button>
            </div>
        );
    }

    const handleJoinStream = () => {
        if (!joinInput.trim()) return;
        
        let targetId = joinInput.trim();
        if (targetId.includes("/party/")) {
            targetId = targetId.split("/party/")[1];
        } else if (targetId.includes("/")) {
            targetId = targetId.split("/").pop() || "";
        }

        if (targetId) {
            router.push(`/party/${targetId}`);
        } else {
            toast.error("Invalid stream link or code");
        }
    };

    const handleTogglePrivacy = async () => {
        const newPrivacy = !isPublic;
        setIsPublic(newPrivacy);
        try {
            await fetch("/api/user/privacy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isPublic: newPrivacy })
            });
            toast.success(`Stream set to ${newPrivacy ? "Public" : "Private"}`);
        } catch (err) {
            toast.error("Failed to update privacy settings");
            setIsPublic(!newPrivacy);
        }
    };

    const hasFavorites = favorites.length > 0;

    return (
        <div className="min-h-screen bg-gray-950 text-white selection:bg-blue-500/30 overflow-x-hidden">
            <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.1),transparent_50%)]" />
            <div className="fixed top-0 left-0 right-0 z-50">
                <Appbar />
            </div>

            <main className={`max-w-6xl mx-auto px-6 pt-32 pb-12 space-y-12 relative z-10 ${!hasFavorites && view === "choice" ? "flex flex-col items-center" : ""}`}>
                <div className={`flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8 w-full ${!hasFavorites && view === "choice" ? "text-center md:text-left" : ""}`}>
                    <div>
                        <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
                            Welcome, {session.user.name?.split(' ')[0] || 'DJ'}
                        </h1>
                        <p className="text-gray-400 mt-2">The deck is ready. What's your move?</p>
                    </div>
                </div>

                <div className={`grid grid-cols-1 ${hasFavorites ? "lg:grid-cols-3" : "max-w-4xl mx-auto"} gap-8 items-start w-full`}>
                    {/* Main Actions Column */}
                    <div className={`${hasFavorites ? "lg:col-span-2" : ""} space-y-8`}>
                        {view === "choice" ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Start Stream Choice */}
                                <Card 
                                    className="bg-gray-900/50 border-white/5 backdrop-blur-md overflow-hidden group hover:border-blue-500/40 transition-all cursor-pointer h-[380px] flex flex-col relative"
                                    onClick={() => router.push("/stream")}
                                >
                                    <div className="absolute top-4 right-4 z-20">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Stream Status</span>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className={`h-9 px-3 text-xs font-bold rounded-xl flex items-center gap-2 border shadow-lg transition-all ${isPublic ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20"}`}
                                                onClick={(e) => { e.stopPropagation(); handleTogglePrivacy(); }}
                                            >
                                                {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                                {isPublic ? "PUBLIC" : "PRIVATE"}
                                            </Button>
                                        </div>
                                    </div>
                                    <CardContent className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 text-center">
                                        <div className="p-5 rounded-3xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform shadow-2xl shadow-blue-500/5">
                                            <Play className="w-14 h-14 fill-blue-500" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-bold text-white">Start a Stream</h3>
                                            <p className="text-gray-400 text-sm max-w-[200px]">Host your own party and let others vibe with you.</p>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest group-hover:gap-3 transition-all">
                                            Go Live <Plus className="w-4 h-4" />
                                        </div>
                                    </CardContent>
                                    <div className="py-3 bg-blue-500/5 border-t border-white/5 text-center text-[10px] font-bold text-blue-400/60 uppercase tracking-widest">
                                        HOST YOUR SESSION
                                    </div>
                                </Card>

                                {/* Join Stream Choice */}
                                <Card 
                                    className="bg-gray-900/50 border-white/5 backdrop-blur-md overflow-hidden group hover:border-purple-500/40 transition-all cursor-pointer h-[380px] flex flex-col"
                                    onClick={() => setView("join")}
                                >
                                    <CardContent className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 text-center">
                                        <div className="p-5 rounded-3xl bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform shadow-2xl shadow-purple-500/5">
                                            <Users className="w-14 h-14" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-bold text-white">Join a Stream</h3>
                                            <p className="text-gray-400 text-sm max-w-[200px]">Jump into a friend's party and start voting.</p>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-widest group-hover:gap-3 transition-all">
                                            Connect <Plus className="w-4 h-4" />
                                        </div>
                                    </CardContent>
                                    <div className="py-3 bg-purple-500/5 border-t border-white/5 text-center text-[10px] font-bold text-purple-400/60 uppercase tracking-widest">
                                        LINK OR CODE
                                    </div>
                                </Card>
                            </div>
                        ) : (
                            <Card className="bg-gray-900/50 border-white/5 backdrop-blur-md animate-in zoom-in-95 duration-300 shadow-2xl shadow-purple-500/5 max-w-2xl mx-auto overflow-hidden">
                                <CardHeader className="pb-2 flex flex-row items-center gap-4">
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        onClick={() => setView("choice")} 
                                        className="rounded-xl border-white/10 hover:bg-white/10 bg-white/5 shadow-lg group/back text-white"
                                    >
                                        <ArrowLeft className="w-5 h-5 group-hover/back:-translate-x-1 transition-transform" />
                                    </Button>
                                    <CardTitle className="text-2xl text-white">Join a Party</CardTitle>
                                </CardHeader>
                                <CardContent className="p-12 space-y-10">
                                    <div className="space-y-4 text-center">
                                        <div className="mx-auto w-20 h-20 rounded-3xl bg-purple-500/10 flex items-center justify-center text-purple-500 mb-2 shadow-2xl shadow-purple-500/10">
                                            <Users className="w-10 h-10" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white">Enter Stream Details</h3>
                                        <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">Paste the link from <span className="text-purple-400 font-mono">echodeck.avianage.in</span> or enter the unique host code.</p>
                                    </div>
                                    <div className="max-w-md mx-auto space-y-5">
                                        <div className="relative group/input">
                                            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-0 group-focus-within/input:opacity-20 transition duration-500"></div>
                                            <Input 
                                                placeholder="e.g. f3ef33... or echodeck.avianage.in/party/..." 
                                                className="bg-black/60 border-white/10 h-16 px-6 text-lg focus:border-purple-500/30 rounded-2xl relative z-10"
                                                value={joinInput}
                                                onChange={(e) => setJoinInput(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && handleJoinStream()}
                                                autoFocus
                                            />
                                        </div>
                                        <Button 
                                            onClick={handleJoinStream}
                                            className="w-full h-16 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-purple-500/30 active:scale-[0.98] text-lg uppercase tracking-wider border-b-4 border-purple-800 hover:border-purple-600"
                                        >
                                            Dive into Vibe
                                        </Button>
                                    </div>
                                </CardContent>
                                <div className="py-2 bg-purple-500/10 border-t border-purple-500/20 text-center">
                                    <p className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] animate-pulse">Waiting for your entry</p>
                                </div>
                            </Card>
                        )}
                    </div>

                    {hasFavorites && (
                        <Card className="bg-gray-900/40 border-white/5 backdrop-blur-md sticky top-32 overflow-hidden border-l-0 lg:border-l lg:border-white/5 md:rounded-l-none shadow-2xl">
                            <CardHeader className="pb-4 border-b border-white/5 px-6">
                                <CardTitle className="text-sm font-bold flex items-center justify-between tracking-tight">
                                    <span className="flex items-center gap-2 text-gray-300">
                                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500/20" /> YOUR CIRCLE
                                    </span>
                                    <span className="text-[10px] font-black text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">{favorites.length}/5</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto custom-scrollbar">
                                    {favorites.map((fav) => (
                                        <div 
                                            key={fav.id}
                                            className="group/item flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer relative"
                                            onClick={() => router.push(`/party/${fav.id}`)}
                                        >
                                            <div className="flex items-center gap-4 relative z-10 w-full">
                                                <div className="relative shrink-0">
                                                    <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br transition-all duration-500 ${fav.isOnline ? "from-green-500/20 to-blue-500/20 border-green-500/20" : "from-gray-500/10 to-gray-500/5 border-white/5"} flex items-center justify-center font-bold border`}>
                                                        <span className={fav.isOnline ? "text-green-500" : "text-gray-600"}>{fav.email[0].toUpperCase()}</span>
                                                    </div>
                                                    {fav.isOnline && (
                                                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-950 shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
                                                    )}
                                                </div>
                                                <div className="overflow-hidden flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-semibold text-white truncate group-hover/item:text-blue-400 transition-colors">
                                                            {fav.email.split('@')[0]}
                                                        </p>
                                                        {fav.isOnline && (
                                                            <span className="shrink-0 text-[8px] font-black bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded-sm border border-green-500/20 tracking-tighter uppercase animate-pulse">
                                                                Live
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className={`text-[10px] font-medium tracking-tight ${fav.isOnline ? "text-blue-400/60" : "text-gray-500/60"}`}>
                                                        {fav.isOnline ? "Streaming now" : "Currently offline"}
                                                    </p>
                                                </div>
                                                <div className="shrink-0 opacity-0 group-hover/item:opacity-100 transition-all translate-x-2 group-hover/item:translate-x-0">
                                                    <ArrowLeft className="w-4 h-4 text-blue-500 rotate-180" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-4 bg-white/[0.01] border-t border-white/5 text-center">
                                    <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Only your top 5 DJs</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
}
