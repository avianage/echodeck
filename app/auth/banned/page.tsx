'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShieldAlert, LogOut, Clock, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from 'next-auth/react';
import { UserData } from '@/types/user';

export default function BannedPage() {
  const { data: _, status } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    const checkStatus = async () => {
      if (status !== 'authenticated') return;
      try {
        const res = await fetch('/api/user/me');
        if (res.ok) {
          const { user } = await res.json();
          const isRestricted =
            user.isBanned || (user.bannedUntil && new Date(user.bannedUntil) > new Date());

          if (!isRestricted) {
            router.push('/dashboard');
          } else {
            setUserData(user);
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to check restriction status:', err);
      }
    };

    // Initial check
    checkStatus();

    // Poll every 5 seconds
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [status, router]);

  if (status === 'loading' || !userData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white font-mono">
        Verifying account status...
      </div>
    );
  }

  const bannedUntilDate = userData.bannedUntil ? new Date(userData.bannedUntil) : null;
  const isTimeout = bannedUntilDate && bannedUntilDate > new Date();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 selection:bg-red-500/30">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex justify-center">
          <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20 animate-pulse">
            <ShieldAlert className="w-16 h-16 text-red-500" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">
            Access Restricted
          </h1>
          <p className="text-gray-400 text-sm font-medium">
            Your account has been suspended by the platform administration.
          </p>
        </div>

        <div className="bg-[#111] border border-white/5 rounded-3xl p-8 space-y-6 text-left">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <Ban className="w-5 h-5 text-red-500 mt-1 shrink-0" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">
                  Reason
                </p>
                <p className="text-white font-bold leading-relaxed">
                  {userData.banReason ||
                    'Terms of Service violation or community guidelines breach.'}
                </p>
              </div>
            </div>

            {isTimeout && (
              <div className="flex items-start gap-4">
                <Clock className="w-5 h-5 text-amber-500 mt-1 shrink-0" />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">
                    Duration
                  </p>
                  <p className="text-white font-bold">
                    Restricted until {bannedUntilDate?.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 space-y-3">
            <p className="text-[10px] text-gray-600 leading-relaxed text-center">
              {isTimeout
                ? 'You will be able to log back in once the restriction period ends.'
                : 'This suspension is permanent. If you believe this is a mistake, please reach out through official support channels.'}
            </p>
          </div>
        </div>

        <Button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          variant="outline"
          className="w-full rounded-2xl border-white/10 hover:bg-white/5 py-6 text-lg font-bold group"
        >
          <LogOut className="w-5 h-5 mr-2 transition-transform group-hover:-translate-x-1" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
