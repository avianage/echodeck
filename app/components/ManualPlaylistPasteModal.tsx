import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, X, Loader2, ListMusic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'react-toastify';
import { useModalA11y } from '@/app/lib/useModalA11y';

interface SavedPlaylist {
  id: string;
  name: string;
  _count: { tracks: number };
}

interface ManualPlaylistPasteModalProps {
  isOpen: boolean;
  creatorId?: string;
  initialMode?: 'queue' | 'playlist' | 'saved';
  onClose: () => void;
  onResolved: (result: { title: string; videos: unknown[] }) => void;
  onAdded?: () => void;
}

export function ManualPlaylistPasteModal({
  isOpen,
  creatorId,
  initialMode = 'queue',
  onClose,
  onResolved,
  onAdded,
}: ManualPlaylistPasteModalProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'queue' | 'playlist' | 'saved'>('queue');
  const [playlistName, setPlaylistName] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const containerRef = useModalA11y(isOpen, onClose);

  // Re-apply the caller's requested starting tab each time the modal opens —
  // e.g. the "Add from Playlist" button next to "Add to Queue" opens
  // straight into the saved-playlists tab, while a Spotify-import failure
  // opens into the paste tab.
  useEffect(() => {
    if (isOpen) setMode(initialMode);
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (mode !== 'saved' || !isOpen) return;
    fetch('/api/playlists')
      .then((res) => (res.ok ? res.json() : { playlists: [] }))
      .then((data) => setSavedPlaylists(data.playlists || []))
      .catch(() => {});
  }, [mode, isOpen]);

  const getManualTracks = () =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const handleResolve = async () => {
    const manualTracks = getManualTracks();
    if (!manualTracks.length) return;

    setIsResolving(true);
    try {
      const res = await fetch('/api/streams/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualTracks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to resolve tracks');

      onResolved(data);
      setText('');
    } catch {
      // Parent surfaces the toast; nothing further to do here.
    } finally {
      setIsResolving(false);
    }
  };

  const handleSaveAsPlaylist = async () => {
    const manualTracks = getManualTracks();
    const name = playlistName.trim();
    if (!manualTracks.length || !name) return;

    setIsResolving(true);
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, manualTracks }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to create playlist');
        return;
      }
      toast.success(`Playlist "${name}" saved with ${data.playlist?._count?.tracks ?? manualTracks.length} tracks`);
      setText('');
      setPlaylistName('');
      onClose();
    } catch {
      toast.error('Error saving playlist');
    } finally {
      setIsResolving(false);
    }
  };

  const handleAddSavedPlaylist = async (id: string) => {
    setAddingId(id);
    try {
      const query = creatorId ? `?creatorId=${creatorId}` : '';
      const res = await fetch(`/api/playlists/${id}/add-to-queue${query}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to add playlist to queue');
        return;
      }
      toast.success(`Added ${data.trackCount} tracks to the queue`);
      onAdded?.();
      onClose();
    } catch {
      toast.error('Error adding playlist to queue');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-gray-900 border border-gray-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" /> Paste Songs
                </h2>
                <p className="text-sm text-gray-400">
                  One song per line — name, YouTube link, or Spotify track link
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-full text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-1 p-1 bg-white/5 border border-gray-800 rounded-xl w-fit flex-wrap">
                <button
                  onClick={() => setMode('queue')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    mode === 'queue' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  Add to Queue Now
                </button>
                <button
                  onClick={() => setMode('playlist')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    mode === 'playlist' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  Save as Playlist
                </button>
                <button
                  onClick={() => setMode('saved')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    mode === 'saved' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  From Saved Playlist
                </button>
              </div>

              {mode === 'saved' ? (
                <div className="space-y-2">
                  {savedPlaylists.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No saved playlists yet — create one from the other tabs.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                      {savedPlaylists.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white/5"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <ListMusic className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-gray-200 truncate">{p.name}</p>
                              <p className="text-[10px] text-gray-500">{p._count.tracks} tracks</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={addingId === p.id}
                            onClick={() => handleAddSavedPlaylist(p.id)}
                            className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 flex-shrink-0 text-xs"
                          >
                            {addingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add to Queue'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={'Blinding Lights - The Weeknd\nAs It Was - Harry Styles'}
                    rows={8}
                    className="w-full bg-white/5 border border-gray-800 rounded-xl p-3 text-white text-sm resize-none focus:outline-none focus:border-blue-600"
                  />

                  {mode === 'queue' ? (
                    <Button
                      onClick={handleResolve}
                      disabled={isResolving || !text.trim()}
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700 font-bold rounded-xl"
                    >
                      {isResolving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Resolve & Add'}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={playlistName}
                        onChange={(e) => setPlaylistName(e.target.value)}
                        placeholder="Playlist name..."
                        className="h-11 bg-white/5 border-gray-800 rounded-xl"
                      />
                      <Button
                        onClick={handleSaveAsPlaylist}
                        disabled={isResolving || !text.trim() || !playlistName.trim()}
                        className="w-full h-11 bg-blue-600 hover:bg-blue-700 font-bold rounded-xl"
                      >
                        {isResolving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Playlist'}
                      </Button>
                      <p className="text-xs text-gray-500 text-center">
                        Saved playlists are reusable across streams — find them in Saved Playlists.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
