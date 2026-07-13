import { spawn } from 'node:child_process';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';

const API_BASE = process.env.ECHODECK_API_BASE || 'http://app:3002';
const BOT_INTERNAL_SECRET = process.env.BOT_INTERNAL_SECRET;

// How long (ms) to wait after the voice channel empties before ending a bot-owned
// stream. Configurable via BOT_EMPTY_GRACE_SECONDS (default: 300 = 5 minutes).
const EMPTY_CHANNEL_GRACE_MS =
  parseInt(process.env.BOT_EMPTY_GRACE_SECONDS || '300', 10) * 1000;

// Per-guild playback state. The bot advances through the queue on its own
// timeline (see plan: "independent player, same queue") — it never mutates
// the web app's played/CurrentStream state, it only reads the queue snapshot.
const sessions = new Map();

async function fetchQueue(username) {
  const res = await fetch(`${API_BASE}/api/bot/queue?username=${encodeURIComponent(username)}`, {
    headers: { 'x-bot-secret': BOT_INTERNAL_SECRET },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'Failed to fetch queue');
  return body.queue;
}

async function endBotStream() {
  try {
    await fetch(`${API_BASE}/api/bot/streams`, {
      method: 'DELETE',
      headers: { 'x-bot-secret': BOT_INTERNAL_SECRET },
    });
  } catch (err) {
    console.error('Failed to call bot stream teardown endpoint:', err);
  }
}

async function resolveAudioUrl(videoId) {
  const res = await fetch(`${API_BASE}/api/bot/resolve?videoId=${encodeURIComponent(videoId)}`, {
    headers: { 'x-bot-secret': BOT_INTERNAL_SECRET },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'Failed to resolve audio URL');
  return body.url;
}

function extractVideoId(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function spawnFfmpegAudio(sourceUrl) {
  const proc = spawn('ffmpeg', [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', sourceUrl,
    '-vn',
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-f', 'ogg',
    'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  proc.stderr?.on('data', (chunk) => {
    const msg = chunk.toString();
    if (/error|invalid|403|404|fail/i.test(msg)) {
      console.error('[ffmpeg]', msg.trimEnd());
    }
  });

  return proc;
}

const MAX_CONSECUTIVE_FAILURES = 5;

async function playNext(session) {
  if (session.stopped) return;
  const track = session.queue[session.cursor];
  if (!track) {
    if (!session.isBotOwned) {
      // Human-joined session: refresh from the live web queue in case new
      // songs were added via the web app while the bot was playing.
      session.queue = await fetchQueue(session.username);
      session.cursor = 0;
      if (!session.queue.length) {
        session.advancing = false;
        return;
      }
    } else {
      // Bot-owned session: queue is managed entirely via appendToQueue —
      // never refetch (would replay already-played tracks since DB rows
      // are never marked played). Signal idle and wait for !play.
      session.textChannel
        ?.send('📭 Queue finished. Add more songs with `!play`, or I\'ll leave in 5 minutes.')
        .catch(() => {});
      startEmptyChannelGrace(session.guildId);
      session.advancing = false;
      return;
    }
  }

  // Cancel any pending idle/empty-channel timer since we're about to play.
  cancelEmptyChannelGrace(session.guildId);

  const current = session.queue[session.cursor];
  session.cursor += 1;

  const videoId = extractVideoId(current.url);
  if (!videoId) {
    await playNext(session).catch((e) => {
      console.error('Voice playback error:', e);
      session.advancing = false;
    });
    return;
  }

  let audioUrl;
  let ffmpeg;
  try {
    audioUrl = await resolveAudioUrl(videoId);
    ffmpeg = spawnFfmpegAudio(audioUrl);
  } catch (err) {
    console.error(
      `Failed to resolve/spawn track "${current.title || 'Untitled'}" (videoId: ${videoId}):`,
      err,
    );

    session.consecutiveFailures = (session.consecutiveFailures || 0) + 1;
    if (session.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      await session.textChannel
        ?.send('❌ Too many unplayable tracks, stopping.')
        .catch((e) => console.error('Failed to send stop message:', e));
      stop(session.guildId);
      return;
    }

    await session.textChannel
      ?.send(`⚠️ Skipping unavailable track: ${current.title || 'Untitled'}`)
      .catch((e) => console.error('Failed to send skip message:', e));

    await playNext(session).catch((e) => {
      console.error('Voice playback error:', e);
      session.advancing = false;
    });
    return;
  }

  // Attached synchronously, right after spawn() returns and before ffmpeg is
  // used anywhere else. spawn() does not throw for a bad binary/runtime
  // failure (e.g. ENOENT) — that surfaces asynchronously as an 'error' event
  // on the ChildProcess, and an unhandled 'error' event on a ChildProcess is
  // fatal to the whole Node process by default. This covers ANY ffmpeg
  // failure (missing binary, corrupt stream, permission error), not just the
  // resolve failures the try/catch above already handles.
  ffmpeg.on('error', (err) => {
    console.error(`ffmpeg spawn/runtime error for videoId ${videoId}:`, err);

    // Stale-event guard: after a track ends and the next one starts,
    // session.ffmpeg is updated to the new process. If the old process later
    // emits a late error (e.g. OS-level cleanup after SIGKILL), this check
    // prevents it from triggering a spurious playNext call that would skip
    // the track currently playing.
    if (session.advancing || session.stopped || session.ffmpeg !== ffmpeg) return;
    session.advancing = true;

    session.consecutiveFailures = (session.consecutiveFailures || 0) + 1;
    session.textChannel?.send(`⚠️ Playback error, skipping: ${current.title || 'Untitled'}`);

    if (session.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      session.textChannel?.send('❌ Too many unplayable tracks, stopping.');
      stop(session.guildId);
      return;
    }

    playNext(session).catch((e) => {
      console.error('Voice playback error:', e);
      session.advancing = false;
    });
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0 && !session.stopped && session.ffmpeg === ffmpeg) {
      console.error(`[ffmpeg] exited code ${code} for "${current.title || 'Untitled'}" (${videoId})`);
    }
  });

  session.ffmpeg = ffmpeg;

  const resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.OggOpus });
  session.player.play(resource);
}

export async function joinAndPlay(voiceChannel, username, textChannel, { isBotOwned = false, initialQueue = null } = {}) {
  const guildId = voiceChannel.guild.id;

  const existing = sessions.get(guildId);
  if (existing) {
    stop(guildId);
  }

  const queue = initialQueue ?? await fetchQueue(username);
  if (!queue.length) {
    throw new Error('Queue is empty — nothing to play');
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
  } catch (err) {
    connection.destroy();
    throw err;
  }

  const player = createAudioPlayer();
  connection.subscribe(player);

  const session = {
    guildId,
    username,
    connection,
    player,
    queue,
    cursor: 0,
    ffmpeg: null,
    textChannel,
    consecutiveFailures: 0,
    advancing: false,
    stopped: false,
    isBotOwned,
    emptyChannelTimer: null,
  };
  sessions.set(guildId, session);

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 30_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 30_000),
      ]);
    } catch {
      const s = sessions.get(guildId);
      s?.textChannel?.send('⚠️ Lost voice connection — stopping session.').catch(() => {});
      stop(guildId);
    }
  });

  // Guarded by session.advancing — see the comment on the ffmpeg 'error'
  // listener inside playNext for why: these can otherwise double-fire
  // alongside that handler for the same dead resource.
  player.on(AudioPlayerStatus.Idle, () => {
    if (session.advancing || session.stopped) return;
    session.advancing = true;
    playNext(session).catch((err) => {
      console.error('Voice playback error:', err);
      session.advancing = false;
    });
  });
  player.on('error', (err) => {
    console.error('Audio player error:', err);
    if (session.advancing || session.stopped) return;
    session.advancing = true;
    playNext(session).catch((e) => {
      console.error('Voice playback error:', e);
      session.advancing = false;
    });
  });
  // advancing is reset here rather than in .finally() so it stays true until
  // the player is confirmed in Playing state — prevents stale Idle events
  // (from player.stop() in skip() or a dying ffmpeg process) from firing
  // another playNext while the new track is still loading.
  player.on(AudioPlayerStatus.Playing, () => {
    session.consecutiveFailures = 0;
    session.advancing = false;
  });

  await playNext(session);
  return session;
}

export function stop(guildId) {
  const session = sessions.get(guildId);
  if (!session) return false;

  if (session.emptyChannelTimer) {
    clearTimeout(session.emptyChannelTimer);
    session.emptyChannelTimer = null;
  }

  session.stopped = true;
  session.player.stop();
  session.ffmpeg?.kill('SIGKILL');
  session.connection.destroy();
  sessions.delete(guildId);

  if (session.isBotOwned) {
    endBotStream();
  }

  return true;
}

export function isBotOwnedSession(guildId) {
  return sessions.get(guildId)?.isBotOwned === true;
}

// Starts (or resets) the grace-period timer for an empty voice channel.
// When the timer fires, the bot-owned session is torn down.
export function startEmptyChannelGrace(guildId) {
  const session = sessions.get(guildId);
  if (!session || !session.isBotOwned) return;

  if (session.emptyChannelTimer) {
    clearTimeout(session.emptyChannelTimer);
  }

  session.emptyChannelTimer = setTimeout(() => {
    session.emptyChannelTimer = null;
    session.textChannel
      ?.send('👋 Voice channel has been empty for a while — stopping playback.')
      .catch(() => {});
    stop(guildId);
  }, EMPTY_CHANNEL_GRACE_MS);
}

// Cancels the grace-period timer (call when someone rejoins the channel).
export function cancelEmptyChannelGrace(guildId) {
  const session = sessions.get(guildId);
  if (!session || !session.emptyChannelTimer) return;
  clearTimeout(session.emptyChannelTimer);
  session.emptyChannelTimer = null;
}

// Immediately advance n tracks in a bot-owned session (default: skip 1).
export function skip(guildId, n = 1) {
  const session = sessions.get(guildId);
  if (!session || session.stopped || session.advancing) return false;

  if (n > 1) {
    session.cursor = Math.min(session.cursor + n - 1, session.queue.length);
  }

  session.advancing = true;
  session.ffmpeg?.kill('SIGKILL');
  session.player.stop(); // Idle listener is blocked by advancing=true

  playNext(session).catch((e) => {
    console.error('Skip error:', e);
    session.advancing = false;
  });

  return true;
}

// Append tracks to the in-memory queue of an active session.
// tracks: array of { title, url, thumbnail } (same shape fetchQueue returns).
export function appendToQueue(guildId, tracks) {
  const session = sessions.get(guildId);
  if (!session || !tracks?.length) return false;
  session.queue.push(...tracks);
  cancelEmptyChannelGrace(guildId);
  // If the queue was exhausted and the player is idle, restart playback immediately.
  if (
    !session.advancing &&
    !session.stopped &&
    session.player.state.status === AudioPlayerStatus.Idle &&
    session.cursor < session.queue.length
  ) {
    session.advancing = true;
    playNext(session).catch((e) => {
      console.error('appendToQueue auto-resume error:', e);
      session.advancing = false;
    });
  }
  return true;
}

// Return the track currently playing (the one before the cursor).
export function getCurrentTrack(guildId) {
  const session = sessions.get(guildId);
  if (!session || session.cursor === 0) return null;
  return session.queue[session.cursor - 1] ?? null;
}

// Return upcoming tracks (from cursor onwards) for display.
export function getSessionQueue(guildId) {
  const session = sessions.get(guildId);
  if (!session) return null;
  return session.queue.slice(session.cursor);
}

// Move the 1-indexed upcoming track at position n to be the very next track.
// Position 1 = already next (no-op). Position 2 = second upcoming, etc.
export function bump(guildId, n) {
  const session = sessions.get(guildId);
  if (!session || n <= 1) return false;
  const target = session.cursor + n - 1;
  if (target >= session.queue.length) return false;
  const [track] = session.queue.splice(target, 1);
  session.queue.splice(session.cursor, 0, track);
  return true;
}

export function isPlaying(guildId) {
  return sessions.has(guildId);
}

// Pause the current track. Returns true if successfully paused, false if not
// playing or already paused.
export function pause(guildId) {
  const session = sessions.get(guildId);
  if (!session || session.stopped) return false;
  return session.player.pause();
}

// Resume a paused track. Returns true if successfully resumed, false if not
// paused.
export function resume(guildId) {
  const session = sessions.get(guildId);
  if (!session || session.stopped) return false;
  return session.player.unpause();
}
