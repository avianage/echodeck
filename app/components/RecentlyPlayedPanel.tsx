'use client';

import { useEffect, useState } from 'react';
import { History, TrendingUp, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'react-toastify';
import Image from 'next/image';

interface PlayedTrack {
  id?: string;
  title: string;
  extractedId: string;
  playedTs?: string | null;
  playCount?: number;
  url?: string;
}

interface RecentlyPlayedPanelProps {
  creatorId: string;
  onAdded?: () => void;
}

function formatTimeAgo(iso: string | null | undefined) {
  if (!iso) return '';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const REFRESH_INTERVAL_MS = 30 * 1000;

export function RecentlyPlayedPanel({ creatorId, onAdded }: RecentlyPlayedPanelProps) {
  const [tab, setTab] = useState<'recent' | 'frequent'>('recent');
  const [tracks, setTracks] = useState<PlayedTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = () => {
      const query =
        tab === 'frequent'
          ? `creatorId=${creatorId}&sortBy=frequency`
          : `creatorId=${creatorId}`;
      fetch(`/api/streams/history?${query}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load history'))))
        .then((data) => {
          if (!cancelled) {
            setTracks(data.tracks || []);
            setError(false);
          }
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [creatorId, tab]);

  const handleAddToQueue = async (track: PlayedTrack) => {
    const key = track.id || track.extractedId;
    const url = track.url || `https://www.youtube.com/watch?v=${track.extractedId}`;
    setAddingId(key);
    try {
      const res = await fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, url }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to add to queue');
        return;
      }
      toast.success(`Added ${track.title} to queue`);
      onAdded?.();
    } catch {
      toast.error('Error adding to queue');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          {tab === 'recent' ? <History className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
          {tab === 'recent' ? 'Recently Played' : 'Most Played'}
        </h2>
        <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-xl">
          <button
            onClick={() => setTab('recent')}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              tab === 'recent' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-500 hover:text-white'
            }`}
          >
            Recent
          </button>
          <button
            onClick={() => setTab('frequent')}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              tab === 'frequent' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-500 hover:text-white'
            }`}
          >
            Most Played
          </button>
        </div>
      </div>
      {/* Fixed height regardless of tab/loading/empty state, so switching
          tabs never changes this panel's size and shifts the page layout
          below it (was causing Session Settings/Stream Mgmt's entrance
          animation to replay). */}
      <div className="h-[300px] overflow-y-auto pr-2 custom-scrollbar">
      {loading ? (
        <p className="text-sm text-gray-500 text-center py-4">Loading…</p>
      ) : error ? (
        <p className="text-sm text-gray-500 text-center py-4">Couldn&apos;t load recently played.</p>
      ) : tracks.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">Nothing played yet.</p>
      ) : (
        <div className="space-y-3">
          {tracks.map((track) => {
            const key = track.id || track.extractedId;
            return (
              <Card key={key} className="bg-white/5 border-white/5">
                <CardContent className="p-3 flex items-center gap-4">
                  <div className="w-16 h-10 relative flex-shrink-0 opacity-70">
                    {track.extractedId ? (
                      <Image
                        src={`https://img.youtube.com/vi/${track.extractedId}/mqdefault.jpg`}
                        alt={track.title}
                        fill
                        sizes="64px"
                        className="rounded object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-800 rounded" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate text-xs">{track.title}</h3>
                  </div>
                  <span className="text-[10px] text-gray-500 flex-shrink-0">
                    {tab === 'recent' ? formatTimeAgo(track.playedTs) : `${track.playCount}x played`}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={addingId === key}
                    onClick={() => handleAddToQueue(track)}
                    className="h-8 w-8 p-0 rounded-full flex-shrink-0 text-gray-400 hover:text-blue-400"
                    title="Add to Queue"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
