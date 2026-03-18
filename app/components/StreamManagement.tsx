"use client";

import React, { useState, useEffect } from "react";
import { Users, Ban, Clock, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import { BanModal } from "./BanModal";

interface Viewer {
    id: string;
    username: string | null;
    displayName: string | null;
    image: string | null;
}

interface StreamManagementProps {
    creatorId: string;
}

export function StreamManagement({ creatorId }: StreamManagementProps) {
    const [viewers, setViewers] = useState<Viewer[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<Viewer | null>(null);
    const [isBanModalOpen, setIsBanModalOpen] = useState(false);

    const fetchViewers = async () => {
        try {
            const res = await fetch(`/api/streams/viewers?creatorId=${creatorId}`);
            if (res.ok) {
                const data = await res.json();
                setViewers(data.viewers);
            }
        } catch (err) {
            console.error("Failed to fetch viewers:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchViewers();
        const interval = setInterval(fetchViewers, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, [creatorId]);

    const handleBanConfirm = async (type: "ban" | "timeout", duration: string, reason: string) => {
        if (!selectedUser) return;
        try {
            const res = await fetch("/api/streams/ban", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetUserId: selectedUser.id,
                    creatorId,
                    type,
                    duration,
                    reason
                })
            });
            if (res.ok) {
                toast.success(`${selectedUser.username} ${type === "ban" ? "banned" : "timed out"}`);
                setIsBanModalOpen(false);
                fetchViewers();
            } else {
                toast.error("Action failed");
            }
        } catch (err) {
            toast.error("Error communicating with server");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black tracking-tighter uppercase italic">Live Viewers</h3>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active in the last 20 seconds</p>
                    </div>
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={fetchViewers}
                    className="rounded-full hover:bg-white/5"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[10px] uppercase tracking-widest text-gray-500 bg-white/[0.03]">
                                <th className="px-6 py-4 font-black">User</th>
                                <th className="px-6 py-4 font-black text-right">Moderation</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {viewers.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="px-6 py-12 text-center text-gray-500 text-sm">
                                        No active viewers found.
                                    </td>
                                </tr>
                            ) : (
                                viewers.map((viewer) => (
                                    <tr key={viewer.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <img 
                                                    src={viewer.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${viewer.username}`} 
                                                    className="w-10 h-10 rounded-xl object-cover border border-white/10"
                                                    alt=""
                                                />
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-white text-sm">@{viewer.username || "Anonymous"}</span>
                                                    <span className="text-[10px] text-gray-500 font-medium">{viewer.displayName}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-9 gap-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                                                onClick={() => {
                                                    setSelectedUser(viewer);
                                                    setIsBanModalOpen(true);
                                                }}
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Moderate</span>
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedUser && (
                <BanModal 
                    isOpen={isBanModalOpen}
                    targetUsername={selectedUser.username || "User"}
                    scope="stream"
                    onClose={() => setIsBanModalOpen(false)}
                    onConfirm={handleBanConfirm}
                />
            )}
        </div>
    );
}
