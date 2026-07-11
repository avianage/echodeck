export type PlatformRole = 'OWNER' | 'CREATOR' | 'MEMBER' | 'GUEST';
export type StreamRole = 'OWNER' | 'CREATOR' | 'MODERATOR' | 'MEMBER' | 'GUEST' | 'BANNED';
export type SessionMode = 'BROADCAST' | 'JAM';

export type Permission =
  | 'stream:create'
  | 'stream:start'
  | 'stream:end'
  | 'stream:enter:silent' // owner-only invisible join
  | 'queue:add'
  | 'queue:remove:own'
  | 'queue:remove:any'
  | 'queue:clear'
  | 'playback:skip'
  | 'playback:pause'
  | 'playback:play'
  | 'vote:cast'
  | 'session:ban:stream' // ban from stream
  | 'session:timeout:stream'
  | 'session:promote:mod' // assign moderator
  | 'platform:ban:user' // owner only
  | 'platform:timeout:user' // owner only
  | 'platform:assign:creator' // owner only
  | 'platform:revoke:creator' // owner only
  | 'platform:view:all:streams'
  | 'platform:manage:streams'
  | 'access:manage'
  | 'stream:update'
  | 'chat:send'
  | 'chat:moderate';

const STREAM_ROLE_PERMISSIONS: Record<StreamRole, Permission[]> = {
  OWNER: [
    'stream:create',
    'stream:start',
    'stream:end',
    'stream:enter:silent',
    'queue:add',
    'queue:remove:own',
    'queue:remove:any',
    'queue:clear',
    'playback:skip',
    'playback:pause',
    'playback:play',
    'vote:cast',
    'session:ban:stream',
    'session:timeout:stream',
    'session:promote:mod',
    'platform:ban:user',
    'platform:timeout:user',
    'platform:assign:creator',
    'platform:revoke:creator',
    'platform:view:all:streams',
    'platform:manage:streams',
    'access:manage',
    'stream:update',
    'chat:send',
    'chat:moderate',
  ],
  CREATOR: [
    'stream:create',
    'stream:start',
    'stream:end',
    'queue:add',
    'queue:remove:own',
    'queue:remove:any',
    'queue:clear',
    'playback:skip',
    'playback:pause',
    'playback:play',
    'vote:cast',
    'session:ban:stream',
    'session:timeout:stream',
    'session:promote:mod',
    'access:manage',
    'stream:update',
    'chat:send',
    'chat:moderate',
  ],
  MODERATOR: [
    'queue:add',
    'queue:remove:own',
    'queue:remove:any',
    'playback:skip',
    'vote:cast',
    'session:ban:stream',
    'session:timeout:stream',
    'access:manage',
    'stream:update',
    'chat:send',
    'chat:moderate',
  ],
  MEMBER: ['queue:add', 'queue:remove:own', 'vote:cast', 'chat:send'],
  GUEST: [],
  BANNED: [],
};

// Additive-only permissions granted on top of STREAM_ROLE_PERMISSIONS when a
// session's mode is 'JAM' — a jam shares playback control among members
// without touching moderation/access powers (ban, promote, clear, etc. stay
// gated exactly as in broadcast mode).
const JAM_ROLE_OVERRIDES: Partial<Record<StreamRole, Permission[]>> = {
  MEMBER: ['playback:play', 'playback:pause', 'playback:skip'],
};

export function hasPermission(
  role: StreamRole,
  permission: Permission,
  mode?: SessionMode,
): boolean {
  if (STREAM_ROLE_PERMISSIONS[role].includes(permission)) return true;
  if (mode === 'JAM' && JAM_ROLE_OVERRIDES[role]?.includes(permission)) return true;
  return false;
}
