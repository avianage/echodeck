import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

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

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Always allow public paths and static assets
    if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
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
