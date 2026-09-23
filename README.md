# Expense Bot

An AI-powered personal finance assistant for Telegram. Record income and expenses naturally via text or voice, get detailed reports, and manage your finances through conversation.

## Features

- **Natural language** transaction recording ("Spent ₦15,000 on fuel")
- **Voice notes** — send a voice message, bot transcribes and records it
- **Smart categorization** — AI classifies your transactions automatically
- **Reports** — PDF and CSV exports for any date range
- **Budgets** — track spending against limits with alerts
- **Recurring transactions** — auto-record salary, rent, etc.
- **Multi-currency** — NGN, USD, EUR, GBP, GHS, KES, RWF
- **Financial queries** — ask questions in plain English
- **REST API** — designed for future web/mobile dashboard

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 (TypeScript) |
| HTTP Framework | Fastify |
| Telegram Bot | Grammy |
| Database | PostgreSQL + Prisma ORM |
| Cache / Queue | Redis + BullMQ |
| AI | DeepSeek (OpenAI-compatible) |
| Speech-to-Text | OpenAI Whisper (pluggable) |
| Validation | Zod |
| Logging | Pino |
| Testing | Vitest |
| Deployment | PM2 / systemd / Railway / Render |

## Project Structure

```
src/
├── config/              # Environment config with Zod validation
├── shared/
│   ├── errors/          # Typed error classes
│   ├── logger/          # Pino logger
│   ├── types/           # Shared TypeScript types (currencies, etc.)
│   └── utils/
│       ├── money.ts     # Safe integer money arithmetic
│       └── date.ts      # Natural-language date parsing
├── infrastructure/
│   ├── database/        # Prisma client singleton
│   ├── redis/           # Redis client
│   └── telegram/        # Grammy bot instance
├── modules/
│   ├── users/           # User service and repository
│   ├── transactions/    # Transaction CRUD (Phase 2)
│   ├── categories/      # Category management (Phase 2)
│   ├── ai/              # AI intent parsing (Phase 3)
│   ├── telegram/        # Bot handlers
│   └── voice/           # Voice transcription (Phase 4)
├── routes/              # Fastify routes (HTTP API)
├── middleware/          # Error handler, auth
├── jobs/               # BullMQ background jobs
└── server.ts           # Entry point
prisma/
├── schema.prisma        # Database schema
└── seed.ts              # Default categories + test data
tests/
├── unit/               # Pure unit tests
└── integration/        # DB/API integration tests
```

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 15+
- Redis 7+
- A Telegram Bot token (from [@BotFather](https://t.me/BotFather))
- A DeepSeek API key

### Setup

```bash
# 1. Clone and install
git clone <repo>
cd expense-bot
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 3. Set up database
npm run prisma:migrate
npm run prisma:seed

# 4. Start in development
npm run dev
```

### Production Deployment

The app is a standard Node.js process — deploy it anywhere that can run Node.js.

#### Using PM2 (recommended for VPS)

```bash
npm install -g pm2

# Build first
npm run build

# Run migrations
npm run prisma:migrate:prod
npm run prisma:seed

# Start with PM2
pm2 start dist/server.js --name expense-bot
pm2 save
pm2 startup   # auto-start on reboot
```

#### Railway / Render / Fly.io

Set all environment variables in the platform dashboard, then connect your repo. The build command is `npm run build` and the start command is `npm start`.

For webhook mode on these platforms:
1. Set `TELEGRAM_MODE=webhook`
2. Set `APP_URL` to your deployed URL
3. Set a strong random `TELEGRAM_WEBHOOK_SECRET`

#### VPS (Ubuntu/Debian) with systemd

```bash
# /etc/systemd/system/expense-bot.service
[Unit]
Description=Expense Bot
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/expense-bot
ExecStart=/usr/bin/node dist/server.js
Restart=always
EnvironmentFile=/home/ubuntu/expense-bot/.env
User=ubuntu

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable expense-bot
sudo systemctl start expense-bot
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `TELEGRAM_BOT_TOKEN` | ✅ | From @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | For webhooks | Random secret for webhook validation |
| `TELEGRAM_MODE` | | `polling` (dev) or `webhook` (prod) |
| `DEEPSEEK_API_KEY` | For AI features | DeepSeek API key |
| `AI_MODEL` | | Default: `deepseek-chat` |
| `STT_PROVIDER` | | `openai` or `mock` |
| `STT_API_KEY` | For voice | OpenAI API key for Whisper |
| `APP_URL` | For webhooks | Your public HTTPS URL |
| `DEFAULT_CURRENCY` | | Default: `NGN` |
| `DEFAULT_TIMEZONE` | | Default: `Africa/Lagos` |
| `ENCRYPTION_KEY` | | 32-char key for sensitive data |

## Telegram Bot Setup

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the token into `TELEGRAM_BOT_TOKEN`
4. For production webhook: set `APP_URL` and `TELEGRAM_MODE=webhook`

## Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Done | Project setup, architecture, schema, logging, health endpoint |
| 2 | Planned | Users, categories, basic transaction CRUD |
| 3 | Planned | DeepSeek AI integration, intent parsing |
| 4 | Planned | Voice notes, speech-to-text |
| 5 | Planned | Analytics, balance, budgets, reminders |
| 6 | Planned | PDF/CSV report generation |
| 7 | Planned | Security hardening, rate limits, audit logs |
| 8 | Planned | Full test suite |
| 9 | Planned | Production deployment docs (PM2/Railway/systemd) |

## Available Commands

```bash
npm run dev              # Start development server with hot reload
npm run build            # Compile TypeScript
npm run start            # Start production server
npm run test             # Run test suite
npm run test:watch       # Watch mode for tests
npm run test:coverage    # Coverage report
npm run typecheck        # TypeScript type checking only
npm run lint             # ESLint
npm run format           # Prettier

npm run prisma:generate  # Regenerate Prisma client
npm run prisma:migrate   # Run database migrations (dev)
npm run prisma:migrate:prod  # Deploy migrations (production)
npm run prisma:seed      # Seed default data
npm run prisma:studio    # Open Prisma Studio UI
```

## Money Handling

All monetary amounts are stored as **integer minor units** to avoid floating-point errors:

- ₦15,000 → `1500000` kobo
- $100.00 → `10000` cents
- RWF 5,000 → `5000` (no subunit)

The `src/shared/utils/money.ts` module handles all conversions safely.

## Security

- Telegram user IDs (not usernames) are used as primary identity
- All queries enforce `userId` ownership — users cannot access others' data
- Webhook requests are validated with a secret token
- Passwords/API keys are redacted from logs
- Soft-deletion: data is never permanently destroyed without explicit confirmation

## API

The REST API is at `/api/v1`. Authentication will be added in Phase 7.

```
GET  /health          — Liveness probe
GET  /health/ready    — Readiness probe (checks DB + Redis)
POST /webhooks/telegram  — Telegram webhook endpoint
GET  /api/v1/...      — REST API (Phase 2+)
```

## License

MIT
