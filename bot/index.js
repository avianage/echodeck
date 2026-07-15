import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, EmbedBuilder } from 'discord.js';
import {
  joinAndPlay,
  stop,
  isPlaying,
  isBotOwnedSession,
  startEmptyChannelGrace,
  cancelEmptyChannelGrace,
  skip,
  appendToQueue,
  insertNext,
  forceDisconnect,
  getSessionQueue,
  getCurrentTrack,
  bump,
  pause,
  resume,
  clearQueue,
} from './voice.js';

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const API_BASE = process.env.ECHODECK_API_BASE || 'http://app:3002';
const COMMAND_PREFIX = process.env.BOT_COMMAND_PREFIX || '!';
const BOT_INTERNAL_SECRET = process.env.BOT_INTERNAL_SECRET;

if (!DISCORD_TOKEN) {
  throw new Error('DISCORD_BOT_TOKEN environment variable is required');
}

// Playlist URL detection (mirrors app/lib/utils.ts — can't import TS directly).
const YT_PLAYLIST_RE = /[&?]list=[a-zA-Z0-9_-]+/;
const SPOTIFY_PLAYLIST_RE = /open\.spotify\.com\/playlist\//;

// Must match MAX_QUEUE_LENGTH default in app/api/bot/streams/route.ts and playlists/route.ts.
const MAX_BOT_QUEUE = 200;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel],
});

async function fetchBotApi(path, username) {
  const url = `${API_BASE}${path}?username=${encodeURIComponent(username)}`;
  const res = await fetch(url, { headers: { 'x-bot-secret': BOT_INTERNAL_SECRET } });
  const body = await res.json();
  if (!res.ok) {
    return { ok: false, message: body.message || 'Something went wrong' };
  }
  return { ok: true, data: body };
}

function usageEmbed(command) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setDescription(`Usage: \`${COMMAND_PREFIX}${command} <echodeck-username>\``);
}

async function handleNowPlaying(message, guildId, username) {
  if (!username && isBotOwnedSession(guildId)) {
    const current = getCurrentTrack(guildId);
    if (!current) {
      await message.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('Nothing is playing right now.')] });
      return;
    }
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🎵 Now Playing')
      .setDescription(current.title || 'Untitled')
      .setThumbnail(current.thumbnail || null);
    await message.reply({ embeds: [embed] });
    return;
  }
  const result = await fetchBotApi('/api/bot/nowplaying', username);
  if (!result.ok) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(result.message)] });
    return;
  }
  const { title, genre, thumbnail, displayName } = result.data;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🎵 Now playing for ${displayName || username}`)
    .setDescription(title || 'Untitled')
    .setThumbnail(thumbnail || null);
  if (genre) embed.addFields({ name: 'Genre', value: genre, inline: true });
  await message.reply({ embeds: [embed] });
}

async function handleQueue(message, guildId, username) {
  // If no username and a bot session is active, show the in-memory queue.
  if (!username && isBotOwnedSession(guildId)) {
    const current = getCurrentTrack(guildId);
    const tracks = getSessionQueue(guildId) || [];
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('📜 Queue');
    const lines = [];
    if (current) lines.push(`▶️ **Now:** ${current.title || 'Untitled'}`);
    if (tracks.length) {
      lines.push(...tracks.slice(0, 10).map((t, i) => `${i + 1}. **${t.title || 'Untitled'}**`));
      if (tracks.length > 10) lines.push(`…and ${tracks.length - 10} more`);
    } else if (!current) {
      lines.push('Queue is empty.');
    }
    embed.setDescription(lines.join('\n'));
    await message.reply({ embeds: [embed] });
    return;
  }

  if (!username) {
    await message.reply({ embeds: [usageEmbed('queue')] });
    return;
  }

  const result = await fetchBotApi('/api/bot/queue', username);
  if (!result.ok) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(result.message)] });
    return;
  }
  const { queue } = result.data;
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`📜 Queue for ${username}`);
  if (!queue.length) {
    embed.setDescription('Queue is empty.');
  } else {
    embed.setDescription(
      queue.map((s, i) => `${i + 1}. **${s.title || 'Untitled'}** — ${s.upvotes} 👍`).join('\n'),
    );
  }
  await message.reply({ embeds: [embed] });
}

async function handleViewers(message, username) {
  const result = await fetchBotApi('/api/bot/viewers', username);
  if (!result.ok) {
    await message.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(result.message)] });
    return;
  }
  const { viewerCount } = result.data;
  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription(`👀 **${viewerCount}** viewer${viewerCount === 1 ? '' : 's'} currently watching **${username}**'s stream.`),
    ],
  });
}

async function handleJoin(message, username) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    await message.reply('Join a voice channel first, then run this command.');
    return;
  }

  try {
    await joinAndPlay(voiceChannel, username, message.channel);
    await message.reply(`🔊 Joined **${voiceChannel.name}** and started playing **${username}**'s queue.`);
  } catch (err) {
    await message.reply(`Couldn't start playback: ${err.message}`);
  }
}

async function handleLeave(message) {
  const guildId = message.guild?.id;
  if (!guildId) return;
  const wasBot = isBotOwnedSession(guildId);
  const disconnected = forceDisconnect(guildId);
  await message.reply(
    disconnected
      ? (wasBot ? '👋 Left the voice channel and ended the bot session.' : '👋 Left the voice channel.')
      : "I'm not in a voice channel here.",
  );
}

async function handleSkip(message, n = 1) {
  const guildId = message.guild?.id;
  if (!guildId || !isPlaying(guildId)) {
    await message.reply("I'm not currently playing anything here.");
    return;
  }
  if (!isBotOwnedSession(guildId)) {
    await message.reply("Can't skip a human-created stream.");
    return;
  }
  const ok = skip(guildId, n);
  await message.reply(
    ok
      ? n > 1 ? `⏭️ Skipped ${n} tracks.` : '⏭️ Skipped.'
      : "Couldn't skip right now — try again in a moment.",
  );
}

async function handlePause(message, guildId) {
  if (!guildId || !isPlaying(guildId)) {
    await message.reply("I'm not currently playing anything here.");
    return;
  }
  if (!isBotOwnedSession(guildId)) {
    await message.reply("Can't pause a human-created stream.");
    return;
  }
  if (pause(guildId)) {
    await message.reply('⏸️ Paused. Run `!pause` again to resume.');
  } else if (resume(guildId)) {
    await message.reply('▶️ Resumed.');
  } else {
    await message.reply('Nothing to pause or resume right now.');
  }
}

async function handleResume(message, guildId) {
  if (!guildId || !isPlaying(guildId)) {
    await message.reply("I'm not currently playing anything here.");
    return;
  }
  if (!isBotOwnedSession(guildId)) {
    await message.reply("Can't resume a human-created stream.");
    return;
  }
  if (resume(guildId)) {
    await message.reply('▶️ Resumed.');
  } else {
    await message.reply("Nothing paused right now.");
  }
}

async function handleBump(message, guildId, n) {
  if (!isPlaying(guildId) || !isBotOwnedSession(guildId)) {
    await message.reply('No bot session is active.');
    return;
  }
  const ok = bump(guildId, n);
  if (!ok) {
    const queue = getSessionQueue(guildId) || [];
    await message.reply(
      `Position out of range. Queue has ${queue.length} upcoming track${queue.length === 1 ? '' : 's'}.`,
    );
    return;
  }
  const next = (getSessionQueue(guildId) || [])[0];
  await message.reply(`✅ **${next?.title || 'Track'}** will play next.`);
}

async function handleClear(message, guildId) {
  if (!guildId || !isPlaying(guildId)) {
    await message.reply("I'm not currently playing anything here.");
    return;
  }
  if (!isBotOwnedSession(guildId)) {
    await message.reply("Can't clear a human-created stream.");
    return;
  }
  clearQueue(guildId);
  await message.reply('🗑️ Queue cleared — still playing the current track.');
}

// Handles both !play <single query> and !play <playlist URL>.
// Mid-session: adds to queue without restarting.
// No session: starts one and plays immediately.
async function handlePlay(message, query) {
  const guildId = message.guild?.id;
  if (!guildId) return;

  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    await message.reply('Join a voice channel first, then run this command.');
    return;
  }

  const isPlaylist = YT_PLAYLIST_RE.test(query) || SPOTIFY_PLAYLIST_RE.test(query);
  const sessionActive = isPlaying(guildId);

  const thinking = await message.reply(isPlaylist ? '🔎 Loading playlist…' : '🔎 Finding track…');

  if (isPlaylist) {
    // --- Playlist path ---
    // Bot-side guard for mid-session: use in-memory remaining count so the
    // DB count mismatch (played tracks not marked in DB) doesn't block adds.
    if (sessionActive && isBotOwnedSession(guildId)) {
      const queued = getSessionQueue(guildId)?.length ?? 0;
      if (queued >= MAX_BOT_QUEUE) {
        await thinking.edit(
          `❌ Queue is full (${MAX_BOT_QUEUE} songs max). Wait for some tracks to finish first.`,
        );
        return;
      }
    }

    let tracks, botUsername, totalFound;
    try {
      const res = await fetch(`${API_BASE}/api/bot/playlists`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-bot-secret': BOT_INTERNAL_SECRET },
        body: JSON.stringify({ url: query }),
      });
      const body = await res.json();
      if (!res.ok) {
        await thinking.edit(`❌ ${body.message || 'Could not load playlist.'}`);
        return;
      }
      ({ tracks, botUsername, totalFound } = body);
    } catch (err) {
      console.error('!play playlist POST error:', err);
      await thinking.edit('❌ Could not reach EchoDeck. Try again in a moment.');
      return;
    }

    if (sessionActive && isBotOwnedSession(guildId)) {
      appendToQueue(guildId, tracks.map((t) => ({ title: t.title, url: t.url, thumbnail: t.thumbnail })));
      const capped = totalFound > tracks.length;
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('✅ Playlist added to queue')
        .setDescription(
          capped
            ? `Added **${tracks.length}** of **${totalFound}** tracks (queue capped at ${MAX_BOT_QUEUE}).`
            : `Added **${tracks.length}** tracks.`,
        );
      await thinking.edit({ content: '', embeds: [embed] });
      return;
    }

    if (sessionActive && !isBotOwnedSession(guildId)) {
      await thinking.edit(`Already playing a human-created stream. Use \`${COMMAND_PREFIX}leave\` first.`);
      return;
    }

    // No session — pass the full playlist as initialQueue so joinAndPlay never
    // calls fetchQueue (which would overlap with appendToQueue and double-play
    // tracks 1-9).
    try {
      await joinAndPlay(voiceChannel, botUsername, message.channel, {
        isBotOwned: true,
        initialQueue: tracks.map((t) => ({ title: t.title, url: t.url, thumbnail: t.thumbnail })),
      });
    } catch (err) {
      await thinking.edit(`❌ Couldn't start playback: ${err.message}`);
      return;
    }
    const capped = totalFound > tracks.length;
    const playlistEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🎵 Playing playlist')
      .setDescription(
        capped
          ? `**${tracks[0].title || 'Untitled'}** + ${tracks.length - 1} more\n(${tracks.length} of ${totalFound} tracks added — queue capped at ${MAX_BOT_QUEUE})`
          : `**${tracks[0].title || 'Untitled'}** + ${tracks.length - 1} more`,
      )
      .setThumbnail(tracks[0].thumbnail || null)
      .setFooter({ text: `Playing in ${voiceChannel.name} · ${COMMAND_PREFIX}leave to stop` });
    await thinking.edit({ content: '', embeds: [playlistEmbed] });
    return;
  }

  // --- Single track path ---
  // Bot-side guard for mid-session: check in-memory remaining count.
  if (sessionActive && isBotOwnedSession(guildId)) {
    const queued = getSessionQueue(guildId)?.length ?? 0;
    if (queued >= MAX_BOT_QUEUE) {
      await thinking.edit(
        `❌ Queue is full (${MAX_BOT_QUEUE} songs max). Wait for some tracks to finish first.`,
      );
      return;
    }
  }

  let stream, botUsername;
  try {
    const res = await fetch(`${API_BASE}/api/bot/streams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bot-secret': BOT_INTERNAL_SECRET },
      body: JSON.stringify({ query }),
    });
    const body = await res.json();
    if (!res.ok) {
      await thinking.edit(`❌ ${body.message || 'Could not find track.'}`);
      return;
    }
    ({ stream, botUsername } = body);
  } catch (err) {
    console.error('!play single POST error:', err);
    await thinking.edit('❌ Could not reach EchoDeck. Try again in a moment.');
    return;
  }

  if (sessionActive && isBotOwnedSession(guildId)) {
    appendToQueue(guildId, [{ title: stream.title, url: stream.url, thumbnail: stream.smallImg }]);
    const addedEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('✅ Added to queue')
      .setDescription(stream.title || 'Untitled')
      .setThumbnail(stream.smallImg || null);
    await thinking.edit({ content: '', embeds: [addedEmbed] });
    return;
  }

  if (sessionActive && !isBotOwnedSession(guildId)) {
    await thinking.edit(`Already playing a human-created stream. Use \`${COMMAND_PREFIX}leave\` first.`);
    return;
  }

  // No session — start one.
  try {
    await joinAndPlay(voiceChannel, botUsername, message.channel, { isBotOwned: true });
  } catch (err) {
    await thinking.edit(`❌ Couldn't start playback: ${err.message}`);
    return;
  }

  const nowPlayingEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎵 Now Playing')
    .setDescription(stream.title || 'Untitled')
    .setThumbnail(stream.smallImg || null)
    .setFooter({ text: `Playing in ${voiceChannel.name} · ${COMMAND_PREFIX}leave to stop` });
  await thinking.edit({ content: '', embeds: [nowPlayingEmbed] });
}

// Fetch a single track and jump it to the front of the queue (plays right
// after the current track). If no bot session is active, this just starts one.
async function handlePlayNext(message, query) {
  const guildId = message.guild?.id;
  if (!guildId) return;

  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    await message.reply('Join a voice channel first, then run this command.');
    return;
  }

  if (YT_PLAYLIST_RE.test(query) || SPOTIFY_PLAYLIST_RE.test(query)) {
    await message.reply(`\`${COMMAND_PREFIX}playnext\` only supports a single track, not a playlist.`);
    return;
  }

  const sessionActive = isPlaying(guildId);

  if (sessionActive && !isBotOwnedSession(guildId)) {
    await message.reply(`Already playing a human-created stream. Use \`${COMMAND_PREFIX}leave\` first.`);
    return;
  }

  if (sessionActive) {
    const queued = getSessionQueue(guildId)?.length ?? 0;
    if (queued >= MAX_BOT_QUEUE) {
      await message.reply(`❌ Queue is full (${MAX_BOT_QUEUE} songs max). Wait for some tracks to finish first.`);
      return;
    }
  }

  const thinking = await message.reply('🔎 Finding track…');

  let stream, botUsername;
  try {
    const res = await fetch(`${API_BASE}/api/bot/streams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bot-secret': BOT_INTERNAL_SECRET },
      body: JSON.stringify({ query }),
    });
    const body = await res.json();
    if (!res.ok) {
      await thinking.edit(`❌ ${body.message || 'Could not find track.'}`);
      return;
    }
    ({ stream, botUsername } = body);
  } catch (err) {
    console.error('!playnext POST error:', err);
    await thinking.edit('❌ Could not reach EchoDeck. Try again in a moment.');
    return;
  }

  if (sessionActive) {
    insertNext(guildId, [{ title: stream.title, url: stream.url, thumbnail: stream.smallImg }]);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('⏭️ Playing next')
      .setDescription(stream.title || 'Untitled')
      .setThumbnail(stream.smallImg || null);
    await thinking.edit({ content: '', embeds: [embed] });
    return;
  }

  // No session — start one.
  try {
    await joinAndPlay(voiceChannel, botUsername, message.channel, { isBotOwned: true });
  } catch (err) {
    await thinking.edit(`❌ Couldn't start playback: ${err.message}`);
    return;
  }

  const nowPlayingEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎵 Now Playing')
    .setDescription(stream.title || 'Untitled')
    .setThumbnail(stream.smallImg || null)
    .setFooter({ text: `Playing in ${voiceChannel.name} · ${COMMAND_PREFIX}leave to stop` });
  await thinking.edit({ content: '', embeds: [nowPlayingEmbed] });
}

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(COMMAND_PREFIX)) return;

  // Split into the command word and the full remainder (preserves spaces in queries).
  const trimmed = message.content.slice(COMMAND_PREFIX.length).trim();
  const spaceIdx = trimmed.indexOf(' ');
  const rawCommand = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const argText = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();
  const command = rawCommand.toLowerCase();
  const guildId = message.guild?.id;
  // For commands that only need the first word arg (join, nowplaying, etc.)
  const username = argText.split(/\s+/)[0] || '';

  try {
    switch (command) {
      case 'nowplaying':
        if (!username && !isBotOwnedSession(guildId))
          return void (await message.reply({ embeds: [usageEmbed('nowplaying')] }));
        await handleNowPlaying(message, guildId, username);
        break;
      case 'queue':
        await handleQueue(message, guildId, username);
        break;
      case 'viewers':
        if (!username) return void (await message.reply({ embeds: [usageEmbed('viewers')] }));
        await handleViewers(message, username);
        break;
      case 'join':
        if (!username) return void (await message.reply({ embeds: [usageEmbed('join')] }));
        await handleJoin(message, username);
        break;
      case 'play':
        if (!argText) {
          return void (await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xed4245)
                .setDescription(
                  `Usage: \`${COMMAND_PREFIX}play <song name, YouTube URL, or playlist URL>\``,
                ),
            ],
          }));
        }
        await handlePlay(message, argText);
        break;
      case 'playnext': {
        if (!argText) {
          return void (await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xed4245)
                .setDescription(
                  `Usage: \`${COMMAND_PREFIX}playnext <song name or YouTube URL>\` — inserts the track to play right after the current one.`,
                ),
            ],
          }));
        }
        await handlePlayNext(message, argText);
        break;
      }
      case 'skip': {
        const skipN = argText ? parseInt(argText, 10) : 1;
        const skipCount = !isNaN(skipN) && skipN >= 1 ? skipN : 1;
        await handleSkip(message, skipCount);
        break;
      }
      case 'pause':
        await handlePause(message, guildId);
        break;
      case 'resume':
      case 'unpause':
      case 'continue':
        await handleResume(message, guildId);
        break;
      case 'bump': {
        const n = parseInt(argText, 10);
        if (!argText || isNaN(n) || n < 2) {
          return void (await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xed4245)
                .setDescription(
                  `Usage: \`${COMMAND_PREFIX}bump <position>\` — moves that queue position to play next. Position must be 2 or greater.`,
                ),
            ],
          }));
        }
        await handleBump(message, guildId, n);
        break;
      }
      case 'clear':
        await handleClear(message, guildId);
        break;
      case 'leave':
        await handleLeave(message);
        break;
      case 'echo': {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🎵 EchoDeck Bot — Commands')
          .setDescription(
            [
              `\`${COMMAND_PREFIX}play <song / URL / playlist>\` — play or queue a track or playlist`,
              `\`${COMMAND_PREFIX}skip [N]\` — skip 1 or N tracks ahead`,
              `\`${COMMAND_PREFIX}pause\` — pause or resume playback`,
              `\`${COMMAND_PREFIX}resume\` — resume paused playback (aliases: \`unpause\`, \`continue\`)`,
              `\`${COMMAND_PREFIX}bump <N>\` — move queue position N to play next (N ≥ 2)`,
              `\`${COMMAND_PREFIX}clear\` — clear the upcoming queue without leaving`,
              `\`${COMMAND_PREFIX}playnext <song / URL>\` — insert a track to play right after the current one`,
              `\`${COMMAND_PREFIX}queue\` — show upcoming tracks in the bot session`,
              `\`${COMMAND_PREFIX}queue <username>\` — show a user's EchoDeck web queue`,
              `\`${COMMAND_PREFIX}nowplaying\` — what's playing in this session`,
              `\`${COMMAND_PREFIX}nowplaying <username>\` — what someone is streaming on EchoDeck`,
              `\`${COMMAND_PREFIX}viewers <username>\` — viewer count for a stream`,
              `\`${COMMAND_PREFIX}join <username>\` — join voice and play a user's web queue`,
              `\`${COMMAND_PREFIX}leave\` — stop playback and leave the voice channel`,
              `\`${COMMAND_PREFIX}echo\` — show this help`,
            ].join('\n'),
          );
        await message.reply({ embeds: [embed] });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('Command handler error:', err);
    await message.reply('Something went wrong reaching EchoDeck. Try again in a moment.');
  }
});

// Monitor the bot's voice channel for departures. When no non-bot members
// remain, start the grace-period countdown. Cancel it if someone rejoins.
// Only applies to bot-owned sessions — human-created sessions manage their
// own lifecycle through the web app.
client.on('voiceStateUpdate', (oldState, newState) => {
  const guildId = oldState.guild?.id ?? newState.guild?.id;
  if (!guildId) return;
  if (!isPlaying(guildId) || !isBotOwnedSession(guildId)) return;

  // Ignore the bot's own voice state transitions.
  if (oldState.member?.user.bot || newState.member?.user.bot) return;

  const botMember = (oldState.guild ?? newState.guild).members.cache.get(client.user?.id);
  const botChannel = botMember?.voice?.channel;
  if (!botChannel) return;

  const nonBotCount = botChannel.members.filter((m) => !m.user.bot).size;
  if (nonBotCount === 0) {
    startEmptyChannelGrace(guildId);
  } else {
    cancelEmptyChannelGrace(guildId);
  }
});

client.once('clientReady', () => {
  console.log(`EchoDeck bot logged in as ${client.user.tag}`);
});

client.login(DISCORD_TOKEN);
