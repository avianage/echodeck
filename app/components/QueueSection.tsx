import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

interface Video {
  id: string;
  type: string;
  url: string;
  extractedId: string;
  title: string;
  smallImg: string;
  bigImg: string;
  active: string;
  userId: string;
  addedById: string;
  upvotes: number;
  haveUpvoted: boolean;
  playedTs: string | null;
}

interface QueueSectionProps {
  queue: Video[];
  currentUserId: string | null;
  creatorId: string;
  onVote: (id: string, isUpvote: boolean) => void;
  onRemove: (streamId: string) => void;
}

export function QueueSection({
  queue,
  currentUserId,
  creatorId,
  onVote,
  onRemove,
}: QueueSectionProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        Upcoming{' '}
        <span className="text-sm font-normal text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
          {queue.length}
        </span>
      </h2>
      {queue.length <= 0 ? (
        <Card className="bg-gray-900/30 border-gray-800 border-dashed text-white">
          <CardContent className="p-8 flex items-center justify-center opacity-50">
            Empty Queue
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[300px] sm:max-h-[400px] lg:max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {queue.map((video, index) => (
            <Card
              key={`${video.id}-${index}`}
              className="bg-white/5 border-white/5 hover:bg-white/10 transition-colors"
            >
              <CardContent className="p-3 flex items-center gap-4">
                <div className="w-16 h-10 sm:w-20 sm:h-12 relative flex-shrink-0">
                  {video.extractedId ? (
                    <Image
                      src={`https://img.youtube.com/vi/${video.extractedId}/mqdefault.jpg`}
                      alt={video.title}
                      fill
                      sizes="80px"
                      className="rounded object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 rounded" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate text-xs">{video.title}</h3>
                </div>
                <div className="flex items-center gap-1">
                  {(video.addedById === currentUserId || creatorId === currentUserId) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(video.id)}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onVote(video.id, !video.haveUpvoted)}
                    className={`h-8 px-2 ${video.haveUpvoted ? 'text-blue-500' : 'text-gray-400'}`}
                  >
                    {video.haveUpvoted ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                    <span className="ml-1 text-xs font-bold">{video.upvotes}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
