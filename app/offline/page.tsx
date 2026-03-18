import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function OfflinePage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white p-6 text-center">
            <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.1),transparent_50%)]" />
            
            <div className="space-y-6 max-w-md animate-in fade-in zoom-in duration-500">
                <div className="mx-auto w-24 h-24 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4 shadow-2xl shadow-blue-500/10">
                    <WifiOff className="w-12 h-12" />
                </div>
                
                <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
                    You&apos;re Offline
                </h1>
                
                <p className="text-gray-400 text-lg leading-relaxed">
                    EchoDeck requires an active internet connection to sync streams and vibes with your friends.
                </p>

                <div className="pt-4">
                    <Button 
                        asChild
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-14 px-10 rounded-2xl transition-all shadow-xl shadow-blue-500/30 active:scale-95"
                    >
                        <Link href="/">Try Reconnecting</Link>
                    </Button>
                </div>
                
                <p className="text-xs font-bold text-gray-600 uppercase tracking-[0.2em]">
                    EchoDeck Offline Experience
                </p>
            </div>
        </div>
    );
}
