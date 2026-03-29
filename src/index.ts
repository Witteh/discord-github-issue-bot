import { createServer } from 'node:http';
import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import {
  autocomplete as issueAutocomplete,
  data as issueData,
  execute as issueExecute,
  handleModal as issueHandleModal,
} from './commands/issue';
import { config } from './config';
import logger from './utils/logger';

const commands = [issueData.toJSON()];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  try {
    const rest = new REST().setToken(config.discordToken);
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: commands,
    });
    logger.info({ user: c.user.tag }, 'Bot ready, commands registered');
  } catch (err) {
    logger.error({ err }, 'Failed to register commands');
    process.exit(1);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete() && interaction.commandName === issueData.name) {
      await issueAutocomplete(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === issueData.name) {
      await issueExecute(interaction);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('issue-modal:')) {
      await issueHandleModal(interaction);
      return;
    }
  } catch (err) {
    logger.error({ err }, 'Unhandled error in interaction');

    if ((interaction.isChatInputCommand() || interaction.isModalSubmit()) && !interaction.replied) {
      const respond = interaction.deferred
        ? interaction.editReply.bind(interaction)
        : interaction.reply.bind(interaction);
      await respond({ content: 'An unexpected error occurred.' }).catch(() => {});
    }
  }
});

const healthServer = createServer((_req, res) => {
  const ok = client.ws.status === 0;
  res.writeHead(ok ? 200 : 503);
  res.end(ok ? 'ok' : 'unavailable');
});
healthServer.listen(8080, () => logger.info('Health server listening on :8080'));

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled rejection');
});

function shutdown() {
  logger.info('Shutting down');
  healthServer.close();
  client.destroy();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

client.login(config.discordToken);
