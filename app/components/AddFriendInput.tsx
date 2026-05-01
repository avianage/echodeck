'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

export function AddFriendInput() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddFriend = async () => {
    if (!username.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Friend request sent!');
        setUsername('');
      } else {
        toast.error(data.message || 'Failed to send request');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold flex items-center gap-2 text-gray-400 uppercase tracking-widest">
        <UserPlus className="w-4 h-4" /> Add Friend
      </h3>
      <div className="flex gap-2">
        <Input
          placeholder="Enter username..."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
          className="bg-white/5 border-white/10 rounded-xl h-10 text-sm focus:border-blue-500/50"
        />
        <Button
          onClick={handleAddFriend}
          disabled={loading || !username.trim()}
          className="bg-blue-600 hover:bg-blue-700 h-10 px-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
        </Button>
      </div>
    </div>
  );
}
