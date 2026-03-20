'use client';

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Mail } from "lucide-react";

function SignInContent() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams?.get("callbackUrl") || "/dashboard";
    const linkProvider = searchParams?.get("linkProvider");
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await signIn("email", { email, callbackUrl });
        } catch (error) {
            console.error("Email sign in error:", error);
            setIsLoading(false);
        }
    };

    const handleOAuthSignIn = (provider: string) => {
        signIn(provider, { callbackUrl });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#111111] px-4 py-8 text-white">
            <div className="w-full max-w-sm sm:max-w-md bg-[#1a1a1a] rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-[#333] shadow">
                <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8">
                    <h2 className="text-center text-3xl font-extrabold text-[#4a90e2]">
                        EchoDeck
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-400">
                        {linkProvider 
                            ? `Link your ${linkProvider} account`
                            : "Collaborative Music Streaming"}
                    </p>
                </div>

                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <form className="space-y-6" onSubmit={handleEmailSignIn}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                                Email address
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-500" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full pl-10 px-3 py-2 border border-[#333] rounded-md shadow-sm placeholder-gray-500 bg-[#222] text-white focus:outline-none focus:ring-[#4a90e2] focus:border-[#4a90e2] sm:text-sm"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#4a90e2] hover:bg-[#357abd] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4a90e2] focus:ring-offset-[#1a1a1a] disabled:opacity-50 transition-colors"
                            >
                                {isLoading ? "Sending link..." : "Send Magic Link"}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-[#333]" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-[#1a1a1a] text-gray-400">
                                    or continue with
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-3">
                            <div>
                                <button
                                    onClick={() => handleOAuthSignIn("google")}
                                    className="w-full inline-flex justify-center py-2 px-4 border border-[#333] rounded-md shadow-sm bg-[#222] text-sm font-medium text-gray-300 hover:bg-[#333] transition-colors"
                                >
                                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                                        <path
                                            fill="currentColor"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="#34A853"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="#FBBC05"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        />
                                        <path
                                            fill="#EA4335"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                    Continue with Google
                                </button>
                            </div>

                            <div>
                                <button
                                    onClick={() => handleOAuthSignIn("spotify")}
                                    className="w-full inline-flex justify-center py-2 px-4 border border-[#333] rounded-md shadow-sm bg-[#222] text-sm font-medium text-gray-300 hover:bg-[#333] transition-colors"
                                >
                                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="#1DB954">
                                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.56.3z" />
                                    </svg>
                                    Continue with Spotify
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SignInPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#111111]" />}>
            <SignInContent />
        </Suspense>
    );
}
