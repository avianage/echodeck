'use client';

import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Play, Users, Globe, Lock, Plus, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { AddFriendInput } from '../components/AddFriendInput';
import { FriendRequests } from '../components/FriendRequests';
import { FriendActivityFeed } from '../components/FriendActivityFeed';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [view, setView] = useState<'choice' | 'join'>('choice');
  const [joinInput, setJoinInput] = useState('');
  const [favorites, setFavorites] = useState<
    {
      id: string;
      email: string;
      username: string;
      partyCode: string | null;
      image: string | null;
      isOnline: boolean;
    }[]
  >([]);

  // Stream setup modal
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupTitle, setSetupTitle] = useState('');
  const [setupGenre, setSetupGenre] = useState('');
  const [setupPublic, setSetupPublic] = useState(true);
  const [clearQueue, setClearQueue] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetchFavorites();
    }
  }, [session]);

  const fetchFavorites = async () => {
    try {
      const res = await fetch('/api/user/favorites');
      const data = await res.json();
      setFavorites(data.favorites || []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch favorites', err);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white gap-4">
        <h1 className="text-2xl font-bold">Please sign in to continue</h1>
        <Button onClick={() => signIn()}>Sign In</Button>
      </div>
    );
  }

  const handleJoinStream = () => {
    if (!joinInput.trim()) return;

    let targetId = joinInput.trim();
    if (targetId.includes('/party/')) {
      targetId = targetId.split('/party/')[1];
    } else if (targetId.includes('/')) {
      targetId = targetId.split('/').pop() || '';
    }

    if (targetId) {
      router.push(`/party/${targetId}`);
    } else {
      toast.error('Invalid stream link or code');
    }
  };

  const handleGoLive = async () => {
    setIsStarting(true);
    try {
      // Save stream metadata before navigating
      await fetch('/api/streams/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: setupTitle || 'My EchoDeck Session',
          genre: setupGenre || null,
          isPublic: setupPublic,
          clearQueue: clearQueue,
        }),
      });
    } catch {
      // Non-fatal — stream will use defaults
    } finally {
      setIsStarting(false);
      setShowSetupModal(false);
      router.push('/stream');
    }
  };

  const hasFavorites = favorites.length > 0;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30 overflow-x-hidden pb-safe">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.1),transparent_50%)]" />

      <main className="max-w-6xl mx-auto px-6 pt-12 pb-12 space-y-12 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8 w-full">
          <div>
            <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
              Welcome,{' '}
              {(session.user as Record<string, unknown>).username
                ? `@${(session.user as Record<string, unknown>).username}`
                : session.user.name?.split(' ')?.[0] || 'DJ'}
            </h1>
            <p className="text-gray-400 mt-2">The deck is ready. What&apos;s your move?</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start w-full">
          {/* Main Actions Column */}
          <div className="lg:col-span-2 space-y-8">
            {view === 'choice' ? (
              <div
                className={`grid grid-cols-1 ${(session?.user as Record<string, unknown>)?.platformRole === 'CREATOR' || (session?.user as Record<string, unknown>)?.platformRole === 'OWNER' ? 'md:grid-cols-2' : 'max-w-md mx-auto'} gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500`}
              >
                {/* Start Stream Choice */}
                {((session?.user as Record<string, unknown>)?.platformRole === 'CREATOR' ||
                  (session?.user as Record<string, unknown>)?.platformRole === 'OWNER') && (
                  <Card
                    className="bg-gray-900/50 border-white/5 backdrop-blur-md overflow-hidden group hover:border-primary/40 transition-all cursor-pointer h-[380px] flex flex-col"
                    onClick={() => setShowSetupModal(true)}
                  >
                    <CardContent className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 text-center">
                      <div className="p-5 rounded-3xl bg-primary-500/10 text-primary group-hover:scale-110 transition-transform shadow-2xl shadow-primary/5">
                        <Play className="w-14 h-14 fill-primary" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-white">Start a Stream</h3>
                        <p className="text-gray-400 text-sm max-w-[200px]">
                          Host your own party and let others vibe with you.
                        </p>
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-xs font-bold text-primary-400 uppercase tracking-widest group-hover:gap-3 transition-all">
                        Go Live <Plus className="w-4 h-4" />
                      </div>
                    </CardContent>
                    <div className="py-3 bg-blue-500/5 border-t border-white/5 text-center text-[10px] font-bold text-primary-400/60 uppercase tracking-widest">
                      CONFIGURE & HOST
                    </div>
                  </Card>
                )}

                {/* Join Stream Choice */}
                <Card
                  className="bg-gray-900/50 border-white/5 backdrop-blur-md overflow-hidden group hover:border-accent/40 transition-all cursor-pointer h-[380px] flex flex-col"
                  onClick={() => setView('join')}
                >
                  <CardContent className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 text-center">
                    <div className="p-5 rounded-3xl bg-accent/10 text-accent group-hover:scale-110 transition-transform shadow-2xl shadow-accent/5">
                      <Users className="w-14 h-14" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-white">Join a Stream</h3>
                      <p className="text-gray-400 text-sm max-w-[200px]">
                        Jump into a friend&apos;s party and start voting.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-accent-400 uppercase tracking-widest group-hover:gap-3 transition-all">
                      Connect <Plus className="w-4 h-4" />
                    </div>
                  </CardContent>
                  <div className="py-3 bg-purple-500/5 border-t border-white/5 text-center text-[10px] font-bold text-accent-400/60 uppercase tracking-widest">
                    LINK OR CODE
                  </div>
                </Card>
              </div>
            ) : (
              <Card className="bg-gray-900/50 border-white/5 backdrop-blur-sm shadow-xl shadow-accent/5 max-w-2xl mx-auto overflow-hidden">
                <CardHeader className="pb-2 flex flex-row items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setView('choice')}
                    className="rounded-xl border-white/10 hover:bg-white/10 bg-white/5 shadow-lg group/back text-white"
                  >
                    <ArrowLeft className="w-5 h-5 group-hover/back:-translate-x-1 transition-transform" />
                  </Button>
                  <CardTitle className="text-2xl text-white">Join a Party</CardTitle>
                </CardHeader>
                <CardContent className="p-12 space-y-10">
                  <div className="space-y-4 text-center">
                    <div className="mx-auto w-20 h-20 rounded-3xl bg-accent-500/10 flex items-center justify-center text-accent mb-2 shadow-2xl shadow-accent/10">
                      <Users className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Enter Stream Details</h3>
                    <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
                      Paste the link from{' '}
                      <span className="text-accent-400 font-mono">echodeck.avianage.in</span> or
                      enter the unique host code.
                    </p>
                  </div>
                  <div className="max-w-md mx-auto space-y-5">
                    <div className="relative group/input">
                      <div className="absolute -inset-1 bg-gradient-to-r from-primary-600 to-accent-600 rounded-2xl blur opacity-0 group-focus-within/input:opacity-20 transition duration-500"></div>
                      <Input
                        placeholder="e.g. f3ef33... or echodeck.avianage.in/party/..."
                        className="bg-black/60 border-white/10 h-16 px-6 text-lg focus:border-purple-500/30 rounded-2xl relative z-10"
                        value={joinInput}
                        onChange={(e) => setJoinInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoinStream()}
                        autoFocus
                      />
                    </div>
                    <Button
                      onClick={handleJoinStream}
                      className="w-full h-16 bg-accent border-accent/90 text-white font-bold rounded-2xl transition-all shadow-xl shadow-accent/30 active:scale-[0.98] text-lg uppercase tracking-wider border-b-4 border-primary-800 hover:border-primary-600"
                    >
                      Dive into Vibe
                    </Button>
                  </div>
                </CardContent>
                <div className="py-2 bg-accent/10 border-t border-accent/20 text-center">
                  <p className="text-[10px] font-black text-accent-400 uppercase tracking-[0.2em] animate-pulse">
                    Waiting for your entry
                  </p>
                </div>
              </Card>
            )}
          </div>

          <Card className="bg-gray-900/40 border-white/5 backdrop-blur-md sticky top-32 overflow-hidden border-l-0 lg:border-l lg:border-white/5 md:rounded-l-none shadow-2xl">
            <CardHeader className="pb-4 border-b border-white/5 px-6">
              <CardTitle className="text-sm font-bold flex items-center gap-2 tracking-tight text-gray-300">
                <Users className="w-4 h-4 text-primary" /> SOCIAL HUB
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {hasFavorites && (
                <div className="border-b border-white/5">
                  <div className="px-6 py-4 flex items-center justify-between bg-black/20">
                    <span className="text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">
                      Your Circle
                    </span>
                    <span className="text-[10px] font-black text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">
                      {favorites.length}/5
                    </span>
                  </div>
                  <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {favorites.map((fav) => (
                      <div
                        key={fav.id}
                        className="group/item flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer relative"
                        onClick={() => router.push(`/party/${fav.partyCode || fav.id}`)}
                      >
                        <div className="flex items-center gap-4 relative z-10 w-full">
                          <div className="relative shrink-0">
                            <div
                              className={`w-10 h-10 rounded-2xl bg-gradient-to-br transition-all duration-500 overflow-hidden ${fav.isOnline ? 'from-green-500/20 to-blue-500/20 border-green-500/20' : 'from-gray-500/10 to-gray-500/5 border-white/5'} flex items-center justify-center font-bold border`}
                            >
                              {fav.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={fav.image}
                                  alt={fav.email}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className={fav.isOnline ? 'text-green-500' : 'text-gray-600'}>
                                  {fav.email[0].toUpperCase()}
                                </span>
                              )}
                            </div>
                            {fav.isOnline && (
                              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-950 shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
                            )}
                          </div>
                          <div className="overflow-hidden flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-white truncate group-hover/item:text-blue-400 transition-colors">
                                {fav.email?.split('@')?.[0]}
                              </p>
                              {fav.isOnline && (
                                <span className="shrink-0 text-[8px] font-black bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded-sm border border-green-500/20 tracking-tighter uppercase animate-pulse">
                                  Live
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-[10px] font-medium tracking-tight ${fav.isOnline ? 'text-blue-400/60' : 'text-gray-500/60'}`}
                            >
                              {fav.isOnline ? 'Streaming now' : 'Currently offline'}
                            </p>
                          </div>
                          <div className="shrink-0 opacity-0 group-hover/item:opacity-100 transition-all translate-x-2 group-hover/item:translate-x-0">
                            <ArrowLeft className="w-4 h-4 text-blue-500 rotate-180" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-6 space-y-8 max-h-[calc(100vh-400px)] overflow-y-auto custom-scrollbar">
                <FriendRequests />
                <AddFriendInput />
                <div className="border-t border-white/5 pt-6">
                  <FriendActivityFeed />
                </div>
              </div>
            </CardContent>
            <div className="p-4 bg-white/[0.01] border-t border-white/5 text-center">
              <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                Live Activity Feed
              </p>
            </div>
          </Card>
        </div>
      </main>

      {/* Stream Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white">Setup Your Stream</h2>
                <p className="text-sm text-gray-500 mt-1">Configure before going live</p>
              </div>
              <button
                onClick={() => setShowSetupModal(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                  Stream Title
                </label>
                <input
                  value={setupTitle}
                  onChange={(e) => setSetupTitle(e.target.value)}
                  placeholder="My EchoDeck Session"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 font-medium text-sm focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                  Genre <span className="text-gray-600 normal-case font-normal">(optional)</span>
                </label>
                <input
                  value={setupGenre}
                  onChange={(e) => setSetupGenre(e.target.value)}
                  placeholder="e.g. Lo-fi, Hip-hop, Pop..."
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 font-medium text-sm focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                  Visibility
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSetupPublic(true)}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-bold text-sm transition-all ${
                      setupPublic
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'
                    }`}
                  >
                    <Globe className="w-4 h-4" /> Public
                  </button>
                  <button
                    onClick={() => setSetupPublic(false)}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-bold text-sm transition-all ${
                      !setupPublic
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'
                    }`}
                  >
                    <Lock className="w-4 h-4" /> Private
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                <input
                  type="checkbox"
                  id="clearQueue"
                  checked={clearQueue}
                  onChange={(e) => setClearQueue(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-black/40 text-primary focus:ring-primary/50"
                />
                <label
                  htmlFor="clearQueue"
                  className="text-xs font-bold text-gray-400 cursor-pointer select-none"
                >
                  Clear previous queue before starting
                </label>
              </div>
            </div>

            <button
              onClick={handleGoLive}
              disabled={isStarting}
              className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest rounded-2xl transition-all active:scale-[0.98] shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-60"
            >
              <Play className="w-5 h-5 fill-current" />
              {isStarting ? 'Setting up...' : 'Go Live'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
