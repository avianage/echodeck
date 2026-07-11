import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import { YT_REGEX } from '@/app/lib/utils';
import Image from 'next/image';
import type { YouTubeSearchItem } from '@/types/youtube-api';

interface SearchBarProps {
  videoLink: string;
  searchResults: YouTubeSearchItem[];
  isSearching: boolean;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSelectResult: (video: YouTubeSearchItem) => void;
}

export function SearchBar({
  videoLink,
  searchResults,
  isSearching,
  loading,
  onChange,
  onSubmit,
  onSelectResult,
}: SearchBarProps) {
  const [activeIndex, setActiveIndex] = useState(-1);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next =
          e.key === 'ArrowDown'
            ? Math.min(prev + 1, searchResults.length - 1)
            : Math.max(prev - 1, 0);
        return next;
      });
      return;
    }
    if (e.key === 'Enter') {
      if (searchResults.length > 0 && activeIndex >= 0) {
        e.preventDefault();
        onSelectResult(searchResults[activeIndex]);
        setActiveIndex(-1);
        return;
      }
      if (!loading) onSubmit(e);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Input
          value={videoLink}
          onChange={(e) => {
            onChange(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder="Paste Link or Type Song Name"
          className="w-full h-12 bg-gray-900 border-gray-800 text-white rounded-xl pr-10"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}

        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute z-50 left-0 right-0 mt-2 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-52 sm:max-h-72 md:max-h-80 overflow-y-auto custom-scrollbar"
            >
              {searchResults.map((video, index) => {
                const thumbUrl = video.thumbnail?.thumbnails?.[0]?.url;
                return (
                  <button
                    key={video.id}
                    onClick={() => onSelectResult(video)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full flex items-center gap-3 p-3 transition-colors text-left border-b border-gray-800 last:border-0 ${
                      index === activeIndex ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="relative w-16 h-10 flex-shrink-0">
                      {thumbUrl ? (
                        <Image
                          src={thumbUrl}
                          alt=""
                          fill
                          sizes="64px"
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 rounded" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{video.title}</p>
                      <p className="text-xs text-gray-400 truncate">{video.channelTitle}</p>
                    </div>
                    <Plus className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Button
        onClick={onSubmit}
        disabled={loading}
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 font-bold rounded-xl"
      >
        {loading ? 'Adding...' : 'Add to Queue'}
      </Button>
      {videoLink && videoLink.match(YT_REGEX) && !loading && (
        <div className="rounded-xl overflow-hidden border border-gray-800">
          <LiteYouTubeEmbed title="Youtube Video Preview" id={videoLink.match(YT_REGEX)![1]} />
        </div>
      )}
    </div>
  );
}
