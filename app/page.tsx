'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Radio, Play, Sparkles, Music2, Users, ShieldCheck } from 'lucide-react';

export default function LandingPage() {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30 overflow-hidden">
      {/* Background Gradients */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-40 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/10 rounded-full border border-blue-600/20 text-blue-500 text-[10px] font-black uppercase tracking-[0.2em] mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <Sparkles className="w-4 h-4" />
          The Future of Distributed Listening
        </div>

        <h1 className="text-5xl md:text-8xl font-black tracking-tighter uppercase italic leading-[0.9] mb-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
          Social <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/80 to-accent">
            Streaming
          </span>{' '}
          <br />
          Evolved.
        </h1>

        <p className="max-w-xl text-gray-400 text-base md:text-lg font-medium leading-relaxed mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
          EchoDeck lets you stream your favorite music and videos to a global audience. Sync, chat,
          and upvote in real-time. Experience the vibe together.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-6 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-700">
          {(!session?.user ||
            (session.user as Record<string, unknown>).platformRole === 'CREATOR' ||
            (session.user as Record<string, unknown>).platformRole === 'OWNER') && (
            <button
              onClick={() => router.push(session ? '/stream' : '/auth/signin')}
              className="h-16 md:h-20 px-10 md:px-12 rounded-2xl md:rounded-3xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest transition-all shadow-2xl shadow-primary/30 group active:scale-95 flex items-center justify-center text-xs md:text-sm"
            >
              <Play className="w-4 h-4 md:w-5 md:h-5 mr-3 fill-current group-hover:scale-110 transition-transform" />
              Start Streaming
            </button>
          )}
          <button
            onClick={() => router.push('/discover')}
            className="h-16 md:h-20 px-10 md:px-12 rounded-2xl md:rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center text-xs md:text-sm"
          >
            <Radio className="w-4 h-4 md:w-5 md:h-5 mr-3 text-primary" />
            Discover Streams
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-40 max-w-5xl w-full">
          {[
            {
              icon: <Music2 className="w-6 h-6" />,
              title: 'Multi-Source',
              desc: 'Connect Spotify and YouTube seamlessly. One queue, infinite vibes.',
            },
            {
              icon: <Users className="w-6 h-6" />,
              title: 'Real-time Sync',
              desc: 'Experience ultra-low latency listening. If it plays for them, it plays for you.',
            },
            {
              icon: <ShieldCheck className="w-6 h-6" />,
              title: 'Total Control',
              desc: 'Advanced RBAC, scoped bans, and visibility toggles for your community.',
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 text-left space-y-4 hover:bg-white/[0.06] transition-colors group"
            >
              <div className="p-4 bg-primary/10 rounded-2xl w-fit text-primary group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-black tracking-tighter uppercase italic">
                {feature.title}
              </h3>
              <p className="text-gray-500 text-sm font-medium leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Background decoration */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full h-[50vh] bg-gradient-to-t from-primary/5 to-transparent pointer-events-none -z-0" />
    </div>
  );
}
