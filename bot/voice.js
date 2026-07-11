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

// Per-guild playback state. The bot advances through the queue on its own
// timeline (see plan: "independent player, same queue") — it never mutates
// the web app's played/CurrentStream state, it only reads the queue snapshot.
const sessions = new Map();

async function fetchQueue(username) {
  const res = await fetch(`${API_BASE}/api/bot/queue?username=${encodeURIComponent(username)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'Failed to fetch queue');
  return body.queue;
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

async function playNext(session) {
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

  const audioUrl = await resolveAudioUrl(videoId);
  const ffmpeg = spawnFfmpegAudio(audioUrl);
  session.ffmpeg = ffmpeg;

  const resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.OggOpus });
  session.player.play(resource);
}

export async function joinAndPlay(voiceChannel, username) {
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

  const session = { username, connection, player, queue, cursor: 0, ffmpeg: null };
  sessions.set(guildId, session);

  player.on(AudioPlayerStatus.Idle, () => {
    playNext(session).catch((err) => console.error('Voice playback error:', err));
  });
  player.on('error', (err) => {
    console.error('Audio player error:', err);
    playNext(session).catch((e) => console.error('Voice playback error:', e));
  });

  await playNext(session);
  return session;
}

export function stop(guildId) {
  const session = sessions.get(guildId);
  if (!session) return false;

  session.player.stop();
  session.ffmpeg?.kill('SIGKILL');
  session.connection.destroy();
  sessions.delete(guildId);
  return true;
}

export function isPlaying(guildId) {
  return sessions.has(guildId);
}
