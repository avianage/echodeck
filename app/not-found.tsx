import Link from "next/link";
import { Music, Home, Search } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
            <div className="space-y-6 max-w-md">
                {/* Animated icon */}
                <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 bg-blue-600/20 blur-2xl rounded-full animate-pulse" />
                    <div className="relative w-24 h-24 bg-gray-900 rounded-full border border-gray-800 flex items-center justify-center">
                        <Music className="w-10 h-10 text-blue-500" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-7xl font-black text-white">404</h1>
                    <h2 className="text-xl font-bold text-gray-300">This track doesn't exist</h2>
                    <p className="text-gray-500 text-sm">
                        The page you're looking for has been removed, renamed, or never existed.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <Link
                        href="/"
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all"
                    >
                        <Home className="w-4 h-4" /> Go Home
                    </Link>
                    <Link
                        href="/discover"
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-all"
                    >
                        <Search className="w-4 h-4" /> Discover Streams
                    </Link>
                </div>
            </div>
        </div>
    );
}
