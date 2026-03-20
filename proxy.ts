import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const MAINTENANCE_EXEMPT_PATHS = [
    "/maintenance",
    "/api/admin/maintenance", // so the maintenance page can poll
    "/api/auth",
    "/auth/signin",
    "/auth/banned",
    "/_next",
    "/favicon.ico",
    "/public",
];

const PUBLIC_PATHS = [
    "/auth/signin",
    "/auth/verify",
    "/auth/setup",
    "/auth/banned",
    "/auth/link-account",
    "/auth/error",
    "/api/auth",
    "/api/user/check-username",
    "/discover",
    "/",
];

export default async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // --- MAINTENANCE MODE CHECK (runs before everything else) ---
    const isExempt = MAINTENANCE_EXEMPT_PATHS.some(p => pathname.startsWith(p));

    if (!isExempt) {
        try {
            const baseUrl = `http://127.0.0.1:${process.env.PORT || 3000}`;

            const maintenanceRes = await fetch(
                `${baseUrl}/api/admin/maintenance`,
                { cache: "no-store", headers: { "Cache-Control": "no-cache, no-store, must-revalidate", Pragma: "no-cache" } }
            );
            
            if (maintenanceRes.ok) {
                const maintenance = await maintenanceRes.json();

                if (maintenance.isActive) {
                    const token = await getToken({ req });
                    const role = (token as any)?.platformRole;

                    // Owner bypasses maintenance entirely
                    if (role !== "OWNER") {
                        // API routes during maintenance return 503
                        if (pathname.startsWith("/api/")) {
                            return NextResponse.json(
                                { message: "Service under maintenance" },
                                { status: 503 }
                            );
                        }
                        // All other routes redirect to maintenance page
                        return NextResponse.redirect(new URL("/maintenance", req.url));
                    }
                }
            }
        } catch (error) {
            console.error("Maintenance check failed:", error);
        }
    }
    // --- END MAINTENANCE CHECK ---

    // Always allow public paths and static assets
    const isPublicPath = PUBLIC_PATHS.some(p => {
        if (p === "/") return pathname === "/";
        return pathname.startsWith(p);
    });

    if (isPublicPath) {
        return NextResponse.next();
    }

    const token = await getToken({ req });

    // Not logged in + trying to access /party/* → redirect to sign in with callbackUrl
    if (!token && pathname.startsWith("/party/")) {
        const signInUrl = new URL("/auth/signin", req.url);
        signInUrl.searchParams.set("callbackUrl", req.url);
        return NextResponse.redirect(signInUrl);
    }

    // Logged in but no username set → force username setup page
    if (token && !(token as any).username && pathname !== "/auth/setup") {
        const setupUrl = new URL("/auth/setup", req.url);
        setupUrl.searchParams.set("callbackUrl", req.url);
        return NextResponse.redirect(setupUrl);
    }

    // Role-based route protection: Only CREATOR and OWNER can access /stream
    if (token && pathname.startsWith("/stream")) {
        const role = (token as any).platformRole;
        if (role !== "CREATOR" && role !== "OWNER") {
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
