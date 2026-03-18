'use client';

import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import { Mail, ArrowLeft, Link as LinkIcon } from "lucide-react";

function LinkAccountContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const email = searchParams?.get("email");
    const provider = searchParams?.get("provider");
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");

    if (!email || !provider) {
        return (
            <div className="min-h-screen bg-[#111111] flex flex-col justify-center py-12 text-white">
                <p className="text-center text-red-500">Missing parameters</p>
                <div className="text-center mt-4">
                    <button onClick={() => router.push("/auth/signin")} className="text-[#4a90e2]">Go to Sign In</button>
                </div>
            </div>
        );
    }

    const handleConnect = async () => {
        setIsLoading(true);
        setError("");
        try {
            const res = await fetch("/api/auth/send-link-verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, provider })
            });

            if (res.ok) {
                setSent(true);
            } else {
                const data = await res.json();
                setError(data.message || "Failed to send link");
            }
        } catch (err) {
            setError("Network error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="min-h-screen bg-[#111111] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-white">
                <div className="sm:mx-auto sm:w-full sm:max-w-md text-center bg-[#1a1a1a] p-8 rounded-lg border border-[#333]">
                    <div className="flex justify-center mb-4">
                        <Mail className="w-12 h-12 text-[#4a90e2]" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Check your inbox</h2>
                    <p className="text-gray-400 text-sm">
                        We sent a verification link to <strong>{email}</strong>. Click the link to securely connect your {provider} account.
                    </p>
                </div>
            </div>
        );
    }

    const displayProvider = provider.charAt(0).toUpperCase() + provider.slice(1);

    return (
        <div className="min-h-screen bg-[#111111] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-white">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-[#1a1a1a] py-8 px-6 shadow sm:rounded-lg border border-[#333] text-center">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-[#222] rounded-full flex items-center justify-center border-2 border-[#4a90e2]">
                            <LinkIcon className="w-8 h-8 text-[#4a90e2]" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Account already exists</h2>
                    <p className="text-gray-400 text-sm mb-6">
                        The email <strong>{email}</strong> is already in use by an existing EchoDeck account. You attempted to sign in with {displayProvider}.
                    </p>

                    <div className="space-y-4">
                        <button
                            onClick={handleConnect}
                            disabled={isLoading}
                            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#4a90e2] hover:bg-[#357abd] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4a90e2] focus:ring-offset-[#1a1a1a] disabled:opacity-50 transition-colors"
                        >
                            {isLoading ? "Sending verification..." : `Connect ${displayProvider} to my existing account`}
                        </button>
                        
                        <button
                            onClick={() => router.push("/auth/signin")}
                            className="w-full flex justify-center items-center py-3 px-4 border border-[#333] rounded-md shadow-sm text-sm font-medium text-gray-300 bg-[#222] hover:bg-[#333] transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Cancel
                        </button>
                    </div>
                    
                    {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
                </div>
            </div>
        </div>
    );
}

export default function LinkAccountPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#111111]" />}>
            <LinkAccountContent />
        </Suspense>
    );
}
