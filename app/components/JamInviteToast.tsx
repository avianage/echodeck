'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Music2, X } from 'lucide-react';

interface JamInvite {
  id: string;
  creator: { id: string; username: string | null; displayName: string | null; partyCode: string | null };
  inviter: { id: string; username: string | null; displayName: string | null };
}

const POLL_INTERVAL_MS = 10 * 1000;

// Mounted at the root layout — jam invites are actionable and time-sensitive,
// so they need to reach the recipient on any page, not just wherever
// friend-activity browsing happens to live (unlike FriendActivityFeed).
export function JamInviteToast() {
  const { data: session } = useSession();
  const router = useRouter();
  const [invites, setInvites] = useState<JamInvite[]>([]);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/streams/jam-invite');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setInvites(data.invites || []);
        }
      } catch {
        // ignore — will retry on next poll
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session?.user]);

  const respond = async (invite: JamInvite, action: 'accept' | 'decline') => {
    setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    try {
      const res = await fetch(`/api/streams/jam-invite/${invite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (action === 'accept' && res.ok) {
        const data = await res.json();
        const target = data.partyCode || invite.creator.partyCode || invite.creator.id;
        router.push(`/party/${target}`);
      }
    } catch {
      // best-effort — invite will simply expire if this failed
    }
  };

  if (invites.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 max-w-sm w-full px-4 sm:px-0">
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="bg-[#111] border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-900/20 p-4 flex items-start gap-3 animate-in slide-in-from-bottom-2"
        >
          <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20 shrink-0">
            <Music2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-bold">
              @{invite.inviter.username || invite.inviter.displayName || 'A friend'} invited you to a jam
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              with @{invite.creator.username || invite.creator.displayName || 'someone'}
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => respond(invite, 'accept')}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors"
              >
                Join
              </button>
              <button
                onClick={() => respond(invite, 'decline')}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-bold transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
          <button
            onClick={() => respond(invite, 'decline')}
            className="text-gray-600 hover:text-gray-400 shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
