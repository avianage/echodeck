import { prismaClient } from "@/app/lib/db";
import { StreamEventType } from "@prisma/client";

export async function broadcastEvent(
    creatorId: string,
    type: StreamEventType,
    message: string
) {
    try {
        await prismaClient.streamEvent.create({
            data: {
                creatorId,
                type,
                message,
                expiresAt: new Date(Date.now() + 30 * 1000) // 30s TTL
            }
        });

        // Cleanup expired events (background-ish)
        // We do this here as a simple maintenance task
        prismaClient.streamEvent.deleteMany({
            where: { expiresAt: { lt: new Date() } }
        }).catch(err => console.error("Event cleanup failed:", err));
        
    } catch (error) {
        console.error("Failed to broadcast event:", error);
    }
}
