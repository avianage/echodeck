"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight, LayoutDashboard, User, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function LinkSuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const provider = searchParams.get("provider") || "account";
    const displayProvider = provider.charAt(0).toUpperCase() + provider.slice(1);
    const [countdown, setCountdown] = useState(3);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    router.push("/dashboard");
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [router]);

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-700">
                <div className="space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
                        All Set!
                    </h1>
                    <p className="text-gray-400 font-medium">
                        Your <span className="text-white font-bold">{displayProvider}</span> account is now linked.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-[10px] font-black text-primary-400 uppercase tracking-widest mt-2 bg-primary/5 py-2 px-4 rounded-full border border-primary/10 w-fit mx-auto">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Redirecting to Dashboard in {countdown}s...
                    </div>
                </div>

                <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl">
                    <CardContent className="p-8 space-y-4">
                        <Link href="/dashboard" className="block">
                            <Button className="w-full bg-primary hover:bg-primary/90 text-white font-black py-6 rounded-2xl group transition-all">
                                <LayoutDashboard className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                                Go to Dashboard
                                <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                            </Button>
                        </Link>
                        
                        <Link href="/account" className="block">
                            <Button variant="ghost" className="w-full text-gray-400 hover:text-white hover:bg-white/5 font-bold py-6 rounded-2xl">
                                <User className="w-5 h-5 mr-3" />
                                Review Account Settings
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <p className="text-center text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">
                    EchoDeck • Integration Complete
                </p>
            </div>
        </div>
    );
}

export default function LinkSuccessPage() {
    return (
        <Suspense fallback={
            <div className="min-h-[80vh] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        }>
            <LinkSuccessContent />
        </Suspense>
    );
}
