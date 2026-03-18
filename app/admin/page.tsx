"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Appbar } from "@/app/components/Appbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Users, 
    PlayCircle, 
    ShieldAlert, 
    UserPlus, 
    UserMinus, 
    Ban, 
    ExternalLink, 
    Search,
    RefreshCw,
    AlertCircle,
    CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import { UsersTable } from "../components/admin/UsersTable";
import { StreamsList } from "../components/admin/StreamsList";
import { BanModal } from "../components/BanModal";

export default function AdminDashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [streams, setStreams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Ban/Timeout Modal State
    const [isBanModalOpen, setIsBanModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        } else if (status === "authenticated") {
            // Further client-side check if needed, but API is guarded
            fetchData();
        }
    }, [status]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, streamsRes] = await Promise.all([
                fetch(`/api/admin/users?search=${encodeURIComponent(search)}`),
                fetch("/api/admin/streams")
            ]);

            if (usersRes.status === 403 || streamsRes.status === 403) {
                toast.error("Unauthorized access.");
                router.push("/dashboard");
                return;
            }

            const userData = await usersRes.json();
            const streamData = await streamsRes.json();

            setUsers(userData.users || []);
            setStreams(streamData.streams || []);
        } catch (error) {
            toast.error("Failed to fetch admin data.");
        } finally {
            setLoading(false);
        }
    };

    const handleRoleUpdate = async (targetUserId: string, action: "assign" | "revoke") => {
        try {
            const res = await fetch("/api/admin/assign-creator", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetUserId, action })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchData();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error("Error updating role.");
        }
    };

    const handleBanAction = async (type: "ban" | "timeout", duration: string, reason: string) => {
        if (!selectedUser) return;
        try {
            const res = await fetch("/api/admin/ban", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetUserId: selectedUser.id,
                    type,
                    duration,
                    reason
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchData();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error("Error applying restriction.");
        }
    };

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-blue-500/30">
            <Appbar />
            
            <main className="max-w-7xl mx-auto px-6 pt-24 pb-12 space-y-12">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <ShieldAlert className="w-6 h-6 text-blue-500" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Admin Control</span>
                        </div>
                        <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-500">
                            Owner Dashboard
                        </h1>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                            <input 
                                type="text"
                                placeholder="Search users..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchData()}
                                className="bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-64 transition-all"
                            />
                        </div>
                        <Button onClick={fetchData} variant="outline" className="rounded-2xl border-white/10 hover:bg-white/5">
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* User Management */}
                    <Card className="lg:col-span-2 bg-[#111] border-white/5 shadow-2xl rounded-3xl overflow-hidden">
                        <CardHeader className="p-8 border-b border-white/5 flex flex-row items-center justify-between bg-white/[0.02]">
                            <CardTitle className="text-xl flex items-center gap-3">
                                <Users className="w-5 h-5 text-blue-400" /> User Management
                            </CardTitle>
                            <span className="text-xs text-gray-500 font-mono">{users.length} users found</span>
                        </CardHeader>
                        <CardContent className="p-0">
                            <UsersTable 
                                users={users}
                                onRoleUpdate={handleRoleUpdate}
                                onBanClick={(user) => {
                                    setSelectedUser(user);
                                    setIsBanModalOpen(true);
                                }}
                            />
                        </CardContent>
                    </Card>

                    {/* Stream Management */}
                    <Card className="bg-[#111] border-white/5 shadow-2xl rounded-3xl overflow-hidden flex flex-col">
                        <CardHeader className="p-8 border-b border-white/5 bg-white/[0.02]">
                            <CardTitle className="text-xl flex items-center gap-3">
                                <PlayCircle className="w-5 h-5 text-accent-400" /> Active Streams
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px]">
                            <StreamsList 
                                streams={streams}
                                onForceClose={(id) => {
                                    // Implementation for force close can be added here
                                    toast.info("Force close requested for " + id);
                                }}
                            />
                        </CardContent>
                    </Card>
                </div>
            </main>

            <BanModal 
                isOpen={isBanModalOpen}
                targetUsername={selectedUser?.username || ""}
                scope="platform"
                onClose={() => setIsBanModalOpen(false)}
                onConfirm={handleBanAction}
            />
        </div>
    );
}
