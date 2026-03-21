import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        allowOwnerCreation: process.env.ALLOW_OWNER_CREATION === "true" || process.env.NEXT_PUBLIC_ALLOW_OWNER_CREATION === "true"
    });
}
