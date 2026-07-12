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
  return spawn('ffmpeg', [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', sourceUrl,
    '-f', 'opus',
    '-ar', '48000',
    '-ac', '2',
    'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'ignore'] });
}

const MAX_CONSECUTIVE_FAILURES = 5;

async function playNext(session) {
  if (session.stopped) return;
  const track = session.queue[session.cursor];
  if (!track) {
    // Reached the end of the snapshot — refresh from the live queue and
    // keep going if new tracks showed up, otherwise idle in the channel.
    session.queue = await fetchQueue(session.username);
    session.cursor = 0;
    if (!session.queue.length) return;
  }

  const current = session.queue[session.cursor];
  session.cursor += 1;

  const videoId = extractVideoId(current.url);
  if (!videoId) {
    await playNext(session);
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

    await playNext(session).catch((e) => console.error('Voice playback error:', e));
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

    // Guards against a double-skip: @discordjs/voice's AudioPlayer listens
    // for errors on the resource's underlying stream (ffmpeg.stdout here)
    // and can independently emit its own 'error' (or transition to Idle) for
    // the exact same dead process this handler is reacting to — without
    // this flag, both this handler and the player's own Idle/error
    // listeners below could each call playNext for the same failure.
    if (session.advancing || session.stopped) return;
    session.advancing = true;

    session.consecutiveFailures = (session.consecutiveFailures || 0) + 1;
    session.textChannel?.send(`⚠️ Playback error, skipping: ${current.title || 'Untitled'}`);

    if (session.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      session.textChannel?.send('❌ Too many unplayable tracks, stopping.');
      stop(session.guildId);
      return;
    }

    playNext(session)
      .catch((e) => console.error('Voice playback error:', e))
      .finally(() => {
        session.advancing = false;
      });
  });

  session.ffmpeg = ffmpeg;

  const resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.Opus });
  session.player.play(resource);
}

export async function joinAndPlay(voiceChannel, username, textChannel, { isBotOwned = false } = {}) {
  const guildId = voiceChannel.guild.id;

  const existing = sessions.get(guildId);
  if (existing) {
    stop(guildId);
  }

  const queue = await fetchQueue(username);
  if (!queue.length) {
    throw new Error('Queue is empty — nothing to play');
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 10_000);

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

  // Guarded by session.advancing — see the comment on the ffmpeg 'error'
  // listener inside playNext for why: these can otherwise double-fire
  // alongside that handler for the same dead resource.
  player.on(AudioPlayerStatus.Idle, () => {
    if (session.advancing || session.stopped) return;
    session.advancing = true;
    playNext(session)
      .catch((err) => console.error('Voice playback error:', err))
      .finally(() => {
        session.advancing = false;
      });
  });
  player.on('error', (err) => {
    console.error('Audio player error:', err);
    if (session.advancing || session.stopped) return;
    session.advancing = true;
    playNext(session)
      .catch((e) => console.error('Voice playback error:', e))
      .finally(() => {
        session.advancing = false;
      });
  });
  player.on(AudioPlayerStatus.Playing, () => {
    session.consecutiveFailures = 0;
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

export function isPlaying(guildId) {
  return sessions.has(guildId);
}
