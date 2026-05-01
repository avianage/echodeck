const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// TODO: This in-memory rate limiter must be replaced with Redis (or similar)
// for multi-instance deployments. The current Map does not share state across
// server instances, making rate limits ineffective behind a load balancer.

// Cleanup interval: purge entries that have passed their resetAt time
// Runs every 5 minutes to prevent unbounded memory growth
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now > entry.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

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
