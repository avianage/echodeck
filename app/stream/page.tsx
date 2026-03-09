"use client";

import StreamView from "../components/StreamView";
import { useSession } from "next-auth/react";

export default function Component() {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
                Loading...
            </div>
        );
    }

    if (!session?.user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
                Please sign in to view your dashboard.
            </div>
        );
    }

    // @ts-expect-error session.user.id is added in nextauth callback
    const creatorId = session.user.id;

    if (!creatorId) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
                Error: User ID not found.
            </div>
        );
    }

    return <StreamView key={creatorId} creatorId={creatorId} playVideo={true} />;
}