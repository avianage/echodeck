'use client';

import { useState, useEffect } from 'react';
import { Check, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-toastify';

interface FriendRequest {
  id: string;
  requester: {
    id: string;
    username: string;
    displayName: string;
    image: string | null;
  };
}

export function FriendRequests() {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/friends/requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRespond = async (friendshipId: string, action: 'accept' | 'block') => {
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId, action }),
      });

      if (res.ok) {
        toast.success(`Friend request ${action}ed`);
        setRequests((prev) => prev.filter((r) => r.id !== friendshipId));
      } else {
        toast.error('Failed to respond to request');
      }
    } catch (err) {
      toast.error('Error responding to request');
    }
  };

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold flex items-center gap-2 text-gray-400 uppercase tracking-widest">
        Pending Requests ({requests.length})
      </h3>
      <div className="space-y-2">
        {requests.map((req) => (
          <div
            key={req.id}
            className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-2xl animate-in slide-in-from-right-2 duration-300"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden shrink-0 border border-white/10">
                {req.requester.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={req.requester.image} className="w-full h-full object-cover" alt="" />
                ) : (
                  <User className="w-4 h-4 text-gray-500" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">@{req.requester.username}</p>
                <p className="text-[10px] text-gray-500 truncate">
                  {req.requester.displayName || 'Echoer'}
                </p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20"
                onClick={() => handleRespond(req.id, 'accept')}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                onClick={() => handleRespond(req.id, 'block')}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
