"use client";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
// import { useRouter } from "next/navigation";
// import { ThemeSwitcher } from "./ThemeSwitcher";
// import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";



export function Appbar() {
  const session = useSession();

  return <div className="flex justify-between px-20 pt-4">
    <div className="text-lg font-bold flex flex-col justify-center text-white">
      Tunify
    </div>
    <div>
      {session.data?.user && <Button className="bg-purple-600 text-white hover:bg-purple-700" onClick={() =>
        signOut()}>Logout</Button>}
      {!session.data?.user && <Button className="bg-purple-600 text-white hover:bg-purple-700" onClick={() =>
        signIn()}>Sign In</Button>}
    </div>
  </div>
}