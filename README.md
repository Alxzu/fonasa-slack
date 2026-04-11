# 🤖 FONASA Slack Bot

Slack bot that automates BPS FONASA invoice generation for professional services in Uruguay. Powered by Playwright browser automation.

## ✨ Features

- 🔐 **Encrypted credentials** — AES-256-GCM with key versioning
- 📋 **Slack modal** for secure credential setup (never in command text)
- 📄 **PDF delivery via DM** — invoices sent directly to your Slack DMs
- 💱 **Auto exchange rate** — fetches USD/UYU from BCU API with retry logic
- 📊 **Telemetry** — p50/p95/p99 duration, success rates, error tracking
- 🔒 **Self-service only** — users can only manage their own profile
- ⚡ **Rate limiting** — 5 invoices/user/hour, max 2 concurrent Playwright runs
- 🛡️ **Error sanitization** — credentials never leak in logs or error messages

## 🚀 Quick Start

### 1. Prerequisites

- [Bun](https://bun.sh) runtime
- [Docker](https://docker.com) (for PostgreSQL)
- A Slack workspace with admin access

### 2. Slack App Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App**
2. Enable **Socket Mode** → generate an `xapp-` token
3. Add **Slash Command**: `/fonasa`
4. Under **OAuth & Permissions**, add scopes:
   - `commands`
   - `chat:write`
   - `files:write`
   - `im:write`
5. Install the app to your workspace → copy the `xoxb-` bot token

### 3. Start the Bot

```bash
# 🐘 Start PostgreSQL
docker compose up -d

# 📦 Install dependencies
bun install

# 🎭 Install Playwright browser
bun run install:browser

# 🔑 Configure environment
cp .env.example .env
# Edit .env with your tokens:
#   SLACK_BOT_TOKEN=xoxb-...
#   SLACK_APP_TOKEN=xapp-...
#   ENCRYPTION_KEY=$(openssl rand -hex 32)
#   DATABASE_URL=postgres://fonasa:fonasa@localhost:5432/fonasa

# 🚀 Run
bun run dev
```

## 💬 Commands

| Command | Description |
|---------|-------------|
| `/fonasa setup` | 📝 Opens a modal to save your BPS credentials (encrypted) |
| `/fonasa @you <amount> [DD/MM/YYYY]` | 📄 Generate an invoice for the given USD amount |
| `/fonasa clear @you` | 🗑️ Delete your saved profile |
| `/fonasa telemetry [days]` | 📊 View usage stats (default: 30 days) |
| `/fonasa help` | ❓ Show available commands |

### 📄 Invoice Generation Example

```
/fonasa @alice 1000
```

⏳ Bot immediately acknowledges → runs Playwright in background → sends PDF + summary to your DMs.

```
/fonasa @alice 1000 01/03/2026
```

📅 Same as above, but uses March 1, 2026 as the payment date (for paying old invoices).

## 🏗️ Architecture

```
src/
├── index.ts           🚀 Entry point (Hono + Socket Mode + graceful shutdown)
├── config.ts          ⚙️ Zod-validated environment config
├── types.ts           📐 Shared TypeScript types
├── logger.ts          📝 Pino structured logging
├── db/
│   ├── index.ts       🐘 PostgreSQL connection (Bun.sql)
│   ├── queries.ts     🔍 Profile + telemetry CRUD
│   └── migrate.ts     📦 Migration runner
├── migrations/
│   └── 001_initial.sql 🗃️ Schema (profiles, invoice_runs, exchange_rate_logs, profile_events)
├── slack/
│   ├── routes.ts      🔀 Command routing with error boundary
│   ├── client.ts      📡 Slack Web API wrapper
│   ├── messages.ts    🎨 Block Kit message builders
│   └── commands/
│       ├── setup.ts   🔐 Modal-based credential setup
│       ├── clear.ts   🗑️ Profile deletion
│       ├── invoice.ts 📄 Invoice generation (ack-first async)
│       ├── telemetry.ts 📊 Usage statistics
│       └── help.ts    ❓ Help text
├── fonasa/
│   └── runner.ts      🎭 Playwright automation (pure function)
└── utils/
    ├── crypto.ts      🔑 AES-256-GCM encrypt/decrypt
    ├── exchange-rate.ts 💱 BCU API fetcher with retry
    ├── date.ts        📅 Date formatting + business day logic
    └── rate-limit.ts  ⚡ In-memory sliding window rate limiter
```

## 🧪 Testing

```bash
bun test          # Run all tests
bun run lint      # Biome lint check
bun run lint:fix  # Auto-fix lint issues
```

## 🐳 Docker

```bash
# Dev (PostgreSQL only)
docker compose up -d

# Full stack (app + PostgreSQL)
docker build -t fonasa-slack .
docker run --env-file .env fonasa-slack
```

## 🔐 Security

- 🔑 Credentials encrypted with **AES-256-GCM** (key versioning for rotation)
- 🪟 Setup via **Slack modal** — credentials never appear in command text or logs
- 🚫 Error messages **sanitized** — credential values stripped before storage
- 📁 Temp PDF files **deleted immediately** after Slack upload
- 🎭 No error screenshots (would capture filled form fields)
- 🔒 Only profile owners can setup/clear/invoke their own profile

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_BOT_TOKEN` | ✅ | Bot token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | ✅ | App token for Socket Mode (`xapp-...`) |
| `ENCRYPTION_KEY` | ✅ | 64-char hex key (`openssl rand -hex 32`) |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `EXCHANGE_RATE_API` | ❌ | Custom BCU API endpoint |
| `PORT` | ❌ | Health check port (default: `3001`) |
| `LOG_LEVEL` | ❌ | `debug` \| `info` \| `warn` \| `error` (default: `info`) |
