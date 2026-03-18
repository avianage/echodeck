"use client";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

import Link from "next/link";

import { InstallPrompt } from "./InstallPrompt";

export function Appbar() {
  const session = useSession();

    const getInitials = (name: string | null | undefined) => {
      if (!name) return "DJ";
      const parts = name.split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    };

    return <div className="flex justify-between items-center py-4 px-6 md:px-12 bg-gray-900/40 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <div className="relative group">
          <div className="absolute -inset-1 bg-blue-500/50 rounded-xl blur opacity-25 group-hover:opacity-100 transition duration-300"></div>
          <Image src="/logo.png" alt="EchoDeck Logo" width={32} height={32} className="relative rounded-lg border border-white/10 shadow-lg" />
        </div>
        <div className="text-2xl font-bold text-white tracking-tight">
          EchoDeck
        </div>
      </Link>
      <div className="flex items-center gap-6">
        <InstallPrompt />
        {session.data?.user && (
          <nav className="hidden md:flex items-center gap-6 mr-4">
            <Link href="/dashboard" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Dashboard</Link>
          </nav>
        )}
        <div className="flex items-center gap-4">
          {session.data?.user ? (
            <>
              <Link href="/account" className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-0 group-hover:opacity-40 transition duration-300"></div>
                <div className="h-10 w-10 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center text-sm font-bold text-white relative hover:border-white/30 transition-all">
                  {getInitials(session.data.user.name)}
                </div>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white hover:bg-white/5 px-3"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Logout
              </Button>
            </>
          ) : (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
              onClick={() => signIn(undefined, { callbackUrl: "/dashboard" })}
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </div>

}