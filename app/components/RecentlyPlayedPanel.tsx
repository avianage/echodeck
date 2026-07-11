'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';

interface PlayedTrack {
  id: string;
  title: string;
  extractedId: string;
  playedTs: string | null;
}

interface RecentlyPlayedPanelProps {
  creatorId: string;
}

function formatTimeAgo(iso: string | null) {
  if (!iso) return '';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const REFRESH_INTERVAL_MS = 30 * 1000;

export function RecentlyPlayedPanel({ creatorId }: RecentlyPlayedPanelProps) {
  const [tracks, setTracks] = useState<PlayedTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch(`/api/streams/history?creatorId=${creatorId}`)
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
  }, [creatorId]);

  if (loading) return null;
  if (error) {
    return <p className="text-sm text-gray-500 text-center py-4">Couldn&apos;t load recently played.</p>;
  }
  if (tracks.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <History className="w-5 h-5" /> Recently Played
      </h2>
      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {tracks.map((track) => (
          <Card key={track.id} className="bg-white/5 border-white/5">
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
                {formatTimeAgo(track.playedTs)}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
