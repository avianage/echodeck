import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, EmbedBuilder } from 'discord.js';
import { joinAndPlay, stop, isPlaying } from './voice.js';

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const API_BASE = process.env.ECHODECK_API_BASE || 'http://app:3002';
const COMMAND_PREFIX = process.env.BOT_COMMAND_PREFIX || '!';

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
  const res = await fetch(url);
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
  stop(guildId);
  await message.reply('👋 Left the voice channel.');
}

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(COMMAND_PREFIX)) return;

  const [rawCommand, username] = message.content.slice(COMMAND_PREFIX.length).trim().split(/\s+/);
  const command = rawCommand?.toLowerCase();

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

client.once('clientReady', () => {
  console.log(`EchoDeck bot logged in as ${client.user.tag}`);
});

client.login(DISCORD_TOKEN);
