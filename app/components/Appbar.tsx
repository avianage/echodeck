"use client";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function Appbar() {
  const session = useSession();

  return <div className="flex justify-between items-center pt-4">
  <div className="text-3xl font-bold text-white">
    Tunify
  </div>
  <div>
    {session.data?.user ? (
      <Button
        className="text-lg bg-blue-600 hover:bg-blue-700 text-white"
        onClick={() => signOut()}
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