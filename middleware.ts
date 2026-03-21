import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { prismaClient } from "@/app/lib/db";

export const runtime = 'nodejs';

const MAINTENANCE_EXEMPT_PATHS = [
    "/maintenance",
    "/api/admin/maintenance", // so the maintenance page can poll
    "/api/auth",
    "/api/health", // Health checks don't need maintenance or auth checks
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

async function getMaintenanceStatus(): Promise<{
    active: boolean;
    message?: string;
    endsAt?: Date | null;
}> {
    try {
        const maintenance = await prismaClient.maintenanceMode.findUnique({
            where: { id: "singleton" }
        });

        if (!maintenance || !maintenance.isActive) {
            return { active: false };
        }

        // Auto-expire if duration has passed
        if (maintenance.endsAt && new Date(maintenance.endsAt) < new Date()) {
            await prismaClient.maintenanceMode.update({
                where: { id: "singleton" },
                data: { isActive: false }
            });
            return { active: false };
        }

        return {
            active: true,
            message: maintenance.message ?? undefined,
            endsAt: maintenance.endsAt
        };
    } catch (err) {
        // If DB is unreachable for any reason, fail open —
        // never block all traffic due to a maintenance check failure
        console.error("Maintenance check failed:", err);
        return { active: false };
    }
}

export default async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // --- CORS HANDLING ---
    const origin = req.headers.get('origin');
    const allowedOrigins = ['https://echodeck.avianage.in', 'http://localhost:3000', 'http://localhost:3002'];
    const responseOrigin = origin && allowedOrigins.includes(origin) ? origin : 'https://echodeck.avianage.in';

    // Handle Preflight
    if (req.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': responseOrigin,
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    const applyCors = (res: NextResponse) => {
        res.headers.set('Access-Control-Allow-Origin', responseOrigin);
        res.headers.set('Access-Control-Allow-Credentials', 'true');
        return res;
    };
    // --- END CORS ---

    // --- MAINTENANCE MODE CHECK ---
    const isExempt = MAINTENANCE_EXEMPT_PATHS.some(p => pathname.startsWith(p));

    if (!isExempt) {
        const maintenance = await getMaintenanceStatus();

        if (maintenance.active) {
            const token = await getToken({ req });
            const role = (token as any)?.platformRole;

            if (role !== "OWNER") {
                if (pathname.startsWith("/api/")) {
                    return applyCors(NextResponse.json(
                        { message: "Service under maintenance" },
                        { status: 503 }
                    ));
                }
                return NextResponse.redirect(new URL("/maintenance", req.url));
            }
        }
    }

    // Always allow public paths and static assets
    const isPublicPath = PUBLIC_PATHS.some(p => {
        if (p === "/") return pathname === "/";
        return pathname.startsWith(p);
    });

    if (isPublicPath) {
        return applyCors(NextResponse.next());
    }

    const token = await getToken({ req });

    if (!token && pathname.startsWith("/party/")) {
        const signInUrl = new URL("/auth/signin", req.url);
        signInUrl.searchParams.set("callbackUrl", req.url);
        return applyCors(NextResponse.redirect(signInUrl));
    }

    if (token && !(token as any).username && pathname !== "/auth/setup") {
        const setupUrl = new URL("/auth/setup", req.url);
        setupUrl.searchParams.set("callbackUrl", req.url);
        return applyCors(NextResponse.redirect(setupUrl));
    }

    if (token && pathname.startsWith("/stream")) {
        const role = (token as any).platformRole;
        if (role !== "CREATOR" && role !== "OWNER") {
            return applyCors(NextResponse.redirect(new URL("/dashboard", req.url)));
        }
    }

    return applyCors(NextResponse.next());
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
