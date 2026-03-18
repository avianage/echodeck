"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Shield, Calendar, Music, ExternalLink, Unlink, Edit3, Check, X, Loader2, Users,
    Trash2,
    AlertTriangle,
    ShieldAlert
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FriendActivityFeed } from "../components/FriendActivityFeed";
import { UsersTable } from "../components/admin/UsersTable";
import { StreamsList } from "../components/admin/StreamsList";
import { BanModal } from "../components/BanModal";
import { PlayCircle } from "lucide-react";

export default function AccountPage() {
    const { data: session, update } = useSession();
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [updatingUsername, setUpdatingUsername] = useState(false);
    const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
    const [newDisplayName, setNewDisplayName] = useState("");
    const [updatingDisplayName, setUpdatingDisplayName] = useState(false);
    const [allowFriendRequests, setAllowFriendRequests] = useState(true);
    const [partyCode, setPartyCode] = useState<string | null>(null);

    // Owner Management State
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [allStreams, setAllStreams] = useState<any[]>([]);
    const [selectedUserForBan, setSelectedUserForBan] = useState<any>(null);
    const [isBanModalOpen, setIsBanModalOpen] = useState(false);
    const [isManagementLoading, setIsManagementLoading] = useState(false);

    // Account Deletion State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);

    const AVATAR_SEEDS = [
        "Aiden", "Aneka", "Abby", "Aaliyah", "Bailey", "Caleb", 
        "Daisy", "Ethan", "Faith", "Gavin", "Hazel", "Ivan", 
        "Jasmine", "Kevin", "Lily", "Mason", "Nora", "Oscar", 
        "Piper", "Quinn", "Riley", "Sophie", "Toby", "Uma"
    ];

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const res = await fetch("/api/user/me");
                if (res.ok) {
                    const data = await res.json();
                    setUserData(data.user);
                    setNewUsername(data.user.username || "");
                    setNewDisplayName(data.user.displayName || (session?.user?.name ?? "") || "");

                    const privRes = await fetch("/api/user/privacy");
                    const privData = await privRes.json();
                    if (privData.allowFriendRequests !== undefined) setAllowFriendRequests(privData.allowFriendRequests);
                    setPartyCode(data.user.partyCode);
                }
            } catch (err) {
                console.error("Failed to fetch user data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();

        if ((session?.user as any)?.platformRole === "OWNER") {
            fetchManagementData();
        }
    }, [session]);

    const fetchManagementData = async () => {
        setIsManagementLoading(true);
        try {
            const [uRes, sRes] = await Promise.all([
                fetch("/api/admin/users"),
                fetch("/api/admin/streams")
            ]);
            if (uRes.ok) {
                const uData = await uRes.json();
                setAllUsers(uData.users);
            }
            if (sRes.ok) {
                const sData = await sRes.json();
                setAllStreams(sData.streams);
            }
        } catch (err) {
            console.error("Failed to fetch management data:", err);
        } finally {
            setIsManagementLoading(false);
        }
    };

    const handleRoleUpdate = async (userId: string, action: "assign" | "revoke") => {
        try {
            const res = await fetch("/api/admin/assign-creator", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, action })
            });
            if (res.ok) {
                toast.success(`Role ${action}ed successfully`);
                fetchManagementData();
            } else {
                toast.error("Failed to update role");
            }
        } catch (err) {
            toast.error("Error updating role");
        }
    };

    const handleUpdateUsername = async () => {
        if (!newUsername.trim() || newUsername === userData?.username) {
            setIsEditingUsername(false);
            return;
        }

        setUpdatingUsername(true);
        try {
            const res = await fetch("/api/user/update-username", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: newUsername.trim().toLowerCase() })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success("Username updated!");
                setUserData({ ...userData, username: newUsername.trim().toLowerCase() });
                setIsEditingUsername(false);
            } else {
                toast.error(data.message || "Failed to update username");
            }
        } catch (err) {
            toast.error("Error updating username");
        } finally {
            setUpdatingUsername(false);
        }
    };

    const handleUpdateDisplayName = async () => {
        const currentDisplayName = userData?.displayName || (session?.user?.name ?? "");
        if (!newDisplayName.trim() || newDisplayName === currentDisplayName) {
            setIsEditingDisplayName(false);
            return;
        }

        setUpdatingDisplayName(true);
        try {
            const res = await fetch("/api/user/update-displayname", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ displayName: newDisplayName.trim() })
            });

            if (res.ok) {
                toast.success("Display name updated!");
                setUserData({ ...userData, displayName: newDisplayName.trim() });
                setIsEditingDisplayName(false);
            } else {
                toast.error("Failed to update display name");
            }
        } catch (err) {
            toast.error("Error updating display name");
        } finally {
            setUpdatingDisplayName(false);
        }
    };

    const handleToggleFriendRequests = async () => {
        const nextState = !allowFriendRequests;
        setAllowFriendRequests(nextState);
        try {
            const res = await fetch("/api/user/privacy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ allowFriendRequests: nextState })
            });
            if (!res.ok) throw new Error();
            toast.success(`Friend requests: ${nextState ? "Allowed" : "Blocked"}`);
        } catch (err) {
            toast.error("Failed to update social settings");
            setAllowFriendRequests(!nextState);
        }
    };

    const handleDisconnectProvider = async (provider: "google" | "spotify") => {
        try {
            const res = await fetch("/api/auth/disconnect-provider", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider })
            });

            if (res.ok) {
                if (provider === "spotify") {
                    setUserData({ ...userData, spotifyConnected: false });
                } else {
                    setUserData({ 
                        ...userData, 
                        accounts: userData.accounts?.filter((a: any) => a.provider !== "google") 
                    });
                }
                toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} disconnected`);
            } else {
                toast.error(`Failed to disconnect ${provider}`);
            }
        } catch (err) {
            toast.error(`Error disconnecting ${provider}`);
        }
    };

    const handleBanAction = async (type: "ban" | "timeout", duration: string, reason: string) => {
        if (!selectedUserForBan) return;
        try {
            const res = await fetch("/api/admin/ban", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: selectedUserForBan.id,
                    type,
                    duration,
                    reason
                })
            });
            if (res.ok) {
                toast.success(`${type === "ban" ? "Ban" : "Timeout"} applied`);
                fetchManagementData();
                setIsBanModalOpen(false);
            } else {
                toast.error("Failed to apply restriction");
            }
        } catch (err) {
            toast.error("Error applying restriction");
        }
    };

    const handleDeleteAccount = async () => {
        setIsDeletingAccount(true);
        try {
            const res = await fetch("/api/user/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            if (res.ok) {
                toast.success("Account deleted successfully");
                await signOut({ callbackUrl: "/" });
            } else {
                toast.error("Failed to delete account");
            }
        } catch (err) {
            console.error("Error deleting account:", err);
            toast.error("An unexpected error occurred while deleting your account");
        } finally {
            setIsDeletingAccount(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleUpdateAvatar = async (seed: string) => {
        const imageUrl = seed === "OWNER_SPECIAL" 
            ? "/avatars/owner_avatar.png" 
            : `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
        try {
            const res = await fetch("/api/user/update-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: imageUrl })
            });

            if (res.ok) {
                setUserData({ ...userData, image: imageUrl });
                await update({ image: imageUrl });
                toast.success("Avatar updated!");
            } else {
                toast.error("Failed to update avatar");
            }
        } catch (err) {
            toast.error("Error updating avatar");
        }
    };

    if (loading || !session?.user) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <p>Loading profile...</p>
            </div>
        );
    }

    const user = userData || session.user;
    const isCreator = user.platformRole === "CREATOR" || user.platformRole === "OWNER";

    return (
        <div className="min-h-screen bg-black text-white selection:bg-primary/30">
            <main className="max-w-4xl mx-auto px-6 py-12">
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
                                My Account
                            </h1>
                            <p className="text-gray-400 mt-2">Manage your profile and account settings.</p>
                        </div>
                        {user.username && (
                            <a 
                                href={`/user/${user.username}`}
                                className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 hover:border-primary/50 transition-all flex items-center gap-2 group w-fit"
                            >
                                View My Public Profile
                                <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-primary" />
                            </a>
                        )}
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Profile Section */}
                        <Card className="bg-gray-900/50 border-white/5 backdrop-blur-md md:col-span-2 overflow-hidden shadow-2xl">
                            <CardHeader className="pb-4 border-b border-white/5 px-8 pt-8">
                                <CardTitle className="text-xl flex items-center gap-3">
                                    <User className="w-5 h-5 text-primary" /> Personal Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">
                                <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                                    <div className="relative group">
                                        <div className="h-24 w-24 rounded-3xl bg-gray-900 border-4 border-white/5 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-500/30">
                                            {user.image ? (
                                                <img src={user.image} alt={user.displayName || user.name || "Profile"} className="h-full w-full object-cover" />
                                            ) : (
                                                <User className="w-12 h-12 text-gray-400" />
                                            )}
                                        </div>
                                        {user.platformRole && (
                                            <div className={`absolute -bottom-2 -right-2 px-2 py-1 rounded-lg text-[8px] font-black border uppercase tracking-widest shadow-xl
                                                ${user.platformRole === "OWNER" ? "bg-red-500/20 text-red-500 border-red-500/30" :
                                                    user.platformRole === "CREATOR" ? "bg-primary/20 text-primary border-primary/30" :
                                                        "bg-gray-500/20 text-gray-500 border-white/10"}`}>
                                                {user.platformRole}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-4 flex-1 w-full">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Display Name</p>
                                                <div className="flex items-center gap-2 group/display">
                                                    {isEditingDisplayName ? (
                                                        <div className="flex items-center gap-2 w-full">
                                                            <Input
                                                                value={newDisplayName}
                                                                onChange={(e) => setNewDisplayName(e.target.value)}
                                                                className="h-8 bg-white/5 border-white/10 text-sm font-bold w-full max-w-[200px]"
                                                                autoFocus
                                                            />
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500 hover:bg-green-500/10" onClick={handleUpdateDisplayName} disabled={updatingDisplayName}>
                                                                {updatingDisplayName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-500 hover:bg-white/5" onClick={() => { setIsEditingDisplayName(false); setNewDisplayName(user.displayName || user.name || ""); }}>
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <p className="text-lg font-bold text-white">{user.displayName || user.name}</p>
                                                            <button
                                                                onClick={() => setIsEditingDisplayName(true)}
                                                                className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-all opacity-0 group-hover/display:opacity-100"
                                                            >
                                                                <Edit3 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Username</p>
                                                <div className="flex items-center gap-2 group/user">
                                                    {isEditingUsername ? (
                                                        <div className="flex items-center gap-2 w-full">
                                                            <Input
                                                                value={newUsername}
                                                                onChange={(e) => setNewUsername(e.target.value)}
                                                                className="h-8 bg-white/5 border-white/10 text-sm font-bold w-full max-w-[150px]"
                                                                autoFocus
                                                            />
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500 hover:bg-green-500/10" onClick={handleUpdateUsername} disabled={updatingUsername}>
                                                                {updatingUsername ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-500 hover:bg-white/5" onClick={() => { setIsEditingUsername(false); setNewUsername(user.username || ""); }}>
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <p className="text-lg font-bold text-primary-400">@{user.username || "setup_needed"}</p>
                                                            <button
                                                                onClick={() => setIsEditingUsername(true)}
                                                                className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-all opacity-0 group-hover/user:opacity-100"
                                                            >
                                                                <Edit3 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Email Address</p>
                                                <div className="flex items-center gap-2">
                                                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                                                    <p className="text-sm font-bold text-gray-300">{user.email}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {isCreator && (
                                    <>
                                        {/* Professional Party Link */}
                                        <div className="pt-8 border-t border-white/5 space-y-4">
                                            <div className="flex items-center justify-between group/link">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Creator URL</p>
                                                    <p className="text-sm font-mono text-primary-400 break-all">
                                                        {`https://echodeck.avianage.in/party/${partyCode || user.id}`}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (partyCode || user.id) {
                                                            navigator.clipboard.writeText(`https://echodeck.avianage.in/party/${partyCode || user.id}`);
                                                            toast.success("Professional link copied!");
                                                        }
                                                    }}
                                                    className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest"
                                                >
                                                    Copy Link
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                )}
                                
                                {/* Avatar Selector */}
                                <div className="pt-8 border-t border-white/5 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Select Your Avatar</p>
                                            <p className="text-xs text-gray-500 font-medium leading-relaxed">Choose a persona that matches your vibe.</p>
                                        </div>
                                        {isCreator && (
                                            <div className="flex flex-col items-end gap-1">
                                                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Friend Requests</p>
                                                <button
                                                    onClick={handleToggleFriendRequests}
                                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all text-[8px] font-bold tracking-widest uppercase
                                                        ${allowFriendRequests ? "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20" : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"}`}
                                                >
                                                    {allowFriendRequests ? <Users className="w-2.5 h-2.5" /> : <ShieldAlert className="w-2.5 h-2.5" />}
                                                    {allowFriendRequests ? "On" : "Off"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar p-1">
                                        {user.platformRole === "OWNER" && (
                                            <button
                                                key="owner_special"
                                                onClick={() => handleUpdateAvatar("OWNER_SPECIAL")}
                                                className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 ${
                                                    user.image === "/avatars/owner_avatar.png"
                                                        ? "border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-105" 
                                                        : "border-amber-500/20 bg-gray-900 hover:border-amber-500/40"
                                                }`}
                                            >
                                                <img src="/avatars/owner_avatar.png" alt="Owner Special" className="w-full h-full object-cover" />
                                                <div className="absolute top-0 left-0 right-0 bg-amber-500 py-0.5">
                                                    <p className="text-[6px] font-black text-white text-center uppercase tracking-tighter">Owner Only</p>
                                                </div>
                                                {user.image === "/avatars/owner_avatar.png" && (
                                                    <div className="absolute top-1 right-1 bg-amber-500 rounded-full p-0.5 shadow-lg">
                                                        <Check className="w-2.5 h-2.5 text-white" />
                                                    </div>
                                                )}
                                            </button>
                                        )}
                                        {AVATAR_SEEDS.map((seed) => {
                                            const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
                                            const isSelected = user.image === url;
                                            return (
                                                <button
                                                    key={seed}
                                                    onClick={() => handleUpdateAvatar(seed)}
                                                    className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 ${
                                                        isSelected 
                                                            ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(37,99,235,0.3)] scale-105" 
                                                            : "border-white/5 bg-gray-900 hover:border-white/20"
                                                    }`}
                                                >
                                                    <img src={url} alt={seed} className="w-full h-full object-cover" />
                                                    {isSelected && (
                                                        <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5 shadow-lg">
                                                            <Check className="w-2.5 h-2.5 text-white" />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Connected Accounts Section */}
                                <div className="pt-8 border-t border-white/5 space-y-6">
                                    <div className="flex items-center gap-2">
                                        <ExternalLink className="w-4 h-4 text-gray-500" />
                                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Connected Accounts</h3>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="group relative flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl transition-all hover:bg-white/[0.04]">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-green-500/10 rounded-lg">
                                                    <Music className="w-5 h-5 text-green-500" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">Spotify</p>
                                                    <p className="text-[10px] text-gray-500 font-medium">
                                                        {user.spotifyConnected ? "Connected" : "Not connected"}
                                                    </p>
                                                </div>
                                            </div>

                                            {user.spotifyConnected ? (
                                                <button 
                                                    onClick={() => handleDisconnectProvider("spotify")}
                                                    className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                                    title="Disconnect Spotify"
                                                >
                                                    <Unlink className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <a
                                                    href="/api/auth/spotify-connect"
                                                    className="text-xs font-bold text-green-500 hover:text-green-400 transition-colors"
                                                >
                                                    Connect
                                                </a>
                                            )}
                                        </div>
                                        <div className={`group relative flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl transition-all ${user.accounts?.some((a: any) => a.provider === "google") ? "hover:bg-white/[0.04]" : "opacity-60"}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-red-500/10 rounded-lg">
                                                    <Mail className="w-5 h-5 text-red-500" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">Google</p>
                                                    <p className="text-[10px] text-gray-500 font-medium tracking-tight uppercase">
                                                        {user.accounts?.some((a: any) => a.provider === "google") ? "Connected" : "Linked via Email"}
                                                    </p>
                                                </div>
                                            </div>

                                            {user.accounts?.some((a: any) => a.provider === "google") ? (
                                                <button 
                                                    onClick={() => handleDisconnectProvider("google")}
                                                    className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                                    title="Disconnect Google"
                                                >
                                                    <Unlink className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        signIn("google", { callbackUrl: "/auth/link-success" });
                                                    }}
                                                    className="text-xs font-bold text-red-500 hover:text-red-400 transition-colors"
                                                >
                                                    Connect
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Social Sidebar */}
                        <div className="space-y-6">
                            <Card className="bg-gray-900/50 border-white/5 backdrop-blur-md overflow-hidden shadow-xl">
                                <CardHeader className="pb-4 border-b border-white/5 bg-white/[0.02] px-6 py-4">
                                    <CardTitle className="text-sm font-black flex items-center gap-2 text-primary-400 uppercase tracking-widest">
                                        <Users className="w-4 h-4" /> Social Pulse
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <FriendActivityFeed />
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* OWNER MANAGEMENT SECTION */}
                    {(session.user as any).platformRole === "OWNER" && (
                        <div className="space-y-8 pt-12 border-t border-white/5 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                            <header className="flex items-center gap-4">
                                <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20 text-red-500">
                                    <Shield className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black tracking-tighter uppercase italic">Platform Control Center</h2>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Administrative access granted</p>
                                </div>
                            </header>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Global User Management */}
                                <Card className="lg:col-span-2 bg-gray-900/40 border-white/5 backdrop-blur-xl rounded-[2.5rem] overflow-hidden shadow-2xl">
                                    <CardHeader className="p-8 border-b border-white/5 flex flex-row items-center justify-between bg-white/[0.02]">
                                        <CardTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-3 italic text-blue-400">
                                            <Users className="w-5 h-5" /> User Management
                                        </CardTitle>
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{allUsers.length} total</span>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <UsersTable
                                            users={allUsers}
                                            currentUserId={(session?.user as any)?.id}
                                            onRoleUpdate={handleRoleUpdate}
                                            onBanClick={(user) => {
                                                setSelectedUserForBan(user);
                                                setIsBanModalOpen(true);
                                            }}
                                        />
                                    </CardContent>
                                </Card>

                                {/* Global Stream Management */}
                                <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
                                    <CardHeader className="p-8 border-b border-white/5 bg-white/[0.02]">
                                        <CardTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-3 italic text-accent">
                                            <PlayCircle className="w-5 h-5" /> Live Streams
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px]">
                                        <StreamsList
                                            streams={allStreams}
                                            onForceClose={(id) => {
                                                toast.info("Force close functionality coming soon");
                                            }}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* Danger Zone */}
                    <div className="space-y-6 pt-12 border-t border-white/5 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <h2 className="text-sm font-black text-red-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4" />
                            Danger Zone
                        </h2>
                        
                        <Card className="bg-red-500/5 border-red-500/20 overflow-hidden">
                            <CardContent className="p-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-white">Delete Account</p>
                                        <p className="text-xs text-red-400/80">
                                            Once you delete your account, all your data including streams, favorites, and settings will be permanently removed.
                                        </p>
                                    </div>
                                    <Button 
                                        variant="destructive" 
                                        className="bg-red-500 hover:bg-red-600 text-[10px] font-black tracking-widest uppercase px-6"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        disabled={isDeletingAccount}
                                    >
                                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                                        {isDeletingAccount ? "Deleting..." : "Delete Permanently"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>

            {/* Account Deletion Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
                        onClick={() => !isDeletingAccount && setShowDeleteConfirm(false)} 
                    />
                    <div className="relative w-full max-w-md bg-[#0a0c10] border border-red-500/30 rounded-3xl shadow-2xl p-8 space-y-6">
                        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-bold text-white">Delete your account?</h3>
                            <p className="text-sm text-gray-400">
                                This action is permanent and cannot be undone. You will lose access to all your streams and data.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeletingAccount}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold"
                                onClick={handleDeleteAccount}
                                disabled={isDeletingAccount}
                            >
                                {isDeletingAccount ? "Deleting..." : "Yes, Delete"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ban Modal for Owner */}
            {selectedUserForBan && (
                <BanModal
                    isOpen={isBanModalOpen}
                    targetUsername={selectedUserForBan.username || "User"}
                    scope="platform"
                    onClose={() => setIsBanModalOpen(false)}
                    onConfirm={handleBanAction}
                />
            )}
        </div>
    );
}
