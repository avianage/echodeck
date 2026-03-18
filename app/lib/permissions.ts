export type PlatformRole = "OWNER" | "CREATOR" | "MEMBER" | "GUEST";
export type StreamRole = "OWNER" | "CREATOR" | "MODERATOR" | "MEMBER" | "GUEST";

export type Permission =
    | "stream:create"
    | "stream:start"
    | "stream:end"
    | "stream:enter:silent"     // owner-only invisible join
    | "queue:add"
    | "queue:remove:own"
    | "queue:remove:any"
    | "queue:clear"
    | "playback:skip"
    | "playback:pause"
    | "playback:play"
    | "vote:cast"
    | "session:ban:stream"      // ban from stream
    | "session:timeout:stream"
    | "session:promote:mod"     // assign moderator
    | "platform:ban:user"       // owner only
    | "platform:timeout:user"   // owner only
    | "platform:assign:creator" // owner only
    | "platform:revoke:creator" // owner only
    | "platform:view:all:streams"
    | "platform:manage:streams";

const STREAM_ROLE_PERMISSIONS: Record<StreamRole, Permission[]> = {
    OWNER: [
        "stream:create", "stream:start", "stream:end", "stream:enter:silent",
        "queue:add", "queue:remove:own", "queue:remove:any", "queue:clear",
        "playback:skip", "playback:pause", "playback:play",
        "vote:cast",
        "session:ban:stream", "session:timeout:stream", "session:promote:mod",
        "platform:ban:user", "platform:timeout:user",
        "platform:assign:creator", "platform:revoke:creator",
        "platform:view:all:streams", "platform:manage:streams"
    ],
    CREATOR: [
        "stream:create", "stream:start", "stream:end",
        "queue:add", "queue:remove:own", "queue:remove:any", "queue:clear",
        "playback:skip", "playback:pause", "playback:play",
        "vote:cast",
        "session:ban:stream", "session:timeout:stream", "session:promote:mod",
    ],
    MODERATOR: [
        "queue:add", "queue:remove:own", "queue:remove:any",
        "playback:skip",
        "vote:cast",
        "session:ban:stream", "session:timeout:stream",
    ],
    MEMBER: [
        "queue:add", "queue:remove:own",
        "vote:cast",
    ],
    GUEST: [],
};

export function hasPermission(role: StreamRole, permission: Permission): boolean {
    return STREAM_ROLE_PERMISSIONS[role].includes(permission);
}
