import type { ChatInputCommandInteraction } from 'discord.js';
import { config } from '../config';

export function hasRequiredRole(interaction: ChatInputCommandInteraction): boolean {
  if (!interaction.inGuild()) return false;

  const member = interaction.member;
  if (!('cache' in member.roles)) return false;

  return member.roles.cache.some((role) => config.allowedRoleIds.has(role.id));
}
