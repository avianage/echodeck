"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Compass, LayoutDashboard, User, Music } from "lucide-react";

const NAV_ITEMS = [
  { label: "Discover", href: "/discover", icon: Compass },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Account", href: "/account", icon: User },
];

export function BottomNav() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] px-4 pb-6 pt-2">
      <div className="max-w-md mx-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-around py-3 px-2 shadow-2xl shadow-primary/20">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 relative px-6 py-2 transition-all ${
                isActive ? "text-primary scale-110" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {isActive && (
                <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full" />
              )}
              <Icon className={`w-5 h-5 relative z-10 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
              <span className="text-[10px] font-black uppercase tracking-tighter relative z-10">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
