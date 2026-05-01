'use client';

import type { Stream } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { ExternalLink, ShieldAlert } from 'lucide-react';

interface StreamWithUser extends Stream {
  user: {
    username: string | null;
    displayName: string | null;
  };
}

interface StreamsListProps {
  streams: StreamWithUser[];
  onForceClose?: (streamId: string) => void;
}

export function StreamsList({ streams, onForceClose }: StreamsListProps) {
  return (
    <div className="divide-y divide-white/5">
      {streams.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-gray-500 text-sm">No active streams found.</p>
        </div>
      ) : (
        streams.map((stream) => (
          <div key={stream.id} className="p-6 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-bold text-white text-sm line-clamp-1">{stream.title}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  by <span className="text-accent-400 font-medium">@{stream.user?.username}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full hover:bg-white/10"
                  title="Join Silently"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </Button>
                {onForceClose && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-full hover:bg-red-500/10"
                    title="Force Close"
                    onClick={() => onForceClose(stream.id)}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-[10px] uppercase font-bold tracking-widest">
              <span
                className={`flex items-center gap-1.5 ${stream.isLive ? 'text-green-500' : 'text-gray-500'}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${stream.isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}
                />
                {stream.isLive ? 'Live' : 'Ended'}
              </span>
              <span className="text-gray-500">{stream.viewerCount || 0} Viewers</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
