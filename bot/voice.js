import { spawn } from 'node:child_process';
import { EmbedBuilder } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} from '@discordjs/voice';

const API_BASE = process.env.ECHODECK_API_BASE || 'http://app:3002';
const BOT_INTERNAL_SECRET = process.env.BOT_INTERNAL_SECRET;

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

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

function markStreamsPlayed(streamIds) {
  if (!streamIds?.length) return;
  log(`[db] marking played: [${streamIds.join(', ')}]`);
  fetch(`${API_BASE}/api/bot/streams`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-bot-secret': BOT_INTERNAL_SECRET },
    body: JSON.stringify({ streamIds }),
  }).catch((err) => console.error('markStreamsPlayed error:', err));
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

function extractVideoId(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Spawn yt-dlp piped directly into ffmpeg — no URL resolution, no expiry issues.
function spawnPipeline(videoId) {
  const ytdlpArgs = [
    `https://www.youtube.com/watch?v=${videoId}`,
    '--format', 'bestaudio[channels<=2]/bestaudio',
    '--no-cache-dir',
    '-o', '-',
    '--quiet',
    '--no-check-certificate',
    '--js-runtimes', 'node',
    '--extractor-args', 'youtube:player_client=web_embedded',
    '--retries', '2',
    '--fragment-retries', '2',
  ];
  if (process.env.YTDLP_COOKIES_FILE) {
    ytdlpArgs.push('--cookies', process.env.YTDLP_COOKIES_FILE);
  }
  const ytdlp = spawn('yt-dlp', ytdlpArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

  ytdlp.stderr?.on('data', (chunk) => {
    const msg = chunk.toString().trimEnd();
    if (msg) console.error('[yt-dlp]', msg);
  });

  const ffmpeg = spawn('ffmpeg', [
    '-i', 'pipe:0',
    '-vn',
    '-ac', '2',
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-f', 'ogg',
    'pipe:1',
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  ffmpeg.stderr?.on('data', (chunk) => {
    const msg = chunk.toString();
    if (/error|invalid|403|404|fail/i.test(msg)) {
      console.error('[ffmpeg]', msg.trimEnd());
    }
  });

  // Suppress EPIPE: when ffmpeg exits before yt-dlp finishes writing, Node.js
  // would otherwise throw an unhandled error and crash the process.
  ffmpeg.stdin.on('error', (err) => {
    if (err.code !== 'EPIPE') console.error('[pipeline] stdin error:', err);
  });

  ytdlp.stdout.pipe(ffmpeg.stdin);
  // If yt-dlp exits with an error, close ffmpeg's stdin so it doesn't hang.
  ytdlp.on('exit', (code) => { if (code !== 0) ffmpeg.stdin.end(); });

  return { ffmpeg, ytdlp };
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
      log(`[play] queue exhausted (cursor=${session.cursor}, total=${session.queue.length})`);
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

  log(`[play] starting "${current.title || 'Untitled'}" (videoId: ${extractVideoId(current.url) || 'unknown'}) [${session.cursor}/${session.queue.length}]`);

  // Keep DB count in sync so the queue-full check reflects consumed tracks.
  if (session.isBotOwned && current.streamId) {
    markStreamsPlayed([current.streamId]);
  }

  const videoId = extractVideoId(current.url);
  if (!videoId) {
    await playNext(session)
      .catch((e) => { console.error('Voice playback error:', e); })
      .finally(() => { session.advancing = false; });
    return;
  }

  const { ffmpeg, ytdlp } = spawnPipeline(videoId);
  log(`[play] pipeline started for ${videoId}`);

  // Attached synchronously before the processes are stored in session state.
  // spawn() does not throw for a bad binary — errors surface asynchronously
  // as 'error' events. An unhandled 'error' on a ChildProcess is fatal to the
  // Node process by default, so we must attach this handler immediately.
  ffmpeg.on('error', (err) => {
    console.error(`ffmpeg spawn/runtime error for videoId ${videoId}:`, err);

    // Stale-event guard: if another track has already started, ignore.
    if (session.advancing || session.stopped || session.ffmpeg !== ffmpeg) return;
    session.advancing = true;
    session.ytdlp?.kill('SIGKILL');
    session.ytdlp = null;

    session.consecutiveFailures = (session.consecutiveFailures || 0) + 1;
    session.textChannel?.send(`⚠️ Playback error, skipping: ${current.title || 'Untitled'}`);

    if (session.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      session.textChannel?.send('❌ Too many unplayable tracks, stopping.');
      stop(session.guildId);
      return;
    }

    playNext(session)
      .catch((e) => { console.error('Voice playback error:', e); })
      .finally(() => { session.advancing = false; });
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0 && !session.stopped && session.ffmpeg === ffmpeg) {
      console.error(`[ffmpeg] exited code ${code} for "${current.title || 'Untitled'}" (${videoId})`);
    }
  });

  session.ffmpeg = ffmpeg;
  session.ytdlp = ytdlp;

  const resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.OggOpus });
  session.player.play(resource);

  announceNowPlaying(session, current);
}

// Sent on every track transition: current track plus the next up to 5
// upcoming tracks, mirroring !nowplaying + !queue.
function announceNowPlaying(session, current) {
  if (!session.textChannel) return;
  const upcoming = session.queue.slice(session.cursor, session.cursor + 5);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎵 Now Playing')
    .setDescription(current.title || 'Untitled')
    .setThumbnail(current.thumbnail || null);
  if (upcoming.length) {
    embed.addFields({
      name: 'Up Next',
      value: upcoming.map((t, i) => `${i + 1}. ${t.title || 'Untitled'}`).join('\n'),
    });
  }
  session.textChannel.send({ embeds: [embed] }).catch(() => {});
}

export async function joinAndPlay(voiceChannel, username, textChannel, { isBotOwned = false, initialQueue = null } = {}) {
  const guildId = voiceChannel.guild.id;

  const existing = sessions.get(guildId);
  if (existing) {
    // Reusing the existing, already-ready connection avoids a destroy/rejoin
    // race on the same guild's voice gateway (which surfaced as a false
    // "AbortError: The operation was aborted" from entersState below, even
    // though playback was still audible).
    const reusable =
      existing.connection.joinConfig.channelId === voiceChannel.id &&
      existing.connection.state.status === VoiceConnectionStatus.Ready;

    if (reusable) {
      existing.stopped = true;
      existing.player.stop();
      existing.ffmpeg?.kill('SIGKILL');
      if (existing.emptyChannelTimer) {
        clearTimeout(existing.emptyChannelTimer);
        existing.emptyChannelTimer = null;
      }
      sessions.delete(guildId);

      const queue = initialQueue ?? await fetchQueue(username);
      if (!queue.length) {
        throw new Error('Queue is empty — nothing to play');
      }

      const session = {
        guildId,
        username,
        connection: existing.connection,
        player: existing.player,
        queue,
        cursor: 0,
        ffmpeg: null,
        ytdlp: null,
        textChannel,
        consecutiveFailures: 0,
        advancing: false,
        stopped: false,
        isBotOwned,
        emptyChannelTimer: null,
      };
      sessions.set(guildId, session);
      attachPlayerListeners(session);
      await playNext(session);
      return session;
    }

    await stopAndAwaitTeardown(guildId);
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
    if (connection.state.status !== VoiceConnectionStatus.Ready) {
      connection.destroy();
      throw err;
    }
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
    ytdlp: null,
    textChannel,
    consecutiveFailures: 0,
    advancing: false,
    stopped: false,
    isBotOwned,
    emptyChannelTimer: null,
  };
  sessions.set(guildId, session);
  attachPlayerListeners(session);

  await playNext(session);
  return session;
}

function attachPlayerListeners(session) {
  const { player } = session;
  player.on(AudioPlayerStatus.Idle, () => {
    if (session.advancing || session.stopped) return;
    const finishedTrack = session.queue[session.cursor - 1];
    if (finishedTrack) finishedTrack.finished = true;
    session.advancing = true;
    playNext(session)
      .catch((err) => { console.error('Voice playback error:', err); })
      .finally(() => { session.advancing = false; });
  });
  player.on('error', (err) => {
    console.error('Audio player error:', err);
    if (session.advancing || session.stopped) return;
    session.advancing = true;
    playNext(session)
      .catch((e) => { console.error('Voice playback error:', e); })
      .finally(() => { session.advancing = false; });
  });
  player.on(AudioPlayerStatus.Playing, () => {
    session.consecutiveFailures = 0;
  });
}

async function stopAndAwaitTeardown(guildId) {
  const session = sessions.get(guildId);
  if (!session) return false;

  if (session.emptyChannelTimer) {
    clearTimeout(session.emptyChannelTimer);
    session.emptyChannelTimer = null;
  }

  session.stopped = true;
  session.player.stop();
  session.ffmpeg?.kill('SIGKILL');
  session.ytdlp?.kill('SIGKILL');
  const { connection } = session;
  connection.destroy();
  sessions.delete(guildId);

  try {
    await entersState(connection, VoiceConnectionStatus.Destroyed, 5_000);
  } catch {
    // Best-effort — proceed even if we didn't observe the Destroyed state in time.
  }

  if (session.isBotOwned) {
    endBotStream();
  }

  return true;
}

export function stop(guildId) {
  const session = sessions.get(guildId);
  if (!session) return false;
  log(`[stop] stopping session for guild ${guildId} (cursor=${session.cursor}, total=${session.queue.length})`);

  if (session.emptyChannelTimer) {
    clearTimeout(session.emptyChannelTimer);
    session.emptyChannelTimer = null;
  }

  session.stopped = true;
  session.player.stop();
  session.ffmpeg?.kill('SIGKILL');
  session.ytdlp?.kill('SIGKILL');
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

  log(`[skip] skip ${n} — cursor ${session.cursor} → ${Math.min(session.cursor + n - 1, session.queue.length)}, queue total ${session.queue.length}`);

  if (n > 1) {
    // Mark the songs being jumped over as played (the currently-playing song
    // is marked by playNext when it started; only the in-between ones need it).
    const skippedIds = session.queue
      .slice(session.cursor, session.cursor + n - 1)
      .map((t) => t.streamId)
      .filter(Boolean);
    if (session.isBotOwned && skippedIds.length) markStreamsPlayed(skippedIds);
    session.cursor = Math.min(session.cursor + n - 1, session.queue.length);
  }

  session.advancing = true;
  session.ffmpeg?.kill('SIGKILL');
  session.ytdlp?.kill('SIGKILL');
  session.player.stop(); // Idle listener is blocked by advancing=true

  playNext(session)
    .catch((e) => { console.error('Skip error:', e); })
    .finally(() => { session.advancing = false; });

  return true;
}

// Remove all upcoming tracks from the queue without stopping the current song.
export function clearQueue(guildId) {
  const session = sessions.get(guildId);
  if (!session || session.stopped) return false;
  const removed = session.queue.length - session.cursor;
  session.queue.splice(session.cursor);
  log(`[queue] cleared ${removed} upcoming track(s)`);
  if (session.isBotOwned) {
    // Delete remaining unplayed DB rows (currently playing is already marked played).
    fetch(`${API_BASE}/api/bot/streams`, {
      method: 'DELETE',
      headers: { 'x-bot-secret': BOT_INTERNAL_SECRET },
    }).catch((err) => console.error('clearQueue DB cleanup error:', err));
  }
  return removed;
}

// Append tracks to the in-memory queue of an active session.
// tracks: array of { title, url, thumbnail } (same shape fetchQueue returns).
export function appendToQueue(guildId, tracks) {
  const session = sessions.get(guildId);
  if (!session || !tracks?.length) return false;
  session.queue.push(...tracks);
  log(`[queue] append ${tracks.length} track(s) → queue now ${session.cursor}/${session.queue.length}`);
  cancelEmptyChannelGrace(guildId);
  // If the queue was exhausted and the player is idle, restart playback immediately.
  if (
    !session.advancing &&
    !session.stopped &&
    session.player.state.status === AudioPlayerStatus.Idle &&
    session.cursor < session.queue.length
  ) {
    session.advancing = true;
    playNext(session)
      .catch((e) => { console.error('appendToQueue auto-resume error:', e); })
      .finally(() => { session.advancing = false; });
  }
  return true;
}

// Insert tracks so they play immediately after the current track, ahead of
// the rest of the queue. tracks: same shape as appendToQueue.
export function insertNext(guildId, tracks) {
  const session = sessions.get(guildId);
  if (!session || !tracks?.length) return false;
  session.queue.splice(session.cursor, 0, ...tracks);
  log(`[queue] insertNext ${tracks.length} track(s) at cursor ${session.cursor} → total ${session.queue.length}`);
  cancelEmptyChannelGrace(guildId);
  if (
    !session.advancing &&
    !session.stopped &&
    session.player.state.status === AudioPlayerStatus.Idle &&
    session.cursor < session.queue.length
  ) {
    session.advancing = true;
    playNext(session)
      .catch((e) => { console.error('insertNext auto-resume error:', e); })
      .finally(() => { session.advancing = false; });
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

// Drop all upcoming (unplayed) tracks, leaving the currently playing track
// and the session/connection untouched.
export function clearQueue(guildId) {
  const session = sessions.get(guildId);
  if (!session) return false;
  session.queue.length = session.cursor;
  return true;
}

// Disconnect from voice in this guild even if there's no tracked session —
// covers a stray/orphaned connection (e.g. joined but session state was lost).
export function forceDisconnect(guildId) {
  if (stop(guildId)) return true;
  const connection = getVoiceConnection(guildId);
  if (!connection) return false;
  connection.destroy();
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
