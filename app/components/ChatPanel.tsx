'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Trash2, MessageCircle, Pin, PinOff, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'react-toastify';

interface ChatUser {
  id: string;
  username: string | null;
  displayName: string | null;
  image: string | null;
}

interface ChatMessage {
  id: string;
  message: string;
  createdAt: string;
  user: ChatUser;
}

interface ChatPanelProps {
  creatorId: string;
  currentUserId: string | null;
  canModerate: boolean;
}

const MAX_MESSAGES = 200;

// Self-contained: opens its own connection to the same SSE endpoint used for
// playback sync (app/api/streams/[streamId]/events) and only reacts to
// `type: 'chat'` / `type: 'chat_deleted'` / `type: 'chat_pinned'` /
// `type: 'slow_mode_changed'` messages, so it doesn't interfere with
// StreamView's playback drift-correction logic on the same channel.
export function ChatPanel({ creatorId, currentUserId, canModerate }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null);
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 1000;

    fetch(`/api/streams/chat?creatorId=${creatorId}`)
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data) => {
        if (cancelled) return;
        setMessages((data.messages || []).slice(-MAX_MESSAGES));
        setPinnedMessage(data.pinnedMessage || null);
        setSlowModeSeconds(data.slowModeSeconds || 0);
      })
      .catch(() => {});

    const connect = () => {
      if (cancelled) return;
      es = new EventSource(`/api/streams/${creatorId}/events`);

      es.onopen = () => {
        reconnectDelay = 1000;
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chat' && data.message) {
            setMessages((prev) => [...prev, data.message].slice(-MAX_MESSAGES));
          } else if (data.type === 'chat_deleted' && data.id) {
            setMessages((prev) => prev.filter((m) => m.id !== data.id));
          } else if (data.type === 'chat_pinned') {
            setPinnedMessage(data.message || null);
          } else if (data.type === 'slow_mode_changed') {
            setSlowModeSeconds(data.slowModeSeconds || 0);
          }
        } catch {
          // ignore malformed events (e.g. keepalive comments)
        }
      };

      es.onerror = () => {
        es?.close();
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      };
    };
    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [creatorId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Live countdown for the local send cooldown while slow mode is active.
  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownLeft(left);
      if (left <= 0) setCooldownUntil(null);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || cooldownLeft > 0) return;
    setSending(true);
    try {
      const res = await fetch('/api/streams/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, message: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || 'Failed to send message');
        return;
      }
      setInput('');
      if (slowModeSeconds > 0 && !canModerate) {
        setCooldownUntil(Date.now() + slowModeSeconds * 1000);
      }
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (id: string) => {
    const res = await fetch(`/api/streams/chat/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Failed to delete message');
    }
  };

  const togglePin = async (message: ChatMessage, pinned: boolean) => {
    const res = await fetch(`/api/streams/chat/${message.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned }),
    });
    if (!res.ok) {
      toast.error(pinned ? 'Failed to pin message' : 'Failed to unpin message');
    }
  };

  if (!currentUserId) return null;

  const isOnCooldown = cooldownLeft > 0 && !canModerate;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <MessageCircle className="w-5 h-5" /> Chat
        {slowModeSeconds > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-1">
            <Timer className="w-3 h-3" /> Slow mode: {slowModeSeconds}s
          </span>
        )}
      </h2>
      <Card className="bg-white/[0.02] border-white/5 rounded-3xl overflow-hidden">
        <CardContent className="p-4 flex flex-col h-[400px]">
          {pinnedMessage && (
            <div className="flex items-start gap-2 text-xs bg-accent/5 border border-accent/20 rounded-xl px-3 py-2 mb-2">
              <Pin className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-accent">
                  {pinnedMessage.user.displayName || pinnedMessage.user.username || 'User'}:
                </span>{' '}
                <span className="text-gray-300 break-words">{pinnedMessage.message}</span>
              </div>
              {canModerate && (
                <button
                  onClick={() => togglePin(pinnedMessage, false)}
                  className="text-gray-500 hover:text-red-400 flex-shrink-0"
                  aria-label="Unpin message"
                >
                  <PinOff className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
            {messages.length === 0 ? (
              <p className="text-sm text-gray-500 text-center pt-8">No messages yet — say hi!</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="group flex items-start gap-2 text-sm">
                  <span className="font-semibold text-accent flex-shrink-0">
                    {m.user.displayName || m.user.username || 'User'}:
                  </span>
                  <span className="text-gray-200 break-words flex-1">{m.message}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canModerate && m.id !== pinnedMessage?.id && (
                      <button
                        onClick={() => togglePin(m, true)}
                        className="text-gray-500 hover:text-accent"
                        aria-label="Pin message"
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {(canModerate || m.user.id === currentUserId) && (
                      <button
                        onClick={() => deleteMessage(m.id)}
                        className="text-gray-500 hover:text-red-500"
                        aria-label="Delete message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
          <div className="flex items-center gap-2 pt-3 mt-3 border-t border-white/5">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendMessage();
              }}
              placeholder={isOnCooldown ? `Wait ${cooldownLeft}s...` : 'Say something...'}
              disabled={isOnCooldown}
              maxLength={500}
              className="h-10 bg-white/5 border-white/10 rounded-xl disabled:opacity-60"
            />
            <Button
              onClick={sendMessage}
              disabled={sending || !input.trim() || isOnCooldown}
              size="sm"
              className="h-10 w-10 p-0 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-60"
            >
              {isOnCooldown ? (
                <span className="text-[10px] font-black">{cooldownLeft}</span>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
