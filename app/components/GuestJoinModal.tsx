"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { X, Mail, Github, LogIn, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GuestJoinModalProps {
    isOpen: boolean;
    streamTitle: string;
    creatorUsername: string;
    callbackUrl: string;
    onClose: () => void;
}

export function GuestJoinModal({ isOpen, streamTitle, creatorUsername, callbackUrl, onClose }: GuestJoinModalProps) {
    const [email, setEmail] = useState("");
    const [isEmailSent, setIsEmailSent] = useState(false);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleEmailSignin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setLoading(true);
        try {
            await signIn("email", { email, callbackUrl, redirect: false });
            setIsEmailSent(true);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0a0a0a]/90 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="relative bg-[#111] border border-white/10 w-full max-w-md rounded-[3rem] shadow-[0_0_100px_rgba(37,99,235,0.2)] overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Decorative background */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px]" />
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-600/20 rounded-full blur-[100px]" />

                <div className="relative p-10 pt-12 space-y-8">
                    <button 
                        onClick={onClose}
                        className="absolute top-8 right-8 p-2 hover:bg-white/5 rounded-full transition-colors group"
                    >
                        <X className="w-5 h-5 text-gray-500 group-hover:text-white" />
                    </button>

                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-6">
                            <div className="p-4 bg-blue-600/10 rounded-2xl border border-blue-600/20">
                                <LogIn className="w-10 h-10 text-blue-500" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-black tracking-tighter"> Join @{creatorUsername} </h2>
                        <p className="text-gray-500 font-medium text-sm"> Sign in to listen and interact with this stream. </p>
                    </div>

                    <div className="space-y-3">
                        <Button 
                            onClick={() => signIn("google", { callbackUrl })}
                            className="w-full h-14 rounded-2xl bg-white text-black hover:bg-white/90 font-bold transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                        >
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                            Continue with Google
                        </Button>
                        <Button 
                            onClick={() => signIn("spotify", { callbackUrl })}
                            className="w-full h-14 rounded-2xl bg-[#1DB954] text-white hover:bg-[#1ed760] font-bold transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                        >
                            <img src="https://www.svgrepo.com/show/475684/spotify-color.svg" className="w-5 h-5 brightness-0 invert" alt="Spotify" />
                            Continue with Spotify
                        </Button>
                    </div>

                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                        <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest"><span className="bg-[#111] px-4 text-gray-600">or use email</span></div>
                    </div>

                    {!isEmailSent ? (
                        <form onSubmit={handleEmailSignin} className="space-y-3">
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <Input 
                                    type="email" 
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="h-14 bg-white/5 border-white/5 rounded-2xl pl-12 pr-4 text-sm focus:ring-blue-500/50 transition-all font-medium"
                                />
                            </div>
                            <Button 
                                disabled={loading}
                                className="w-full h-14 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/5 text-white font-bold transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                            >
                                {loading ? "Sending..." : "Send Magic Link"}
                                {!loading && <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />}
                            </Button>
                        </form>
                    ) : (
                        <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 text-center space-y-2 animate-in slide-in-from-bottom-2">
                            <p className="text-blue-500 font-bold text-sm"> Check your inbox! </p>
                            <p className="text-gray-500 text-xs font-medium"> We've sent a magic link to {email}. </p>
                        </div>
                    )}

                    <div className="text-center">
                        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-xs font-black uppercase tracking-widest transition-colors">
                            I'll join later
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
