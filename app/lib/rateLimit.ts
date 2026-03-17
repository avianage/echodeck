const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
        return false;
    }

    if (entry.count >= maxRequests) return true;

    entry.count++;
    return false;
}
