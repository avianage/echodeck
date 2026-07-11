'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface TrackStat {
  extractedId: string;
  title: string;
  playCount?: number;
  upvotes?: number;
}

interface Stats {
  totalPlays: number;
  topPlayed: TrackStat[];
  topUpvoted: TrackStat[];
  currentViewerCount: number;
  peakViewerCount: number;
}

interface CreatorStatsPanelProps {
  creatorId: string;
}

const REFRESH_INTERVAL_MS = 30 * 1000;

export function CreatorStatsPanel({ creatorId }: CreatorStatsPanelProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch(`/api/streams/stats?creatorId=${creatorId}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load stats'))))
        .then((data) => {
          if (!cancelled) {
            setStats(data);
            setError(false);
          }
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    };

    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [creatorId]);

  if (error) {
    return <p className="text-sm text-gray-500 text-center py-4">Couldn&apos;t load stats.</p>;
  }

  if (!stats) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent/10 rounded-xl border border-accent/20">
          <BarChart3 className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="text-xl font-black tracking-tighter uppercase italic">Stats</h3>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
            Your Stream at a Glance
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-white/[0.02] border-white/5 rounded-2xl">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-white">{stats.totalPlays}</p>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              Total Plays
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.02] border-white/5 rounded-2xl">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-white flex items-center justify-center gap-1">
              <Users className="w-4 h-4" /> {stats.currentViewerCount}
            </p>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              Live Viewers
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.02] border-white/5 rounded-2xl">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-white flex items-center justify-center gap-1">
              <TrendingUp className="w-4 h-4" /> {stats.peakViewerCount}
            </p>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              Peak Viewers
            </p>
          </CardContent>
        </Card>
      </div>

      {stats.topPlayed.length > 0 && (
        <Card className="bg-white/[0.02] border-white/5 rounded-3xl overflow-hidden">
          <CardContent className="p-5 space-y-2">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              Most Played
            </p>
            {stats.topPlayed.map((t, i) => (
              <div key={t.extractedId + i} className="flex justify-between text-sm">
                <span className="text-gray-200 truncate pr-2">{t.title}</span>
                <span className="text-gray-500 flex-shrink-0">{t.playCount}x</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {stats.topUpvoted.length > 0 && (
        <Card className="bg-white/[0.02] border-white/5 rounded-3xl overflow-hidden">
          <CardContent className="p-5 space-y-2">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              Most Upvoted
            </p>
            {stats.topUpvoted.map((t, i) => (
              <div key={t.extractedId + i} className="flex justify-between text-sm">
                <span className="text-gray-200 truncate pr-2">{t.title}</span>
                <span className="text-gray-500 flex-shrink-0">▲ {t.upvotes}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
