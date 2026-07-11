'use client';

import { useEffect, useState } from 'react';
import { X, Music2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-toastify';
import { useModalA11y } from '@/app/lib/useModalA11y';

interface Friend {
  id: string;
  username: string | null;
  displayName: string | null;
  image: string | null;
}

interface InviteFriendsModalProps {
  isOpen: boolean;
  creatorId: string;
  onClose: () => void;
}

export function InviteFriendsModal({ isOpen, creatorId, onClose }: InviteFriendsModalProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const containerRef = useModalA11y(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setInvitedIds(new Set());
    fetch('/api/friends/activity')
      .then((res) => (res.ok ? res.json() : { activity: [] }))
      .then((data) => setFriends(data.activity || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const inviteFriend = async (friend: Friend) => {
    try {
      const res = await fetch('/api/streams/jam-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, inviteeId: friend.id }),
      });
      if (res.ok) {
        setInvitedIds((prev) => new Set(prev).add(friend.id));
        toast.success(`Invited @${friend.username}`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || 'Failed to send invite');
      }
    } catch {
      toast.error('Error communicating with server');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        ref={containerRef}
        className="bg-gray-900 border border-purple-500/20 rounded-3xl w-full max-w-sm max-h-[70vh] flex flex-col overflow-hidden"
      >
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music2 className="w-4 h-4 text-purple-400" />
            <h2 className="text-lg font-bold text-white">Invite Friends to Jam</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-full text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">Loading friends...</p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Add friends first to invite them to a jam.
            </p>
          ) : (
            friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white/5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      friend.image ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`
                    }
                    className="w-8 h-8 rounded-full object-cover border border-white/10"
                    alt=""
                  />
                  <p className="text-sm text-white truncate">@{friend.username}</p>
                </div>
                <Button
                  size="sm"
                  disabled={invitedIds.has(friend.id)}
                  onClick={() => inviteFriend(friend)}
                  className="h-8 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold disabled:opacity-60"
                >
                  {invitedIds.has(friend.id) ? <Check className="w-3.5 h-3.5" /> : 'Invite'}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
