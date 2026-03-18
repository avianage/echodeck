"use client";

import React from "react";
import { 
    Users, 
    UserPlus, 
    UserMinus, 
    Ban, 
    AlertCircle,
    CheckCircle2
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
    currentUserId?: string;
}

export function UsersTable({ users, onRoleUpdate, onBanClick, currentUserId }: UsersTableProps) {
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
                    {users.map((user) => (
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
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider ${
                                    user.platformRole === "CREATOR" 
                                        ? "bg-accent/10 text-accent border border-accent/20" 
                                        : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                                }`}>
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
                                <div className="flex items-center justify-end gap-2">
                                    {user.platformRole === "CREATOR" ? (
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-8 w-8 p-0 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-30"
                                            onClick={() => onRoleUpdate(user.id, "revoke")}
                                            title={user.id === currentUserId ? "Cannot modify self" : "Revoke Creator"}
                                            disabled={user.id === currentUserId}
                                        >
                                            <UserMinus className="w-4 h-4" />
                                        </Button>
                                    ) : (
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-8 w-8 p-0 text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 disabled:opacity-30"
                                            onClick={() => onRoleUpdate(user.id, "assign")}
                                            title={user.id === currentUserId ? "Cannot modify self" : "Assign Creator"}
                                            disabled={user.id === currentUserId}
                                        >
                                            <UserPlus className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                                        title={user.id === currentUserId ? "Cannot restrict self" : "Ban/Timeout User"}
                                        onClick={() => onBanClick(user)}
                                        disabled={user.id === currentUserId}
                                    >
                                        <Ban className="w-4 h-4" />
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
