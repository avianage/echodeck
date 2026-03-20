"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Ban, Clock, ShieldAlert, X } from "lucide-react";

interface BanModalProps {
    isOpen: boolean;
    targetUsername: string;
    scope: "platform" | "stream";
    onClose: () => void;
    onConfirm: (type: "ban" | "timeout", duration: string, reason: string) => void;
}

export function BanModal({ isOpen, targetUsername, scope, onClose, onConfirm }: BanModalProps) {
    const [type, setType] = useState<"ban" | "timeout">("timeout");
    const [duration, setDuration] = useState("1d");
    const [reason, setReason] = useState("");

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setType("timeout");
            setDuration("1h");
            setReason("");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(type, type === "ban" ? "permanent" : duration, reason);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0a0a0a]/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative bg-[#111] border border-white/10 text-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${type === "ban" ? "from-red-600 to-red-400" : "from-amber-600 to-amber-400"}`} />
                
                {/* Header */}
                <div className="p-8 pb-4 flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <ShieldAlert className={`w-6 h-6 ${type === "ban" ? "text-red-500" : "text-amber-500"}`} />
                            <h2 className="text-2xl font-black tracking-tighter">Restrict Access</h2>
                        </div>
                        <p className="text-gray-500 text-sm font-medium">
                            Restricting <span className="text-white font-bold">@{targetUsername}</span> on {scope}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-8 py-4 space-y-8">
                    {/* Action Type */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Action Type</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setType("timeout")}
                                className={`flex items-center justify-center gap-2 py-4 rounded-2xl border transition-all font-bold text-sm ${
                                    type === "timeout" 
                                        ? "bg-amber-500/10 border-amber-500/50 text-amber-500" 
                                        : "bg-white/[0.03] border-white/5 text-gray-500 hover:bg-white/[0.06]"
                                }`}
                            >
                                <Clock className="w-4 h-4" /> Timeout
                            </button>
                            <button
                                onClick={() => setType("ban")}
                                className={`flex items-center justify-center gap-2 py-4 rounded-2xl border transition-all font-bold text-sm ${
                                    type === "ban" 
                                        ? "bg-red-500/10 border-red-500/50 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.1)]" 
                                        : "bg-white/[0.03] border-white/5 text-gray-500 hover:bg-white/[0.06]"
                                }`}
                            >
                                <Ban className="w-4 h-4" /> Ban
                            </button>
                        </div>
                    </div>

                    {/* Duration */}
                    {type === "timeout" ? (
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Duration</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { id: "1m", label: "1 Minute" },
                                    { id: "1h", label: "1 Hour" },
                                    { id: "1d", label: "1 Day" },
                                    { id: "1w", label: "1 Week" },
                                    { id: "1mo", label: "1 Month" }
                                ].map((d) => (
                                    <button
                                        key={d.id}
                                        onClick={() => setDuration(d.id)}
                                        className={`px-4 py-2 rounded-xl border text-[11px] font-black uppercase tracking-tighter transition-all ${
                                            duration === d.id 
                                                ? "bg-white/10 border-white/20 text-white" 
                                                : "bg-transparent border-white/5 text-gray-600 hover:text-gray-400 hover:border-white/10"
                                        }`}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Duration</label>
                            <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 font-black text-xs uppercase tracking-widest inline-block">
                                Permanent
                            </div>
                        </div>
                    )}

                    {/* Reason */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Reason (Optional)</label>
                        <input 
                            placeholder="Reason for restriction..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all placeholder:text-gray-700"
                        />
                    </div>

                    {/* Warning Text */}
                    <div className={`p-5 rounded-[1.5rem] flex items-start gap-4 transition-colors ${
                        type === "ban" ? "bg-red-500/5 border border-red-500/10" : "bg-amber-500/5 border border-amber-500/10"
                    }`}>
                        <AlertCircle className={`w-5 h-5 mt-0.5 shrink-0 ${type === "ban" ? "text-red-500" : "text-amber-500"}`} />
                        <p className="text-[11px] font-medium leading-relaxed text-gray-400">
                            <strong className="text-white block mb-0.5">Note:</strong>
                            {type === "ban" 
                                ? "This user will be completely blocked from the platform. All active sessions will be terminated immediately."
                                : "The user will be able to browse but cannot interact (vote, add songs, etc.) for the selected duration."}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 pt-4 flex gap-3">
                    <Button variant="ghost" onClick={onClose} className="flex-1 rounded-2xl text-gray-500 hover:bg-white/5 h-12 font-bold">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleConfirm}
                        className={`flex-1 rounded-2xl font-bold h-12 transition-all shadow-lg ${
                            type === "ban" 
                                ? "bg-red-600 hover:bg-red-500 text-white shadow-red-900/20" 
                                : "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20"
                        }`}
                    >
                        Apply {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Button>
                </div>
            </div>
        </div>
    );
}
