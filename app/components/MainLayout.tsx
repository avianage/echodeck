"use client";
import { useSession } from "next-auth/react";
import React from "react";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  return (
    <div className={`pt-20 ${session ? "pb-24 md:pb-0" : "pb-0"} px-safe pb-safe`}>
      {children}
    </div>
  );
}
