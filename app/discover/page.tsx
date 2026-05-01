'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Radio, Search, Music2, Sparkles } from 'lucide-react';
import { StreamCard } from '@/app/components/StreamCard';
import { GuestJoinModal } from '@/app/components/GuestJoinModal';
import { Input } from '@/components/ui/input';
import type { StreamData } from '@/app/components/StreamCard';

export default function DiscoverPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [streams, setStreams] = useState<StreamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [selectedStream, setSelectedStream] = useState<StreamData | null>(null);
  const [userResults, setUserResults] = useState<
    Array<{ id: string; username: string; displayName: string | null; image: string | null }>
  >([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const fetchStreams = async () => {
    try {
      const res = await fetch('/api/streams/public');
      const data = await res.json();
      setStreams(data.streams || []);
    } catch (error) {
      // TODO: replace with logger - console.error('Failed to fetch streams:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();

    // Auto-refresh the streams list every 15 seconds to keep viewer counts and order updated
    const intervalId = setInterval(() => {
      fetchStreams();
    }, 15000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setUserResults([]);
        return;
      }
      setSearchingUsers(true);
      try {
        const res = await fetch(`/api/user/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setUserResults(data.users || []);
      } catch (error) {
        // TODO: replace with logger - console.error('Failed to search users:', error);
      } finally {
        setSearchingUsers(false);
      }
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleJoinClick = (stream: StreamData) => {
    if (!session) {
      setSelectedStream(stream);
      setGuestModalOpen(true);
      return;
    }
    // Redirect to stream view
    router.push(`/party/${stream.user?.partyCode || stream.user?.id || stream.id}`);
  };

  const filteredStreams = streams.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.user?.username?.toLowerCase() || '').includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      <div className="max-w-7xl mx-auto px-6 pt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-2xl border border-primary/20">
              <Radio className="w-6 h-6 text-primary animate-pulse" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">Discover</h1>
          </div>

          <div className="flex-1 max-w-xl relative group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find a vibe, a song, or a friend..."
              className="h-12 bg-white/5 border-white/5 rounded-2xl pl-12 pr-4 focus:ring-primary/50 transition-all font-medium text-sm"
            />
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        {/* Hero / Promo Section */}
        <div className="relative p-12 rounded-[3.5rem] bg-[#0a0a0a] border border-white/5 overflow-hidden">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 via-transparent to-transparent" />
          <div className="relative z-10 space-y-4 max-w-lg">
            <div className="flex items-center gap-2 text-primary font-black uppercase tracking-[0.2em] text-[10px]">
              <Sparkles className="w-4 h-4" /> Recommended for you
            </div>
            <h2 className="text-5xl font-black tracking-tighter leading-none">
              Find your next <br /> <span className="text-primary">EchoDeck</span> experience.
            </h2>
            <p className="text-gray-500 font-medium leading-relaxed">
              Join live public rooms, listen along with creators, and share the vibe in real-time.
            </p>
          </div>
        </div>

        {/* Search Results for Users */}
        {searchQuery.length >= 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black tracking-tighter uppercase flex items-center gap-3 italic">
                <Sparkles className="w-6 h-6 text-primary" />
                People matching &quot;{searchQuery}&quot;
              </h3>
              {searchingUsers && (
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {userResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {userResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => router.push(`/user/${user.username}`)}
                    className="group p-4 bg-white/[0.02] border border-white/5 rounded-3xl hover:bg-white/5 hover:border-primary/30 transition-all text-left space-y-3"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-gray-900 border border-white/10 overflow-hidden group-hover:border-primary/50 transition-colors">
                      {user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.image}
                          alt={user.username}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-500">
                          <Radio className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-black truncate uppercase tracking-tight">
                        {user.displayName || user.username}
                      </p>
                      <p className="text-[10px] font-bold text-gray-500 truncate lowercase tracking-wider">
                        @{user.username}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              !searchingUsers && (
                <p className="text-sm font-bold text-gray-600 italic">
                  No people found matching that name.
                </p>
              )
            )}
          </div>
        )}

        {/* Streams Grid */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black tracking-tighter uppercase flex items-center gap-3">
              <Music2 className="w-6 h-6 text-primary" />
              Live Now
            </h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-4 py-2 bg-white/5 rounded-full border border-white/5">
              {filteredStreams.length} Channels
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="aspect-video bg-white/5 rounded-[2.5rem] animate-pulse" />
              ))}
            </div>
          ) : filteredStreams.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {filteredStreams.slice(0, 9).map((stream, index) => (
                <div key={stream.id} className={index >= 3 ? 'hidden sm:block' : ''}>
                  <StreamCard stream={stream} isGuest={!session} onJoinClick={handleJoinClick} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-white/5 rounded-[3rem]">
              <div className="p-6 bg-white/5 rounded-full">
                <Radio className="w-12 h-12 text-gray-700" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-bold text-gray-400"> No streams found </h4>
                <p className="text-gray-600 text-sm max-w-xs px-4">
                  There are no live public streams right now. Check back later or start your own!
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Guest Modal */}
      <GuestJoinModal
        isOpen={guestModalOpen}
        streamTitle={selectedStream?.title || ''}
        creatorUsername={selectedStream?.user?.username || ''}
        callbackUrl={
          selectedStream
            ? `/party/${selectedStream.user?.partyCode || selectedStream.user?.id}`
            : '/discover'
        }
        onClose={() => setGuestModalOpen(false)}
      />
    </div>
  );
}
