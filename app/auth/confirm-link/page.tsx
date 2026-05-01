'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function ConfirmLinkContent() {
  const searchParams = useSearchParams();
  const provider = searchParams.get('provider');
  const email = searchParams.get('email');
  const [status, setStatus] = useState<'ready' | 'connecting' | 'error'>('ready');

  const handleConnect = async () => {
    if (!provider) return;
    setStatus('connecting');
    try {
      await signIn(provider, { callbackUrl: '/auth/link-success' });
    } catch {
      // eslint-disable-next-line no-console
      console.error('Connection initiation failed');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (!provider || !email) {
      setStatus('error');
      return;
    }

    // Auto-initiate connection as soon as they land here from the magic link
    handleConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, email]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <Card className="bg-red-500/5 border-red-500/20 max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Invalid Request</h2>
            <p className="text-gray-400">
              The connection link is missing parameters or has expired.
            </p>
            <Button
              variant="ghost"
              className="text-gray-400 hover:text-white"
              onClick={() => (window.location.href = '/')}
            >
              Go Back Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 border border-primary/20 mb-4 animate-pulse">
            <LinkIcon className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">
            Confirm Connection
          </h1>
          <p className="text-gray-400 font-medium max-w-[280px] mx-auto">
            Connecting your <span className="text-white font-bold">{provider}</span> account for{' '}
            <span className="text-white font-bold">{email}</span>...
          </p>
        </div>

        <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl">
          <CardContent className="p-10 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest">
                Initiating Secure Handshake
              </p>
            </div>

            <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
              You&apos;ll be redirected to {provider} to complete the connection. This ensures your
              account remains secure.
            </p>

            <div className="pt-4 border-t border-white/5">
              <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">
                Not working?{' '}
                <button onClick={handleConnect} className="text-primary hover:underline ml-1">
                  Click here to retry
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ConfirmLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      }
    >
      <ConfirmLinkContent />
    </Suspense>
  );
}
