'use client';

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

function SetupContent() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams?.get("callbackUrl") || "/dashboard";

    const [username, setUsername] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [role, setRole] = useState<"MEMBER" | "OWNER">("MEMBER");
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [reason, setReason] = useState("");
    const [isChecking, setIsChecking] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isConfigLoaded, setIsConfigLoaded] = useState(false);
    const [allowOwnerCreation, setAllowOwnerCreation] = useState(false);

    // Fetch dynamic config to bypass build-time NEXT_PUBLIC_ limitations
    useEffect(() => {
        fetch("/api/config")
            .then(res => res.json())
            .then(data => {
                setAllowOwnerCreation(data.allowOwnerCreation);
                setIsConfigLoaded(true);
            })
            .catch(err => {
                console.error("Failed to load config:", err);
                // Fallback to build-time env if API fails
                setAllowOwnerCreation(process.env.NEXT_PUBLIC_ALLOW_OWNER_CREATION === "true");
                setIsConfigLoaded(true);
            });
    }, []);

    const safeJson = async (res: Response) => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return await res.json();
        }
        throw new Error(`Unexpected response format: ${contentType || 'unknown'}. The request may have been redirected.`);
    };

    // Debounced username check
    useEffect(() => {
        if (!username) {
            setIsAvailable(null);
            setReason("");
            return;
        }

        const validPrefix = /^[a-z0-9_]*$/.test(username);
        if (!validPrefix) {
            setIsAvailable(false);
            setReason("Only lowercase letters, numbers, and underscores allowed");
            return;
        }

        setIsChecking(true);
        const timer = setTimeout(async () => {
            try {
                console.log(`🔍 Checking username: ${username}`);
                const res = await fetch(`/api/user/check-username?username=${username}`);
                const data = await safeJson(res);
                console.log(`✅ Username check result:`, data);
                setIsAvailable(data.available);
                setReason(data.reason || "");
            } catch (err) {
                console.error("❌ Failed to check username:", err);
                setReason("Failed to verify username availability");
            } finally {
                setIsChecking(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [username]);

    // Pre-fill display name and redirect if already set up
    useEffect(() => {
        if (session?.user?.name && !displayName) {
            setDisplayName(session.user.name);
        }
        
        if (session?.user && (session.user as any).username) {
            console.log("🚀 User already setup, redirecting to", callbackUrl);
            router.push(callbackUrl);
        }
    }, [session, router, callbackUrl]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("🔘 [Setup] Form submitted with:", { username, displayName, role, isAvailable });
        
        if (isAvailable !== true) {
            console.warn("⚠️ Cannot submit: username is not available or still checking.");
            return;
        }

        setIsSubmitting(true);
        setReason("");
        try {
            console.log("📡 [Setup] Sending setup request to /api/user/setup...");
            const res = await fetch("/api/user/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, displayName, role })
            });

            console.log(`📦 [Setup] Received response (Status ${res.status})`);
            
            if (res.ok) {
                const data = await safeJson(res);
                console.log("✨ [Setup] Success! Updating session and redirecting...");
                // Pass role too so JWT callback can capture it
                await update({ username, displayName, platformRole: role });
                
                // Use a hard refresh to ensure the session cookie is correctly 
                // picked up by the middleware on the next request.
                window.location.href = callbackUrl;
            } else {
                try {
                    const data = await safeJson(res);
                    console.error("❌ [Setup] Server error data:", data);
                    setIsAvailable(false);
                    setReason(data.message || "Failed to set up profile");
                } catch (parseErr) {
                    console.error("❌ [Setup] Parse error during failure handling:", parseErr);
                    setReason(`Server error (Status ${res.status}). Please refresh and try again.`);
                }
            }
        } catch (err) {
            console.error("❌ [Setup] Critical network error:", err);
            setReason(err instanceof Error ? err.message : "An unexpected error occurred. Please check your connection.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#111111] px-4 py-8 text-white">
            <div className="w-full max-w-sm sm:max-w-md bg-[#1a1a1a] rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-[#333] shadow">
                <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8">
                    <h2 className="text-center text-3xl font-extrabold text-[#4a90e2]">
                        Complete setup
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-400">
                        Choose a username to start using EchoDeck
                    </p>
                </div>

                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                                Username
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                                    className="appearance-none block w-full px-3 py-2 border border-[#333] rounded-md shadow-sm placeholder-gray-500 bg-[#222] text-white focus:outline-none focus:ring-[#4a90e2] focus:border-[#4a90e2] sm:text-sm"
                                    placeholder="your_username"
                                />
                                {username.length > 0 && (
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        {isChecking ? (
                                            <span className="text-gray-500 text-xs">Checking...</span>
                                        ) : isAvailable === true ? (
                                            <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        ) : isAvailable === false ? (
                                            <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                            {reason && (
                                <p className={`mt-2 text-sm ${isAvailable ? 'text-green-500' : 'text-red-500'}`}>
                                    {reason}
                                </p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="displayName" className="block text-sm font-medium text-gray-300">
                                Display Name <span className="text-gray-500">(Optional)</span>
                            </label>
                            <div className="mt-1">
                                <input
                                    id="displayName"
                                    name="displayName"
                                    type="text"
                                    maxLength={50}
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-[#333] rounded-md shadow-sm placeholder-gray-500 bg-[#222] text-white focus:outline-none focus:ring-[#4a90e2] focus:border-[#4a90e2] sm:text-sm"
                                    placeholder="How should we call you?"
                                />
                            </div>
                        </div>

                        {allowOwnerCreation && (
                            <div className="space-y-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                                <label className="block text-sm font-black uppercase tracking-widest text-blue-400">
                                    Account Privilege
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRole("MEMBER")}
                                        className={`py-2 px-4 rounded-lg text-xs font-bold transition-all border ${
                                            role === "MEMBER" 
                                                ? "bg-blue-600 border-blue-500 text-white" 
                                                : "bg-[#222] border-[#333] text-gray-400 hover:border-gray-600"
                                        }`}
                                    >
                                        Standard Member
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole("OWNER")}
                                        className={`py-2 px-4 rounded-lg text-xs font-bold transition-all border ${
                                            role === "OWNER" 
                                                ? "bg-amber-600 border-amber-500 text-white shadow-[0_0_15px_rgba(217,119,6,0.3)]" 
                                                : "bg-[#222] border-[#333] text-gray-400 hover:border-gray-600"
                                        }`}
                                    >
                                        Platform Owner
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-500 italic">
                                    {role === "OWNER" 
                                        ? "⚠️ You will have full administrative control over the platform."
                                        : "Standard accounts can join existing streams and request access."}
                                </p>
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={isSubmitting || isAvailable !== true}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#4a90e2] hover:bg-[#357abd] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4a90e2] focus:ring-offset-[#1a1a1a] disabled:opacity-50 transition-colors"
                            >
                                {isSubmitting ? "Saving..." : "Continue"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function SetupPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#111111]" />}>
            <SetupContent />
        </Suspense>
    );
}
