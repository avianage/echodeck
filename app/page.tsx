"use client"
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { Users, Radio, Headphones } from "lucide-react";
import { Appbar } from "./components/Appbar";
import { signIn } from "next-auth/react";
import { Redirect } from "./components/Redirect";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-black via-blue-900 to-gray-900">
      <div className="px-8 md:px-20 py-4">
        <Appbar />
      </div>
      <Redirect/>
      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center py-16 md:py-24 lg:py-32 text-center">
        <div className="max-w-3xl px-6 space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
            Your Fans, Your Playlist
          </h1>
          <p className="text-lg text-gray-300 md:text-xl">
            Let your fans control the music that plays on your stream. Engage like never before!
          </p>
          <div className="flex flex-wrap justify-center items-center gap-4">
            <Button className="bg-blue-700 text-white hover:bg-blue-800 px-6 py-3"
              onClick={() => signIn()}>
              Get Started
            </Button>
            <Button className="bg-white text-blue-700 hover:bg-white/90 px-6 py-3">
              Learn More
            </Button>
          </div>
        </div>
      </main>

      {/* Key Features Section */}
      <section className="w-full bg-gray-900 bg-opacity-50 py-16 md:py-24 lg:py-32">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl mb-8">Key Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 place-items-center">
            <FeatureCard Icon={Users} title="Fan Interaction" description="Let fans choose the music." color="text-yellow-400" />
            <FeatureCard Icon={Radio} title="Live Voting" description="Real-time song voting system." color="text-green-400" />
            <FeatureCard Icon={Headphones} title="Seamless Streaming" description="High-quality uninterrupted playback." color="text-blue-400" />
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      {/* <section className="w-full py-16 md:py-24 lg:py-32 text-center">
        <div className="max-w-3xl mx-auto px-6 space-y-6">
          <h2 className="text-4xl font-bold text-white sm:text-5xl">What Our Users Say</h2>
          <p className="text-lg text-gray-300 md:text-xl">“This platform revolutionized my music streams! My fans love having a say in the playlist.”</p>
          <p className="text-gray-400">— Alex, Professional Streamer</p>
        </div>
      </section> */}

      {/* Call to Action Section */}
      <section className="w-full py-16 md:py-24 lg:py-32 text-center">
        <div className="max-w-3xl mx-auto px-6 space-y-6">
          <h2 className="text-4xl font-bold text-white sm:text-5xl">Start Engaging Your Audience Today</h2>
          <p className="text-lg text-gray-300 md:text-xl">
            Join now and elevate your music streaming experience!
          </p>
          <div className="flex justify-center items-center">
            <Button className="bg-blue-700 text-white hover:bg-blue-800 px-6 py-3"
              onClick={() => signIn()}>
              Sign Up
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-col items-center gap-4 border-t border-gray-700 px-4 py-6 sm:flex-row sm:justify-between">
        <p className="text-xs text-gray-400">© 2025 EchoDeck. All rights reserved.</p>
        <nav className="flex gap-6">
          <Link href="#" className="text-xs text-gray-400 hover:text-blue-400">
            Terms of Service
          </Link>
          <Link href="#" className="text-xs text-gray-400 hover:text-blue-400">
            Privacy Policy
          </Link>
        </nav>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  Icon: LucideIcon;
  title: string;
  description: string;
  color: string;
}

// Reusable Feature Card Component
function FeatureCard({ Icon, title, description, color }: FeatureCardProps) {
  return (
    <div className="flex flex-col items-center space-y-3 text-center">
      <Icon className={`h-12 w-12 ${color}`} />
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
