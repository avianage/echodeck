"use client";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export function Appbar() {
  const session = useSession();

  return <div className="flex justify-between items-center pt-4">
    <div className="flex items-center gap-3">
      <div className="relative group">
        <div className="absolute -inset-1 bg-blue-500/50 rounded-xl blur opacity-25 group-hover:opacity-100 transition duration-300"></div>
        <Image src="/logo.png" alt="EchoDeck Logo" width={40} height={40} className="relative rounded-xl border border-white/10 shadow-lg" />
      </div>
      <div className="text-3xl font-bold text-white tracking-tight">
        EchoDeck
      </div>
    </div>
    <div>
      {session.data?.user ? (
        <Button
          className="text-lg bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          Logout
        </Button>
      ) : (
        <Button
          className="text-lg bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => signIn()}
        >
          Sign In
        </Button>
      )}
    </div>
  </div>

}