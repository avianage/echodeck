import StreamView from "@/app/components/StreamView";
import { prismaClient } from "@/app/lib/db";
import { notFound, redirect } from "next/navigation";
import { Radio } from "lucide-react";

export default async function Party(props: { params: Promise<{ creatorId: string }> }) {
  const { params } = props;
  const { creatorId: slug } = await params;

  // 1. Try to find by partyCode (UUID) or id (CUID)
  // 2. Fetch currentStream to check if live
  const user = await prismaClient.user.findFirst({
    where: {
      OR: [
        { partyCode: slug },
        { id: slug }
      ]
    },
    select: { 
      id: true,
      partyCode: true,
      currentStream: {
        select: {
          updatedAt: true
        }
      }
    }
  });

  if (!user) {
    notFound();
  }

  // Auto-redirect to the UUID-based URL if a CUID was used
  if (slug === user.id && user.partyCode && slug !== user.partyCode) {
    redirect(`/party/${user.partyCode}`);
  }

  // Determine if live: CurrentStream exists AND was updated in the last 15 seconds
  const isLive = user.currentStream && (Date.now() - new Date(user.currentStream.updatedAt).getTime() < 15000);

  if (!isLive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 text-center space-y-4">
        <div className="p-6 bg-white/5 rounded-full border border-white/10 animate-pulse">
            <Radio className="w-12 h-12 text-gray-600" />
        </div>
        <div className="space-y-1">
            <h1 className="text-2xl font-black uppercase tracking-tighter italic">The user is offline</h1>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Check back later or explore other live streams</p>
        </div>
        <a href="/discover" className="mt-8 px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
            Back to Discover
        </a>
      </div>
    );
  }

  return (
    <div>
      <StreamView key={user.id} creatorId={user.id} playVideo={true} />
    </div>
  );
}
