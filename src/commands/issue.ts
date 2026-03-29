import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  LabelBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { createIssue, listLabels, listRepos } from '../services/github';
import logger from '../utils/logger';
import { hasRequiredRole } from '../utils/permissions';

function parseRepo(input: string): [owner: string, repo: string] | null {
  const parts = input.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

function parseLabels(input: string | undefined): string[] | undefined {
  if (!input) return undefined;
  const labels = input
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean);
  return labels.length ? labels : undefined;
}

const ERROR_MESSAGES: Record<number, string> = {
  401: 'GitHub authentication failed. Contact the bot administrator.',
  403: 'GitHub authentication failed. Contact the bot administrator.',
  404: "Repository not found, or the bot's GitHub token doesn't have access.",
  422: 'Validation failed. Check that labels exist and the title is valid.',
};

function createCache<T>(ttl: number) {
  let data: T | undefined;
  let time = 0;

  return {
    get: () => (Date.now() - time < ttl ? data : undefined),
    set: (value: T) => {
      data = value;
      time = Date.now();
    },
    stale: () => data,
  };
}

const repoCache = createCache<string[]>(5 * 60 * 1000);
const labelCaches = new Map<string, ReturnType<typeof createCache<string[]>>>();

function getLabelCache(key: string) {
  let cache = labelCaches.get(key);
  if (!cache) {
    cache = createCache<string[]>(2 * 60 * 1000);
    labelCaches.set(key, cache);
  }
  return cache;
}

export const data = new SlashCommandBuilder()
  .setName('issue')
  .setDescription('Create a GitHub issue')
  .addStringOption((opt) =>
    opt.setName('repo').setDescription('GitHub repo (owner/repo)').setRequired(true).setAutocomplete(true),
  )
  .addStringOption((opt) =>
    opt.setName('labels').setDescription('Comma-separated labels').setRequired(false).setAutocomplete(true),
  );

async function autocompleteRepo(focused: string): Promise<{ name: string; value: string }[]> {
  if (!repoCache.get()) {
    try {
      repoCache.set(await listRepos());
    } catch {
      // use stale cache
    }
  }

  const repos = repoCache.get() ?? repoCache.stale() ?? [];
  const query = focused.toLowerCase();
  return repos
    .filter((r) => r.toLowerCase().includes(query))
    .slice(0, 25)
    .map((r) => ({ name: r, value: r }));
}

async function autocompleteLabels(repoInput: string, focused: string): Promise<{ name: string; value: string }[]> {
  const parsed = parseRepo(repoInput);
  if (!parsed) return [];

  const [owner, repo] = parsed;
  const cache = getLabelCache(`${owner}/${repo}`);

  if (!cache.get()) {
    try {
      cache.set(await listLabels(owner, repo));
    } catch {
      // use stale cache
    }
  }

  const labels = cache.get() ?? cache.stale() ?? [];

  const lastComma = focused.lastIndexOf(',');
  const prefix = lastComma >= 0 ? `${focused.slice(0, lastComma + 1)} ` : '';
  const current = (lastComma >= 0 ? focused.slice(lastComma + 1) : focused).trim().toLowerCase();
  const alreadySelected = new Set(
    focused
      .split(',')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean),
  );

  return labels
    .filter((l) => l.toLowerCase().includes(current) && !alreadySelected.has(l.toLowerCase()))
    .slice(0, 25)
    .map((l) => ({ name: `${prefix}${l}`, value: `${prefix}${l}` }));
}

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);

  if (focused.name === 'repo') {
    return void (await interaction.respond(await autocompleteRepo(focused.value)));
  }

  if (focused.name === 'labels') {
    const repoInput = interaction.options.getString('repo') ?? '';
    return void (await interaction.respond(await autocompleteLabels(repoInput, focused.value)));
  }
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!hasRequiredRole(interaction)) {
    await interaction.reply({
      content: "You don't have permission to use this command.",
      ephemeral: true,
    });
    return;
  }

  const repoInput = interaction.options.getString('repo', true);
  if (!parseRepo(repoInput)) {
    await interaction.reply({ content: 'Invalid repo format. Use `owner/repo`.', ephemeral: true });
    return;
  }

  const labelsInput = interaction.options.getString('labels') ?? '';

  const modal = new ModalBuilder()
    .setCustomId(`issue-modal:${repoInput}:${labelsInput}`)
    .setTitle(`New issue — ${repoInput}`);

  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel('Title')
      .setTextInputComponent(
        new TextInputBuilder().setCustomId('title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(256),
      ),
    new LabelBuilder()
      .setLabel('Description')
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId('body')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(4000),
      ),
  );

  await interaction.showModal(modal);
}

export async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const [, repoInput, labelsInput] = interaction.customId.split(':');
  const [owner, repo] = repoInput.split('/');
  const title = interaction.fields.getTextInputValue('title');
  const body = interaction.fields.getTextInputValue('body') || undefined;
  const labels = parseLabels(labelsInput);

  await interaction.deferReply();

  try {
    const result = await createIssue({ owner, repo, title, body, labels });

    const descriptionParts = [`**Repo:** ${owner}/${repo}`];
    if (body) descriptionParts.push(`**Body:** ${body.length > 100 ? `${body.slice(0, 100)}...` : body}`);
    if (labels?.length) descriptionParts.push(`**Labels:** ${labels.join(', ')}`);

    const embed = new EmbedBuilder()
      .setColor(0x238636)
      .setTitle(`#${result.number} — ${title}`)
      .setURL(result.htmlUrl)
      .setDescription(descriptionParts.join('\n'));

    await interaction.editReply({ embeds: [embed] });
    logger.info({ repo: `${owner}/${repo}`, issue: result.number, user: interaction.user.tag }, 'Issue created');
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    const message =
      (status != null ? ERROR_MESSAGES[status] : undefined) ?? 'Failed to create issue. Please try again later.';

    await interaction.editReply(message);
    logger.error({ err, repo: `${owner}/${repo}`, status }, 'Failed to create issue');
  }
}
