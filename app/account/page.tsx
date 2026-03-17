"use client";

import { useSession } from "next-auth/react";
import { Appbar } from "../components/Appbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Shield, Calendar } from "lucide-react";

export default function AccountPage() {
    const { data: session } = useSession();

    if (!session?.user) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <p>Loading profile...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white selection:bg-blue-500/30">
            <Appbar />
            
            <main className="max-w-4xl mx-auto px-6 pt-24 pb-12">
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <header>
                        <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
                            My Account
                        </h1>
                        <p className="text-gray-400 mt-2">Manage your profile and account settings.</p>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Profile Section */}
                        <Card className="bg-gray-900/50 border-white/5 backdrop-blur-md md:col-span-2 overflow-hidden shadow-2xl">
                            <CardHeader className="pb-4 border-b border-white/5 px-8 pt-8">
                                <CardTitle className="text-xl flex items-center gap-3">
                                    <User className="w-5 h-5 text-blue-500" /> Personal Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">
                                <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                                    <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-3xl font-bold border-4 border-white/5">
                                        {session.user.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'DJ'}
                                    </div>
                                    <div className="space-y-4 flex-1">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Full Name</p>
                                                <p className="text-lg font-bold text-white">{session.user.name}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Email Address</p>
                                                <div className="flex items-center gap-2">
                                                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                                                    <p className="text-lg font-bold text-white">{session.user.email}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Security Sidebar */}
                        <div className="space-y-6">
                            <Card className="bg-gray-900/50 border-white/5 backdrop-blur-md overflow-hidden">
                                <CardHeader className="pb-4 border-b border-white/5 bg-white/[0.02]">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-purple-500" /> SECURITY
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <p className="text-xs text-gray-500 leading-relaxed italic">
                                        You are signed in via Google. Security settings are managed by your provider.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="bg-gray-900/50 border-white/5 backdrop-blur-md overflow-hidden">
                                <CardHeader className="pb-4 border-b border-white/5">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-yellow-500" /> ACTIVITY
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-gray-500 border-b border-white/5 pb-2">
                                            <span>Sessions</span>
                                            <span className="text-green-500">Active</span>
                                        </div>
                                        <p className="text-xs text-blue-400 underline cursor-pointer hover:text-blue-300">View recent streams</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
