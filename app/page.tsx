"use client"
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LucideIcon, PlayCircle, Users, Radio, Headphones, Sparkles, MessageSquare } from "lucide-react";
import { Appbar } from "./components/Appbar";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { motion } from "framer-motion";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white overflow-hidden selection:bg-blue-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.1),transparent_50%)]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_80%_20%,rgba(147,51,234,0.1),transparent_40%)]" />

      <div className="px-8 md:px-20 py-4 relative z-10">
        <Appbar />
      </div>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center pt-20 pb-16 md:pt-32 md:pb-24 lg:pt-40 lg:pb-32 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl px-6 space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            <span>The ultimate collaborative streaming experience</span>
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
            Music is better <br /> <span className="text-blue-500 drop-shadow-[0_0_35px_rgba(59,130,246,0.5)]">with friends</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg text-gray-400 md:text-xl leading-relaxed">
            EchoDeck turns your stream into a live party. Let your friends and fans drop tracks, vote for the next vibe, and control the deck together in real-time.
          </p>

          <div className="flex flex-wrap justify-center items-center gap-6 pt-4">
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700 h-14 px-10 text-lg rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            >
              Start Your Party
            </Button>
          </div>
        </motion.div>

        {/* Mockup Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="mt-20 w-full max-w-5xl px-6"
        >
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative bg-gray-900/80 border border-white/10 rounded-2xl p-4 md:p-8 backdrop-blur-xl">
              <div className="flex items-center gap-4 mb-6 border-b border-white/5 pb-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/50" />
                </div>
                <div className="text-xs text-gray-500 font-medium tracking-widest uppercase">Collaborative Queue — Live</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className="space-y-4">
                  <div className="h-4 w-32 bg-white/5 rounded" />
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                      <div className="w-12 h-8 rounded bg-gray-800 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-3/4 bg-white/10 rounded" />
                        <div className="h-2 w-1/2 bg-white/5 rounded" />
                      </div>
                      <div className="h-8 w-8 rounded bg-blue-500/10 flex items-center justify-center text-blue-500 text-xs font-bold">12</div>
                    </div>
                  ))}
                </div>
                <div className="bg-black/40 rounded-xl border border-white/5 flex flex-col items-center justify-center py-12">
                  <PlayCircle className="w-16 h-16 text-blue-500/50 mb-4" />
                  <div className="h-4 w-40 bg-white/10 rounded" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Features Section */}
      <section className="w-full py-24 md:py-32 relative">
        <div className="container mx-auto px-6 text-center">
          <div className="space-y-4 mb-20 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl md:text-5xl">Engineered for connection</h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">Every feature is designed to bridge the gap between streamers and their audience.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              Icon={Users}
              title="Shared Control"
              description="Invite your best friends to curate the stream in real-time."
              gradient="from-blue-500/20 to-cyan-500/20"
              iconColor="text-blue-400"
            />
            <FeatureCard
              Icon={Radio}
              title="Live Voting"
              description="Propel your favorites to the top with our dynamic voting system."
              gradient="from-purple-500/20 to-pink-500/20"
              iconColor="text-purple-400"
            />
            <FeatureCard
              Icon={MessageSquare}
              title="Live Reaction"
              description="Everyone sees updates instantly as tracks are added."
              gradient="from-green-500/20 to-emerald-500/20"
              iconColor="text-green-400"
            />
            <FeatureCard
              Icon={Headphones}
              title="Zero Delay"
              description="Synced media playback powered by advanced WebSockets."
              gradient="from-orange-500/20 to-yellow-500/20"
              iconColor="text-orange-400"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 px-8 md:px-20 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2 mb-2">
              <Image src="/logo.png" alt="EchoDeck Logo" width={32} height={32} className="rounded-lg shadow-lg" />
              <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">EchoDeck</div>
            </div>
            <p className="text-gray-500 text-sm max-w-xs text-center md:text-left">Building the future of social streaming for creators and friends everywhere.</p>
          </div>
          <nav className="flex gap-8">
            <Link href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Terms</Link>
            <Link href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Security</Link>
          </nav>
        </div>
        <div className="mt-12 pt-8 border-t border-white/5 text-center text-xs text-gray-600">
          © {new Date().getFullYear()} EchoDeck. Crafted with ❤️ for the streaming community.
        </div>
      </footer>
    </div >
  );
}

interface FeatureCardProps {
  Icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
  iconColor: string;
}

function FeatureCard({ Icon, title, description, gradient, iconColor }: FeatureCardProps) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="relative group p-8 rounded-3xl bg-gray-900/50 border border-white/5 overflow-hidden transition-all hover:bg-white/5"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="relative z-10 flex flex-col items-center sm:items-start text-center sm:text-left space-y-4">
        <div className={`p-3 rounded-2xl bg-white/5 ${iconColor}`}>
          <Icon className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">{title}</h3>
        <p className="text-gray-400 line-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}
