import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Users, Radio, Headphones } from "lucide-react";
import { Appbar } from "./components/Appbar";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Appbar showThemeSwitch={false} />

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center py-16 md:py-24 lg:py-32 text-center">
        <div className="max-w-3xl px-6 space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
            Let Your Fans Choose the Beat
          </h1>
          <p className="text-lg text-gray-400 md:text-xl">
            Empower your audience to curate your music stream. Connect with fans like never before.
          </p>
          <div className="flex flex-wrap justify-center items-center gap-4">
            <Link href="/auth?authType=signUp">
              <Button className="bg-purple-600 text-white hover:bg-purple-700 px-6 py-3">
                Get Started
              </Button>
            </Link>
            <Button className="bg-white text-purple-600 hover:bg-white/90 px-6 py-3">
              Learn More
            </Button>
          </div>

        </div>
      </main>

      {/* Key Features Section */}
      <section className="w-full bg-gray-800 bg-opacity-50 py-16 md:py-24 lg:py-32">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl mb-8">Key Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 place-items-center">
            <FeatureCard Icon={Users} title="Fan Interaction" description="Let fans choose the music." color="text-yellow-400" />
            <FeatureCard Icon={Radio} title="Live Streaming" description="Stream with real-time input." color="text-green-400" />
            <FeatureCard Icon={Headphones} title="High-Quality Audio" description="Crystal clear sound quality." color="text-blue-400" />
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="w-full py-16 md:py-24 lg:py-32 text-center">
        <div className="max-w-3xl mx-auto px-6 space-y-6">
          <h2 className="text-4xl font-bold text-white sm:text-5xl">Ready to Transform Your Streams?</h2>
          <p className="text-lg text-gray-400 md:text-xl">
            Join MusicStreamChoice today and create unforgettable experiences.
          </p>
          <div className="flex justify-center items-center">
            <Link href="/auth?authType=signUp">
              <Button className="bg-purple-600 text-white hover:bg-purple-700 px-6 py-3">
                Sign Up
              </Button>
            </Link>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-col items-center gap-4 border-t border-gray-700 px-4 py-6 sm:flex-row sm:justify-between">
        <p className="text-xs text-gray-400">© 2025 Tunify. All rights reserved.</p>
        <nav className="flex gap-6">
          <Link href="#" className="text-xs text-gray-400 hover:text-purple-400">
            Terms of Service
          </Link>
          <Link href="#" className="text-xs text-gray-400 hover:text-purple-400">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  );
}

// Reusable Feature Card Component
function FeatureCard({ Icon, title, description, color }) {
  return (
    <div className="flex flex-col items-center space-y-3 text-center">
      <Icon className={`h-12 w-12 ${color}`} />
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
