"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();

    if (status === "loading") {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
                Loading...
            </div>
        );
    }

    if (!session?.user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
                Please sign in to view your dashboard.
            </div>
        );
    }

    // @ts-expect-error session properties added in callback
    const isSpotifyConnected = session.provider === "Spotify" || session.provider === "spotify";

    return (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-950 text-white p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-lg w-full max-w-md p-8">
                <h1 className="text-3xl font-bold mb-6 text-center text-purple-400">Account Dashboard</h1>

                <div className="space-y-4 mb-8 text-gray-300">
                    <div>
                        <span className="font-semibold text-gray-100">Email:</span> {session.user.email}
                    </div>
                    <div>
                        <span className="font-semibold text-gray-100">Auth Provider:</span>
                        <span className="ml-2 px-2 py-1 rounded bg-gray-800 text-sm">
                            {/* @ts-expect-error session.provider used internally */}
                            {session.provider || "Google"}
                        </span>
                    </div>

                    <div className="pt-4 border-t border-gray-800">
                        <h2 className="text-xl font-semibold mb-3">Integrations</h2>
                        <div className="flex items-center justify-between">
                            <span>Spotify Integration</span>
                            {isSpotifyConnected ? (
                                <span className="text-green-400 text-sm font-semibold flex items-center">
                                    <span className="w-2 h-2 mr-2 bg-green-400 rounded-full"></span>
                                    Connected
                                </span>
                            ) : (
                                <button
                                    onClick={() => signIn("spotify")}
                                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 rounded text-sm text-white transition font-semibold"
                                >
                                    Connect Spotify
                                </button>
                            )}
                        </div>
                        {!isSpotifyConnected && (
                            <p className="text-xs text-gray-500 mt-2">
                                Connect Spotify to enable adding songs from your private playlists.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg shadow-md transition-transform transform hover:scale-[1.02]"
                        onClick={() => router.push("/stream")}
                    >
                        🚀 Start your party
                    </button>

                    <button
                        className="w-full mt-4 bg-transparent border border-gray-600 hover:bg-gray-800 text-gray-300 font-semibold py-2 rounded-lg transition"
                        onClick={() => signOut()}
                    >
                        Sign out
                    </button>
                </div>
            </div>
        </div>
    );
}
