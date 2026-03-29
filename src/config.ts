import { z } from 'zod';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_GUILD_ID: z.string().min(1, 'DISCORD_GUILD_ID is required'),
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),
  ALLOWED_ROLE_IDS: z.string().min(1, 'ALLOWED_ROLE_IDS is required'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

export const config = {
  discordToken: env.DISCORD_TOKEN,
  clientId: env.DISCORD_CLIENT_ID,
  guildId: env.DISCORD_GUILD_ID,
  githubToken: env.GITHUB_TOKEN,
  allowedRoleIds: new Set(
    env.ALLOWED_ROLE_IDS.split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  ),
} as const;
