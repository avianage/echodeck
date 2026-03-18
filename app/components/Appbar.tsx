"use client";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { User } from "lucide-react";

import Link from "next/link";

import { InstallPrompt } from "./InstallPrompt";

export function Appbar() {
  const session = useSession();



    return <div className="flex justify-between items-center py-4 px-6 md:px-12 bg-black/40 backdrop-blur-xl border-b border-white/5">
      <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <div className="relative group">
          <div className="absolute -inset-1 bg-primary/50 rounded-xl blur opacity-25 group-hover:opacity-100 transition duration-300"></div>
          <Image src="/logo.png" alt="EchoDeck Logo" width={32} height={32} className="relative rounded-lg border border-white/10 shadow-lg" />
        </div>
        <div className="text-2xl font-black tracking-tighter text-white uppercase italic">
          Echo<span className="text-primary">Deck</span>
        </div>
      </Link>
      <div className="flex items-center gap-6">
        <InstallPrompt />
        {session.data?.user && (
          <nav className="hidden md:flex items-center gap-6 mr-4">
            <Link href="/discover" className="text-xs font-black uppercase tracking-widest text-gray-500 hover:text-primary transition-colors">Discover</Link>
            <Link href="/dashboard" className="text-xs font-black uppercase tracking-widest text-gray-500 hover:text-primary transition-colors">Dashboard</Link>
          </nav>
        )}
        <div className="flex items-center gap-4">
          {session.data?.user ? (
            <>
              <Link href="/account" className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-0 group-hover:opacity-40 transition duration-300"></div>
                <div className="h-10 w-10 rounded-full bg-gray-900 border border-white/10 flex items-center justify-center relative hover:border-primary/30 transition-all overflow-hidden text-primary">
                  {session.data.user.image ? (
                    <img src={session.data.user.image} alt={session.data.user.name || "Profile"} className="h-full w-full object-cover" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/5 px-3"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Logout
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-3">
            <Link href="/discover" className="hidden md:block text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors mr-2">Discover</Link>
               <Button
                className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] rounded-xl px-6 py-5 shadow-xl shadow-primary/20 transition-all active:scale-95"
                onClick={() => signIn(undefined, { callbackUrl: "/dashboard" })}
              >
                Sign In
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>

}