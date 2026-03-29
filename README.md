# Discord GitHub Issue Bot

A Discord bot that creates GitHub issues via a `/issue` slash command with autocomplete for repos and labels.

## Features

- `/issue` slash command with a modal form for title and description
- Autocomplete for repos (fetched from your GitHub token's access) and labels (per-repo)
- Role-based permissions — only allowed Discord roles can create issues
- Lightweight Docker image for production

## Setup

### 1. Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, give it a name, and create it
3. Copy the **Application ID** from **General Information** — this is your `DISCORD_CLIENT_ID`
4. Go to **Bot** in the sidebar
5. Click **Reset Token** and copy the **Bot Token** (not the OAuth2 Client Secret) — this is your `DISCORD_TOKEN`

### 2. Invite the bot

1. Go to **OAuth2** in the sidebar
2. Under **OAuth2 URL Generator**, select the `bot` and `applications.commands` scopes
3. Under **Bot Permissions**, select `Send Messages` and `Use Slash Commands`
4. Open the generated URL to invite the bot to your server

### 3. Get your Guild and Role IDs

1. In Discord, enable **Developer Mode** (Settings > Advanced)
2. Right-click your server name > **Copy Server ID** — this is your `DISCORD_GUILD_ID`
3. Right-click the role(s) to allow > **Copy Role ID** — comma-separate for `ALLOWED_ROLE_IDS`

### 4. Create a GitHub Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Generate a **classic** token with the `repo` scope, or a **fine-grained** token with **Issues: Read and write**

### 5. Configure

```bash
cp .env.example .env
```

Fill in all values. See `.env.example` for reference.

## Development

```bash
pnpm install
pnpm dev
```

## Production

```bash
docker compose up -d --build
```

Or without Compose:

```bash
docker build -t discord-issue-bot .
docker run --env-file .env discord-issue-bot
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Run locally with hot reload |
| `pnpm build` | Bundle for production |
| `pnpm start` | Run the production bundle |
| `pnpm typecheck` | Type check without emitting |
| `pnpm check` | Lint and format with Biome |
| `pnpm docker:up` | Build and start with Docker Compose |
| `pnpm docker:down` | Stop Docker Compose services |
| `pnpm docker:logs` | Tail container logs |
| `pnpm docker:build` | Build the Docker image standalone |
| `pnpm docker:restart` | Restart Docker Compose services |
