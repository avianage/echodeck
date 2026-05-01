import Link from 'next/link';
import { ShieldX } from 'lucide-react';

export default function Unauthorized() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
      <div className="space-y-6 max-w-md">
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 bg-yellow-600/20 blur-2xl rounded-full" />
          <div className="relative w-24 h-24 bg-gray-900 rounded-full border border-gray-800 flex items-center justify-center">
            <ShieldX className="w-10 h-10 text-yellow-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-white">Access Denied</h1>
          <p className="text-gray-500 text-sm">You don&apos;t have permission to view this page.</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-all"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
