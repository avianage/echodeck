"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function RestrictionGuardian({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (status === "authenticated" && session?.user) {
            const user = session.user as any;
            const isBanned = user.isBanned;
            const bannedUntil = user.bannedUntil;
            const isTimedOut = bannedUntil && new Date(bannedUntil) > new Date();

            if ((isBanned || isTimedOut) && !pathname.startsWith("/auth/banned")) {
                console.log("🚫 [RestrictionGuardian] User is restricted. Redirecting to /auth/banned");
                router.push(`/auth/banned`);
            }
        }
    }, [session, status, pathname, router]);

    return <>{children}</>;
}
