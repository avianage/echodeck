"use client";

import React, { useState } from "react";
import { 
    Users, 
    UserPlus, 
    UserMinus, 
    Ban, 
    AlertCircle,
    CheckCircle2,
    Trash2,
    ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface User {
    id: string;
    username: string | null;
    email: string | null;
    platformRole: string;
    isBanned: boolean;
}

interface UsersTableProps {
    users: User[];
    onRoleUpdate: (userId: string, action: "assign" | "revoke") => void;
    onBanClick: (user: User) => void;
    onDeleteClick?: (user: User) => void;
    currentUserId?: string;
}

export function UsersTable({ users, onRoleUpdate, onBanClick, onDeleteClick, currentUserId }: UsersTableProps) {
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const handleDeleteClick = (user: User) => {
        if (confirmDeleteId === user.id) {
            // Second click — confirmed
            onDeleteClick?.(user);
            setConfirmDeleteId(null);
        } else {
            // First click — arm the confirmation
            setConfirmDeleteId(user.id);
            // Auto-disarm after 3s
            setTimeout(() => setConfirmDeleteId(prev => prev === user.id ? null : prev), 3000);
        }
    };

    const roleColor = (role: string) => {
        if (role === "OWNER") return "bg-red-500/10 text-red-400 border border-red-500/20";
        if (role === "CREATOR") return "bg-accent/10 text-accent border border-accent/20";
        return "bg-gray-500/10 text-gray-400 border border-gray-500/20";
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-gray-500 bg-white/[0.01]">
                        <th className="px-8 py-4 font-black">User</th>
                        <th className="px-6 py-4 font-black">Role</th>
                        <th className="px-6 py-4 font-black">Status</th>
                        <th className="px-8 py-4 font-black text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {users.map((user) => {
                        const isSelf = user.id === currentUserId;
                        const isOwner = user.platformRole === "OWNER";
                        const isConfirmingDelete = confirmDeleteId === user.id;

                        return (
                            <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-8 py-6">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-white group-hover:text-blue-400 transition-colors">
                                            {user.username || "No username"}
                                        </span>
                                        <span className="text-xs text-gray-500">{user.email}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-6 text-sm">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider ${roleColor(user.platformRole)}`}>
                                        {user.platformRole === "OWNER" && <ShieldCheck className="inline w-3 h-3 mr-1" />}
                                        {user.platformRole}
                                    </span>
                                </td>
                                <td className="px-6 py-6 text-sm">
                                    {user.isBanned ? (
                                        <div className="flex items-center gap-1.5 text-red-500">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold">Banned</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-green-500">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold">Active</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        {/* Assign / Revoke Creator */}
                                        {!isOwner && (
                                            user.platformRole === "CREATOR" ? (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="h-8 px-3 gap-1.5 text-[10px] font-black uppercase tracking-widest border-amber-500/20 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/40 rounded-xl transition-all disabled:opacity-30"
                                                    onClick={() => onRoleUpdate(user.id, "revoke")}
                                                    title={isSelf ? "Cannot modify self" : "Revoke Creator Perks"}
                                                    disabled={isSelf}
                                                >
                                                    <UserMinus className="w-3.5 h-3.5" />
                                                    Revoke
                                                </Button>
                                            ) : (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="h-8 px-3 gap-1.5 text-[10px] font-black uppercase tracking-widest border-blue-500/20 bg-blue-500/5 text-blue-500 hover:bg-blue-500/10 hover:border-blue-500/40 rounded-xl transition-all disabled:opacity-30"
                                                    onClick={() => onRoleUpdate(user.id, "assign")}
                                                    title={isSelf ? "Cannot modify self" : "Assign Creator Role"}
                                                    disabled={isSelf}
                                                >
                                                    <UserPlus className="w-3.5 h-3.5" />
                                                    Assign
                                                </Button>
                                            )
                                        )}
                                        
                                        {/* Ban / Timeout */}
                                        {!isOwner && (
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="h-8 px-3 gap-1.5 text-[10px] font-black uppercase tracking-widest border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 hover:border-red-500/40 rounded-xl transition-all disabled:opacity-30"
                                                onClick={() => onBanClick(user)}
                                                disabled={isSelf}
                                                title={isSelf ? "Cannot restrict self" : "Restrict account access"}
                                            >
                                                <Ban className="w-3.5 h-3.5" />
                                                Restrict
                                            </Button>
                                        )}

                                        {/* Delete */}
                                        {!isOwner && !isSelf && (
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className={`h-8 px-3 gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${
                                                    isConfirmingDelete
                                                        ? "bg-red-500 border-red-500 text-white hover:bg-red-600 animate-pulse"
                                                        : "border-white/10 text-gray-400 hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20"
                                                }`}
                                                title="Permanently Delete User"
                                                onClick={() => handleDeleteClick(user)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                {isConfirmingDelete ? "Confirm?" : "Delete"}
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
