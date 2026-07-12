'use client';

import { useEffect, useState } from 'react';
import { ListMusic, Play, Trash2, Save, ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'react-toastify';
import { ConfirmDialog } from './ConfirmDialog';

interface Playlist {
  id: string;
  name: string;
  updatedAt: string;
  _count: { tracks: number };
}

interface SavedPlaylistsPanelProps {
  creatorId?: string;
  onLoaded?: () => void;
}

// "Saved/swappable queues": a creator can save the current live queue as a
// named playlist, then later load a different saved playlist to replace it.
// Also supports creating a playlist directly from pasted song names/links —
// the workaround for Spotify blocking full playlist-track access (see
// app/lib/playlistResolve.ts's resolveMixedTrackLines).
// Scoped to the signed-in user's own playlists via session on the API side.
// creatorId is only used for the "Add to Queue" action, so a moderator
// managing someone else's room adds to that room's queue, not their own.
export function SavedPlaylistsPanel({ creatorId, onLoaded }: SavedPlaylistsPanelProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [mode, setMode] = useState<'save-queue' | 'create'>('save-queue');
  const [name, setName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    { type: 'load' | 'delete'; id: string } | null
  >(null);

  const refresh = () => {
    fetch('/api/playlists')
      .then((res) => (res.ok ? res.json() : { playlists: [] }))
      .then((data) => setPlaylists(data.playlists || []))
      .catch(() => {});
  };

  useEffect(() => {
    refresh();
  }, []);

  const saveCurrentQueue = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to save playlist');
        return;
      }
      toast.success('Playlist saved');
      setName('');
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const createFromPaste = async () => {
    const trimmedName = name.trim();
    const manualTracks = pasteText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!trimmedName || manualTracks.length === 0) return;

    setBusy(true);
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, manualTracks }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to create playlist');
        return;
      }
      toast.success(`Playlist created with ${data.playlist?._count?.tracks ?? manualTracks.length} tracks`);
      setName('');
      setPasteText('');
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const loadPlaylist = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/playlists/${id}/load`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to load playlist');
        return;
      }
      toast.success(`Loaded ${data.trackCount} tracks`);
      onLoaded?.();
    } finally {
      setBusy(false);
    }
  };

  const addToQueue = async (id: string) => {
    setBusy(true);
    try {
      const query = creatorId ? `?creatorId=${creatorId}` : '';
      const res = await fetch(`/api/playlists/${id}/add-to-queue${query}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to add playlist to queue');
        return;
      }
      toast.success(`Added ${data.trackCount} tracks to the queue`);
      onLoaded?.();
    } finally {
      setBusy(false);
    }
  };

  const deletePlaylist = async (id: string) => {
    const res = await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
    } else {
      toast.error('Failed to delete playlist');
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    setConfirmAction(null);
    if (type === 'load') await loadPlaylist(id);
    else await deletePlaylist(id);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent/10 rounded-xl border border-accent/20">
          <ListMusic className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="text-xl font-black tracking-tighter uppercase italic">
            Saved Playlists
          </h3>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
            Save &amp; Swap Queues
          </p>
        </div>
      </div>

      <Card className="bg-white/[0.02] border-white/5 rounded-3xl overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-xl w-fit">
            <button
              onClick={() => setMode('save-queue')}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                mode === 'save-queue' ? 'bg-accent/10 text-accent' : 'text-gray-500 hover:text-white'
              }`}
            >
              Save Current Queue
            </button>
            <button
              onClick={() => setMode('create')}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                mode === 'create' ? 'bg-accent/10 text-accent' : 'text-gray-500 hover:text-white'
              }`}
            >
              Create From Songs
            </button>
          </div>

          {mode === 'save-queue' ? (
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name this queue..."
                className="h-10 bg-white/5 border-white/10 rounded-xl"
              />
              <Button
                onClick={saveCurrentQueue}
                disabled={busy || !name.trim()}
                size="sm"
                className="h-10 rounded-xl bg-accent hover:bg-accent/90 flex-shrink-0"
              >
                <Save className="w-4 h-4 mr-1" /> Save
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Playlist name..."
                className="h-10 bg-white/5 border-white/10 rounded-xl"
              />
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'One song per line — name, YouTube link, or Spotify track link\nBlinding Lights - The Weeknd\nhttps://open.spotify.com/track/...'}
                rows={5}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm resize-none focus:outline-none focus:border-accent/50"
              />
              <Button
                onClick={createFromPaste}
                disabled={busy || !name.trim() || !pasteText.trim()}
                size="sm"
                className="w-full h-10 rounded-xl bg-accent hover:bg-accent/90"
              >
                <Save className="w-4 h-4 mr-1" /> Create Playlist
              </Button>
            </div>
          )}

          {playlists.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No saved playlists yet.</p>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
              {playlists.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-gray-200 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-500">{p._count.tracks} tracks</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => addToQueue(p.id)}
                      title="Add to Queue"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-emerald-400"
                    >
                      <ListPlus className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => setConfirmAction({ type: 'load', id: p.id })}
                      title="Load (replace queue)"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-accent"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmAction({ type: 'delete', id: p.id })}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={confirmAction !== null}
        title={confirmAction?.type === 'load' ? 'Replace live queue?' : 'Delete playlist?'}
        message={
          confirmAction?.type === 'load'
            ? 'This replaces your current live queue with this playlist.'
            : 'This saved playlist will be permanently deleted.'
        }
        confirmLabel={confirmAction?.type === 'load' ? 'Load' : 'Delete'}
        destructive={confirmAction?.type === 'delete'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
