// Previously three routes (friends/activity, user/favorites, user/public/[username])
// each reimplemented "is this user currently online/listening" with different
// thresholds (30s, 30s inline, 15s) — a friend could appear online in one
// place and offline in another at the same instant. One shared constant/helper.
export const PRESENCE_WINDOW_MS = 30 * 1000;

export function isRecentlyActive(updatedAt: Date | string | null | undefined): boolean {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() < PRESENCE_WINDOW_MS;
}

// "Is this viewer currently active in a specific creator's stream" — used by
// viewers/members (to decide who to list as live) and heartbeat (to compute
// viewerCount). Previously heartbeat, viewers, and members each hardcoded
// their own window (a heartbeat-interval-derived value vs. two separate
// literal 20000ms constants), so the same viewer could count as "active" in
// one endpoint and not another. One shared constant.
export const ACTIVE_VIEWER_WINDOW_MS = 20 * 1000;
