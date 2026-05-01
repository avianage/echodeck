'use client';

import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';

interface MaintenanceData {
  isActive: boolean;
  message?: string;
  startedAt?: string;
  endsAt?: string;
}

function formatCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Any moment now';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export default function MaintenancePage() {
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    const fetchStatus = async () => {
      const res = await fetch('/api/admin/maintenance');
      const json = await res.json();
      setData(json);

      // If maintenance ended, redirect to home
      if (!json.isActive) {
        window.location.href = '/';
      }
    };

    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 30000); // recheck every 30s
    return () => clearInterval(statusInterval);
  }, []);

  useEffect(() => {
    if (!data?.endsAt) return;

    const tick = () => setCountdown(formatCountdown(data.endsAt!));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data?.endsAt]);

  return (
    <div className="fixed inset-0 z-[99999] bg-[#030712] flex flex-col items-center justify-center px-4 text-center overflow-hidden selection:bg-blue-500/30">
      {/* Ambient Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Secret Owner Login - Made very discreet but hoverable at bottom right */}
      <a
        href="/auth/signin"
        className="absolute bottom-8 right-8 p-3 group z-50 outline-none"
        title="Owner Access"
      >
        <Wrench className="w-5 h-5 text-gray-800/50 group-hover:text-blue-500 transition-colors" />
      </a>

      <div className="relative z-10 space-y-12 max-w-xl w-full animate-in fade-in zoom-in-95 duration-1000">
        {/* Animated icon cluster */}
        <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
          <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping [animation-duration:3s]" />
          <div className="absolute inset-4 bg-blue-500/30 rounded-full animate-pulse [animation-duration:2s]" />
          <div className="relative z-10 w-20 h-20 bg-gray-900/80 backdrop-blur-xl rounded-full border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Wrench className="w-10 h-10 text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400 tracking-tight">
            Under Maintenance
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-md mx-auto">
            {data?.message ??
              "EchoDeck is undergoing scheduled maintenance. We'll be back shortly."}
          </p>
        </div>

        {/* Glassmorphism Duration info card */}
        <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/[0.05] rounded-[2.5rem] p-8 space-y-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          {data?.startedAt && (
            <div className="flex justify-between items-center text-sm px-4">
              <span className="text-gray-500 font-medium">Started</span>
              <span className="text-gray-300 font-bold">{formatDate(data.startedAt)}</span>
            </div>
          )}

          {data?.endsAt ? (
            <>
              <div className="flex justify-between items-center text-sm px-4">
                <span className="text-gray-500 font-medium">Expected Back</span>
                <span className="text-gray-300 font-bold">{formatDate(data.endsAt)}</span>
              </div>
              <div className="pt-6 border-t border-white/[0.05]">
                <p className="text-xs text-blue-400/80 mb-2 font-bold uppercase tracking-[0.2em]">
                  Time Remaining
                </p>
                <p className="text-4xl sm:text-5xl font-black text-white font-mono tabular-nums tracking-tighter drop-shadow-md">
                  {countdown}
                </p>
              </div>
            </>
          ) : (
            <div className="flex justify-between items-center text-sm px-4">
              <span className="text-gray-500 font-medium">Expected Back</span>
              <span className="text-blue-400 font-bold tracking-widest uppercase text-xs">
                No ETA Yet
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-600 font-medium">
          Auto-refreshing status every 30 seconds.
        </p>
      </div>
    </div>
  );
}
