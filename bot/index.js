import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, EmbedBuilder } from 'discord.js';
import {
  joinAndPlay,
  stop,
  isPlaying,
  isBotOwnedSession,
  startEmptyChannelGrace,
  cancelEmptyChannelGrace,
} from './voice.js';

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const API_BASE = process.env.ECHODECK_API_BASE || 'http://app:3002';
const COMMAND_PREFIX = process.env.BOT_COMMAND_PREFIX || '!';
const BOT_INTERNAL_SECRET = process.env.BOT_INTERNAL_SECRET;

if (!DISCORD_TOKEN) {
  throw new Error('DISCORD_BOT_TOKEN environment variable is required');
}

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

async function handleNowPlaying(message, username) {
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

async function handleQueue(message, username) {
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
  if (!guildId || !isPlaying(guildId)) {
    await message.reply("I'm not currently playing anything here.");
    return;
  }
  // Only end a bot-owned stream from !leave; human-created streams are not
  // the bot's to tear down (the web app manages their lifecycle).
  if (!isBotOwnedSession(guildId)) {
    stop(guildId);
    await message.reply('👋 Left the voice channel.');
    return;
  }
  stop(guildId);
  await message.reply('👋 Left the voice channel and ended the bot session.');
}

async function handleCreate(message, query) {
  const guildId = message.guild?.id;
  if (!guildId) return;

  if (isPlaying(guildId)) {
    await message.reply(
      `Already playing in this server. Use \`${COMMAND_PREFIX}leave\` first, then run \`${COMMAND_PREFIX}create\` again.`,
    );
    return;
  }

  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) {
    await message.reply('Join a voice channel first, then run this command.');
    return;
  }

  const thinking = await message.reply('🔎 Finding track…');

  let stream, botUsername;
  try {
    const res = await fetch(`${API_BASE}/api/bot/streams`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bot-secret': BOT_INTERNAL_SECRET,
      },
      body: JSON.stringify({ query }),
    });
    const body = await res.json();
    if (!res.ok) {
      await thinking.edit(`❌ ${body.message || 'Could not create stream.'}`);
      return;
    }
    ({ stream, botUsername } = body);
  } catch (err) {
    console.error('!create POST /api/bot/streams error:', err);
    await thinking.edit('❌ Could not reach EchoDeck. Try again in a moment.');
    return;
  }

  try {
    await joinAndPlay(voiceChannel, botUsername, message.channel, { isBotOwned: true });
  } catch (err) {
    await thinking.edit(`❌ Couldn't start playback: ${err.message}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎵 Now Playing')
    .setDescription(stream.title || 'Untitled')
    .setThumbnail(stream.smallImg || null)
    .setFooter({ text: `Playing in ${voiceChannel.name} · ${COMMAND_PREFIX}leave to stop` });

  await thinking.edit({ content: '', embeds: [embed] });
}

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(COMMAND_PREFIX)) return;

  // Split into the command word and the full remainder (preserves spaces in queries).
  const trimmed = message.content.slice(COMMAND_PREFIX.length).trim();
  const spaceIdx = trimmed.indexOf(' ');
  const rawCommand = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const argText = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();
  const command = rawCommand.toLowerCase();
  // For commands that only need the first word arg (join, nowplaying, etc.)
  const username = argText.split(/\s+/)[0] || '';

  try {
    switch (command) {
      case 'nowplaying':
        if (!username) return void (await message.reply({ embeds: [usageEmbed('nowplaying')] }));
        await handleNowPlaying(message, username);
        break;
      case 'queue':
        if (!username) return void (await message.reply({ embeds: [usageEmbed('queue')] }));
        await handleQueue(message, username);
        break;
      case 'viewers':
        if (!username) return void (await message.reply({ embeds: [usageEmbed('viewers')] }));
        await handleViewers(message, username);
        break;
      case 'join':
        if (!username) return void (await message.reply({ embeds: [usageEmbed('join')] }));
        await handleJoin(message, username);
        break;
      case 'create':
        if (!argText) {
          return void (await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xed4245)
                .setDescription(
                  `Usage: \`${COMMAND_PREFIX}create <song name, artist, or YouTube/Spotify URL>\``,
                ),
            ],
          }));
        }
        await handleCreate(message, argText);
        break;
      case 'leave':
        await handleLeave(message);
        break;
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
