'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Share2,
  Music,
  Users,
  Check,
  Loader2,
  UserPlus,
  ExternalLink,
  User,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import type { UserData } from '@/types/user';

export default function UserProfilePage() {
  const { username } = useParams();
  const { data: session } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestPending, setRequestPending] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/user/public/${username}`);
        if (!res.ok) {
          if (res.status === 404) router.push('/404');
          return;
        }
        const data = await res.json();
        setUser(data.user);

        // Check friendship status if logged in
        if (session?.user) {
          const statusRes = await fetch(`/api/friends/status?userId=${data.user.id}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setIsFriend(statusData.isFriend);
            setRequestPending(statusData.isPending);
          }
        }
      } catch (err) {
        // TODO: replace with logger - console.error('Failed to fetch profile:', err);
      } finally {
        setLoading(false);
      }
    };

    if (username) fetchProfile();
  }, [username, session, router]);

  const handleSendRequest = async () => {
    if (!session) {
      toast.info('Please sign in to add friends');
      router.push('/auth/signin');
      return;
    }

    setSendingRequest(true);
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user?.username }),
      });

      if (res.ok) {
        toast.success('Friend request sent!');
        setRequestPending(true);
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to send request');
      }
    } catch (err) {
      toast.error('Error sending friend request');
    } finally {
      setSendingRequest(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        >
          <Loader2 className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  if (!user) return null;

  const isCreator = user.platformRole === 'CREATOR' || user.platformRole === 'OWNER';
  const isSelf = session?.user?.id === user.id;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30 pb-20">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[120px] rounded-full animate-pulse delay-700" />
      </div>

      <main className="max-w-4xl mx-auto px-6 py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          {/* Hero Section */}
          <div className="relative p-8 rounded-[2.5rem] bg-gradient-to-b from-white/[0.05] to-transparent border border-white/[0.08] backdrop-blur-xl overflow-hidden shadow-2xl">
            <div className="flex flex-col md:flex-row gap-8 items-center text-center md:text-left">
              <div className="relative group">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="h-32 w-32 rounded-[2rem] bg-gray-900 border-4 border-white/10 flex items-center justify-center overflow-hidden shadow-2xl transition-all group-hover:border-primary/50"
                >
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image ?? undefined}
                      alt={user.displayName ?? undefined}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="w-16 h-16 text-gray-400" />
                  )}
                </motion.div>
                {user.platformRole && (
                  <div
                    className={`absolute -bottom-2 -right-2 px-3 py-1.5 rounded-xl text-[10px] font-black border uppercase tracking-widest shadow-2xl backdrop-blur-md
                                        ${
                                          user.platformRole === 'OWNER'
                                            ? 'bg-red-500/20 text-red-500 border-red-500/30'
                                            : user.platformRole === 'CREATOR'
                                              ? 'bg-primary/20 text-primary border-primary/30'
                                              : 'bg-gray-500/20 text-gray-500 border-white/10'
                                        }`}
                  >
                    {user.platformRole}
                  </div>
                )}
              </div>

              <div className="space-y-4 flex-1">
                <div>
                  <h1 className="text-4xl font-black tracking-tighter text-white">
                    {user.displayName || user.username}
                  </h1>
                  <p className="text-xl font-medium text-gray-500 tracking-tight">
                    @{user.username}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  {!isSelf && (
                    <>
                      {isFriend ? (
                        <Button
                          disabled
                          className="rounded-2xl bg-green-500/10 text-green-500 border border-green-500/20 font-black uppercase tracking-widest text-[10px]"
                        >
                          <Check className="w-3.5 h-3.5 mr-2" /> Friends
                        </Button>
                      ) : requestPending ? (
                        <Button
                          disabled
                          className="rounded-2xl bg-gray-500/10 text-gray-500 border border-white/5 font-black uppercase tracking-widest text-[10px]"
                        >
                          Request Pending
                        </Button>
                      ) : user.allowFriendRequests || !isCreator ? (
                        <Button
                          onClick={handleSendRequest}
                          disabled={sendingRequest}
                          className="rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] px-6 shadow-xl shadow-primary/20"
                        >
                          {sendingRequest ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                          ) : (
                            <UserPlus className="w-3.5 h-3.5 mr-2" />
                          )}
                          Add Friend
                        </Button>
                      ) : null}
                    </>
                  )}
                  <Button
                    variant="ghost"
                    className="rounded-2xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest h-10 border border-white/5"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-2" /> Share
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Stats / Info Sidebar */}
            <div className="space-y-6">
              <Card className="bg-gray-900/40 border-white/5 backdrop-blur-xl rounded-3xl overflow-hidden shadow-xl">
                <CardHeader className="pb-4 border-b border-white/5 bg-white/[0.02] px-6 py-4">
                  <CardTitle className="text-[10px] font-black flex items-center gap-2 text-gray-400 uppercase tracking-widest">
                    <Shield className="w-3.5 h-3.5" /> Account Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Role</p>
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">
                      {user.platformRole || 'User'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Status</p>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${user.isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}
                      />
                      <p className="text-[10px] font-black text-white uppercase tracking-widest">
                        {user.isLive ? 'Live' : 'Offline'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Stream Section for Creators */}
            {isCreator && (
              <div className="md:col-span-2 space-y-6">
                <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20 backdrop-blur-xl rounded-[2rem] overflow-hidden shadow-2xl relative">
                  <CardContent className="p-8 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black italic tracking-tighter uppercase text-primary-400">
                        Creator Pulse
                      </h3>
                      <p className="text-gray-400 text-sm leading-relaxed max-w-md">
                        Jamming live and creating vibes. Catch the latest stream or head back to
                        their home party.
                      </p>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          Public Stream Link
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-mono text-primary-400 truncate mr-4">
                            {`https://echodeck.avianage.in/party/${user.partyCode || user.id}`}
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `https://echodeck.avianage.in/party/${user.partyCode || user.id}`,
                              );
                              toast.success('Link copied!');
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>

                      <Button
                        onClick={() => router.push(`/party/${user.partyCode || user.id}`)}
                        className={`w-full h-14 rounded-2xl font-black uppercase tracking-widest group shadow-2xl
                                                    ${
                                                      user.isLive
                                                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                                                        : 'bg-white/10 hover:bg-white/15 text-white'
                                                    }`}
                      >
                        {user.isLive ? (
                          <>
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                              className="w-3 h-3 bg-white rounded-full mr-3"
                            />
                            Jump into Live Session
                          </>
                        ) : (
                          'Visit Party Page'
                        )}
                        <ExternalLink className="w-4 h-4 ml-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </Button>
                    </div>
                  </CardContent>

                  {/* Decorative Icon */}
                  <div className="absolute top-8 right-8 text-primary shadow-2xl opacity-20 group-hover:opacity-30 transition-opacity">
                    <Music className="w-16 h-16" />
                  </div>
                </Card>
              </div>
            )}

            {/* Fallback for Normal Users if no creator info */}
            {!isCreator && (
              <div className="md:col-span-2">
                <Card className="bg-white/[0.02] border-white/5 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="h-20 w-20 rounded-[1.5rem] bg-gray-900 flex items-center justify-center border border-white/5">
                    <Users className="w-8 h-8 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-300">Listening to the Vibes</h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    This user is currently a listener in the EchoDeck social circle. Connect with
                    them to see what they are vibing to!
                  </p>
                </Card>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
