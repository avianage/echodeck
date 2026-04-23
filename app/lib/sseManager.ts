/**
 * sseManager.ts
 *
 * In-memory SSE connection registry.
 * Maps creatorId -> Set of WritableStreamDefaultWriter
 *
 * IMPORTANT: This is a process-local singleton. It works correctly in a
 * single-server / single-process deployment (dev, Railway, Render, etc.).
 * For multi-instance deployments (e.g. Vercel auto-scaling), replace the
 * Map with a Redis pub/sub (e.g. Upstash) without changing the broadcast API.
 */

type SseWriter = {
    write: (chunk: string) => void;
    close: () => void;
};

// Map<creatorId, Set<SseWriter>>
const connections = new Map<string, Set<SseWriter>>();

export function addConnection(creatorId: string, writer: SseWriter) {
    if (!connections.has(creatorId)) {
        connections.set(creatorId, new Set());
    }
    connections.get(creatorId)!.add(writer);
}

export function removeConnection(creatorId: string, writer: SseWriter) {
    connections.get(creatorId)?.delete(writer);
    if (connections.get(creatorId)?.size === 0) {
        connections.delete(creatorId);
    }
}

export function broadcastToStream(
    creatorId: string,
    data: Record<string, unknown>
) {
    const clients = connections.get(creatorId);
    if (!clients || clients.size === 0) return;

    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const writer of clients) {
        try {
            writer.write(payload);
        } catch {
            // Client disconnected between this loop iteration and the next;
            // the cleanup runs via the AbortSignal listener.
        }
    }
}

export function getConnectionCount(creatorId: string): number {
    return connections.get(creatorId)?.size ?? 0;
}
