'use client';

import { useEffect, useState } from 'react';
import { ListMusic, Play, Trash2, Save } from 'lucide-react';
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
  onLoaded?: () => void;
}

// "Saved/swappable queues": a creator can save the current live queue as a
// named playlist, then later load a different saved playlist to replace it.
// One live queue at a time — this is not concurrent multi-streaming.
// Scoped to the signed-in user via session on the API side, so no creatorId
// prop is needed here (only the creator themselves can reach this panel).
export function SavedPlaylistsPanel({ onLoaded }: SavedPlaylistsPanelProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [name, setName] = useState('');
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
                      onClick={() => setConfirmAction({ type: 'load', id: p.id })}
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
